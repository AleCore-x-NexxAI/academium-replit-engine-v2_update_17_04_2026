import { generateChatCompletion } from "../openai";
import type { AgentContext, CausalExplanation, DisplayKPI, DomainExpertOutput } from "./types";
import { RDSBand, SignalQuality } from "./types";
import { getLanguageDirective } from "./guardrails";

function getRDSDepthDirective(rdsBand: RDSBand | undefined): string {
  switch (rdsBand) {
    case RDSBand.INTEGRATED:
      return "3-4 oraciones. Los 3 componentes con detalle específico del caso. Ancla directamente a señales STRONG del estudiante (parafrasea sus palabras).";
    case RDSBand.ENGAGED:
      return "2-3 oraciones. Los 3 componentes presentes. Ancla ligeramente a señales (referencia el dominio de la señal).";
    default:
      return "2 oraciones. Componentes 1 (Referencia a Decisión) y 3 (Conexión Direccional). Mecanismo implícito. Sin anclaje a señales.";
  }
}

function buildSignalAnchoring(context: AgentContext, indicatorId: string): string {
  if (!context.signalExtractionResult) return "";
  const rdsBand = context.rdsBand;
  if (!rdsBand || rdsBand === RDSBand.SURFACE) return "";

  const signals = context.signalExtractionResult;
  const anchors: string[] = [];

  if (signals.intent.quality >= SignalQuality.STRONG) {
    anchors.push(`Intent STRONG: la prioridad del estudiante fue "${signals.intent.extracted_text}". Referencia de Decisión debe ecoar esta prioridad.`);
  }
  if (signals.justification.quality >= SignalQuality.STRONG) {
    anchors.push(`Justification STRONG: el razonamiento causal del estudiante fue "${signals.justification.extracted_text}". Mecanismo debe referenciar este razonamiento.`);
  }
  if (signals.tradeoffAwareness.quality >= SignalQuality.STRONG) {
    anchors.push(`TradeoffAwareness STRONG: "${signals.tradeoffAwareness.extracted_text}". Conexión Direccional debe validar el costo anticipado.`);
  }
  if (signals.stakeholderAwareness.quality >= SignalQuality.STRONG) {
    anchors.push(`StakeholderAwareness STRONG: "${signals.stakeholderAwareness.extracted_text}". Mecanismo debe referenciar stakeholder nombrado.`);
  }
  if (signals.ethicalAwareness.quality >= SignalQuality.STRONG) {
    anchors.push(`EthicalAwareness STRONG: "${signals.ethicalAwareness.extracted_text}". Mecanismo debe referenciar dimensión ética.`);
  }

  return anchors.length > 0 ? `\nANCLAJE DE SEÑALES:\n${anchors.join("\n")}` : "";
}

