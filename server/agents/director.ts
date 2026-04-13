import type { AgentContext, DirectorOutput, DecisionEvidenceLog, SignalExtractionResult } from "./types";
import { RDSBand, SignalQuality, computeRDS, classifyRDSBand, mapCompetencyEvidence } from "./types";
import type { KPIs, SimulationState, TurnResponse, HistoryEntry, DecisionPoint } from "@shared/schema";
import { evaluateDecision } from "./evaluator";
import { calculateKPIImpact } from "./domainExpert";
import { generateNarrative } from "./narrator";
import { classifyInput, type ClassificationContext } from "./inputValidator";
import { extractSignals } from "./signalExtractor";
import { generateChatCompletion, SupportedModel } from "../openai";
import { HARD_PROHIBITIONS, MENTOR_TONE, MISUSE_HANDLING, getLanguageDirective } from "./guardrails";
import { storage } from "../storage";

const MAX_REVISIONS = 2;

export const DEFAULT_DIRECTOR_PROMPT = `Eres un INTÉRPRETE DE INTENCIÓN para un juego de simulación empresarial inmersivo.

${HARD_PROHIBITIONS}

${MENTOR_TONE}

${MISUSE_HANDLING}

TU MISIÓN CRÍTICA: Aceptar e interpretar virtualmente CUALQUIER COSA que el estudiante diga como una decisión o acción válida dentro del contexto de la simulación. NO eres un guardián - eres un intérprete creativo.

PRINCIPIOS FUNDAMENTALES:
1. ASUME INTENCIÓN POSITIVA - El estudiante está tratando de participar en la simulación
2. SÉ MÁXIMAMENTE PERMISIVO - Acepta errores de escritura, lenguaje casual, oraciones parciales, ideas no convencionales
3. INTERPRETA CREATIVAMENTE - Encuentra la decisión empresarial oculta en cualquier declaración
4. NUNCA RECHACES - Transforma entradas poco claras en interpretaciones accionables

FORMATO DE SALIDA (solo JSON):
{
  "isValid": true,
  "interpretedAction": "<descripción clara de lo que el estudiante está tratando de hacer>",
  "confidence": "high" | "medium" | "low"
}

Para el caso extremadamente raro de inválido:
{
  "isValid": false,
  "helpfulPrompt": "<pregunta atractiva para regresarlos al camino>"
}`;

async function interpretIntent(
  input: string,
  history: HistoryEntry[],
  scenario: { title: string; context: string },
  options?: { customPrompt?: string; model?: SupportedModel; sessionId?: string; language?: "es" | "en" }
): Promise<{ isValid: boolean; interpretedAction?: string; helpfulPrompt?: string }> {
  try {
    const recentContext = history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");
    const basePrompt = options?.customPrompt || DEFAULT_DIRECTOR_PROMPT;
    const systemPrompt = basePrompt + getLanguageDirective(options?.language);
    
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `
SCENARIO: ${scenario.title}
SCENARIO CONTEXT: ${scenario.context}

RECENT CONVERSATION:
${recentContext}

STUDENT'S LATEST INPUT: "${input}"

Interpret this input as a simulation action. Find the business decision in their words.` },
      ],
      { responseFormat: "json", maxTokens: 256, model: "gpt-4o-mini", agentName: "director", sessionId: options?.sessionId ? parseInt(options.sessionId) : undefined }
    );
    
    const parsed = JSON.parse(response);
    
    if (parsed.isValid === false && parsed.helpfulPrompt) {
      return { isValid: false, helpfulPrompt: parsed.helpfulPrompt };
    }
    
    return { 
      isValid: true, 
      interpretedAction: parsed.interpretedAction || input 
    };
  } catch {
    return { isValid: true, interpretedAction: input };
  }
}

function applyKPIDeltas(currentKpis: KPIs, deltas: Record<string, number>): KPIs {
  const newKpis: KPIs = { ...currentKpis };

  if (deltas.revenue) {
    newKpis.revenue = Math.max(0, currentKpis.revenue + deltas.revenue);
  }
  if (deltas.morale !== undefined) {
    newKpis.morale = Math.max(0, Math.min(100, currentKpis.morale + deltas.morale));
  }
  if (deltas.reputation !== undefined) {
    newKpis.reputation = Math.max(0, Math.min(100, currentKpis.reputation + deltas.reputation));
  }
  if (deltas.efficiency !== undefined) {
    newKpis.efficiency = Math.max(0, Math.min(100, currentKpis.efficiency + deltas.efficiency));
  }
  if (deltas.trust !== undefined) {
    newKpis.trust = Math.max(0, Math.min(100, currentKpis.trust + deltas.trust));
  }

  return newKpis;
}

