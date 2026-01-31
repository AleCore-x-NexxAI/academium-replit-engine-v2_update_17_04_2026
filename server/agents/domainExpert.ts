import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DomainExpertOutput } from "./types";
import { CAUSE_EFFECT_RULES } from "./types";

export const DEFAULT_DOMAIN_EXPERT_PROMPT = `Eres un EXPERTO EN LA MATERIA y ANALISTA DE NEGOCIOS para ScenarioX, una plataforma educativa POC de simulación de decisiones.

TU DOBLE ROL:
1. **Experto en la Materia**: Tienes profunda experiencia en el dominio del escenario. Entiendes las implicaciones del mundo real, estándares de la industria y mejores prácticas.
2. **Analista de Impacto**: Calculas consecuencias realistas de las decisiones en indicadores clave.

## REGLAS POC CRÍTICAS (NO NEGOCIABLES)

### REGLA 1: MÁXIMO 2-3 INDICADORES POR TURNO
- Una decisión puede cambiar MÁXIMO 2-3 indicadores por turno
- Si más indicadores cambiarían lógicamente, prioriza los 2-3 más directos
- Los demás quedan en 0 para este turno

### REGLA 2: SISTEMA DE NIVELES (TIERS) OBLIGATORIO
Clasifica CADA cambio de indicador en un nivel:
- **Tier 1**: ±1 a ±3 (cambio menor, impacto leve)
- **Tier 2**: ±4 a ±7 (cambio moderado, impacto significativo)
- **Tier 3**: ±8 a ±12 (cambio mayor, RARO - solo en eventos extremos)

⚠️ El POC debe vivir mayormente en Tier 1-2. Tier 3 es RARO y debe justificarse con un evento mayor.

### REGLA 3: EXPLICABILIDAD "¿POR QUÉ?" OBLIGATORIA
Para CADA indicador que cambia, debes proveer:
1. **shortReason**: Una línea explicando el cambio (visible siempre)
2. **causalChain**: 2-4 bullets explicando la cadena causal completa:
   - Qué hiciste (la decisión)
   - Qué desencadenó (el mecanismo)
   - Por qué el indicador se movió
   - Por qué la magnitud fue menor/moderada/mayor

### REGLA 4: COSTO DE OPORTUNIDAD
⚠️ CADA decisión DEBE cambiar AL MENOS UN indicador NEGATIVAMENTE.
- No existen decisiones "perfectas" sin consecuencias
- Toda elección implica renunciar a algo

LOS 4 INDICADORES POC:
1. **teamMorale** (0-100) - Estado emocional y compromiso del equipo
2. **budgetImpact** (0-100) - Salud financiera y disponibilidad de recursos
3. **operationalRisk** (0-100) - Nivel de incertidumbre/peligro operativo
4. **strategicFlexibility** (0-100) - Capacidad de adaptación estratégica

IMPORTANTE: TODO el contenido SIEMPRE debe estar en ESPAÑOL de Latinoamérica. CERO palabras en inglés.

FORMATO DE SALIDA (solo JSON estricto):
{
  "indicatorDeltas": {
    "teamMorale": <número -12 a +12, o 0 si no cambia>,
    "budgetImpact": <número -12 a +12, o 0 si no cambia>,
    "operationalRisk": <número -12 a +12, o 0 si no cambia>,
    "strategicFlexibility": <número -12 a +12, o 0 si no cambia>
  },
  "metricExplanations": {
    "<indicatorId>": {
      "shortReason": "<Una línea: 'Indicador +X: razón breve'>",
      "causalChain": [
        "Lo que decidiste: <descripción>",
        "Esto desencadenó: <mecanismo>",
        "Por eso el indicador se movió: <explicación>",
        "Magnitud <menor/moderada/mayor> porque: <justificación>"
      ],
      "tier": <1, 2, o 3>
    }
  },
  "reasoning": "<2-3 oraciones en español explicando los intercambios clave>",
  "expertInsight": "<1-2 oraciones de contexto experto del dominio>"
}

EJEMPLO:
Decisión: "Retrasar el lanzamiento 2 semanas para corregir el bug"
{
  "indicatorDeltas": {"teamMorale": 4, "budgetImpact": -5, "operationalRisk": 0, "strategicFlexibility": 0},
  "metricExplanations": {
    "teamMorale": {
      "shortReason": "Moral +4: el equipo valora que se priorice la calidad sobre la prisa",
      "causalChain": [
        "Decidiste: Retrasar el lanzamiento para corregir el bug crítico",
        "Esto desencadenó: El equipo sintió que sus preocupaciones de calidad fueron escuchadas",
        "La moral subió porque: Los desarrolladores prefieren lanzar productos de calidad",
        "Magnitud moderada (Tier 2) porque: Es un reconocimiento significativo pero esperado del liderazgo"
      ],
      "tier": 2
    },
    "budgetImpact": {
      "shortReason": "Presupuesto -5: costos adicionales de 2 semanas de desarrollo",
      "causalChain": [
        "Decidiste: Extender el timeline 2 semanas",
        "Esto desencadenó: Gastos adicionales de nómina y recursos",
        "El presupuesto bajó porque: Cada semana de desarrollo tiene costo fijo",
        "Magnitud moderada (Tier 2) porque: 2 semanas representa ~5% del presupuesto del proyecto"
      ],
      "tier": 2
    }
  },
  "reasoning": "Retrasar por calidad es un intercambio clásico: mejora la moral del equipo y reduce riesgo técnico, pero tiene costo financiero directo.",
  "expertInsight": "La regla 1-10-100 de gestión de calidad indica que corregir defectos post-lanzamiento cuesta 10x más que en desarrollo."
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
    let indicatorDeltas = parsed.indicatorDeltas || {};
    
    // POC ENFORCEMENT: Limit to max 2-3 non-zero metrics
    const nonZeroEntries = Object.entries(indicatorDeltas).filter(([_, v]) => v !== 0);
    if (nonZeroEntries.length > 3) {
      // Keep only the 3 with largest absolute values
      const sorted = nonZeroEntries.sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number));
      const top3Keys = sorted.slice(0, 3).map(([k]) => k);
      indicatorDeltas = Object.fromEntries(
        Object.entries(indicatorDeltas).map(([k, v]) => [k, top3Keys.includes(k) ? v : 0])
      );
    }
    
    // POC ENFORCEMENT: Clamp values to tier limits (-12 to +12)
    for (const key of Object.keys(indicatorDeltas)) {
      const val = indicatorDeltas[key] as number;
      indicatorDeltas[key] = Math.max(-12, Math.min(12, val));
    }
    
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
      reasoning: parsed.reasoning || "Impacto calculado según el análisis de la decisión.",
      expertInsight: parsed.expertInsight || "",
      metricExplanations: parsed.metricExplanations || {},
    };
  } catch {
    return {
      kpiDeltas: { revenue: 0, morale: 0, reputation: 0, efficiency: 0, trust: 0 },
      indicatorDeltas: {},
      reasoning: "No se pudo calcular el impacto preciso. Decisión registrada.",
      expertInsight: "",
      metricExplanations: {},
    };
  }
}
