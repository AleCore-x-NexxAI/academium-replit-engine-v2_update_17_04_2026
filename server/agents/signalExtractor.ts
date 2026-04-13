import { generateChatCompletion, SupportedModel } from "../openai";
import {
  SignalQuality,
  RDSBand,
  type SignalExtractionResult,
  type DecisionEvidenceLog,
  type AgentContext,
  computeRDS,
  classifyRDSBand,
  mapCompetencyEvidence,
} from "./types";
import { getLanguageDirective } from "./guardrails";

function getSignalExtractionPrompt(language: "es" | "en"): string {
  if (language === "en") {
    return `You are a SIGNAL EXTRACTOR for an educational business simulation. You analyze student decision text to detect reasoning signals.

Extract EXACTLY 5 signals from the student's response. Each signal is scored independently on a 4-level scale:
- STRONG (3): Clear, specific, case-anchored evidence
- PRESENT (2): Evidence exists but is generic or vague
- WEAK (1): Minimal or hedged evidence
- ABSENT (0): No evidence at all

THE 5 SIGNALS:

1. **Intent** — Does the student commit to a clear direction/priority/action?
   STRONG: Specific, directional, case-anchored ("I will prioritize client retention by offering...")
   PRESENT: Directional but generic ("I choose option A")
   WEAK: Hedged ("maybe we could...", "perhaps...")
   ABSENT: No commitment to any direction
   FALSE POSITIVE: A question is NOT intent. "Should we reduce costs?" = ABSENT, not PRESENT.

2. **Justification** — Does the student provide reasoning?
   STRONG: Case-specific causal chain ("Because our Q3 revenue dropped and the team is burned out, we need...")
   PRESENT: General causal reasoning ("Because it's important for the team")
   WEAK: Circular or merely asserted ("It's the right thing to do")
   ABSENT: No reasoning provided
   FALSE POSITIVE: Restating a case fact is NOT justification. Tautology ("X because X") = WEAK not PRESENT.

3. **Tradeoff Awareness** — Does the student acknowledge a cost or sacrifice?
   STRONG: Specific named tradeoff with consequence ("This will hurt short-term revenue but...")
   PRESENT: Acknowledged but vague ("There are some downsides")
   WEAK: Generic ("pros and cons")
   ABSENT: No downside mentioned
   NOTE: Always detect regardless of scenario configuration.

4. **Stakeholder Awareness** — Does the student consider impact on specific groups?
   STRONG: Named stakeholder + specific impact + why it matters ("The engineering team will face overtime, affecting morale")
   PRESENT: Named stakeholder with general impact ("The team will be affected")
   WEAK: Implied/generic ("the team", "people")
   ABSENT: No stakeholder consideration
   FALSE POSITIVE: "Everyone" or "the company" does NOT qualify as a named stakeholder.
   FALSE POSITIVE: Student referring to themselves is NOT stakeholder awareness.

5. **Ethical Awareness** — Does the student surface a principle/obligation/fairness concern?
   STRONG: Applied ethical principle with case connection ("We have a duty of transparency to our customers...")
   PRESENT: Acknowledged but generic ("It's about doing the right thing")
   WEAK: Abstract moral language ("it's important to be good")
   ABSENT: No ethical dimension
   NOTE: Recognizing ethical TENSION counts as strong ethical awareness.
   FALSE POSITIVE: Keyword "ethical" alone does NOT qualify. Must demonstrate actual ethical reasoning.

CRITICAL RULES:
- Grammar/spelling are NEVER scoring criteria
- Word count is NEVER a factor
- Score each signal INDEPENDENTLY — one signal's score does not affect another
- If unsure between two levels, choose the LOWER level

Return ONLY valid JSON:
{
  "intent": { "quality": 0-3, "extracted_text": "exact quote or '' if absent" },
  "justification": { "quality": 0-3, "extracted_text": "exact quote or '' if absent" },
  "tradeoffAwareness": { "quality": 0-3, "extracted_text": "exact quote or '' if absent" },
  "stakeholderAwareness": { "quality": 0-3, "extracted_text": "exact quote or '' if absent" },
  "ethicalAwareness": { "quality": 0-3, "extracted_text": "exact quote or '' if absent" }
}`;
  }

  return `Eres un EXTRACTOR DE SEÑALES para una simulación educativa de negocios. Analizas el texto de decisión del estudiante para detectar señales de razonamiento.

Extrae EXACTAMENTE 5 señales de la respuesta del estudiante. Cada señal se puntúa independientemente en una escala de 4 niveles:
- STRONG (3): Evidencia clara, específica, anclada al caso
- PRESENT (2): Existe evidencia pero es genérica o vaga
- WEAK (1): Evidencia mínima o con reservas
- ABSENT (0): Sin evidencia alguna

LAS 5 SEÑALES:

1. **Intent (Intención)** — ¿El estudiante se compromete con una dirección/prioridad/acción clara?
   STRONG: Específico, direccional, anclado al caso ("Voy a priorizar la retención de clientes ofreciendo...")
   PRESENT: Direccional pero genérico ("Elijo la opción A")
   WEAK: Con reservas ("quizás podríamos...", "tal vez...")
   ABSENT: Sin compromiso con ninguna dirección
   FALSO POSITIVO: Una pregunta NO es intención. "¿Deberíamos reducir costos?" = ABSENT, no PRESENT.

2. **Justification (Justificación)** — ¿El estudiante proporciona razonamiento?
   STRONG: Cadena causal específica del caso ("Porque nuestros ingresos del Q3 cayeron y el equipo está agotado...")
   PRESENT: Razonamiento causal general ("Porque es importante para el equipo")
   WEAK: Circular o meramente afirmado ("Es lo correcto")
   ABSENT: Sin razonamiento
   FALSO POSITIVO: Repetir un hecho del caso NO es justificación. Tautología ("X porque X") = WEAK no PRESENT.

3. **Tradeoff Awareness (Conciencia de Trade-offs)** — ¿El estudiante reconoce un costo o sacrificio?
   STRONG: Trade-off nombrado con consecuencia ("Esto afectará los ingresos a corto plazo pero...")
   PRESENT: Reconocido pero vago ("Hay algunas desventajas")
   WEAK: Genérico ("pros y contras")
   ABSENT: Sin mención de desventajas
   NOTA: Siempre detectar independientemente de la configuración del escenario.

4. **Stakeholder Awareness (Conciencia de Stakeholders)** — ¿El estudiante considera impacto en grupos específicos?
   STRONG: Stakeholder nombrado + impacto específico + por qué importa ("El equipo de ingeniería enfrentará horas extra, afectando su moral")
   PRESENT: Stakeholder nombrado con impacto general ("El equipo se verá afectado")
   WEAK: Implícito/genérico ("el equipo", "la gente")
   ABSENT: Sin consideración de stakeholders
   FALSO POSITIVO: "Todos" o "la empresa" NO califican como stakeholder nombrado.
   FALSO POSITIVO: El estudiante refiriéndose a sí mismo NO es conciencia de stakeholders.

5. **Ethical Awareness (Conciencia Ética)** — ¿El estudiante expone un principio/obligación/preocupación de justicia?
   STRONG: Principio ético aplicado con conexión al caso ("Tenemos el deber de transparencia con nuestros clientes...")
   PRESENT: Reconocido pero genérico ("Se trata de hacer lo correcto")
   WEAK: Lenguaje moral abstracto ("es importante ser bueno")
   ABSENT: Sin dimensión ética
   NOTA: Reconocer una TENSIÓN ética cuenta como conciencia ética fuerte.
   FALSO POSITIVO: La palabra "ético" sola NO califica. Debe demostrar razonamiento ético real.

REGLAS CRÍTICAS:
- La gramática/ortografía NUNCA son criterios de puntuación
- La cantidad de palabras NUNCA es un factor
- Puntúa cada señal INDEPENDIENTEMENTE — la puntuación de una señal no afecta a otra
- Si no estás seguro entre dos niveles, elige el nivel MÁS BAJO

Devuelve SOLO JSON válido:
{
  "intent": { "quality": 0-3, "extracted_text": "cita exacta o '' si ausente" },
  "justification": { "quality": 0-3, "extracted_text": "cita exacta o '' si ausente" },
  "tradeoffAwareness": { "quality": 0-3, "extracted_text": "cita exacta o '' si ausente" },
  "stakeholderAwareness": { "quality": 0-3, "extracted_text": "cita exacta o '' si ausente" },
  "ethicalAwareness": { "quality": 0-3, "extracted_text": "cita exacta o '' si ausente" }
}`;
}

