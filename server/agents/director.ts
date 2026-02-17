import type { AgentContext, DirectorOutput } from "./types";
import type { KPIs, SimulationState, TurnResponse, HistoryEntry } from "@shared/schema";
import { evaluateDecision } from "./evaluator";
import { calculateKPIImpact } from "./domainExpert";
import { generateNarrative } from "./narrator";
import { evaluateDepth } from "./depthEvaluator";
import { generateChatCompletion, SupportedModel } from "../openai";
import { HARD_PROHIBITIONS, MENTOR_TONE, MISUSE_HANDLING } from "./guardrails";

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

EJEMPLOS DE INTERPRETACIONES VÁLIDAS:
- "empjuar a los desarrolladores" → VÁLIDO: "Presionar a los desarrolladores para terminar a tiempo" (error obvio)
- "darles café todos los días" → VÁLIDO: Mejorar amenidades del lugar de trabajo/moral
- "no sé quizás retrasarlo" → VÁLIDO: Considerar retrasar el proyecto/fecha límite
- "despedir a todos jaja" → VÁLIDO: Reducción dramática de costos/reestructuración (explorar consecuencias)
- "qué tal si mentimos" → VÁLIDO: Enfoque ético cuestionable (explorar consecuencias)
- "seguir adelante sin importar qué" → VÁLIDO: Estrategia agresiva de cumplimiento de fechas
- "lo de arriba es mi decisión" → VÁLIDO: Referenciando su declaración anterior como su decisión
- "ya respondí la pregunta" → VÁLIDO: Su mensaje anterior era su acción pretendida
- Respuestas aleatorias/tontas → VÁLIDO: Interpretar como un enfoque empresarial no convencional y mostrar consecuencias

ENTRADAS PARA MARCAR PARA ACLARACIÓN (aún raras):
- Galimatías completo sin significado interpretable: "asdfghjkl"
- Contenido que promueve violencia, actividades ilegales o acoso que no puede reformularse como decisión empresarial
- Contenido completamente no relacionado con cualquier contexto profesional/empresarial

Nota: Las decisiones empresariales arriesgadas o éticamente cuestionables SON VÁLIDAS (ej., "despedir a todos", "mentirle a los clientes") - deja que las consecuencias enseñen. Solo marca contenido verdaderamente dañino/fuera de tema.

IMPORTANTE: Si la entrada no es válida, el helpfulPrompt debe estar en ESPAÑOL.

FORMATO DE SALIDA (solo JSON):
{
  "isValid": true,
  "interpretedAction": "<descripción clara de lo que el estudiante está tratando de hacer>",
  "confidence": "high" | "medium" | "low"
}

Para el caso extremadamente raro de inválido:
{
  "isValid": false,
  "helpfulPrompt": "<pregunta atractiva en español para regresarlos al camino>"
}

