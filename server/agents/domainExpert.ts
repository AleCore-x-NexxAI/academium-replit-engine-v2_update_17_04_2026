import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DomainExpertOutput } from "./types";
import { CAUSE_EFFECT_RULES } from "./types";
import type { Indicator } from "@shared/schema";

function buildDomainExpertPrompt(indicators: Indicator[]): string {
  const indicatorList = indicators.map((ind, i) => {
    const directionNote = ind.direction === "down_better" 
      ? "(menor es mejor)" 
      : "(mayor es mejor)";
    return `${i + 1}. **${ind.id}** (0-100) - ${ind.label} ${directionNote}`;
  }).join("\n");

  const indicatorJsonFields = indicators.map(ind => 
    `    "${ind.id}": <número -12 a +12, o 0 si no cambia>`
  ).join(",\n");

  return `Eres un EXPERTO EN LA MATERIA y ANALISTA DE NEGOCIOS para Scenario+, una plataforma educativa de simulación de decisiones.

TU DOBLE ROL:
1. **Experto en la Materia**: Tienes profunda experiencia en el dominio del escenario. Entiendes las implicaciones del mundo real, estándares de la industria y mejores prácticas.
2. **Analista de Impacto**: Calculas consecuencias realistas de las decisiones en indicadores clave.

## REGLAS CRÍTICAS (NO NEGOCIABLES)

### REGLA 1: MÁXIMO 2-3 INDICADORES POR TURNO
- Una decisión puede cambiar MÁXIMO 2-3 indicadores por turno
- Si más indicadores cambiarían lógicamente, prioriza los 2-3 más directos
- Los demás quedan en 0 para este turno

### REGLA 2: SISTEMA DE NIVELES (TIERS) OBLIGATORIO
Clasifica CADA cambio de indicador en un nivel:
- **Tier 1**: ±1 a ±3 (cambio menor, impacto leve)
- **Tier 2**: ±4 a ±7 (cambio moderado, impacto significativo)
- **Tier 3**: ±8 a ±12 (cambio mayor, RARO - solo en eventos extremos)

⚠️ Las decisiones deben vivir mayormente en Tier 1-2. Tier 3 es RARO y debe justificarse con un evento mayor.

### REGLA 3: SENSIBILIDAD AL CONTEXTO (OBLIGATORIA)
Los cambios en indicadores DEBEN ser ESPECÍFICOS a la decisión real del estudiante:
- ANALIZA la decisión concreta y sus implicaciones únicas
- DIFERENTES decisiones deben producir DIFERENTES impactos
- NO apliques el mismo patrón genérico a todas las decisiones
- Considera las DECISIONES ANTERIORES y su efecto acumulado
- Si el estudiante tomó un enfoque conservador, el impacto será diferente que si fue agresivo

### REGLA 4: EXPLICABILIDAD "¿POR QUÉ?" OBLIGATORIA
Para CADA indicador que cambia, debes proveer:
1. **shortReason**: Una línea explicando el cambio (visible siempre)
2. **causalChain**: 2-4 bullets explicando la cadena causal completa:
   - Qué hiciste (la decisión)
   - Qué desencadenó (el mecanismo)
   - Por qué el indicador se movió
   - Por qué la magnitud fue menor/moderada/mayor

### REGLA 5: COSTO DE OPORTUNIDAD
⚠️ CADA decisión DEBE cambiar AL MENOS UN indicador NEGATIVAMENTE.
- No existen decisiones "perfectas" sin consecuencias
- Toda elección implica renunciar a algo

LOS INDICADORES DEL ESCENARIO:
${indicatorList}

IMPORTANTE: TODO el contenido SIEMPRE debe estar en ESPAÑOL de Latinoamérica. CERO palabras en inglés.

FORMATO DE SALIDA (solo JSON estricto):
{
  "indicatorDeltas": {
${indicatorJsonFields}
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
}`;
}

export const DEFAULT_DOMAIN_EXPERT_PROMPT = buildDomainExpertPrompt([
  { id: "revenue", label: "Ingresos / Presupuesto", value: 50, direction: "up_better" },
  { id: "morale", label: "Moral del Equipo", value: 50, direction: "up_better" },
  { id: "reputation", label: "Reputación de Marca", value: 50, direction: "up_better" },
  { id: "efficiency", label: "Eficiencia Operacional", value: 50, direction: "up_better" },
  { id: "trust", label: "Confianza de Stakeholders", value: 50, direction: "up_better" },
]);

const DEFAULT_INDICATORS: Indicator[] = [
  { id: "revenue", label: "Ingresos / Presupuesto", value: 50, direction: "up_better" },
  { id: "morale", label: "Moral del Equipo", value: 50, direction: "up_better" },
  { id: "reputation", label: "Reputación de Marca", value: 50, direction: "up_better" },
  { id: "efficiency", label: "Eficiencia Operacional", value: 50, direction: "up_better" },
  { id: "trust", label: "Confianza de Stakeholders", value: 50, direction: "up_better" },
];

