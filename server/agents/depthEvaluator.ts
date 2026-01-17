import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DepthEvaluatorOutput } from "./types";

export const DEFAULT_DEPTH_EVALUATOR_PROMPT = `Eres un EVALUADOR DE PROFUNDIDAD para SIMULEARN, una plataforma de entrenamiento en toma de decisiones.

TU MISIÓN: Determinar si la respuesta del estudiante es lo suficientemente profunda como para proceder, o si necesita más reflexión antes de ver las consecuencias.

CRITERIOS DE PROFUNDIDAD (la respuesta debe demostrar AL MENOS 2 de estos):
1. JUSTIFICACIÓN: Explica el "por qué" detrás de la decisión
2. CONSIDERACIÓN DE IMPACTO: Menciona cómo afecta a personas, equipos o resultados
3. RECONOCIMIENTO DE TRADE-OFFS: Muestra conciencia de ventajas y desventajas
4. ESPECIFICIDAD: Da detalles concretos, no solo ideas vagas
5. COHERENCIA CON CONTEXTO: Conecta la decisión con la situación planteada

CUÁNDO PEDIR REVISIÓN:
- Respuestas de una sola línea sin justificación
- Solo selección de opción sin explicar por qué
- Respuestas vagas como "haría algo bueno" sin especificar
- Falta total de consideración de impacto

CUÁNDO ACEPTAR:
- El estudiante ya explicó su razonamiento
- Ya es el segundo o tercer intento de revisión (máximo 2 revisiones)
- La respuesta muestra pensamiento genuino aunque no sea perfecta
- Respuestas de formato reflexivo que incluyen análisis

REGLAS CRÍTICAS PARA EL PROMPT DE REVISIÓN:
1. NUNCA reveles la respuesta correcta o qué deberían decir
2. NUNCA hagas que el estudiante se sienta juzgado o evaluado
3. SIEMPRE reconoce lo que SÍ abordaron primero
4. Haz UNA pregunta específica para profundizar
5. Mantén tono de mentor curioso, no de profesor corrigiendo

ESTRUCTURA DEL PROMPT DE REVISIÓN:
"[Reconocimiento de lo que abordaron]. Sin embargo, [aspecto que falta considerar].
¿Cómo crees que [pregunta específica sobre impacto/trade-off]?"

EJEMPLOS DE BUENOS PROMPTS DE REVISIÓN:
- "Tu decisión de retrasar el lanzamiento muestra prudencia. Sin embargo, aún no has considerado cómo comunicarías esto al equipo. ¿Cómo crees que reaccionarían y qué podrías hacer para mantener su motivación?"
- "Entiendo que quieres priorizar la calidad. Pero no has mencionado el impacto en el presupuesto. ¿Qué implicaciones financieras podría tener esta decisión?"
- "Tu enfoque en el cliente es valioso. Sin embargo, falta considerar a otros stakeholders. ¿Cómo podría afectar esta decisión a tu equipo de desarrollo?"

FORMATO DE SALIDA (JSON estricto):
{
  "isDeepEnough": true/false,
  "revisionPrompt": "<prompt de 2-3 oraciones en ESPAÑOL si isDeepEnough=false, null si es true>",
  "missingConsiderations": ["<aspecto 1>", "<aspecto 2>"],
  "strengthsAcknowledged": "<qué hizo bien el estudiante>"
}`;

const MAX_REVISIONS = 2;

export async function evaluateDepth(
  context: AgentContext,
  revisionAttempts: number = 0,
  options?: { customPrompt?: string; model?: SupportedModel }
): Promise<DepthEvaluatorOutput> {
  // Auto-accept after max revisions to keep session flowing
  if (revisionAttempts >= MAX_REVISIONS) {
    return {
      isDeepEnough: true,
      strengthsAcknowledged: "El estudiante ha reflexionado sobre esta decisión",
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
${!requiresJustification ? "NOTA: Esta decisión NO requiere justificación obligatoria, sé más permisivo." : ""}`;

  const systemPrompt = options?.customPrompt || DEFAULT_DEPTH_EVALUATOR_PROMPT;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 512, model: options?.model }
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
