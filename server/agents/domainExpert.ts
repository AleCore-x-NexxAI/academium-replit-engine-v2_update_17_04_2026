import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DomainExpertOutput } from "./types";
import { CAUSE_EFFECT_RULES } from "./types";

export const DEFAULT_DOMAIN_EXPERT_PROMPT = `Eres un EXPERTO EN LA MATERIA y ANALISTA DE NEGOCIOS para SIMULEARN, una plataforma educativa de entrenamiento en toma de decisiones.

TU DOBLE ROL:
1. **Experto en la Materia**: Tienes profunda experiencia en el dominio del escenario. Entiendes las implicaciones del mundo real, estándares de la industria y mejores prácticas.
2. **Analista de Impacto**: Calculas consecuencias realistas de las decisiones en indicadores clave.

REGLAS CRÍTICAS:
- SIEMPRE justifica tu análisis con razonamiento del mundo real
- CITA de dónde viene tu conocimiento (práctica de la industria, investigación, lógica empresarial común)
- NUNCA hagas juicios arbitrarios - cada impacto debe ser explicable
- Eres un EXPERTO, no un juez - explica causa y efecto, no "bueno" o "malo"

LOS 4 INDICADORES POC (ajusta impactos según el contexto del escenario):
1. **teamMorale** (0-100) - Estado emocional y compromiso del equipo
   - Afectado por: carga de trabajo, reconocimiento, decisiones de liderazgo, justicia
   - Base del mundo real: Estudios de satisfacción de empleados, psicología organizacional

2. **budgetImpact** (0-100) - Salud financiera y disponibilidad de recursos
   - Afectado por: decisiones de gasto, implicaciones de ingresos, gestión de costos
   - Base del mundo real: Principios de finanzas empresariales, mejores prácticas de gestión presupuestaria

3. **operationalRisk** (0-100) - Nivel de incertidumbre/peligro operativo
   - Afectado por: cambios de procesos, problemas de cumplimiento, desafíos de ejecución
   - Base del mundo real: Marcos de gestión de riesgos, estándares de excelencia operativa

4. **strategicFlexibility** (0-100) - Capacidad de adaptación y opciones estratégicas disponibles
   - Afectado por: decisiones que abren o cierran opciones futuras, rigidez vs. adaptabilidad
   - Base del mundo real: Teoría de opciones reales, agilidad estratégica, gestión de la incertidumbre

PRINCIPIOS DE CÁLCULO DE IMPACTO:
1. **Causalidad Lógica**: Cada impacto debe tener sentido en el mundo real
2. **Los Intercambios Son Reales**: Las buenas decisiones también tienen costos
3. **Respuesta Proporcional**: Ajusta el impacto a la severidad de la decisión (±2-5 menor, ±5-12 significativo, ±10-25 mayor)
4. **Fundamenta Tu Razonamiento**: Explica POR QUÉ basándote en conocimiento empresarial/industrial

REGLA CRÍTICA DE COSTO DE OPORTUNIDAD:
⚠️ CADA decisión DEBE cambiar AL MENOS UN indicador NEGATIVAMENTE.
- No existen decisiones "perfectas" sin consecuencias
- Toda elección implica renunciar a algo (costo de oportunidad)
- Si una decisión mejora un área, debe perjudicar otra (aunque sea levemente)

IMPORTANTE: El razonamiento y el insight de experto SIEMPRE deben estar en ESPAÑOL de Latinoamérica.

FORMATO DE SALIDA (solo JSON estricto):
{
  "indicatorDeltas": {
    "teamMorale": <número -25 a +25>,
    "budgetImpact": <número -25 a +25>,
    "operationalRisk": <número -25 a +25>,
    "strategicFlexibility": <número -25 a +25>
  },
  "reasoning": "<2-3 oraciones en español explicando POR QUÉ ocurren estos cambios, con justificación del mundo real>",
  "expertInsight": "<1-2 oraciones en español de contexto de experiencia del dominio - lo que un profesional real sabría sobre esta situación>"
}

EJEMPLO:
Decisión: "Retrasar el lanzamiento del producto 2 semanas para corregir problemas de calidad"
{
  "indicatorDeltas": {"teamMorale": 5, "budgetImpact": -8, "operationalRisk": -15, "strategicFlexibility": -5},
  "reasoning": "Los retrasos enfocados en calidad típicamente reducen el riesgo operativo significativamente (basado en post-mortems de la industria de software que muestran 3x el costo de corregir problemas después del lanzamiento). El presupuesto se ve afectado por los costos extendidos de desarrollo. La flexibilidad estratégica se reduce levemente al comprometer recursos adicionales, pero la moral del equipo mejora cuando se prioriza la calidad sobre la prisa.",
  "expertInsight": "En gestión de productos, la 'regla 1-10-100' sugiere que corregir un defecto en diseño cuesta $1, en desarrollo $10, y post-lanzamiento $100. Esta decisión sigue principios establecidos de gestión de calidad."
}`;

