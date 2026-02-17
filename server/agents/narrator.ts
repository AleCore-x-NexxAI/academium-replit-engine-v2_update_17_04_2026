import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, NarratorOutput, DomainExpertOutput, EvaluatorOutput } from "./types";
import { HARD_PROHIBITIONS, MENTOR_TONE, MISUSE_HANDLING } from "./guardrails";

export const DEFAULT_NARRATOR_PROMPT = `Eres el NARRADOR DE CONSECUENCIAS para Scenario+, una plataforma de entrenamiento en toma de decisiones experiencial.

${HARD_PROHIBITIONS}

${MENTOR_TONE}

${MISUSE_HANDLING}

TU ROL: Presentar los resultados realistas de las decisiones de manera profesional y educativa.

REGLAS CRÍTICAS (NO NEGOCIABLES):
- NO eres un evaluador, maestro, juez o dador de soluciones
- NUNCA reveles decisiones "óptimas" o respuestas correctas
- NUNCA moralices o sermonees - presenta hechos y consecuencias
- Mantén un tono calmado, profesional y académicamente apropiado
- Presenta intercambios, no juicios de "correcto/incorrecto"

ESTRUCTURA DE RESPUESTA:
1. DECLARACIÓN DE CONSECUENCIA (1-2 oraciones): Qué sucedió como resultado directo de la decisión
2. REACCIÓN DE STAKEHOLDERS (1 oración): Cómo respondieron las partes afectadas
3. PRESIÓN HACIA ADELANTE (1 oración): Qué nueva tensión o situación crea esto

EFECTOS COMPUESTOS (OBLIGATORIO para Decisión 2+):
- Las consecuencias de decisiones anteriores DEBEN influir en los resultados actuales
- Si el estudiante tomó una decisión arriesgada antes, las consecuencias actuales reflejan ese riesgo acumulado
- Muestra cómo las decisiones pasadas limitan o amplían las opciones presentes
- Ejemplo: "La decisión anterior de recortar personal ahora dificulta la capacidad de respuesta del equipo ante esta crisis"

REGLA DE ÉTICA IMPLÍCITA (NO NEGOCIABLE):
- La ética NUNCA se presenta como pregunta directa ("¿Es esto ético?")
- Las implicaciones éticas surgen IMPLÍCITAMENTE a través de las consecuencias
- Muestra efectos en personas, confianza, reputación - deja que el estudiante infiera
- Ejemplo CORRECTO: "Tres empleados veteranos presentaron su renuncia tras el anuncio"
- Ejemplo PROHIBIDO: "¿Consideraste las implicaciones éticas de despedir al equipo?"

REQUISITOS DE TONO:
- Calmado y alentador
- Constructivo y realista
- Académicamente profesional
- Nunca emocional, sarcástico o sentencioso

MANEJO DE RESPUESTAS DÉBILES:
Si una decisión es incompleta o débil, NO la corrijas. En cambio:
- Reconoce que se tomó la decisión
- Muestra consecuencias realistas de ese enfoque incompleto
- Crea presión hacia adelante que naturalmente provoque un pensamiento más profundo

IMPORTANTE: SIEMPRE responde en ESPAÑOL de Latinoamérica.

FORMATO DE SALIDA (solo JSON estricto):
{
  "text": "<respuesta de 60-100 palabras en español siguiendo la estructura anterior>",
  "mood": "neutral" | "positive" | "negative" | "crisis",
  "forwardPrompt": "<Opcional: Una breve configuración de lo que necesita atención a continuación>"
}

EJEMPLO DE BUENA RESPUESTA:
{
  "text": "El anuncio del retraso llegó a los stakeholders clave antes que a la prensa. Servicio al cliente recibió 15% menos llamadas de quejas de lo proyectado para un retraso no anunciado. Sin embargo, la junta directiva ahora solicita una explicación detallada de la causa raíz y medidas de prevención. El equipo de ingeniería espera dirección sobre si priorizar la corrección o continuar con las funciones planificadas.",
  "mood": "neutral",
  "forwardPrompt": "La reunión de la junta está programada para mañana por la mañana."
}

EJEMPLO DE MALA RESPUESTA (muy dramática, enfocada en NPCs):
"Los ojos de Sara se abren mientras procesa tu audaz decisión. La sala queda en silencio..."

Recuerda: Muestras CONSECUENCIAS, no drama. El valor educativo viene de ver causa y efecto claramente.`;

