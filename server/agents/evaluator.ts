import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, EvaluatorOutput } from "./types";
import { COMPETENCY_DEFINITIONS } from "./types";
import { HARD_PROHIBITIONS, MENTOR_TONE } from "./guardrails";

export const DEFAULT_EVALUATOR_PROMPT = `Eres un OBSERVADOR DE COMPETENCIAS para Academium, una plataforma de entrenamiento en toma de decisiones experiencial.

${HARD_PROHIBITIONS}

${MENTOR_TONE}

TU ROL: Rastrear silenciosamente las competencias de aprendizaje mientras los estudiantes toman decisiones. Eres un evaluador INTERNO - tus puntuaciones son solo para uso del profesor/sistema, NO se muestran a los estudiantes.

REGLAS CRÍTICAS (NO NEGOCIABLES):
- NO eres un evaluador visible para los estudiantes
- NUNCA moralices, sermonees o juzgues en los mensajes de retroalimentación
- Tu puntuación interna rastrea el desarrollo de competencias a lo largo del tiempo
- Los mensajes de retroalimentación deben ser observaciones NEUTRALES, no evaluaciones
- NUNCA reveles puntuaciones, rankings o evaluaciones comparativas

MARCO DE COMPETENCIAS (seguimiento interno):
${Object.entries(COMPETENCY_DEFINITIONS)
  .map(([key, def]) => `
**${def.name}** (${key}):
${def.description}
✓ Indicadores fuertes: ${def.positiveIndicators.join("; ")}
✗ Áreas de desarrollo: ${def.negativeIndicators.join("; ")}`)
  .join("\n")}

PUNTUACIÓN INTERNA (1-5, nunca mostrada al estudiante):
5 = Demuestra comprensión sofisticada
4 = Muestra competencia sólida
3 = Aplicación adecuada
2 = Conciencia en desarrollo
1 = Etapa temprana de aprendizaje

MANEJO DE RESPUESTAS DÉBILES O INCOMPLETAS:
Cuando una decisión es débil o incompleta, tus notas internas deben:
1. Reconocer lo que el estudiante SÍ abordó
2. Notar qué consideraciones faltaron (para el panel del profesor)
3. Rastrear si el estudiante muestra crecimiento a través de las decisiones

IMPORTANTE: NO intentes "arreglar" respuestas débiles a través de la retroalimentación. Ese no es tu rol.

IMPORTANTE: El mensaje de retroalimentación SIEMPRE debe estar en ESPAÑOL de Latinoamérica.

TIPOS DE BANDERAS (seguimiento interno):
- STRATEGIC_THINKER: Muestra pensamiento a largo plazo
- DECISIVE_LEADER: Actúa con claridad
- EMPATHETIC_MANAGER: Considera el impacto humano
- RISK_AWARE: Reconoce intercambios
- COST_CONSCIOUS: Considera implicaciones de recursos
- NEEDS_DEEPER_ANALYSIS: La decisión carece de razonamiento profundo
- INCOMPLETE_RESPONSE: Faltan consideraciones clave

FORMATO DE SALIDA (JSON estricto, sin markdown):
{
  "competencyScores": {
    "strategicThinking": <1-5>,
    "ethicalReasoning": <1-5>,
    "decisionDecisiveness": <1-5>,
    "stakeholderEmpathy": <1-5>
  },
  "feedback": {
    "score": <0-100 puntuación de seguimiento interno>,
    "message": "<1-2 oraciones en ESPAÑOL de observación NEUTRAL sobre lo que abordó la decisión - NO evaluativa>",
    "hint": null
  },
  "flags": ["<flag1>", "<flag2>", ...]
}

Recuerda: Los estudiantes nunca ven tus puntuaciones ni retroalimentación evaluativa. Tu rol es rastrear el aprendizaje para el panel del profesor.`;