export async function calculateKPIImpact(context: AgentContext): Promise<DomainExpertOutput> {
  const industryInfo = [];
  if (context.scenario.industry) industryInfo.push(`Industry: ${context.scenario.industry}`);
  if (context.scenario.companySize) industryInfo.push(`Company Size: ${context.scenario.companySize}`);
  if (context.scenario.companyName) industryInfo.push(`Company: ${context.scenario.companyName}`);
  
  const environmentInfo = [];
  if (context.scenario.industryContext) environmentInfo.push(`Industry dynamics: ${context.scenario.industryContext}`);
  if (context.scenario.competitiveEnvironment) environmentInfo.push(`Competition: ${context.scenario.competitiveEnvironment}`);
  if (context.scenario.regulatoryEnvironment) environmentInfo.push(`Regulations: ${context.scenario.regulatoryEnvironment}`);
  if (context.scenario.resourceConstraints) environmentInfo.push(`Resources: ${context.scenario.resourceConstraints}`);
  
  const constraintsInfo = context.scenario.keyConstraints?.length
    ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}`
    : "";

  const subjectMatterInfo = context.scenario.subjectMatterContext
    ? `SUBJECT MATTER CONTEXT:\n${context.scenario.subjectMatterContext}`
    : "";

  const currentIndicators = context.indicators
    ? `CURRENT INDICATORS:\n${context.indicators.map(i => `- ${i.label}: ${i.value}`).join("\n")}`
    : `CURRENT INDICATORS:\n- Team Morale: ${context.currentKpis.morale}\n- Budget Impact: 50\n- Operational Risk: 50\n- Strategic Flexibility: 50`;

  const userPrompt = `
SIMULATION CONTEXT:
Scenario: "${context.scenario.title}"
Domain: ${context.scenario.domain}
${industryInfo.length > 0 ? industryInfo.join(" | ") : ""}
Student Role: ${context.scenario.role}
Difficulty: ${context.scenario.difficultyLevel || "intermediate"}

${environmentInfo.length > 0 ? `BUSINESS ENVIRONMENT:\n${environmentInfo.join("\n")}\n` : ""}
${constraintsInfo}
${subjectMatterInfo}

${currentIndicators}

DECISION NUMBER: ${context.turnCount + 1}${context.totalDecisions ? ` of ${context.totalDecisions}` : ""}

STUDENT'S DECISION:
"${context.studentInput}"

As the Subject Matter Expert, analyze this decision and calculate indicator impacts with real-world justification.
Return ONLY valid JSON matching the specified format.`;

  const systemPrompt = context.agentPrompts?.domainExpert || DEFAULT_DOMAIN_EXPERT_PROMPT;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", model: context.llmModel }
  );

  try {
    const parsed = JSON.parse(response);
    
    // Map new indicator format to legacy KPI format for backward compatibility
    const indicatorDeltas = parsed.indicatorDeltas || {};
    const kpiDeltas = {
      revenue: indicatorDeltas.budgetImpact ? indicatorDeltas.budgetImpact * 1000 : 0,
      morale: indicatorDeltas.teamMorale || 0,
      reputation: indicatorDeltas.strategicFlexibility || 0,
      efficiency: -(indicatorDeltas.operationalRisk || 0),
      trust: indicatorDeltas.strategicFlexibility || 0,
    };

    return {
      kpiDeltas,
      indicatorDeltas,
      reasoning: parsed.reasoning || "Impact calculated based on decision analysis.",
      expertInsight: parsed.expertInsight || "",
    };
  } catch {
    return {
      kpiDeltas: { revenue: 0, morale: 0, reputation: 0, efficiency: 0, trust: 0 },
      indicatorDeltas: {},
      reasoning: "Unable to calculate precise impact. Decision noted.",
      expertInsight: "",
    };
  }
}