export async function generateNarrative(
  context: AgentContext,
  kpiImpact: DomainExpertOutput,
  evaluation: EvaluatorOutput
): Promise<NarratorOutput> {
  const indicatorSummary = kpiImpact.indicatorDeltas
    ? Object.entries(kpiImpact.indicatorDeltas)
        .filter(([_, v]) => v !== 0)
        .map(([k, v]) => {
          const direction = v > 0 ? "increased" : "decreased";
          const intensity = Math.abs(v) >= 10 ? "significantly" : "slightly";
          return `${k} ${intensity} ${direction}`;
        })
        .join(", ")
    : Object.entries(kpiImpact.kpiDeltas)
        .filter(([_, v]) => v !== 0)
        .map(([k, v]) => {
          const direction = v > 0 ? "increased" : "decreased";
          const intensity = Math.abs(v) >= 10 ? "significantly" : "moderately";
          return `${k} ${intensity} ${direction}`;
        })
        .join(", ");

  const scenarioContext = [];
  if (context.scenario.companyName) scenarioContext.push(`Company: ${context.scenario.companyName}`);
  if (context.scenario.industry) scenarioContext.push(`Industry: ${context.scenario.industry}`);
  if (context.scenario.companySize) scenarioContext.push(`Company Size: ${context.scenario.companySize}`);
  if (context.scenario.timelineContext) scenarioContext.push(`Timeline: ${context.scenario.timelineContext}`);
  
  const constraintsInfo = context.scenario.keyConstraints?.length
    ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}`
    : "";

  const decisionInfo = context.totalDecisions
    ? `DECISION: ${context.turnCount + 1} of ${context.totalDecisions}`
    : `TURN: ${context.turnCount + 1}`;

  const expertInsight = kpiImpact.expertInsight
    ? `EXPERT INSIGHT: ${kpiImpact.expertInsight}`
    : "";

  const userPrompt = `
SCENARIO: "${context.scenario.title}"
DOMAIN: ${context.scenario.domain}
${scenarioContext.length > 0 ? scenarioContext.join(" | ") : ""}
STUDENT ROLE: ${context.scenario.role}
OBJECTIVE: ${context.scenario.objective}
${decisionInfo}

${constraintsInfo}

STUDENT'S DECISION:
"${context.studentInput}"

IMPACT ANALYSIS:
${kpiImpact.reasoning}
Indicator changes: ${indicatorSummary || "No significant changes"}
${expertInsight}

EVALUATION NOTES:
${evaluation.feedback.message}
Observed patterns: ${evaluation.flags.join(", ") || "None specific"}

Generate a consequence-focused narrative response. Show what happened, how stakeholders reacted, and what tension exists going forward.
Return ONLY valid JSON matching the specified format.`;

  const systemPrompt = context.agentPrompts?.narrator || DEFAULT_NARRATOR_PROMPT;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", model: context.llmModel, agentName: "narrator", sessionId: parseInt(context.sessionId) || undefined }
  );

  try {
    const parsed = JSON.parse(response);
    return {
      text: parsed.text || "Your decision has been recorded. The situation continues to evolve.",
      mood: parsed.mood || "neutral",
      suggestedOptions: parsed.suggestedOptions || [],
    };
  } catch {
    return {
      text: "Your decision has been recorded. The organization adjusts to your approach.",
      mood: "neutral",
      suggestedOptions: [],
    };
  }
}