export async function evaluateDecision(context: AgentContext): Promise<EvaluatorOutput> {
  const recentHistory = context.history.slice(-6).map((h) => {
    const prefix = h.speaker ? `${h.speaker} (${h.role})` : h.role;
    return `${prefix}: ${h.content}`;
  }).join("\n");

  // Build rich context from enhanced scenario data
  const learningGoals = context.scenario.learningObjectives?.length
    ? `LEARNING OBJECTIVES: ${context.scenario.learningObjectives.join("; ")}`
    : "";
  const ethicsContext = context.scenario.ethicalDimensions?.length
    ? `ETHICAL DIMENSIONS TO CONSIDER: ${context.scenario.ethicalDimensions.join("; ")}`
    : "";
  const stakeholderContext = context.scenario.stakeholders?.length
    ? `KEY STAKEHOLDERS: ${context.scenario.stakeholders.map(s => `${s.name} (${s.role})`).join(", ")}`
    : "";
  const constraintsContext = context.scenario.keyConstraints?.length
    ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}`
    : "";

  const previousDecisions = context.history
    .filter((h: any) => h.role === "user")
    .map((h: any, i: number) => `  Decisión ${i + 1}: "${h.content}"`)
    .join("\n");

  const decisionNumber = context.turnCount + 1;
  const totalDecisions = context.totalDecisions || 3;

  const userPrompt = `
CONTEXTO DE LA SIMULACIÓN:
Escenario: "${context.scenario.title}"
Dominio: ${context.scenario.domain}
${context.scenario.companyName ? `Empresa: ${context.scenario.companyName}` : ""}
${context.scenario.industry ? `Industria: ${context.scenario.industry}` : ""}
Rol del estudiante: ${context.scenario.role}
Objetivo: ${context.scenario.objective}
Dificultad: ${context.scenario.difficultyLevel || "intermedio"}
Decisión: ${decisionNumber} de ${totalDecisions}

${learningGoals}
${ethicsContext}
${stakeholderContext}
${constraintsContext}
${context.scenario.situationBackground ? `SITUACIÓN: ${context.scenario.situationBackground}` : ""}

${previousDecisions ? `DECISIONES ANTERIORES:\n${previousDecisions}\n` : ""}

DECISIÓN ACTUAL DEL ESTUDIANTE: "${context.studentInput}"

CONTEXTO DE CONVERSACIÓN:
${recentHistory}

TAREA DE EVALUACIÓN:
Evalúa esta decisión (#${decisionNumber} de ${totalDecisions}) en las cuatro competencias.
IMPORTANTE - Tu mensaje de retroalimentación DEBE:
- Ser ESPECÍFICO a ESTA decisión concreta (decisión #${decisionNumber}), no genérico
- Mencionar elementos concretos de lo que el estudiante decidió
- Si hay decisiones anteriores, notar la evolución o consistencia del enfoque
- Adaptar el tono según la etapa: ${decisionNumber === 1 ? "primera decisión - observar el enfoque inicial" : decisionNumber === totalDecisions ? "última decisión - observar la madurez del razonamiento" : "decisión intermedia - observar cómo se construye sobre las anteriores"}
- Ser una observación NEUTRAL, no evaluativa
- Estar en ESPAÑOL de Latinoamérica

Devuelve tu evaluación completa en JSON.`;

  // Use custom prompt if provided, otherwise use default
  const systemPrompt = context.agentPrompts?.evaluator || DEFAULT_EVALUATOR_PROMPT;
  
  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 1024, model: context.llmModel, agentName: "evaluator", sessionId: parseInt(context.sessionId) || undefined }
    );

    const parsed = JSON.parse(response);
    
    const competencyScores = {
      strategicThinking: Math.max(1, Math.min(5, parsed.competencyScores?.strategicThinking || 3)),
      ethicalReasoning: Math.max(1, Math.min(5, parsed.competencyScores?.ethicalReasoning || 3)),
      decisionDecisiveness: Math.max(1, Math.min(5, parsed.competencyScores?.decisionDecisiveness || 3)),
      stakeholderEmpathy: Math.max(1, Math.min(5, parsed.competencyScores?.stakeholderEmpathy || 3)),
    };

    const feedback = {
      score: Math.max(0, Math.min(100, parsed.feedback?.score || 50)),
      message: parsed.feedback?.message || "Your decision has been noted. Consider how it might impact different stakeholders as the situation evolves.",
      hint: parsed.feedback?.hint,
    };

    return {
      competencyScores,
      feedback,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    };
  } catch (error) {
    console.error("Evaluator agent error:", error);
    return {
      competencyScores: {
        strategicThinking: 3,
        ethicalReasoning: 3,
        decisionDecisiveness: 3,
        stakeholderEmpathy: 3,
      },
      feedback: {
        score: 50,
        message: "Your approach shows initiative. Consider how various stakeholders might react to this decision and what ripple effects it could create.",
        hint: "Think about both the immediate impact and the longer-term implications of your choices.",
      },
      flags: ["DECISION_MAKER"],
    };
  }
}
