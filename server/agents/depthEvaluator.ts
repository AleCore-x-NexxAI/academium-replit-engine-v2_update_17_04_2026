import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DepthEvaluatorOutput } from "./types";
import { HARD_PROHIBITIONS, MENTOR_TONE, MISUSE_HANDLING } from "./guardrails";

/**
 * S4.2: Relevance + Structure depth evaluator
 * NO length-based rejection. Validate by RELEVANCE and STRUCTURE.
 * 
 * ACCEPT if student does AT LEAST ONE of:
 * 1. States a clear priority
 * 2. References case element
 * 3. Mentions trade-off or risk
 * 
 * NON-BLOCKING mentor nudges for improvement
 */
export const DEFAULT_DEPTH_EVALUATOR_PROMPT = `Eres un EVALUADOR de RELEVANCIA + ESTRUCTURA para Scenario+.

${HARD_PROHIBITIONS}

${MENTOR_TONE}

${MISUSE_HANDLING}

=== S4.2 REGLA CRÍTICA: NO RECHAZAR POR LONGITUD ===

ACEPTA (isDeepEnough = true) si la respuesta cumple AL MENOS UNO:
1. PRIORIDAD: Indica qué optimiza ("Prioritizo X", "Mi prioridad es", "Lo más importante")
2. REFERENCIA AL CASO: Menciona algún elemento del escenario (stakeholders, recursos, situación)
3. TRADE-OFF/RIESGO: Reconoce una desventaja ("aunque", "el riesgo es", "acepto que")

EJEMPLOS QUE DEBEN PASAR (isDeepEnough = true):
- "Prioritizo X porque Y." ✓
- "Elijo X para lograr Y, aunque afecte Z." ✓
- "Mi prioridad es X; el riesgo principal es Y." ✓
- "La opción A porque protege al equipo." ✓
- "Elijo B considerando el presupuesto." ✓

SOLO PIDE REVISIÓN si la respuesta:
- Es literalmente vacía
- No tiene NINGÚN elemento de prioridad, referencia al caso, o trade-off
- Es texto completamente sin relación con el escenario

=== MENTOR NUDGE (NO BLOQUEA, solo sugiere) ===
Si aceptas pero quieres sugerir mejora, usa strengthsAcknowledged para dar un nudge opcional:

Nudges opcionales (LOCKED):
- "Tu respuesta es válida. Para hacerla más sólida, añade qué priorizas y por qué."
- "¿Qué trade-off estás aceptando?"
- "¿A quién afecta más tu decisión?"
- "¿Qué riesgo te preocupa más?"

IMPORTANTE: Los nudges NO bloquean. Son sugerencias para el siguiente turno.

FORMATO DE SALIDA (JSON):
{
  "isDeepEnough": true/false,
  "revisionPrompt": "<solo si isDeepEnough=false, máximo 1 oración>",
  "missingConsiderations": [],
  "strengthsAcknowledged": "<qué hizo bien + nudge opcional si aplica>",
  "hasPriority": true/false,
  "hasCaseReference": true/false,
  "hasTradeoff": true/false
}`;

// S4.2: Only 1 revision max to keep flow smooth
const MAX_REVISIONS = 1;

// S4.2: Quick regex patterns to detect relevance + structure
const PRIORITY_PATTERNS = [
  /\b(priorit|prioriz|lo más importante|mi prioridad|primero|enfoc|optimi)/i,
  /\b(elijo|escojo|decido|opto por)\b.*\b(porque|para|ya que)/i,
];

const TRADEOFF_PATTERNS = [
  /\b(aunque|a pesar|sin embargo|pero|el riesgo|acepto que|sacrific|compromis)/i,
  /\b(desventaja|inconveniente|problema|costo|pérdida|afect)/i,
];

const CASE_REFERENCE_PATTERNS = [
  /\b(equipo|cliente|presupuesto|tiempo|proyecto|empresa|empleado|stakeholder)/i,
  /\b(lanzamiento|producto|servicio|mercado|competencia|recurso|objetivo)/i,
];

function hasRelevanceStructure(input: string): { hasPriority: boolean; hasTradeoff: boolean; hasCaseRef: boolean; passes: boolean } {
  const trimmed = input.trim().toLowerCase();
  
  const hasPriority = PRIORITY_PATTERNS.some(p => p.test(trimmed));
  const hasTradeoff = TRADEOFF_PATTERNS.some(p => p.test(trimmed));
  const hasCaseRef = CASE_REFERENCE_PATTERNS.some(p => p.test(trimmed));
  
  // S4.2: Pass if at least one criterion is met
  const passes = hasPriority || hasTradeoff || hasCaseRef;
  
  return { hasPriority, hasTradeoff, hasCaseRef, passes };
}

