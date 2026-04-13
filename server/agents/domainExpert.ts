import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DomainExpertOutput, DisplayKPI, IndicatorAccumulation, MetricTier, TurnPosition } from "./types";
import { RDSBand, SignalQuality } from "./types";
import type { Indicator, IndicatorAccumulationEntry, TradeoffSignature } from "@shared/schema";
import { getLanguageDirective } from "./guardrails";

const MAX_DISPLAY_KPIS = 3;

function resolveOptionSignature(
  studentInput: string,
  optionSignatures: Record<string, TradeoffSignature>,
): TradeoffSignature | undefined {
  const trimmed = studentInput.trim().toLowerCase();
  for (const [optionKey, signature] of Object.entries(optionSignatures)) {
    if (trimmed === optionKey.toLowerCase() || trimmed.includes(optionKey.toLowerCase())) {
      return signature;
    }
  }
  return undefined;
}

function determineTurnPosition(context: AgentContext): TurnPosition {
  const current = context.currentDecision || context.turnCount + 1;
  const total = context.totalDecisions || 0;
  if (current <= 1) return "FIRST";
  if (total > 0 && current >= total) return "FINAL";
  return "INTERMEDIATE";
}

function getTierRange(tier: MetricTier): { min: number; max: number } {
  switch (tier) {
    case 1: return { min: 2, max: 5 };
    case 2: return { min: 6, max: 10 };
    case 3: return { min: 11, max: 16 };
  }
}

function clampToTier(delta: number, tier: MetricTier): number {
  const range = getTierRange(tier);
  const sign = delta >= 0 ? 1 : -1;
  const abs = Math.abs(delta);
  const clamped = Math.max(range.min, Math.min(range.max, abs));
  return sign * clamped;
}

function determineTier(
  indicatorId: string,
  rawDelta: number,
  rdsBand: RDSBand | undefined,
  signalQuality: number,
  accumulation: IndicatorAccumulation | undefined,
): MetricTier {
  const absDelta = Math.abs(rawDelta);
  if (absDelta === 0) return 1;

  if (rdsBand === RDSBand.SURFACE) return 1;

  if (absDelta >= 11) {
    return 2;
  }

  if (absDelta >= 6 && (signalQuality >= SignalQuality.PRESENT)) {
    if (accumulation && accumulation.consecutiveNegativeTurns >= 4 && signalQuality >= SignalQuality.PRESENT) {
      return 2;
    }
    return 2;
  }

  if (accumulation && accumulation.consecutiveNegativeTurns >= 3 && absDelta >= 4) {
    return 2;
  }

  return 1;
}

function updateAccumulation(
  prev: IndicatorAccumulation | undefined,
  delta: number,
  tier: MetricTier,
  turnNumber: number,
): IndicatorAccumulation {
  const base: IndicatorAccumulation = prev || {
    trajectory: "neutral",
    consecutiveNegativeTurns: 0,
    consecutivePositiveTurns: 0,
    lastTier: null,
    totalMovements: 0,
    firstAppearanceTurn: null,
  };

  if (delta === 0) return base;

  const isPositive = delta > 0;
  const isNegative = delta < 0;

  let consecutiveNeg = isNegative ? base.consecutiveNegativeTurns + 1 : 0;
  let consecutivePos = isPositive ? base.consecutivePositiveTurns + 1 : 0;

  let trajectory = base.trajectory;
  if (isPositive && base.trajectory === "negative") trajectory = "mixed";
  else if (isNegative && base.trajectory === "positive") trajectory = "mixed";
  else if (isPositive) trajectory = "positive";
  else if (isNegative) trajectory = "negative";

  return {
    trajectory: trajectory as IndicatorAccumulation["trajectory"],
    consecutiveNegativeTurns: consecutiveNeg,
    consecutivePositiveTurns: consecutivePos,
    lastTier: tier,
    totalMovements: base.totalMovements + 1,
    firstAppearanceTurn: base.firstAppearanceTurn ?? turnNumber,
  };
}

function applyRecoveryAttenuation(
  delta: number,
  tier: MetricTier,
  accumulation: IndicatorAccumulation | undefined,
): MetricTier {
  if (!accumulation) return tier;
  if (delta > 0 && accumulation.trajectory === "negative") {
    return 1;
  }
  return tier;
}