export async function generateCausalExplanations(
  context: AgentContext,
  kpiImpact: DomainExpertOutput,
  narrativeText: string,
): Promise<CausalExplanation[]> {
  const displayKPIs = kpiImpact.displayKPIs || [];
  if (displayKPIs.length === 0) return [];

  const rdsBand = context.rdsBand;
  const depthDirective = getRDSDepthDirective(rdsBand);
  const signalAnchoring = buildSignalAnchoring(context, "");
  const language = context.language || "es";
  const isEn = language === "en";

  const currentDecisionNum = context.currentDecision || (context.turnCount + 1);
  const currentDP = context.decisionPoints?.find(dp => dp.number === currentDecisionNum);
  const isMcq = currentDP?.format === "multiple_choice";
  const tradeoffSignature = currentDP?.tradeoffSignature ||
    (isMcq && currentDP?.optionSignatures
      ? Object.values(currentDP.optionSignatures)[0]
      : undefined);

  const tradeoffContext = tradeoffSignature
    ? `\nTRADEOFF DEL CASO: Dimensión="${tradeoffSignature.dimension}", Beneficio="${tradeoffSignature.benefit}", Costo="${tradeoffSignature.cost}". Las explicaciones deben reflejar esta dinámica de tradeoff en los mecanismos causales.`
    : "";

  const kpiDescriptions = displayKPIs.map(d =>
    `- ${d.indicatorId} (${d.label}): ${d.direction === "up" ? "↑" : "↓"} ${d.magnitude}, delta=${d.delta}, razón="${d.shortReason}"`
  ).join("\n");

  const systemPrompt = `Eres un generador de EXPLICACIONES CAUSALES para Academium.

ESTRUCTURA DE 3 PARTES POR INDICADOR (OBLIGATORIA):
1. **Referencia a la Decisión**: Qué decidió el estudiante, en términos organizacionales. Tercera persona ("La decisión de..."). NUNCA segunda persona. NUNCA evaluativo.
2. **Mecanismo Causal**: CÓMO la decisión produjo el efecto en este dominio de indicador. La vía organizacional. Debe ser causalmente defendible. NUNCA evaluativo.
3. **Conexión Direccional**: POR QUÉ el mecanismo movió la métrica en esta dirección. Una oración. Sin juicio.

PROHIBIDO:
- NO hay componente "qué significa hacia adelante". Las prescripciones futuras están EXPLÍCITAMENTE PROHIBIDAS.
- NUNCA segunda persona ("tu decisión", "you decided")
- NUNCA evaluativo ("buena/mala", "correcta/incorrecta", "debería haber")
- NUNCA prescribir acciones correctivas ("debería", "podría mejorar")
- NUNCA revelar lógica de corrección de anti-patrones
- NUNCA signos de exclamación (!)

TEST DE PISTA: ¿La explicación prescribe una acción correctiva específica para la siguiente decisión? Si sí → PROHIBIDO. Describe el mecanismo organizacional, nunca nombres la brecha específica ni la acción correctiva.

PROFUNDIDAD: ${depthDirective}
${signalAnchoring}` + getLanguageDirective(language);

  const userPrompt = `
DECISIÓN DEL ESTUDIANTE: "${context.studentInput}"
${tradeoffContext}

INDICADORES QUE CAMBIARON:
${kpiDescriptions}

NARRATIVA GENERADA (para consistencia):
"${narrativeText.substring(0, 300)}"

Genera una explicación causal para CADA indicador mostrado. Devuelve JSON:
{
  "explanations": [
    {
      "indicatorId": "<id>",
      "decisionReference": "<Referencia a la Decisión>",
      "causalMechanism": "<Mecanismo Causal>",
      "directionalConnection": "<Conexión Direccional>"
    }
  ]
}`;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 768, model: "gpt-4o-mini", agentName: "causalExplainer", sessionId: parseInt(context.sessionId) || undefined }
    );

    const parsed = JSON.parse(response) as {
      explanations?: Array<{
        indicatorId?: string;
        decisionReference?: string;
        causalMechanism?: string;
        directionalConnection?: string;
      }>;
    };
    const explanations: CausalExplanation[] = (parsed.explanations || []).map(e => ({
      indicatorId: e.indicatorId || "",
      decisionReference: e.decisionReference || "",
      causalMechanism: e.causalMechanism || "",
      directionalConnection: e.directionalConnection || "",
    }));

    const validIds = new Set(displayKPIs.map(d => d.indicatorId));
    const filtered = explanations.filter(e => validIds.has(e.indicatorId));

    const prescriptivePatterns = [
      /\b(deberías|should|must|need to|hay que|es necesario|conviene)\b/i,
      /\b(te recomiendo|se recomienda|would be better|you should)\b/i,
      /\b(la próxima vez|next time|en el futuro|going forward)\b/i,
    ];
    const secondPersonPatterns = [
      /\b(tu |tus |usted |your |you )\b/i,
    ];

    for (const exp of filtered) {
      const fullText = `${exp.decisionReference} ${exp.causalMechanism} ${exp.directionalConnection}`;

      for (const pattern of prescriptivePatterns) {
        exp.decisionReference = exp.decisionReference.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
        exp.causalMechanism = exp.causalMechanism.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
        exp.directionalConnection = exp.directionalConnection.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
      }

      for (const pattern of secondPersonPatterns) {
        exp.decisionReference = exp.decisionReference.replace(pattern, "la ").replace(/\s{2,}/g, " ").trim();
      }

      exp.decisionReference = exp.decisionReference.replace(/!/g, ".");
      exp.causalMechanism = exp.causalMechanism.replace(/!/g, ".");
      exp.directionalConnection = exp.directionalConnection.replace(/!/g, ".");
    }

    return filtered;
  } catch {
    return displayKPIs.map(d => ({
      indicatorId: d.indicatorId,
      decisionReference: isEn
        ? "The decision has been registered."
        : "La decisión ha sido registrada.",
      causalMechanism: "",
      directionalConnection: d.shortReason || (isEn
        ? "The impact reflects the organizational dynamics of this domain."
        : "El impacto refleja la dinámica organizacional de este dominio."),
    }));
  }
}
