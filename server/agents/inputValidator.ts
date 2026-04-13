import { generateChatCompletion, SupportedModel } from "../openai";
import type { InputClassificationResult, InputClassificationType, BlockReason } from "./types";

type Language = "es" | "en";

const OFFENSIVE_PATTERNS = [
  /\b(mierda|puta|puto|cabrón|cabron|hijo\s*de\s*puta|verga|chingar|pinche|culero|joto|marica|maricón|maricon|zorra)\b/i,
  /\b(fuck|fucking|bitch|bastard|dick|cock|pussy|cunt|retard)\b/i,
  /\b(kill\s*(yourself|urself)|kys|die|hate\s*you)\b/i,
];

const NONSENSE_PATTERNS = [
  /^[a-z]{1,2}$/i,
  /^(asdf|qwer|zxcv|hjkl|wasd)+$/i,
  /^[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]{8,}$/i,
  /^(.)\1{5,}$/i,
  /^[0-9\s\W]+$/,
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+a/i,
  /system\s*:\s*/i,
  /\bprompt\s*injection\b/i,
  /act\s+as\s+(if\s+you\s+are|a)\s/i,
  /forget\s+(everything|all|your)\s/i,
  /new\s+instructions?\s*:/i,
  /override\s+(your|the)\s+(rules|instructions|system)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /jailbreak/i,
  /\bDAN\b.*mode/i,
  /\[\s*SYSTEM\s*\]/i,
];

const BLOCK_MESSAGES: Record<Language, Record<BlockReason, string>> = {
  es: {
    empty: "Tu respuesta parece estar vacía. Comparte tu decisión sobre la situación actual.",
    safety: "No pudimos procesar tu respuesta. Por favor, comparte tu perspectiva sobre la decisión que enfrentas.",
    integrity: "No pudimos procesar tu respuesta. Por favor, comparte tu perspectiva sobre la decisión que enfrentas.",
    off_topic: "Tu respuesta no parece relacionada con la situación del caso. Enfócate en la decisión que tienes frente a ti.",
    insufficient_engagement: "Tu respuesta no parece relacionada con la situación del caso. Enfócate en la decisión que tienes frente a ti.",
  },
  en: {
    empty: "Your response appears to be empty. Share your decision about the current situation.",
    safety: "We couldn't process your response. Please share your perspective on the decision you're facing.",
    integrity: "We couldn't process your response. Please share your perspective on the decision you're facing.",
    off_topic: "Your response doesn't seem related to the case situation. Focus on the decision in front of you.",
    insufficient_engagement: "Your response doesn't seem related to the case situation. Focus on the decision in front of you.",
  },
};

const NUDGE_QUESTION_POOL: Record<Language, string[]> = {
  es: [
    "¿Qué aspecto del caso te parece más relevante para esta decisión?",
    "¿Puedes conectar tu respuesta con algún elemento específico de la situación?",
    "¿Qué factor consideras más importante al tomar esta decisión?",
    "¿Cómo se relaciona tu respuesta con la situación que enfrentas?",
  ],
  en: [
    "What aspect of the case seems most relevant to this decision?",
    "Can you connect your response to a specific element of the situation?",
    "What factor do you consider most important when making this decision?",
    "How does your response relate to the situation you're facing?",
  ],
};

export interface InputValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  userMessage?: string;
}

export interface ClassificationContext {
  title: string;
  objective: string;
  recentHistory?: string;
  decisionPrompt?: string;
  nudgeCount: number;
  currentDecision: number;
  isMcq: boolean;
}

function gate1Empty(input: string): boolean {
  return input.trim().length === 0 || /^\s+$/.test(input);
}