export async function evaluateDepth(
  context: AgentContext,
  revisionAttempts: number = 0,
  options?: { customPrompt?: string; model?: SupportedModel }
): Promise<DepthEvaluatorOutput> {
  // Auto-accept after max revisions
  if (revisionAttempts >= MAX_REVISIONS) {
    return {
      isDeepEnough: true,
      strengthsAcknowledged: "El estudiante ha compartido su perspectiva",
    };
  }
  
  // S4.2: Quick relevance+structure check (no LLM needed for obvious cases)
  const studentInput = context.studentInput?.trim() || "";
  const relevance = hasRelevanceStructure(studentInput);
  
  if (relevance.passes) {
    // Build appropriate mentor nudge based on what's missing
    let nudge = "";
    if (!relevance.hasPriority && !relevance.hasTradeoff) {
      nudge = " Para hacerla más sólida, añade qué priorizas y por qué.";
    } else if (!relevance.hasTradeoff) {
      nudge = " ¿Qué trade-off estás aceptando?";
    }
    
    return {
      isDeepEnough: true,
      strengthsAcknowledged: `Tu respuesta es válida.${nudge}`,
    };
  }
  
  // For very short inputs without clear structure, still be lenient
  if (studentInput.length >= 20) {
    return {
      isDeepEnough: true,
      strengthsAcknowledged: "Tu respuesta es válida. Para hacerla más sólida, añade qué priorizas y por qué.",
    };
  }

  // Get current decision point configuration
  const currentDecisionNum = context.currentDecision || 1;
  const decisionPoint = context.decisionPoints?.find(dp => dp.number === currentDecisionNum);
  
  // Build context about what this decision requires
  const requiresJustification = decisionPoint?.requiresJustification ?? true;
  const includesReflection = decisionPoint?.includesReflection ?? false;
  const decisionFormat = decisionPoint?.format || "written";

  const recentHistory = context.history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

  const userPrompt = `
CONTEXTO DE LA SIMULACIÓN:
Escenario: "${context.scenario.title}"
Dominio: ${context.scenario.domain}
Rol del estudiante: ${context.scenario.role}
Objetivo: ${context.scenario.objective}
${context.scenario.situationBackground ? `Situación: ${context.scenario.situationBackground}` : ""}

CONFIGURACIÓN DE ESTA DECISIÓN:
- Número de decisión: ${currentDecisionNum} de ${context.totalDecisions || 3}
- Formato: ${decisionFormat}
- Requiere justificación: ${requiresJustification ? "Sí" : "No"}
- Incluye reflexión: ${includesReflection ? "Sí" : "No"}
${decisionPoint?.prompt ? `- Pregunta planteada: "${decisionPoint.prompt}"` : ""}

HISTORIAL RECIENTE:
${recentHistory}

RESPUESTA DEL ESTUDIANTE: "${context.studentInput}"

INTENTOS DE REVISIÓN PREVIOS: ${revisionAttempts}

TAREA:
Evalúa si esta respuesta tiene suficiente profundidad para proceder.
${revisionAttempts > 0 ? "NOTA: El estudiante ya revisó su respuesta. Sé más permisivo en esta evaluación." : ""}
${!requiresJustification ? "NOTA: Esta decisión NO requiere justificación obligatoria, sé más permisivo." : ""}
${currentDecisionNum === (context.totalDecisions || 3) ? `
REQUISITO ESPECIAL - DECISIÓN FINAL (INTEGRATIVA):
Esta es la última decisión del escenario. El estudiante DEBE demostrar SÍNTESIS de:
1. Información previa del caso y decisiones anteriores
2. Trade-offs considerados a lo largo de la simulación
3. Cómo las consecuencias previas influyen en esta decisión final
Si la respuesta no hace referencia a decisiones anteriores o no integra el contexto acumulado, solicita revisión pidiendo que conecte esta decisión con lo aprendido en las decisiones previas.` : ""}`;

  const systemPrompt = options?.customPrompt || DEFAULT_DEPTH_EVALUATOR_PROMPT;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 512, model: options?.model, agentName: "depthEvaluator" }
    );

    const parsed = JSON.parse(response);
    
    return {
      isDeepEnough: parsed.isDeepEnough === true,
      revisionPrompt: parsed.isDeepEnough ? undefined : parsed.revisionPrompt,
      missingConsiderations: parsed.missingConsiderations || [],
      strengthsAcknowledged: parsed.strengthsAcknowledged,
    };
  } catch (error) {
    console.error("DepthEvaluator agent error:", error);
    // On error, accept the answer to avoid blocking the student
    return {
      isDeepEnough: true,
      strengthsAcknowledged: "Respuesta procesada",
    };
  }
}
