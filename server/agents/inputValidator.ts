/**
 * Input Validation Agent
 * 
 * POC S4.1: LENIENT VALIDATION - Only block on truly problematic input
 * 
 * This agent validates student/user input BEFORE any main simulation processing.
 * 
 * BLOCKING RULES (only these block the student):
 * 1. Profanity/unsafe content
 * 2. Empty input
 * 3. Clear nonsense/spam (random characters, keyboard mashing)
 * 
 * ACCEPTANCE RULES:
 * - Short but relevant responses: ACCEPT
 * - Brief justifications: ACCEPT
 * - Any attempt at engagement with the case: ACCEPT
 * 
 * POC Priority: Smooth completion + authentic reasoning > quota-writing
 */

import { generateChatCompletion, SupportedModel } from "../openai";

export interface InputValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  userMessage?: string; // Message to show the user if rejected
}

// List of offensive words/patterns - ONLY block on truly offensive content
const OFFENSIVE_PATTERNS = [
  // Spanish insults (severe only)
  /\b(mierda|puta|puto|cabrón|cabron|hijo\s*de\s*puta|verga|chingar|pinche|culero|joto|marica|maricón|maricon|zorra)\b/i,
  // English insults (severe only)
  /\b(fuck|fucking|bitch|bastard|dick|cock|pussy|cunt|retard)\b/i,
  // General offensive patterns
  /\b(kill\s*(yourself|urself)|kys|die|hate\s*you)\b/i,
];

// Patterns that indicate clear nonsense/gibberish - only the most obvious
const NONSENSE_PATTERNS = [
  /^[a-z]{1,2}$/i, // 1-2 random letters only
  /^(asdf|qwer|zxcv|hjkl)+$/i, // Pure keyboard mashing
  /^[^a-záéíóúñü\s]{10,}$/i, // Long strings with no letters at all
  /^(.)\1{6,}$/i, // Same character repeated 7+ times
  /^[0-9\s\W]+$/i, // Only numbers and symbols (no letters at all)
];

// POC: Very lenient minimum - just needs SOMETHING
const MIN_INPUT_LENGTH = 3;

/**
 * S6.B: Quick validation - LENIENT with LOCKED rejection messages
 * Only blocks on: empty, profanity, or clear nonsense
 * Returns null if validation passes, structured error message if fails
 */
function quickValidation(input: string): string | null {
  const trimmed = input.trim();
  
  // Block 1: Empty input only
  if (trimmed.length < MIN_INPUT_LENGTH) {
    return "REJECTION_EMPTY"; // Signal for S6.B format
  }
  
  // Block 2: Offensive patterns (profanity/unsafe)
  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "REJECTION_PROFANITY"; // Signal for S6.B format
    }
  }
  
  // Block 3: Clear nonsense/spam only
  for (const pattern of NONSENSE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "REJECTION_NONSENSE"; // Signal for S6.B format
    }
  }
  
  return null; // Passed - accept everything else
}

/**
 * S4.2: Relevance + Structure validation (NOT length-based)
 * 
 * ACCEPT if student does AT LEAST ONE of:
 * 1. States a clear priority (what they optimize for)
 * 2. References at least one relevant case element
 * 3. Mentions one trade-off or risk they're accepting
 * 
 * Examples that PASS:
 * - "Prioritizo X porque Y."
 * - "Elijo X para lograr Y, aunque afecte Z."
 * - "Mi prioridad es X; el riesgo principal es Y."
 */
