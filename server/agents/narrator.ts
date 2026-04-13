import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, NarratorOutput, DomainExpertOutput, EvaluatorOutput, TurnPosition, DisplayKPI } from "./types";
import { RDSBand } from "./types";
import { HARD_PROHIBITIONS, MENTOR_TONE, MISUSE_HANDLING, getLanguageDirective } from "./guardrails";

const PROHIBITED_PATTERNS = [
  /\bcorrect[oa]?\b/i,
  /\bincorrect[oa]?\b/i,
  /\bmejor opci[oó]n\b/i,
  /\b[oó]ptim[oa]\b/i,
  /\bideal\b/i,
  /\bbuena decisi[oó]n\b/i,
  /\bmala decisi[oó]n\b/i,
  /\bbien hecho\b/i,
  /\bbuen trabajo\b/i,
  /\bwell done\b/i,
  /\bgood job\b/i,
  /\bgood decision\b/i,
  /\bpoor decision\b/i,
  /\bbest\b/i,
  /\bdeberías haber\b/i,
  /\byou should have\b/i,
  /\bdesafortunadamente\b/i,
  /\bafortunadamente\b/i,
  /\bunfortunately\b/i,
  /\bfortunately\b/i,
  /\bsadly\b/i,
  /\bsurprisingly\b/i,
  /\bsorprendentemente\b/i,
  /!/,
];

function scanProhibitedLanguage(text: string): string[] {
  const violations: string[] = [];
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(pattern.source);
    }
  }
  return violations;
}

function determineTurnPosition(context: AgentContext): TurnPosition {
  const current = context.currentDecision || context.turnCount + 1;
  const total = context.totalDecisions || 0;
  if (current <= 1) return "FIRST";
  if (total > 0 && current >= total) return "FINAL";
  return "INTERMEDIATE";
}

function getRDSWordRange(rdsBand: RDSBand | undefined): { min: number; max: number } {
  switch (rdsBand) {
    case RDSBand.INTEGRATED: return { min: 130, max: 160 };
    case RDSBand.ENGAGED: return { min: 100, max: 130 };
    default: return { min: 80, max: 100 };
  }
}

function getRDSComplexity(rdsBand: RDSBand | undefined): string {
  switch (rdsBand) {
    case RDSBand.INTEGRATED:
      return "3+ resultados observables, 2+ reacciones de stakeholders, 2+ datos nuevos, compounding completo con historia previa";
    case RDSBand.ENGAGED:
      return "2-3 resultados observables, 1-2 reacciones de stakeholders, 1-2 datos nuevos, compounding moderado";
    default:
      return "1-2 resultados observables, 1 reacción de stakeholder, 1 dato nuevo, compounding mínimo";
  }
}

function buildTradeoffDirective(context: AgentContext): string {
  const decisionPoint = context.decisionPoints?.find(
    dp => dp.number === (context.currentDecision || context.turnCount + 1)
  );

  if (!decisionPoint?.tradeoffSignature) {
    return "TRADEOFF: No configurado. No fuerces intercambios artificiales, pero NO produzcas resultados artificialmente positivos.";
  }

  const sig = decisionPoint.tradeoffSignature;
  if (sig.dimension && sig.cost && sig.benefit) {
    return `TRADEOFF PRE-ESCRITO: Ancla la consecuencia al intercambio definido: "${sig.dimension}" — costo: "${sig.cost}", beneficio: "${sig.benefit}". La narrativa DEBE reflejar este intercambio.`;
  }

  return "TRADEOFF: Habilitado sin texto específico. Genera intercambios realistas basados en señales y dinámica de indicadores.";
}