function clampQuality(val: any): SignalQuality {
  const n = typeof val === "number" ? val : parseInt(val, 10);
  if (isNaN(n) || n <= 0) return SignalQuality.ABSENT;
  if (n === 1) return SignalQuality.WEAK;
  if (n === 2) return SignalQuality.PRESENT;
  return SignalQuality.STRONG;
}

function parseSignalResult(parsed: any): SignalExtractionResult {
  return {
    intent: {
      quality: clampQuality(parsed.intent?.quality),
      extracted_text: parsed.intent?.extracted_text || "",
    },
    justification: {
      quality: clampQuality(parsed.justification?.quality),
      extracted_text: parsed.justification?.extracted_text || "",
    },
    tradeoffAwareness: {
      quality: clampQuality(parsed.tradeoffAwareness?.quality),
      extracted_text: parsed.tradeoffAwareness?.extracted_text || "",
    },
    stakeholderAwareness: {
      quality: clampQuality(parsed.stakeholderAwareness?.quality),
      extracted_text: parsed.stakeholderAwareness?.extracted_text || "",
    },
    ethicalAwareness: {
      quality: clampQuality(parsed.ethicalAwareness?.quality),
      extracted_text: parsed.ethicalAwareness?.extracted_text || "",
    },
  };
}

function defaultSignals(): SignalExtractionResult {
  const absent = { quality: SignalQuality.ABSENT, extracted_text: "" };
  return {
    intent: { quality: SignalQuality.WEAK, extracted_text: "" },
    justification: absent,
    tradeoffAwareness: absent,
    stakeholderAwareness: absent,
    ethicalAwareness: absent,
  };
}