function checkGameOver(kpis: KPIs, context?: AgentContext): boolean {
  const kpiGameOver = (
    kpis.morale < 20 ||
    kpis.reputation < 20 ||
    kpis.efficiency < 20 ||
    kpis.trust < 20 ||
    kpis.revenue < 10000
  );
  return kpiGameOver;
}

function validateReflection(input: string, language?: "es" | "en"): { isValid: boolean; message?: string } {
  const trimmed = input.trim();
  const isEn = language === "en";
  
  if (trimmed.length < 3) {
    return { 
      isValid: false, 
      message: isEn ? "Please share a brief reflection on your experience." : "Por favor, comparte una breve reflexión sobre tu experiencia." 
    };
  }
  
  const OFFENSIVE_PATTERNS = [
    /\b(mierda|puta|puto|cabrón|cabron|hijo\s*de\s*puta|verga|chingar|pinche|culero|joto|marica|maricón|maricon|zorra)\b/i,
    /\b(fuck|fucking|bitch|bastard|dick|cock|pussy|cunt|retard)\b/i,
    /\b(kill\s*(yourself|urself)|kys|die|hate\s*you)\b/i,
  ];
  
  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { 
        isValid: false, 
        message: isEn ? "Please share a respectful reflection on your experience." : "Por favor, comparte una reflexión respetuosa sobre tu experiencia." 
      };
    }
  }
  
  const NONSENSE_PATTERNS = [
    /^[a-z]{1,2}$/i,
    /^(asdf|qwer|zxcv|hjkl)+$/i,
    /^[^a-záéíóúñü\s]{10,}$/i,
    /^(.)\1{6,}$/i,
  ];
  
  for (const pattern of NONSENSE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { 
        isValid: false, 
        message: isEn ? "Please share your thoughts about the simulation." : "Por favor, comparte tus pensamientos sobre la simulación." 
      };
    }
  }
  
  return { isValid: true };
}

export async function processReflection(
  context: AgentContext
): Promise<DirectorOutput> {
  const validation = validateReflection(context.studentInput, context.language);
  const isEn = context.language === "en";
  
  if (!validation.isValid) {
    const updatedHistory: HistoryEntry[] = [
      ...context.history as HistoryEntry[],
      {
        role: "user",
        content: context.studentInput,
        timestamp: new Date().toISOString(),
      },
      {
        role: "system",
        content: validation.message || (isEn ? "Please share a reflection on your experience." : "Por favor, comparte una reflexión sobre tu experiencia."),
        timestamp: new Date().toISOString(),
      },
    ];
    
    return {
      narrative: {
        text: validation.message || (isEn ? "Please share a reflection on your experience." : "Por favor, comparte una reflexión sobre tu experiencia."),
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: "",
      },
      isGameOver: false,
      turnStatus: "block",
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        indicators: context.indicators,
        history: updatedHistory,
        flags: [],
        rubricScores: {},
        currentDecision: context.currentDecision,
        isComplete: false,
        isReflectionStep: true,
        reflectionCompleted: false,
        pendingRevision: false,
        revisionAttempts: 0,
      },
    };
  }
  
  const optionalNudge = isEn
    ? "If you'd like, add 1 learning and 1 thing you'd do differently."
    : "Si quieres, añade 1 aprendizaje y 1 cosa que harías distinto.";
  
  const completionMessage = isEn
    ? `Thank you for sharing your reflection! You have completed the simulation.\n\n${context.studentInput.length < 50 ? optionalNudge : ""}\n\nYour perspective is valuable to the learning process.`
    : `¡Gracias por compartir tu reflexión! Has completado la simulación.\n\n${context.studentInput.length < 50 ? optionalNudge : ""}\n\nTu perspectiva es valiosa para el proceso de aprendizaje.`;

  const newHistory: HistoryEntry[] = [
    ...context.history as HistoryEntry[],
    {
      role: "user",
      content: context.studentInput,
      timestamp: new Date().toISOString(),
    },
    {
      role: "system",
      content: completionMessage,
      timestamp: new Date().toISOString(),
    },
  ];
  
  return {
    narrative: {
      text: completionMessage,
      mood: "positive",
    },
    kpiUpdates: {},
    feedback: {
      score: 100,
      message: isEn ? "Reflection completed" : "Reflexión completada",
    },
    isGameOver: true,
    turnStatus: "pass",
    updatedState: {
      turnCount: context.turnCount + 1,
      kpis: context.currentKpis,
      indicators: context.indicators,
      history: newHistory,
      flags: [],
      rubricScores: {},
      currentDecision: context.currentDecision,
      isComplete: true,
      isReflectionStep: false,
      reflectionCompleted: true,
      pendingRevision: false,
      revisionAttempts: 0,
    },
  };
}