async function llmValidation(
  input: string,
  caseContext: { title: string; objective: string; recentHistory?: string },
  model?: SupportedModel
): Promise<InputValidationResult> {
  const systemPrompt = `Eres un validador EQUILIBRADO para una simulación educativa de negocios.

Tu objetivo: verificar que el estudiante está PENSANDO sobre el caso — no solo escribiendo algo para pasar.

ACEPTA si la respuesta muestra ALGÚN razonamiento conectado al caso:
- Menciona una acción concreta que tomaría ("Voy a reasignar recursos a marketing")
- Explica un por qué conectado al contexto ("porque el equipo está desmotivado")
- Reconoce un trade-off o consecuencia ("esto puede afectar el presupuesto")
- Hace referencia a elementos del caso (stakeholders, situación, recursos, objetivos)
- Expresa una posición con justificación mínima ("Priorizo al equipo porque necesitamos cohesión")

RECHAZA si la respuesta cae en alguna de estas categorías:
- Texto sin sentido, caracteres aleatorios o spam
- Contenido ofensivo o inapropiado
- Respuestas vagas SIN conexión al caso: "sí", "no sé", "la mejor opción", "porque sí", "elijo esa"
- Respuestas genéricas que aplican a cualquier caso sin demostrar que leyeron este: "Hay que tomar buenas decisiones" o "Es importante analizar bien"
- Respuestas que solo repiten la pregunta sin añadir razonamiento propio

EJEMPLOS:
- "Voy a priorizar la calidad del producto sobre la velocidad de lanzamiento" → ACEPTA (acción concreta con trade-off)
- "Creo que deberíamos invertir en capacitación del equipo para mejorar la eficiencia" → ACEPTA (acción + justificación)
- "Me enfoco en reducir costos operativos aunque sacrifique algo de innovación" → ACEPTA (decisión + trade-off)
- "Sí, eso" → RECHAZA (sin razonamiento)
- "Porque es lo mejor" → RECHAZA (genérica, sin conexión al caso)
- "Hay que analizar las opciones con cuidado" → RECHAZA (genérica, no dice qué haría)
- "Priorizo la calidad" → ACEPTA (breve pero indica una decisión clara)

EN CASO DE DUDA: ACEPTA. Es preferible dejar pasar una respuesta corta pero con sentido que bloquear a un estudiante que sí está pensando.

Responde en JSON:
{
  "isValid": true/false,
  "reason": "breve explicación"
}`;

  const userPrompt = `CASO: ${caseContext.title}
OBJETIVO: ${caseContext.objective}
${caseContext.recentHistory ? `CONTEXTO RECIENTE:\n${caseContext.recentHistory}` : ""}

RESPUESTA DEL ESTUDIANTE:
"${input}"

¿La respuesta muestra razonamiento conectado al caso? Responde en JSON.`;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      { 
        responseFormat: "json",
        model: model || "gpt-4o-mini"
      }
    );

    const result = JSON.parse(response);
    
    if (!result.isValid) {
      return {
        isValid: false,
        rejectionReason: result.reason,
        userMessage: "Tu respuesta no pudo procesarse. Por favor, inténtalo de nuevo."
      };
    }
    
    return { isValid: true };
    
  } catch (error) {
    console.error("[InputValidator] LLM validation error:", error);
    // On error, ALWAYS accept
    return { isValid: true };
  }
}

/**
 * S6.B LOCKED rejection message - always use this structure
 * Never feels like "incorrect" - student knows how to fix quickly
 */
const S6B_REJECTION_MESSAGE = `Para continuar, necesito que conectes tu respuesta con el caso y expliques tu prioridad.`;

/**
 * Get specific rejection reason based on type
 */
function getS6BRejectionReason(type: string): string {
  switch (type) {
    case "REJECTION_EMPTY":
      return "Tu respuesta está vacía.";
    case "REJECTION_PROFANITY":
      return "Tu respuesta contiene lenguaje que no podemos procesar.";
    case "REJECTION_NONSENSE":
      return "Tu respuesta no parece relacionada con el caso.";
    default:
      return S6B_REJECTION_MESSAGE;
  }
}

/**
 * Main validation function - validates user input before simulation processing
 * 
 * S6.B: Rejection only for profanity/unsafe, empty, or totally unrelated spam/nonsense
 * Uses LOCKED rejection message structure
 */
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
  }
): Promise<InputValidationResult> {
  
  // Step 1: Quick regex-based validation (catches obvious issues fast)
  const quickResult = quickValidation(input);
  if (quickResult) {
    console.log("[InputValidator] Quick validation failed:", quickResult);
    return {
      isValid: false,
      rejectionReason: quickResult,
      userMessage: getS6BRejectionReason(quickResult)
    };
  }
  
  // Step 2: LLM-based validation for nuanced checks (unless skipped)
  if (!options?.skipLlmValidation) {
    const llmResult = await llmValidation(input, caseContext, options?.model);
    if (!llmResult.isValid) {
      console.log("[InputValidator] LLM validation failed:", llmResult.rejectionReason);
      return {
        ...llmResult,
        userMessage: S6B_REJECTION_MESSAGE
      };
    }
  }
  
  return { isValid: true };
}