Recuerda: Una simulación empresarial creativa debe poder manejar CUALQUIER decisión y mostrar consecuencias interesantes. Tu trabajo es habilitar el juego, no bloquearlo.`;

async function interpretIntent(
  input: string,
  history: HistoryEntry[],
  scenario: { title: string; context: string },
  options?: { customPrompt?: string; model?: SupportedModel }
): Promise<{ isValid: boolean; interpretedAction?: string; helpfulPrompt?: string }> {
  try {
    const recentContext = history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");
    const systemPrompt = options?.customPrompt || DEFAULT_DIRECTOR_PROMPT;
    
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
      { responseFormat: "json", maxTokens: 256, model: options?.model, agentName: "director", sessionId: parseInt(context.sessionId) || undefined }
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
  // Check for KPI-based game over
  const kpiGameOver = (
    kpis.morale < 20 ||
    kpis.reputation < 20 ||
    kpis.efficiency < 20 ||
    kpis.trust < 20 ||
    kpis.revenue < 10000
  );
  
  // S9.1: Decision limit check now handled separately from reflection step
  // Game over from KPIs only - decision completion leads to reflection step instead
  return kpiGameOver;
}

/**
 * S9.1: Loose reflection validation
 * Only reject: profanity, empty, or completely unrelated spam
 * Accept everything else - we want authentic reflection, not quota-writing
 */
function validateReflection(input: string): { isValid: boolean; message?: string } {
  const trimmed = input.trim();
  
  // Block empty
  if (trimmed.length < 3) {
    return { 
      isValid: false, 
      message: "Por favor, comparte una breve reflexión sobre tu experiencia." 
    };
  }
  
  // Block profanity (same patterns as inputValidator)
  const OFFENSIVE_PATTERNS = [
    /\b(mierda|puta|puto|cabrón|cabron|hijo\s*de\s*puta|verga|chingar|pinche|culero|joto|marica|maricón|maricon|zorra)\b/i,
    /\b(fuck|fucking|bitch|bastard|dick|cock|pussy|cunt|retard)\b/i,
    /\b(kill\s*(yourself|urself)|kys|die|hate\s*you)\b/i,
  ];
  
  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { 
        isValid: false, 
        message: "Por favor, comparte una reflexión respetuosa sobre tu experiencia." 
      };
    }
  }
  
  // Block clear nonsense/gibberish
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
        message: "Por favor, comparte tus pensamientos sobre la simulación." 
      };
    }
  }
  
  // Accept everything else
  return { isValid: true };
}

/**
 * S9.1: Process reflection (Step 4)
 * Loose validation - only reject profanity/empty/spam
 * Non-blocking nudge for depth if desired
 */
export async function processReflection(
  context: AgentContext
): Promise<DirectorOutput> {
  const validation = validateReflection(context.studentInput);
  
  if (!validation.isValid) {
    // Reflection failed basic validation - ask again without harsh messaging
    const updatedHistory: HistoryEntry[] = [
      ...context.history as HistoryEntry[],
      {
        role: "user",
        content: context.studentInput,
        timestamp: new Date().toISOString(),
      },
      {
        role: "system",
        content: validation.message || "Por favor, comparte una reflexión sobre tu experiencia.",
        timestamp: new Date().toISOString(),
      },
    ];
    
    return {
      narrative: {
        text: validation.message || "Por favor, comparte una reflexión sobre tu experiencia.",
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: "",
      },
      isGameOver: false,
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        indicators: context.indicators,
        history: updatedHistory,
        flags: [],
        rubricScores: {},
        currentDecision: context.currentDecision,
        isComplete: false,
        isReflectionStep: true, // Still in reflection step
        reflectionCompleted: false,
        pendingRevision: false,
        revisionAttempts: 0,
      },
    };
  }
  
  // Reflection is valid - complete the simulation
  // S9.1 Optional nudge (non-blocking, just for the record)
  const optionalNudge = "Si quieres, añade 1 aprendizaje y 1 cosa que harías distinto.";
  
  const completionMessage = `¡Gracias por compartir tu reflexión! Has completado la simulación.

${context.studentInput.length < 50 ? `💡 ${optionalNudge}` : ""}