function resolveOptionSignature(
  studentInput: string,
  decisionPoint?: DecisionPoint,
): import("@shared/schema").TradeoffSignature | undefined {
  if (!decisionPoint) return undefined;

  const optionSignatures = decisionPoint.optionSignatures;
  if (optionSignatures) {
    const trimmed = studentInput.trim().toLowerCase();
    for (const [optionKey, signature] of Object.entries(optionSignatures)) {
      if (trimmed === optionKey.toLowerCase() || trimmed.includes(optionKey.toLowerCase())) {
        return signature;
      }
    }
    const options = decisionPoint.options || [];
    for (let i = 0; i < options.length; i++) {
      const optText = options[i].toLowerCase();
      if (trimmed === optText || trimmed.includes(optText) || optText.includes(trimmed)) {
        const sig = optionSignatures[options[i]] || optionSignatures[String(i)] || optionSignatures[String(i + 1)];
        if (sig) return sig;
      }
    }
  }

  return decisionPoint.tradeoffSignature;
}

function buildMcqSignals(studentInput: string, decisionPoint?: DecisionPoint): SignalExtractionResult {
  const tradeoffSignature = resolveOptionSignature(studentInput, decisionPoint);
  const hasTradeoff = tradeoffSignature &&
    tradeoffSignature.dimension && tradeoffSignature.cost && tradeoffSignature.benefit;
  const absent = { quality: SignalQuality.ABSENT, extracted_text: "" };

  return {
    intent: absent,
    justification: absent,
    tradeoffAwareness: hasTradeoff
      ? {
          quality: SignalQuality.PRESENT,
          extracted_text: `${tradeoffSignature.dimension}: ${tradeoffSignature.cost} vs ${tradeoffSignature.benefit}`,
        }
      : absent,
    stakeholderAwareness: absent,
    ethicalAwareness: absent,
  };
}