export const DEFAULT_NARRATOR_PROMPT = `Eres el NARRADOR DE CONSECUENCIAS para Academium.

${HARD_PROHIBITIONS}

${MENTOR_TONE}

${MISUSE_HANDLING}

TU ROL: Narrar los resultados realistas de las decisiones del estudiante.

REGLAS:
- NO eres evaluador, maestro ni dador de soluciones
- NUNCA reveles decisiones "óptimas"
- NUNCA moralices — presenta hechos y consecuencias
- Tono calmado, profesional, académico
- Presenta intercambios, no juicios

ESTRUCTURA DE 4 ELEMENTOS (OBLIGATORIA):
1. RESULTADO OBSERVABLE: Concreto, específico, causal, NO evaluativo
2. REACCIÓN DE STAKEHOLDERS: Al menos un stakeholder nombrado/implícito responde
3. INFORMACIÓN NUEVA: Genuinamente nueva, relevante, profundiza complejidad
4. IMPLICACIÓN FUTURA: Conecta con la siguiente decisión (NO en turno final)

ÉTICA IMPLÍCITA:
- La ética NUNCA como pregunta directa
- Las implicaciones éticas surgen IMPLÍCITAMENTE a través de las consecuencias

LENGUAJE PROHIBIDO:
"Correcto/Incorrecto", "Mejor/Óptimo/Ideal", "Buena/Mala decisión", "Bien hecho",
"Deberías haber", "Desafortunadamente/Afortunadamente", "Sorprendentemente",
signos de exclamación (!), cualquier frase que sugiera una respuesta correcta

FORMATO DE SALIDA (solo JSON):
{
  "text": "<narrativa de consecuencias>",
  "mood": "neutral" | "positive" | "negative" | "crisis"
}`;