function gate2Profanity(input: string): boolean {
  const trimmed = input.trim();
  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function gate3Injection(input: string): boolean {
  const trimmed = input.trim();
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function gate4OffTopicOrSpam(input: string): boolean {
  const trimmed = input.trim();
  for (const pattern of NONSENSE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

async function gate5PassCriteria(
  input: string,
  caseContext: { title: string; objective: string; recentHistory?: string; decisionPrompt?: string },
  language: Language,
  model?: SupportedModel
): Promise<boolean> {
  const trimmed = input.trim();

  const PRIORITY_PATTERNS = [
    /\b(priorit|prioriz|lo más importante|mi prioridad|primero|enfoc|optimi)/i,
    /\b(elijo|escojo|decido|opto por|prefiero|propongo|sugiero|recomiendo)\b/i,
    /\b(i\s+choose|i\s+decide|i\s+prefer|i\s+suggest|i\s+recommend|my\s+priority|i\s+focus)/i,
  ];
  const TRADEOFF_PATTERNS = [
    /\b(aunque|a pesar|sin embargo|pero|el riesgo|acepto que|sacrific|compromis|trade-?off|costo|desventaja)/i,
    /\b(although|despite|however|but|risk|accept that|sacrifice|compromise|trade-?off|cost|downside)/i,
  ];
  const CASE_REFERENCE_PATTERNS = [
    /\b(equipo|cliente|presupuesto|tiempo|proyecto|empresa|empleado|stakeholder|proveedor|mercado|producto|servicio)/i,
    /\b(team|client|budget|time|project|company|employee|stakeholder|supplier|market|product|service)/i,
  ];
  const REASONING_PATTERNS = [
    /\b(porque|ya que|dado que|considerando|debido a|por eso|para|con el fin de)\b/i,
    /\b(because|since|given that|considering|due to|therefore|in order to|so that)\b/i,
  ];

  const hasPriority = PRIORITY_PATTERNS.some(p => p.test(trimmed));
  const hasTradeoff = TRADEOFF_PATTERNS.some(p => p.test(trimmed));
  const hasCaseRef = CASE_REFERENCE_PATTERNS.some(p => p.test(trimmed));
  const hasReasoning = REASONING_PATTERNS.some(p => p.test(trimmed));

  if (hasPriority || hasTradeoff || hasCaseRef || hasReasoning) {
    return true;
  }

  try {
    const systemPrompt = language === "en"
      ? `You are a PASS/FAIL classifier for a business simulation. Return JSON only.
Your job: determine if ANY ONE of these criteria is met:
(a) States a clear priority or direction
(b) References a specific case element (person, resource, situation)
(c) Mentions a trade-off or cost
(d) Identifies a stakeholder impact
(e) Articulates a reasoning chain ("X because Y")

CRITICAL: Word count is NEVER a disqualifier. Grammar/spelling are NEVER criteria. Language mismatch is NEVER a criterion.
"I'd prioritize clients." = PASS. The threshold is intentionally LOW.
If ANY one criterion is met → {"pass": true}
If NONE are met → {"pass": false}
Return ONLY JSON: {"pass": true/false}`
      : `Eres un clasificador PASA/NO-PASA para una simulación de negocios. Devuelve solo JSON.
Tu trabajo: determinar si se cumple AL MENOS UNO de estos criterios:
(a) Establece una prioridad o dirección clara
(b) Referencia un elemento específico del caso (persona, recurso, situación)
(c) Menciona un trade-off o costo
(d) Identifica un impacto en stakeholders
(e) Articula una cadena de razonamiento ("X porque Y")

CRÍTICO: La cantidad de palabras NUNCA es un descalificador. La gramática/ortografía NUNCA son criterios. "Priorizaría clientes." = PASA.
Si se cumple CUALQUIER criterio → {"pass": true}
Si NO se cumple NINGUNO → {"pass": false}
Devuelve SOLO JSON: {"pass": true/false}`;

    const userPrompt = `CASE: ${caseContext.title}
OBJECTIVE: ${caseContext.objective}
${caseContext.decisionPrompt ? `CURRENT DECISION: ${caseContext.decisionPrompt}` : ""}
${caseContext.recentHistory ? `RECENT CONTEXT:\n${caseContext.recentHistory}` : ""}

STUDENT INPUT: "${trimmed}"

Does it meet ANY one criterion? JSON only.`;

    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 64, model: model || "gpt-4o-mini", agentName: "inputClassifier" }
    );
    const parsed = JSON.parse(response);
    return parsed.pass === true;
  } catch (error) {
    console.error("[InputClassifier] Gate 5 LLM error, defaulting to PASS:", error);
    return true;
  }
}

async function gate6Engagement(
  input: string,
  caseContext: { title: string; objective: string; recentHistory?: string },
  language: Language,
  model?: SupportedModel
): Promise<boolean> {
  try {
    const systemPrompt = language === "en"
      ? `You are checking if a student shows ANY case engagement despite not meeting formal criteria.
Does the response show they are TRYING to engage with a business case (even poorly)?
{"engaged": true} if there's any sign of case engagement.
{"engaged": false} if the response is completely unrelated, random, or meaningless.
Return ONLY JSON.`
      : `Estás verificando si un estudiante muestra CUALQUIER engagement con el caso aunque no cumpla criterios formales.
¿La respuesta muestra que INTENTA participar en un caso de negocios (incluso pobremente)?
{"engaged": true} si hay cualquier señal de engagement con el caso.
{"engaged": false} si la respuesta es completamente irrelevante, aleatoria o sin sentido.
Devuelve SOLO JSON.`;

    const userPrompt = `CASE: ${caseContext.title}
OBJECTIVE: ${caseContext.objective}
${caseContext.recentHistory ? `CONTEXT:\n${caseContext.recentHistory}` : ""}

STUDENT INPUT: "${input.trim()}"

JSON only.`;

    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 64, model: model || "gpt-4o-mini", agentName: "inputClassifier" }
    );
    const parsed = JSON.parse(response);
    return parsed.engaged === true;
  } catch (error) {
    console.error("[InputClassifier] Gate 6 LLM error, defaulting to engaged:", error);
    return true;
  }
}