export async function processStudentTurn(
  context: AgentContext,
  revisionAttempts: number = 0
): Promise<DirectorOutput> {
  const isEn = context.language === "en";
  const currentDecisionNum = context.currentDecision || context.turnCount + 1;
  const totalDecisions = context.totalDecisions || 0;
  const decisionPoint = context.decisionPoints?.find(dp => dp.number === currentDecisionNum);
  const isMcq = decisionPoint?.format === "multiple_choice";

  const recentHistory = (context.history as HistoryEntry[])
    .slice(-4)
    .map(h => `${h.role}: ${h.content}`)
    .join("\n");

  const nudgeCounters = context.nudgeCounters || {};
  const currentNudgeCount = nudgeCounters[currentDecisionNum] || 0;

  const classificationStart = Date.now();
  const classificationResult = await classifyInput(
    context.studentInput,
    {
      title: context.scenario.title,
      objective: context.scenario.objective,
      recentHistory,
      decisionPrompt: decisionPoint?.prompt,
      nudgeCount: currentNudgeCount,
      currentDecision: currentDecisionNum,
      isMcq,
    },
    { model: context.llmModel, language: context.language }
  );

  storage.createTurnEvent({
    sessionId: context.sessionId,
    eventType: "agent_call",
    turnNumber: currentDecisionNum,
    rawStudentInput: context.studentInput,
    eventData: {
      agentName: "inputClassifier",
      durationMs: Date.now() - classificationStart,
      classification: classificationResult.classification,
      block_reason: classificationResult.block_reason,
      rationale: classificationResult.classification_rationale,
      integrity_flag: classificationResult.integrity_flag,
      nudgeCount: currentNudgeCount,
    },
  }).catch(err => console.error("[TurnEvent] Failed to log inputClassifier agent_call:", err));

  if (classificationResult.classification === "BLOCK") {
    const redirectMsg = classificationResult.redirect_message ||
      (isEn ? "Please share your perspective on the decision you're facing." : "Por favor, comparte tu perspectiva sobre la decisión que enfrentas.");

    const updatedHistory: HistoryEntry[] = [
      ...context.history as HistoryEntry[],
      {
        role: "user",
        content: context.studentInput,
        timestamp: new Date().toISOString(),
      },
      {
        role: "system",
        content: redirectMsg,
        timestamp: new Date().toISOString(),
      },
    ];

    const updatedIntegrityFlags = [...(context.integrityFlags || [])];
    if (classificationResult.integrity_flag) {
      updatedIntegrityFlags.push(true);
    }

    storage.createTurnEvent({
      sessionId: context.sessionId,
      eventType: "input_rejected",
      turnNumber: currentDecisionNum,
      rawStudentInput: context.studentInput,
      eventData: {
        classification: "BLOCK",
        block_reason: classificationResult.block_reason,
        redirect_message: redirectMsg,
        integrity_flag: classificationResult.integrity_flag,
      },
    }).catch(err => console.error("[TurnEvent] Failed to log input_rejected:", err));

    return {
      narrative: {
        text: redirectMsg,
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: "",
      },
      isGameOver: false,
      turnStatus: "block",
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        indicators: context.indicators,
        history: updatedHistory,
        flags: [],
        rubricScores: {},
        currentDecision: context.currentDecision,
        pendingRevision: false,
        revisionAttempts: 0,
        nudgeCounters: nudgeCounters,
        integrityFlags: updatedIntegrityFlags.length > 0 ? updatedIntegrityFlags : undefined,
        decisionEvidenceLogs: context.decisionEvidenceLogs,
      },
    };
  }

  if (classificationResult.classification === "NUDGE") {
    const questions = classificationResult.nudge_questions || [];
    const nudgeText = questions.join("\n");

    const updatedNudgeCounters = { ...nudgeCounters, [currentDecisionNum]: currentNudgeCount + 1 };

    const nudgeHistory: HistoryEntry[] = [
      ...context.history as HistoryEntry[],
      {
        role: "user",
        content: context.studentInput,
        timestamp: new Date().toISOString(),
      },
    ];

    storage.createTurnEvent({
      sessionId: context.sessionId,
      eventType: "agent_call",
      turnNumber: currentDecisionNum,
      rawStudentInput: context.studentInput,
      eventData: {
        agentName: "nudge",
        classification: "NUDGE",
        nudge_questions: questions,
        nudge_count: currentNudgeCount + 1,
      },
    }).catch(err => console.error("[TurnEvent] Failed to log nudge:", err));

    return {
      narrative: {
        text: nudgeText,
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: "",
      },
      isGameOver: false,
      turnStatus: "nudge",
      requiresRevision: true,
      revisionPrompt: nudgeText,
      revisionAttempt: currentNudgeCount + 1,
      maxRevisions: MAX_REVISIONS,
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        indicators: context.indicators,
        history: nudgeHistory,
        flags: [],
        rubricScores: {},
        currentDecision: context.currentDecision,
        pendingRevision: true,
        revisionAttempts: currentNudgeCount + 1,
        lastStudentInput: context.studentInput,
        nudgeCounters: updatedNudgeCounters,
        integrityFlags: context.integrityFlags,
        decisionEvidenceLogs: context.decisionEvidenceLogs,
      },
    };
  }

  const intentStart = Date.now();
  const intentResult = await interpretIntent(
    context.studentInput,
    context.history as HistoryEntry[],
    { title: context.scenario.title, context: `${context.scenario.domain} - ${context.scenario.objective}` },
    { customPrompt: context.agentPrompts?.director, model: context.llmModel, sessionId: context.sessionId, language: context.language }
  );
  storage.createTurnEvent({
    sessionId: context.sessionId,
    eventType: "agent_call",
    turnNumber: currentDecisionNum,
    rawStudentInput: context.studentInput,
    eventData: {
      agentName: "director",
      durationMs: Date.now() - intentStart,
      isValid: intentResult.isValid,
      interpretedAction: intentResult.interpretedAction,
    },
  }).catch(err => console.error("[TurnEvent] Failed to log director agent_call:", err));

  let evidenceLog: DecisionEvidenceLog;

  if (isMcq) {
    const mcqSignals = buildMcqSignals(context.studentInput, decisionPoint);
    evidenceLog = {
      signals_detected: mcqSignals,
      rds_score: null,
      rds_band: null,
      competency_evidence: mapCompetencyEvidence(mcqSignals),
      raw_signal_scores: {
        intent: mcqSignals.intent.quality,
        justification: mcqSignals.justification.quality,
        tradeoffAwareness: mcqSignals.tradeoffAwareness.quality,
        stakeholderAwareness: mcqSignals.stakeholderAwareness.quality,
        ethicalAwareness: mcqSignals.ethicalAwareness.quality,
      },
      isMcq: true,
    };
    storage.createTurnEvent({
      sessionId: context.sessionId,
      eventType: "agent_call",
      turnNumber: currentDecisionNum,
      rawStudentInput: context.studentInput,
      eventData: {
        agentName: "signalExtractor",
        durationMs: 0,
        source: "mcq_tradeoff_signature",
        isMcq: true,
        hasTradeoffSignature: !!decisionPoint?.tradeoffSignature,
        signals: evidenceLog.raw_signal_scores,
      },
    }).catch(err => console.error("[TurnEvent] Failed to log signalExtractor (MCQ):", err));
  } else {
    const signalStart = Date.now();
    evidenceLog = await extractSignals(context);
    storage.createTurnEvent({
      sessionId: context.sessionId,
      eventType: "agent_call",
      turnNumber: currentDecisionNum,
      rawStudentInput: context.studentInput,
      eventData: {
        agentName: "signalExtractor",
        durationMs: Date.now() - signalStart,
        rds_score: evidenceLog.rds_score,
        rds_band: evidenceLog.rds_band,
        signals: evidenceLog.raw_signal_scores,
        competency_evidence: evidenceLog.competency_evidence,
      },
    }).catch(err => console.error("[TurnEvent] Failed to log signalExtractor:", err));
  }

  const contextWithRDS: AgentContext = {
    ...context,
    studentInput: intentResult.interpretedAction || context.studentInput,
    rdsBand: evidenceLog.rds_band || undefined,
    signalExtractionResult: evidenceLog.signals_detected,
  };

  const agentsStart = Date.now();
  const [evaluation, kpiImpact] = await Promise.all([
    evaluateDecision(contextWithRDS),
    calculateKPIImpact(contextWithRDS),
  ]);
  const agentsDuration = Date.now() - agentsStart;

  storage.createTurnEvent({
    sessionId: context.sessionId,
    eventType: "agent_call",
    turnNumber: currentDecisionNum,
    rawStudentInput: context.studentInput,
    eventData: {
      agentName: "evaluator",
      durationMs: agentsDuration,
      feedbackScore: evaluation.feedback?.score,
      feedbackMessage: evaluation.feedback?.message,
      feedbackHint: evaluation.feedback?.hint,
      competencyScores: evaluation.competencyScores,
      flags: evaluation.flags,
    },
  }).catch(err => console.error("[TurnEvent] Failed to log evaluator agent_call:", err));

  storage.createTurnEvent({
    sessionId: context.sessionId,
    eventType: "agent_call",
    turnNumber: currentDecisionNum,
    rawStudentInput: context.studentInput,
    eventData: {
      agentName: "domainExpert",
      durationMs: agentsDuration,
      kpiDeltas: kpiImpact.kpiDeltas,
      indicatorDeltas: kpiImpact.indicatorDeltas,
      metricExplanations: kpiImpact.metricExplanations,
    },
  }).catch(err => console.error("[TurnEvent] Failed to log domainExpert agent_call:", err));

  const newKpis = applyKPIDeltas(context.currentKpis, kpiImpact.kpiDeltas);

  const narrativeContext: AgentContext = {
    ...contextWithRDS,
    currentKpis: newKpis,
  };
  const narrativeStart = Date.now();
  const narrative = await generateNarrative(narrativeContext, kpiImpact, evaluation);
  storage.createTurnEvent({
    sessionId: context.sessionId,
    eventType: "agent_call",
    turnNumber: currentDecisionNum,
    rawStudentInput: context.studentInput,
    eventData: {
      agentName: "narrator",
      durationMs: Date.now() - narrativeStart,
      mood: narrative.mood,
      speaker: narrative.speaker,
      narrativeLength: narrative.text?.length,
      suggestedOptions: narrative.suggestedOptions,
    },
  }).catch(err => console.error("[TurnEvent] Failed to log narrator agent_call:", err));

  const isGameOver = checkGameOver(newKpis, contextWithRDS);

  const kpiUpdates: Record<string, { value: number; delta: number }> = {};
  const kpiKeys: (keyof KPIs)[] = ["revenue", "morale", "reputation", "efficiency", "trust"];
  
  for (const key of kpiKeys) {
    const delta = kpiImpact.kpiDeltas[key] || 0;
    kpiUpdates[key] = {
      value: newKpis[key],
      delta: delta,
    };
  }

  const newHistory: HistoryEntry[] = [
    ...context.history as HistoryEntry[],
    {
      role: "user",
      content: context.studentInput,
      timestamp: new Date().toISOString(),
    },
    {
      role: narrative.speaker ? "npc" : "system",
      content: narrative.text,
      speaker: narrative.speaker,
      timestamp: new Date().toISOString(),
    },
  ];

  const nextDecision = currentDecisionNum + 1;
  const decisionsComplete = totalDecisions > 0 && nextDecision > totalDecisions;
  
  const updatedIndicators = (context.indicators || []).map((indicator: any) => {
    const delta = kpiImpact.indicatorDeltas?.[indicator.id] || 0;
    return {
      ...indicator,
      value: Math.max(0, Math.min(100, indicator.value + delta)),
    };
  });

  const existingEvidenceLogs = context.decisionEvidenceLogs || [];
  const evidenceEntry: import("@shared/schema").DecisionEvidenceLogEntry = {
    signals_detected: {
      intent: { quality: evidenceLog.signals_detected.intent.quality as 0 | 1 | 2 | 3, extracted_text: evidenceLog.signals_detected.intent.extracted_text },
      justification: { quality: evidenceLog.signals_detected.justification.quality as 0 | 1 | 2 | 3, extracted_text: evidenceLog.signals_detected.justification.extracted_text },
      tradeoffAwareness: { quality: evidenceLog.signals_detected.tradeoffAwareness.quality as 0 | 1 | 2 | 3, extracted_text: evidenceLog.signals_detected.tradeoffAwareness.extracted_text },
      stakeholderAwareness: { quality: evidenceLog.signals_detected.stakeholderAwareness.quality as 0 | 1 | 2 | 3, extracted_text: evidenceLog.signals_detected.stakeholderAwareness.extracted_text },
      ethicalAwareness: { quality: evidenceLog.signals_detected.ethicalAwareness.quality as 0 | 1 | 2 | 3, extracted_text: evidenceLog.signals_detected.ethicalAwareness.extracted_text },
    },
    rds_score: evidenceLog.rds_score,
    rds_band: evidenceLog.rds_band as "SURFACE" | "ENGAGED" | "INTEGRATED" | null,
    competency_evidence: evidenceLog.competency_evidence,
    raw_signal_scores: evidenceLog.raw_signal_scores,
    isMcq: evidenceLog.isMcq,
  };

  storage.createTurnEvent({
    sessionId: context.sessionId,
    eventType: "input_accepted",
    turnNumber: currentDecisionNum,
    rawStudentInput: context.studentInput,
    eventData: {
      classification: "PASS",
      rds_score: evidenceLog.rds_score,
      rds_band: evidenceLog.rds_band,
    },
  }).catch(err => console.error("[TurnEvent] Failed to log input_accepted:", err));

  const updatedState: SimulationState = {
    turnCount: context.turnCount + 1,
    kpis: newKpis,
    indicators: updatedIndicators,
    history: newHistory,
    flags: [...evaluation.flags],
    rubricScores: evaluation.competencyScores,
    currentDecision: decisionsComplete ? totalDecisions : nextDecision,
    isComplete: isGameOver,
    isReflectionStep: decisionsComplete && !isGameOver,
    reflectionCompleted: false,
    pendingRevision: false,
    revisionAttempts: 0,
    decisionEvidenceLogs: [...existingEvidenceLogs, evidenceEntry],
    nudgeCounters: nudgeCounters,
    integrityFlags: context.integrityFlags,
  };

  return {
    narrative: {
      text: narrative.text,
      speaker: narrative.speaker,
      mood: narrative.mood,
    },
    kpiUpdates,
    indicatorDeltas: kpiImpact.indicatorDeltas,
    feedback: evaluation.feedback,
    options: narrative.suggestedOptions,
    isGameOver,
    turnStatus: "pass",
    competencyScores: evaluation.competencyScores,
    requiresRevision: false,
    metricExplanations: kpiImpact.metricExplanations,
    updatedState,
  };
}