export async function generateNarrative(
  context: AgentContext,
  kpiImpact: DomainExpertOutput,
  evaluation: EvaluatorOutput
): Promise<NarratorOutput> {
  const turnPosition = determineTurnPosition(context);
  const rdsBand = context.rdsBand;
  const wordRange = getRDSWordRange(rdsBand);
  const complexity = getRDSComplexity(rdsBand);
  const tradeoffDirective = buildTradeoffDirective(context);

  const indicatorSummary = kpiImpact.indicatorDeltas
    ? Object.entries(kpiImpact.indicatorDeltas)
        .filter(([_, v]) => v !== 0)
        .map(([k, v]) => {
          const direction = v > 0 ? "subió" : "bajó";
          return `${k} ${direction} ${Math.abs(v)}`;
        })
        .join(", ")
    : "";

  const displayKPISummary = kpiImpact.displayKPIs?.map(d =>
    `${d.label} ${d.direction === "up" ? "↑" : "↓"} ${d.magnitude} — ${d.shortReason}`
  ).join("\n") || "";

  const scenarioContext = [];
  if (context.scenario.companyName) scenarioContext.push(`Empresa: ${context.scenario.companyName}`);
  if (context.scenario.industry) scenarioContext.push(`Industria: ${context.scenario.industry}`);
  if (context.scenario.timelineContext) scenarioContext.push(`Timeline: ${context.scenario.timelineContext}`);

  const stakeholderNames = context.scenario.stakeholders?.map(s => `${s.name} (${s.role})`).join(", ") || "";

  const previousDecisions = context.history
    .filter(h => h.role === "user")
    .map((h, i) => `Decisión ${i + 1}: "${h.content}"`)
    .join("\n");

  const positionDirective = turnPosition === "FIRST"
    ? "POSICIÓN: PRIMERA decisión. Sin compounding. Incluir implicación futura."
    : turnPosition === "FINAL"
    ? "POSICIÓN: ÚLTIMA decisión. Referir trayectoria acumulada de TODAS las decisiones. NO incluir implicación futura. Mostrar coherencia/tensión de las decisiones."
    : "POSICIÓN: INTERMEDIA. Referir ≥1 elemento de consecuencias previas. Incluir implicación futura. Compounding activo.";

  const userPrompt = `
ESCENARIO: "${context.scenario.title}"
DOMINIO: ${context.scenario.domain}
${scenarioContext.length > 0 ? scenarioContext.join(" | ") : ""}
ROL: ${context.scenario.role}
OBJETIVO: ${context.scenario.objective}
DECISIÓN: ${context.turnCount + 1}${context.totalDecisions ? ` de ${context.totalDecisions}` : ""}

${positionDirective}

${tradeoffDirective}

RIQUEZA NARRATIVA (${rdsBand || "SURFACE"}): ${wordRange.min}-${wordRange.max} palabras.
${complexity}

${stakeholderNames ? `STAKEHOLDERS DISPONIBLES: ${stakeholderNames}` : ""}

${previousDecisions ? `DECISIONES ANTERIORES:\n${previousDecisions}\n` : ""}

DECISIÓN ACTUAL:
"${context.studentInput}"

IMPACTO EN INDICADORES:
${indicatorSummary || "Sin cambios significativos"}

INDICADORES MOSTRADOS:
${displayKPISummary || "Ninguno"}

${kpiImpact.reasoning}
${kpiImpact.expertInsight ? `Insight experto: ${kpiImpact.expertInsight}` : ""}

Genera una narrativa de consecuencias con los 4 elementos. Devuelve SOLO JSON válido.`;

  const basePrompt = context.agentPrompts?.narrator || DEFAULT_NARRATOR_PROMPT;
  const systemPrompt = basePrompt + getLanguageDirective(context.language);

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", maxTokens: 768, model: context.llmModel, agentName: "narrator", sessionId: parseInt(context.sessionId) || undefined }
  );

  try {
    type NarratorMood = "neutral" | "positive" | "negative" | "crisis";
    const validMoods: NarratorMood[] = ["neutral", "positive", "negative", "crisis"];

    const parsed = JSON.parse(response) as {
      text?: string;
      mood?: string;
    };
    let text = parsed.text || "La decisión ha sido registrada. La situación continúa evolucionando.";
    const mood: NarratorMood = validMoods.includes(parsed.mood as NarratorMood) ? parsed.mood as NarratorMood : "neutral";

    text = text.replace(/!/g, ".");

    const violations = scanProhibitedLanguage(text);
    if (violations.length > 0) {
      for (const pattern of PROHIBITED_PATTERNS) {
        if (pattern.source === "!") continue;
        text = text.replace(pattern, "");
      }
      text = text.replace(/\s{2,}/g, " ").trim();

      const postRepairViolations = scanProhibitedLanguage(text);
      if (postRepairViolations.length > 0) {
        console.warn(`[Narrator] ${postRepairViolations.length} violations remain after repair, regenerating`);
        try {
          const retryResponse = await generateChatCompletion(
            [
              { role: "system", content: systemPrompt + "\n\nCRITICAL: Your previous response was rejected for prohibited language. Do NOT use evaluative, value-laden, or prescriptive words. No exclamation marks. No 'correcto', 'incorrecto', 'ideal', 'buena/mala decisión', 'bien hecho', 'deberías haber', 'desafortunadamente', 'afortunadamente'. Be purely observational." },
              { role: "user", content: userPrompt },
            ],
            { responseFormat: "json", maxTokens: 768, model: context.llmModel, agentName: "narrator", sessionId: parseInt(context.sessionId) || undefined }
          );
          const retryParsed = JSON.parse(retryResponse) as { text?: string; mood?: string };
          if (retryParsed.text) {
            let retryText = retryParsed.text.replace(/!/g, ".");
            for (const pattern of PROHIBITED_PATTERNS) {
              if (pattern.source === "!") continue;
              retryText = retryText.replace(pattern, "");
            }
            text = retryText.replace(/\s{2,}/g, " ").trim();
          }
        } catch (retryErr) {
          console.error("[Narrator] Regeneration failed:", retryErr);
        }
      }
    }

    return {
      text,
      mood,
      suggestedOptions: [],
    };
  } catch {
    return {
      text: "La decisión ha sido registrada. La organización se ajusta al enfoque adoptado.",
      mood: "neutral",
      suggestedOptions: [],
    };
  }
}