function pickNudgeQuestions(language: Language): string[] {
  const pool = NUDGE_QUESTION_POOL[language];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

export async function classifyInput(
  input: string,
  context: ClassificationContext,
  options?: { model?: SupportedModel; language?: Language }
): Promise<InputClassificationResult> {
  const language: Language = options?.language || "es";

  if (context.isMcq) {
    return {
      classification: "PASS",
      classification_rationale: "MCQ input — always PASS, no classification gates applied.",
    };
  }

  if (context.nudgeCount >= 2) {
    return {
      classification: "PASS",
      classification_rationale: `Nudge counter reached ${context.nudgeCount} for decision point ${context.currentDecision}. Force PASS applied.`,
    };
  }

  if (gate1Empty(input)) {
    return {
      classification: "BLOCK",
      block_reason: "empty",
      classification_rationale: "Gate 1: Input is empty or whitespace only.",
      redirect_message: BLOCK_MESSAGES[language].empty,
    };
  }

  if (gate2Profanity(input)) {
    return {
      classification: "BLOCK",
      block_reason: "safety",
      classification_rationale: "Gate 2: Input contains profane or hostile language.",
      redirect_message: BLOCK_MESSAGES[language].safety,
    };
  }

  if (gate3Injection(input)) {
    return {
      classification: "BLOCK",
      block_reason: "integrity",
      classification_rationale: "Gate 3: Prompt injection pattern detected.",
      redirect_message: BLOCK_MESSAGES[language].integrity,
      integrity_flag: true,
    };
  }

  if (gate4OffTopicOrSpam(input)) {
    return {
      classification: "BLOCK",
      block_reason: "off_topic",
      classification_rationale: "Gate 4: Input is random characters, spam, or nonsense pattern.",
      redirect_message: BLOCK_MESSAGES[language].off_topic,
    };
  }

  const passResult = await gate5PassCriteria(
    input,
    {
      title: context.title,
      objective: context.objective,
      recentHistory: context.recentHistory,
      decisionPrompt: context.decisionPrompt,
    },
    language,
    options?.model
  );

  if (passResult) {
    return {
      classification: "PASS",
      classification_rationale: "Gate 5: Input meets at least one PASS criterion.",
    };
  }

  const engagementResult = await gate6Engagement(
    input,
    { title: context.title, objective: context.objective, recentHistory: context.recentHistory },
    language,
    options?.model
  );

  if (engagementResult) {
    return {
      classification: "NUDGE",
      classification_rationale: "Gate 6: Shows case engagement but no formal PASS criterion met.",
      nudge_questions: pickNudgeQuestions(language),
    };
  }

  return {
    classification: "BLOCK",
    block_reason: "insufficient_engagement",
    classification_rationale: "Gate 6: No case engagement detected.",
    redirect_message: BLOCK_MESSAGES[language].insufficient_engagement,
  };
}

export async function validateSimulationInput(
  input: string,
  caseContext: {
    title: string;
    objective: string;
    recentHistory?: string;
  },
  options?: {
    skipLlmValidation?: boolean;
    model?: SupportedModel;
    language?: Language;
  }
): Promise<InputValidationResult> {
  const language: Language = options?.language || "es";
  const result = await classifyInput(input, {
    title: caseContext.title,
    objective: caseContext.objective,
    recentHistory: caseContext.recentHistory,
    nudgeCount: 0,
    currentDecision: 1,
    isMcq: false,
  }, { model: options?.model, language });

  if (result.classification === "PASS") {
    return { isValid: true };
  }
  return {
    isValid: false,
    rejectionReason: result.classification_rationale,
    userMessage: result.redirect_message || BLOCK_MESSAGES[language].off_topic,
  };
}