export async function calculateKPIImpact(context: AgentContext): Promise<DomainExpertOutput> {
  const indicators = (context.indicators && context.indicators.length > 0)
    ? context.indicators
    : DEFAULT_INDICATORS;

  const systemPrompt = context.agentPrompts?.domainExpert || buildDomainExpertPrompt(indicators);

  const industryInfo = [];
  if (context.scenario.industry) industryInfo.push(`Industria: ${context.scenario.industry}`);
  if (context.scenario.companySize) industryInfo.push(`Tamaño de empresa: ${context.scenario.companySize}`);
  if (context.scenario.companyName) industryInfo.push(`Empresa: ${context.scenario.companyName}`);
  
  const environmentInfo = [];
  if (context.scenario.industryContext) environmentInfo.push(`Dinámica de industria: ${context.scenario.industryContext}`);
  if (context.scenario.competitiveEnvironment) environmentInfo.push(`Competencia: ${context.scenario.competitiveEnvironment}`);
  if (context.scenario.regulatoryEnvironment) environmentInfo.push(`Regulaciones: ${context.scenario.regulatoryEnvironment}`);
  if (context.scenario.resourceConstraints) environmentInfo.push(`Recursos: ${context.scenario.resourceConstraints}`);
  
  const constraintsInfo = context.scenario.keyConstraints?.length
    ? `RESTRICCIONES: ${context.scenario.keyConstraints.join("; ")}`
    : "";

  const subjectMatterInfo = context.scenario.subjectMatterContext
    ? `CONTEXTO DE LA MATERIA:\n${context.scenario.subjectMatterContext}`
    : "";

  const currentIndicatorValues = indicators
    .map(i => `- ${i.label} (${i.id}): ${i.value}`)
    .join("\n");

  const previousDecisions = (context.history as any[])
    .filter(h => h.role === "user")
    .map((h, i) => `  Decisión ${i + 1}: "${h.content}"`)
    .join("\n");

  const userPrompt = `
CONTEXTO DE LA SIMULACIÓN:
Escenario: "${context.scenario.title}"
Dominio: ${context.scenario.domain}
${industryInfo.length > 0 ? industryInfo.join(" | ") : ""}
Rol del estudiante: ${context.scenario.role}
Objetivo: ${context.scenario.objective}
Dificultad: ${context.scenario.difficultyLevel || "intermedio"}

${environmentInfo.length > 0 ? `ENTORNO EMPRESARIAL:\n${environmentInfo.join("\n")}\n` : ""}
${constraintsInfo}
${subjectMatterInfo}

INDICADORES ACTUALES:
${currentIndicatorValues}

NÚMERO DE DECISIÓN: ${context.turnCount + 1}${context.totalDecisions ? ` de ${context.totalDecisions}` : ""}

${previousDecisions ? `DECISIONES ANTERIORES DEL ESTUDIANTE:\n${previousDecisions}\n` : ""}

DECISIÓN ACTUAL DEL ESTUDIANTE:
"${context.studentInput}"

Como Experto en la Materia, analiza esta decisión específica y calcula los impactos en los indicadores con justificación del mundo real.
IMPORTANTE: Los cambios deben reflejar ESTA decisión específica, no un patrón genérico. Diferentes decisiones DEBEN producir diferentes impactos.
Devuelve SOLO JSON válido en el formato especificado.`;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", model: context.llmModel, agentName: "domainExpert", sessionId: parseInt(context.sessionId) || undefined }
  );

  try {
    const parsed = JSON.parse(response);
    
    let indicatorDeltas: Record<string, number> = parsed.indicatorDeltas || {};
    
    const validIds = new Set(indicators.map(i => i.id));
    indicatorDeltas = Object.fromEntries(
      Object.entries(indicatorDeltas).filter(([k]) => validIds.has(k))
    );
    
    const nonZeroEntries = Object.entries(indicatorDeltas).filter(([_, v]) => v !== 0);
    if (nonZeroEntries.length > 3) {
      const sorted = nonZeroEntries.sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number));
      const top3Keys = sorted.slice(0, 3).map(([k]) => k);
      indicatorDeltas = Object.fromEntries(
        Object.entries(indicatorDeltas).map(([k, v]) => [k, top3Keys.includes(k) ? v : 0])
      );
    }
    
    for (const key of Object.keys(indicatorDeltas)) {
      const val = indicatorDeltas[key] as number;
      indicatorDeltas[key] = Math.max(-12, Math.min(12, val));
    }
    
    const KNOWN_KPI_KEYS = ["revenue", "morale", "reputation", "efficiency", "trust"];
    const kpiDeltas: Record<string, number> = {
      revenue: 0, morale: 0, reputation: 0, efficiency: 0, trust: 0,
    };
    for (const [key, val] of Object.entries(indicatorDeltas)) {
      if (KNOWN_KPI_KEYS.includes(key)) {
        kpiDeltas[key] = key === "revenue" ? (val as number) * 1000 : (val as number);
      }
    }

    const rawExplanations = parsed.metricExplanations || {};
    const filteredExplanations: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawExplanations)) {
      if (validIds.has(key)) {
        filteredExplanations[key] = val;
      }
    }

    return {
      kpiDeltas,
      indicatorDeltas,
      reasoning: parsed.reasoning || "Impacto calculado según el análisis de la decisión.",
      expertInsight: parsed.expertInsight || "",
      metricExplanations: filteredExplanations,
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