function selectDisplayKPIs(
  indicators: Indicator[],
  deltas: Record<string, number>,
  tiers: Record<string, MetricTier>,
  explanations: Record<string, import("./types").MetricExplanation>,
  accumulations: Record<string, IndicatorAccumulation>,
  signalScores: Record<string, number>,
  language: "es" | "en",
): DisplayKPI[] {
  const movedIndicators = indicators.filter(ind => (deltas[ind.id] || 0) !== 0);
  if (movedIndicators.length === 0) return [];

  const sorted = movedIndicators.sort((a, b) => {
    const tierA = tiers[a.id] || 1;
    const tierB = tiers[b.id] || 1;
    if (tierB !== tierA) return tierB - tierA;

    const firstA = accumulations[a.id]?.firstAppearanceTurn ?? 999;
    const firstB = accumulations[b.id]?.firstAppearanceTurn ?? 999;
    if (firstA === null && firstB !== null) return -1;
    if (firstB === null && firstA !== null) return 1;

    const sigA = signalScores[a.id] || 0;
    const sigB = signalScores[b.id] || 0;
    if (sigB !== sigA) return sigB - sigA;

    return Math.abs(deltas[b.id] || 0) - Math.abs(deltas[a.id] || 0);
  });

  const selected = sorted.slice(0, MAX_DISPLAY_KPIS);

  return selected.map(ind => {
    const delta = deltas[ind.id] || 0;
    const tier = tiers[ind.id] || 1;
    const direction: "up" | "down" = delta > 0 ? "up" : "down";
    const magnitudeMap: Record<MetricTier, { es: "Ligero" | "Moderado" | "Significativo"; en: "Slight" | "Moderate" | "Significant" }> = {
      1: { es: "Ligero", en: "Slight" },
      2: { es: "Moderado", en: "Moderate" },
      3: { es: "Significativo", en: "Significant" },
    };
    const explanation = explanations[ind.id];
    const shortReason = explanation?.shortReason || "";

    return {
      indicatorId: ind.id,
      label: ind.label,
      direction,
      magnitude: magnitudeMap[tier].es,
      magnitudeEn: magnitudeMap[tier].en,
      tier,
      delta,
      shortReason,
    };
  });
}

function detectAndCorrectAntiPatterns(
  indicators: Indicator[],
  deltas: Record<string, number>,
  tiers: Record<string, MetricTier>,
): { correctedDeltas: Record<string, number>; corrections: string[] } {
  const corrections: string[] = [];
  const corrected = { ...deltas };
  const moved = Object.entries(corrected).filter(([_, v]) => v !== 0);

  if (moved.length >= 2) {
    const allPositive = moved.every(([_, v]) => v > 0);
    const allNegative = moved.every(([_, v]) => v < 0);
    if (allPositive || allNegative) {
      const weakest = moved.reduce((min, curr) =>
        Math.abs(curr[1]) < Math.abs(min[1]) ? curr : min
      );
      const flipDirection = allPositive ? -1 : 1;
      corrected[weakest[0]] = flipDirection * getTierRange(1).min;
      tiers[weakest[0]] = 1;
      corrections.push(`uniform_direction_corrected:${weakest[0]}`);
    }
  }

  if (moved.length === 0 && indicators.length > 0) {
    const target = indicators[0];
    corrected[target.id] = target.direction === "down_better" ? -2 : 2;
    tiers[target.id] = 1;
    corrections.push(`zero_movement_corrected:${target.id}`);
  }

  for (const [key, tier] of Object.entries(tiers)) {
    if (tier === 3) {
      tiers[key] = 2;
      if (corrected[key]) {
        corrected[key] = clampToTier(corrected[key], 2);
      }
      corrections.push(`tier3_downgraded:${key}`);
    }
  }

  return { correctedDeltas: corrected, corrections };
}