Tu perspectiva es valiosa para el proceso de aprendizaje.`;

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
      message: "Reflexión completada",
    },
    isGameOver: true, // Simulation is now truly complete
    updatedState: {
      turnCount: context.turnCount + 1,
      kpis: context.currentKpis,
      indicators: context.indicators,
      history: newHistory,
      flags: [],
      rubricScores: {},
      currentDecision: context.currentDecision,
      isComplete: true, // Now complete
      isReflectionStep: false, // No longer in reflection step
      reflectionCompleted: true, // Reflection done
      pendingRevision: false,
      revisionAttempts: 0,
    },
  };
}

export async function processStudentTurn(
  context: AgentContext,
  revisionAttempts: number = 0
): Promise<DirectorOutput> {
  const intentResult = await interpretIntent(
    context.studentInput,
    context.history as HistoryEntry[],
    { title: context.scenario.title, context: `${context.scenario.domain} - ${context.scenario.objective}` },
    { customPrompt: context.agentPrompts?.director, model: context.llmModel }
  );

  if (!intentResult.isValid) {
    const helpPrompt = intentResult.helpfulPrompt || 
      "¡Quiero ayudarte a navegar esta situación! ¿Qué acción te gustaría tomar? Puedes intentar cualquier cosa - negociar, investigar, tomar decisiones audaces, o incluso enfoques no convencionales.";
    
    const updatedHistory: HistoryEntry[] = [
      ...context.history as HistoryEntry[],
      {
        role: "user",
        content: context.studentInput,
        timestamp: new Date().toISOString(),
      },
      {
        role: "system",
        content: helpPrompt,
        timestamp: new Date().toISOString(),
      },
    ];
    
    return {
      narrative: {
        text: helpPrompt,
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: "¡Cuéntame qué quieres hacer y lo haré realidad en la simulación!",
      },
      isGameOver: false,
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        history: updatedHistory,
        flags: [],
        rubricScores: {},
        pendingRevision: false,
        revisionAttempts: 0,
      },
    };
  }

  const interpretedContext = {
    ...context,
    studentInput: intentResult.interpretedAction || context.studentInput,
  };

  // DEPTH EVALUATION: Check if answer needs more depth before processing consequences
  const depthResult = await evaluateDepth(
    interpretedContext,
    revisionAttempts,
    { model: context.llmModel }
  );

  if (!depthResult.isDeepEnough && depthResult.revisionPrompt) {
    // Answer is weak - ask for revision without showing consequences
    const revisionHistory: HistoryEntry[] = [
      ...context.history as HistoryEntry[],
      {
        role: "user",
        content: context.studentInput,
        timestamp: new Date().toISOString(),
      },
      {
        role: "system",
        content: depthResult.revisionPrompt,
        timestamp: new Date().toISOString(),
      },
    ];

    return {
      narrative: {
        text: depthResult.revisionPrompt,
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: depthResult.strengthsAcknowledged || "",
      },
      isGameOver: false,
      requiresRevision: true,
      revisionPrompt: depthResult.revisionPrompt,
      revisionAttempt: revisionAttempts + 1,
      maxRevisions: MAX_REVISIONS,
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        indicators: context.indicators,
        history: revisionHistory,
        flags: [],
        rubricScores: {},
        currentDecision: context.currentDecision,
        pendingRevision: true,
        revisionAttempts: revisionAttempts + 1,
        lastStudentInput: context.studentInput,
      },
    };
  }

  // Answer is deep enough - proceed with full processing
  const [evaluation, kpiImpact] = await Promise.all([
    evaluateDecision(interpretedContext),
    calculateKPIImpact(interpretedContext),
  ]);

  const newKpis = applyKPIDeltas(context.currentKpis, kpiImpact.kpiDeltas);

  const narrativeContext = {
    ...interpretedContext,
    currentKpis: newKpis,
  };
  const narrative = await generateNarrative(narrativeContext, kpiImpact, evaluation);

  const isGameOver = checkGameOver(newKpis, interpretedContext);

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

  const currentDecisionNum = context.currentDecision || context.turnCount + 1;
  const nextDecision = currentDecisionNum + 1;
  const totalDecisions = context.totalDecisions || 0;
  const decisionsComplete = totalDecisions > 0 && nextDecision > totalDecisions;
  
  // S9.1: After all decisions, move to reflection step instead of completing
  // Only mark isComplete if there's a game over from KPIs
  const updatedState: SimulationState = {
    turnCount: context.turnCount + 1,
    kpis: newKpis,
    indicators: context.indicators,
    history: newHistory,
    flags: [...(context.history as any).flags || [], ...evaluation.flags],
    rubricScores: evaluation.competencyScores,
    currentDecision: decisionsComplete ? totalDecisions : nextDecision,
    // S9.1: If decisions are done but no game over, move to reflection step
    isComplete: isGameOver, // Only complete on game over
    isReflectionStep: decisionsComplete && !isGameOver, // Start reflection step
    reflectionCompleted: false,
    pendingRevision: false,
    revisionAttempts: 0,
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
    competencyScores: evaluation.competencyScores,
    requiresRevision: false,
    // POC "Why?" Explainability
    metricExplanations: kpiImpact.metricExplanations,
    updatedState,
  };
}
