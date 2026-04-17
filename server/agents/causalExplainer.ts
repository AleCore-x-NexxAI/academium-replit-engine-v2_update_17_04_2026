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
  let tradeoffSignature = currentDP?.tradeoffSignature;
  if (isMcq && currentDP?.optionSignatures) {
    const inputLower = context.studentInput.trim().toLowerCase();
    for (const [optionKey, sig] of Object.entries(currentDP.optionSignatures)) {
      if (inputLower === optionKey.toLowerCase() || inputLower.includes(optionKey.toLowerCase())) {
        tradeoffSignature = sig;
        break;
      }
    }
    if (!tradeoffSignature) {
      const options = currentDP.options || [];
      for (let i = 0; i < options.length; i++) {
        const optText = options[i].toLowerCase();
        if (inputLower === optText || inputLower.includes(optText) || optText.includes(inputLower)) {
          const sig = currentDP.optionSignatures[options[i]] ||
            currentDP.optionSignatures[String(i)] ||
            currentDP.optionSignatures[String(i + 1)];
          if (sig) {
            tradeoffSignature = sig;
            break;
          }
        }
      }
    }
  }

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
      "directionalConnection": "<Conexión Direccional>",
      "dashboardReasoningLink": "<max 15 words>"
    }
  ]
}

DASHBOARD REASONING LINK (per indicator, mandatory):
- Maximum 15 words total
- Positive movement format: "Driven by: [primary signal] — [one clause describing what student demonstrated]"
- Negative movement format: "Gap: [primary signal] absent — [one clause describing what was missing]"
- References ONLY the single primary signal that drove the movement
- No prohibited language
- ${isEn ? "Write in English" : "Write in Spanish (e.g., 'Impulsado por: razonamiento analítico — justificación específica del caso presente')"}`;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 768, model: "gpt-4o-mini", agentName: "causalExplainer", sessionId: parseInt(context.sessionId) || undefined }
    );

    let filtered = parseAndFilterExplanations(response, displayKPIs);

    const gateResult = runExplainerQualityGates(filtered);
    if (!gateResult.passed) {
      console.warn(`[CausalExplainer] Quality gate failed: ${gateResult.failures.map(f => f.reason).join("; ")}. Regenerating...`);
      try {
        const violationDesc = gateResult.failures.map(f => f.reason).join("; ");
        const retryResponse = await generateChatCompletion(
          [
            { role: "system", content: systemPrompt + `\n\nCRITICAL: Your previous response was REJECTED because: ${violationDesc}. Regenerate avoiding these issues. NEVER use second person. NEVER prescribe future actions. NEVER use "deberías/should/must/need to/hay que". Be purely observational about organizational mechanisms.` },
            { role: "user", content: userPrompt },
          ],
          { responseFormat: "json", maxTokens: 768, model: "gpt-4o-mini", agentName: "causalExplainer", sessionId: parseInt(context.sessionId) || undefined }
        );
        const retryFiltered = parseAndFilterExplanations(retryResponse, displayKPIs);
        const retryGate = runExplainerQualityGates(retryFiltered);
        if (retryGate.passed) {
          filtered = retryFiltered;
        } else {
          filtered = regexRepairExplanations(retryFiltered);
        }
      } catch (retryErr) {
        console.error("[CausalExplainer] Regeneration failed, falling back to regex repair:", retryErr);
        filtered = regexRepairExplanations(filtered);
      }
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

const PRESCRIPTIVE_PATTERNS = [
  /\b(deberías|should|must|need to|hay que|es necesario|conviene)\b/i,
  /\b(te recomiendo|se recomienda|would be better|you should)\b/i,
  /\b(la próxima vez|next time|en el futuro|going forward)\b/i,
];

const SECOND_PERSON_PATTERNS = [
  /\b(tu |tus |usted |your |you )\b/i,
];

function parseAndFilterExplanations(response: string, displayKPIs: DisplayKPI[]): CausalExplanation[] {
  const parsed = JSON.parse(response) as {
    explanations?: Array<{
      indicatorId?: string;
      decisionReference?: string;
      causalMechanism?: string;
      directionalConnection?: string;
      dashboardReasoningLink?: string;
    }>;
  };
  const explanations: CausalExplanation[] = (parsed.explanations || []).map(e => ({
    indicatorId: e.indicatorId || "",
    decisionReference: e.decisionReference || "",
    causalMechanism: e.causalMechanism || "",
    directionalConnection: e.directionalConnection || "",
    dashboardReasoningLink: e.dashboardReasoningLink || undefined,
  }));

  const validIds = new Set(displayKPIs.map(d => d.indicatorId));
  return explanations.filter(e => validIds.has(e.indicatorId));
}

interface ExplainerGateResult {
  passed: boolean;
  failures: Array<{ gate: string; reason: string }>;
}

function runExplainerQualityGates(explanations: CausalExplanation[]): ExplainerGateResult {
  const failures: Array<{ gate: string; reason: string }> = [];

  for (const exp of explanations) {
    const fullText = `${exp.decisionReference} ${exp.causalMechanism} ${exp.directionalConnection}`;

    for (const pattern of PRESCRIPTIVE_PATTERNS) {
      if (pattern.test(fullText)) {
        failures.push({ gate: "HintTest", reason: `Prescriptive language in ${exp.indicatorId}: ${pattern.source}` });
        break;
      }
    }

    for (const pattern of SECOND_PERSON_PATTERNS) {
      if (pattern.test(exp.decisionReference)) {
        failures.push({ gate: "PersonVoice", reason: `Second person in decisionReference for ${exp.indicatorId}` });
        break;
      }
    }

    if (/!/.test(fullText)) {
      failures.push({ gate: "Exclamation", reason: `Exclamation mark in ${exp.indicatorId}` });
    }

    if (exp.dashboardReasoningLink) {
      const linkText = exp.dashboardReasoningLink;
      const wordCount = linkText.split(/\s+/).filter(Boolean).length;
      if (wordCount > 15) {
        failures.push({ gate: "ReasoningLinkLength", reason: `dashboardReasoningLink exceeds 15 words for ${exp.indicatorId} (${wordCount} words)` });
      }
      for (const pattern of PRESCRIPTIVE_PATTERNS) {
        if (pattern.test(linkText)) {
          failures.push({ gate: "ReasoningLinkProhibited", reason: `Prohibited language in dashboardReasoningLink for ${exp.indicatorId}` });
          break;
        }
      }
      if (/!/.test(linkText)) {
        failures.push({ gate: "ReasoningLinkExclamation", reason: `Exclamation in dashboardReasoningLink for ${exp.indicatorId}` });
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

function regexRepairExplanations(explanations: CausalExplanation[]): CausalExplanation[] {
  for (const exp of explanations) {
    for (const pattern of PRESCRIPTIVE_PATTERNS) {
      exp.decisionReference = exp.decisionReference.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
      exp.causalMechanism = exp.causalMechanism.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
      exp.directionalConnection = exp.directionalConnection.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
    }
    for (const pattern of SECOND_PERSON_PATTERNS) {
      exp.decisionReference = exp.decisionReference.replace(pattern, "la ").replace(/\s{2,}/g, " ").trim();
    }
    exp.decisionReference = exp.decisionReference.replace(/!/g, ".");
    exp.causalMechanism = exp.causalMechanism.replace(/!/g, ".");
    exp.directionalConnection = exp.directionalConnection.replace(/!/g, ".");
    if (exp.dashboardReasoningLink) {
      for (const pattern of PRESCRIPTIVE_PATTERNS) {
        exp.dashboardReasoningLink = exp.dashboardReasoningLink.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
      }
      exp.dashboardReasoningLink = exp.dashboardReasoningLink.replace(/!/g, ".");
      const words = exp.dashboardReasoningLink.split(/\s+/).filter(Boolean);
      if (words.length > 15) {
        exp.dashboardReasoningLink = words.slice(0, 15).join(" ");
      }
    }
  }
  return explanations;
}