function buildDomainExpertPrompt(indicators: Indicator[], rdsBand?: RDSBand): string {
  const indicatorList = indicators.map((ind, i) => {
    const directionNote = ind.direction === "down_better"
      ? "(menor es mejor)"
      : "(mayor es mejor)";
    return `${i + 1}. **${ind.id}** (0-100) - ${ind.label} ${directionNote}`;
  }).join("\n");

  const indicatorJsonFields = indicators.map(ind =>
    `    "${ind.id}": <número -16 a +16, o 0 si no cambia>`
  ).join(",\n");

  const tierGuidance = rdsBand === RDSBand.SURFACE
    ? "IMPORTANTE: Banda SURFACE — TODOS los cambios deben ser Tier 1 (±2 a ±5)."
    : "Distribuye cambios: Tier 1 (±2-5, cambios leves), Tier 2 (±6-10, cambios moderados). Tier 3 PROHIBIDO sin trigger pre-escrito.";

  return `Eres un EXPERTO EN LA MATERIA y ANALISTA DE IMPACTO para Academium, una plataforma de simulación de decisiones.

TU ROL: Calcular consecuencias realistas de decisiones en indicadores clave.

## SISTEMA DE NIVELES (TIERS)
${tierGuidance}
- Tier 1 (Ligero): ±2 a ±5 — efecto leve, la mayoría de movimientos
- Tier 2 (Moderado): ±6 a ±10 — requiere señal fuerte del estudiante
- Tier 3 (Significativo): ±11 a ±16 — SOLO con triggers pre-escritos

## REGLAS
- 2-4 indicadores deben cambiar por turno
- CADA decisión DEBE tener al menos un indicador negativo (costo de oportunidad)
- Los cambios deben ser ESPECÍFICOS a la decisión del estudiante
- shortReason DEBE citar o parafrasear palabras del estudiante

LOS INDICADORES:
${indicatorList}

FORMATO DE SALIDA (solo JSON):
{
  "indicatorDeltas": {
${indicatorJsonFields}
  },
  "metricExplanations": {
    "<indicatorId>": {
      "shortReason": "<Una línea citando la decisión del estudiante>",
      "tier": <1 o 2>
    }
  },
  "reasoning": "<2-3 oraciones explicando los intercambios>",
  "expertInsight": "<1-2 oraciones de contexto experto>"
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

  const rdsBand = context.rdsBand;
  const basePrompt = context.agentPrompts?.domainExpert || buildDomainExpertPrompt(indicators, rdsBand);
  const systemPrompt = basePrompt + getLanguageDirective(context.language);
  const turnPosition = determineTurnPosition(context);
  const language = context.language || "es";

  const industryInfo = [];
  if (context.scenario.industry) industryInfo.push(`Industria: ${context.scenario.industry}`);
  if (context.scenario.companySize) industryInfo.push(`Tamaño: ${context.scenario.companySize}`);
  if (context.scenario.companyName) industryInfo.push(`Empresa: ${context.scenario.companyName}`);

  const environmentInfo = [];
  if (context.scenario.industryContext) environmentInfo.push(`Dinámica: ${context.scenario.industryContext}`);
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

  const previousDecisions = context.history
    .filter(h => h.role === "user")
    .map((h, i) => `  Decisión ${i + 1}: "${h.content}"`)
    .join("\n");

  const signalInfo = context.signalExtractionResult
    ? `\nSEÑALES DETECTADAS:
- Intent: ${context.signalExtractionResult.intent.quality}/3 "${context.signalExtractionResult.intent.extracted_text}"
- Justification: ${context.signalExtractionResult.justification.quality}/3
- TradeoffAwareness: ${context.signalExtractionResult.tradeoffAwareness.quality}/3
- StakeholderAwareness: ${context.signalExtractionResult.stakeholderAwareness.quality}/3
- EthicalAwareness: ${context.signalExtractionResult.ethicalAwareness.quality}/3
RDS Band: ${rdsBand || "N/A"}`
    : "";

  const currentDecisionNum = context.currentDecision || (context.turnCount + 1);
  const currentDP = context.decisionPoints?.find(dp => dp.number === currentDecisionNum);
  const isMcq = currentDP?.format === "multiple_choice";
  const resolvedSignature = isMcq && currentDP?.optionSignatures
    ? resolveOptionSignature(context.studentInput, currentDP.optionSignatures)
    : currentDP?.tradeoffSignature;

  let tradeoffDirective = "";
  if (resolvedSignature) {
    tradeoffDirective = `\nTRADEOFF SIGNATURE (pre-authored, must be respected):
- Dimension: ${resolvedSignature.dimension}
- Benefit: ${resolvedSignature.benefit}
- Cost: ${resolvedSignature.cost}
${isMcq ? "This is an MCQ decision — KPI directions MUST align with the tradeoff signature. The benefit dimension should move positive, the cost dimension should move negative." : "Use as guidance for KPI direction."}`;
  }

  const userPrompt = `
CONTEXTO:
Escenario: "${context.scenario.title}"
Dominio: ${context.scenario.domain}
${industryInfo.length > 0 ? industryInfo.join(" | ") : ""}
Rol: ${context.scenario.role}
Objetivo: ${context.scenario.objective}
Posición: ${turnPosition} (Decisión ${context.turnCount + 1}${context.totalDecisions ? ` de ${context.totalDecisions}` : ""})

${environmentInfo.length > 0 ? `ENTORNO:\n${environmentInfo.join("\n")}\n` : ""}
${constraintsInfo}
${subjectMatterInfo}
${tradeoffDirective}

INDICADORES ACTUALES:
${currentIndicatorValues}

${previousDecisions ? `DECISIONES ANTERIORES:\n${previousDecisions}\n` : ""}
${signalInfo}

DECISIÓN ACTUAL:
"${context.studentInput}"

Calcula impactos específicos a esta decisión. Devuelve SOLO JSON válido.`;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", maxTokens: 768, model: context.llmModel, agentName: "domainExpert", sessionId: parseInt(context.sessionId) || undefined }
  );

  try {
    const parsed = JSON.parse(response);

    let indicatorDeltas: Record<string, number> = parsed.indicatorDeltas || {};

    const validIds = new Set(indicators.map(i => i.id));
    indicatorDeltas = Object.fromEntries(
      Object.entries(indicatorDeltas).filter(([k]) => validIds.has(k))
    );

    for (const key of Object.keys(indicatorDeltas)) {
      indicatorDeltas[key] = Math.max(-16, Math.min(16, indicatorDeltas[key] as number));
    }

    const rawExplanations = parsed.metricExplanations || {};
    const filteredExplanations: Record<string, import("./types").MetricExplanation> = {};
    for (const [key, val] of Object.entries(rawExplanations)) {
      if (validIds.has(key)) {
        const raw = val as { shortReason?: string; causalChain?: string[]; tier?: number };
        filteredExplanations[key] = {
          shortReason: raw.shortReason || "",
          causalChain: raw.causalChain || [],
          tier: (raw.tier === 1 || raw.tier === 2 || raw.tier === 3 ? raw.tier : 1) as import("./types").MetricTier,
        };
      }
    }

    const signalScores: Record<string, number> = {};
    if (context.signalExtractionResult) {
      for (const ind of indicators) {
        const id = ind.id;
        if (id === "revenue") signalScores[id] = context.signalExtractionResult.intent.quality;
        else if (id === "morale") signalScores[id] = context.signalExtractionResult.stakeholderAwareness.quality;
        else if (id === "reputation") signalScores[id] = context.signalExtractionResult.ethicalAwareness.quality;
        else if (id === "efficiency") signalScores[id] = context.signalExtractionResult.justification.quality;
        else if (id === "trust") signalScores[id] = context.signalExtractionResult.stakeholderAwareness.quality;
        else signalScores[id] = context.signalExtractionResult.intent.quality;
      }
    }

    const prevAccumulations: Record<string, IndicatorAccumulation> = {};
    if (context.indicatorAccumulation) {
      for (const [k, v] of Object.entries(context.indicatorAccumulation)) {
        prevAccumulations[k] = v as IndicatorAccumulation;
      }
    }

    const tiers: Record<string, MetricTier> = {};
    for (const ind of indicators) {
      const delta = indicatorDeltas[ind.id] || 0;
      if (delta === 0) continue;
      let tier = determineTier(
        ind.id,
        delta,
        rdsBand,
        signalScores[ind.id] || 0,
        prevAccumulations[ind.id],
      );
      tier = applyRecoveryAttenuation(delta, tier, prevAccumulations[ind.id]);
      tiers[ind.id] = tier;
    }

    const { correctedDeltas, corrections } = detectAndCorrectAntiPatterns(
      indicators, indicatorDeltas, tiers
    );
    indicatorDeltas = correctedDeltas;

    for (const key of Object.keys(indicatorDeltas)) {
      const delta = indicatorDeltas[key];
      const tier = tiers[key];
      if (delta !== 0 && tier) {
        indicatorDeltas[key] = clampToTier(delta, tier);
      }
    }

    const newAccumulations: Record<string, IndicatorAccumulation> = {};
    const turnNum = context.turnCount + 1;
    for (const ind of indicators) {
      newAccumulations[ind.id] = updateAccumulation(
        prevAccumulations[ind.id],
        indicatorDeltas[ind.id] || 0,
        tiers[ind.id] || 1,
        turnNum,
      );
    }

    const displayKPIs = selectDisplayKPIs(
      indicators, indicatorDeltas, tiers, filteredExplanations, newAccumulations, signalScores, language
    );

    const KNOWN_KPI_KEYS = ["revenue", "morale", "reputation", "efficiency", "trust"];
    const kpiDeltas: Record<string, number> = {
      revenue: 0, morale: 0, reputation: 0, efficiency: 0, trust: 0,
    };
    for (const [key, val] of Object.entries(indicatorDeltas)) {
      if (KNOWN_KPI_KEYS.includes(key)) {
        kpiDeltas[key] = key === "revenue" ? (val as number) * 1000 : (val as number);
      }
    }

    return {
      kpiDeltas,
      indicatorDeltas,
      reasoning: parsed.reasoning || "Impacto calculado según el análisis de la decisión.",
      expertInsight: parsed.expertInsight || "",
      metricExplanations: filteredExplanations,
      displayKPIs,
      indicatorAccumulation: newAccumulations,
      antiPatternCorrections: corrections.length > 0 ? corrections : undefined,
    };
  } catch {
    return {
      kpiDeltas: { revenue: 0, morale: 0, reputation: 0, efficiency: 0, trust: 0 },
      indicatorDeltas: {},
      reasoning: "No se pudo calcular el impacto preciso. Decisión registrada.",
      expertInsight: "",
      metricExplanations: {},
      displayKPIs: [],
      indicatorAccumulation: {},
    };
  }
}