export async function extractSignals(
  context: AgentContext,
  options?: { model?: SupportedModel }
): Promise<DecisionEvidenceLog> {
  const language = context.language || "es";

  const previousDecisions = context.history
    .filter(h => h.role === "user")
    .map((h, i) => `Decision ${i + 1}: "${h.content}"`)
    .join("\n");

  const stakeholderList = context.scenario.stakeholders?.length
    ? `KEY STAKEHOLDERS: ${context.scenario.stakeholders.map(s => `${s.name} (${s.role})`).join(", ")}`
    : "";

  const userPrompt = `SCENARIO: "${context.scenario.title}"
DOMAIN: ${context.scenario.domain}
ROLE: ${context.scenario.role}
OBJECTIVE: ${context.scenario.objective}
${context.scenario.companyName ? `COMPANY: ${context.scenario.companyName}` : ""}
${context.scenario.situationBackground ? `SITUATION: ${context.scenario.situationBackground}` : ""}
${stakeholderList}
${context.scenario.keyConstraints?.length ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}` : ""}

${previousDecisions ? `PREVIOUS DECISIONS:\n${previousDecisions}\n` : ""}

CURRENT STUDENT INPUT (Decision ${context.currentDecision || context.turnCount + 1}):
"${context.studentInput}"

Extract the 5 signals. Return JSON only.`;

  try {
    const systemPrompt = getSignalExtractionPrompt(language) + getLanguageDirective(language);

    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        responseFormat: "json",
        maxTokens: 512,
        model: "gpt-4o-mini",
        agentName: "signalExtractor",
        sessionId: parseInt(context.sessionId) || undefined,
      }
    );

    const parsed = JSON.parse(response);
    const signals = parseSignalResult(parsed);
    const rds = computeRDS(signals);
    const rdsBand = classifyRDSBand(rds);
    const competencyEvidence = mapCompetencyEvidence(signals);

    return {
      signals_detected: signals,
      rds_score: rds,
      rds_band: rdsBand,
      competency_evidence: competencyEvidence,
      raw_signal_scores: {
        intent: signals.intent.quality,
        justification: signals.justification.quality,
        tradeoffAwareness: signals.tradeoffAwareness.quality,
        stakeholderAwareness: signals.stakeholderAwareness.quality,
        ethicalAwareness: signals.ethicalAwareness.quality,
      },
    };
  } catch (error) {
    console.error("[SignalExtractor] Error extracting signals, using defaults:", error);
    const signals = defaultSignals();
    const rds = computeRDS(signals);
    const rdsBand = classifyRDSBand(rds);
    const competencyEvidence = mapCompetencyEvidence(signals);

    return {
      signals_detected: signals,
      rds_score: rds,
      rds_band: rdsBand,
      competency_evidence: competencyEvidence,
      raw_signal_scores: {
        intent: signals.intent.quality,
        justification: signals.justification.quality,
        tradeoffAwareness: signals.tradeoffAwareness.quality,
        stakeholderAwareness: signals.stakeholderAwareness.quality,
        ethicalAwareness: signals.ethicalAwareness.quality,
      },
    };
  }
}
