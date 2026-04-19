import { generateChatCompletion } from "../openai";
import type { AgentContext, NarratorOutput, TurnPosition } from "./types";
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

/**
 * Phase 1b: word-range scaled to the student's response length.
 * Per-band ceilings preserved (160/130/100); upper bound = studentWords*4
 * clamped at the band ceiling so a 12-word answer cannot demand >48 words.
 * Lower bound preserves the original floor but never exceeds the new max
 * (so the band is always feasible).
 */
function getRDSWordRange(
  rdsBand: RDSBand | undefined,
  studentWords: number = 0,
): { min: number; max: number } {
  let baseMin: number;
  let baseMax: number;
  switch (rdsBand) {
    case RDSBand.INTEGRATED: baseMin = 130; baseMax = 160; break;
    case RDSBand.ENGAGED: baseMin = 100; baseMax = 130; break;
    default: baseMin = 80; baseMax = 100; break;
  }
  if (studentWords <= 0) return { min: baseMin, max: baseMax };
  const scaledMax = Math.min(baseMax, Math.max(20, studentWords * 4));
  const min = Math.min(baseMin, Math.max(20, Math.floor(scaledMax * 0.7)));
  return { min, max: scaledMax };
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function tokenizeForVerbatim(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Phase 1b: detect any 6+ consecutive-word window from `output` that appears
 * verbatim (case-insensitive, punctuation-stripped) in `studentInput`.
 * Returns the longest matching span, or null if none.
 */
function findVerbatimQuote(output: string, studentInput: string, minRun = 6): { start: number; len: number } | null {
  const out = tokenizeForVerbatim(output);
  const stu = tokenizeForVerbatim(studentInput);
  if (out.length < minRun || stu.length < minRun) return null;
  const stuJoined = " " + stu.join(" ") + " ";
  let best: { start: number; len: number } | null = null;
  for (let i = 0; i + minRun <= out.length; i++) {
    let j = minRun;
    while (i + j <= out.length) {
      const window = " " + out.slice(i, i + j).join(" ") + " ";
      if (stuJoined.includes(window)) {
        if (!best || j > best.len) best = { start: i, len: j };
        j++;
      } else break;
    }
  }
  return best;
}

/**
 * Phase 1b: replace verbatim spans with a semantic paraphrase that preserves
 * the topical anchor. Strategy: keep the first 1-2 content tokens of the span
 * (so the student's intent is preserved as a topic marker) and wrap the rest
 * in a neutral framing. Falls back to the generic phrase only if no content
 * tokens survive.
 */
function paraphraseVerbatim(text: string, studentInput: string, isEn: boolean, minRun = 6): string {
  const STOPWORDS_EN = new Set(["the", "a", "an", "to", "of", "and", "or", "in", "on", "for", "with", "is", "are", "was", "were", "be", "been", "being", "by", "as", "at", "from", "this", "that", "these", "those", "it", "its", "their", "his", "her", "i", "you", "we", "they", "but", "not", "if", "then", "than"]);
  const STOPWORDS_ES = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "y", "o", "que", "en", "para", "por", "con", "es", "son", "se", "su", "sus", "lo", "como", "pero", "más", "este", "esta", "estos", "estas", "ser", "muy", "también", "sobre", "entre", "todo", "todos", "cada", "cuando", "donde", "porque", "hay"]);
  const stops = isEn ? STOPWORDS_EN : STOPWORDS_ES;
  const buildReplacement = (tokens: string[]): string => {
    const anchor = tokens.find((t) => !stops.has(t.toLowerCase()) && t.length >= 4);
    if (!anchor) return isEn ? "their stated approach" : "su enfoque planteado";
    return isEn
      ? `their position on ${anchor}`
      : `su postura sobre ${anchor}`;
  };

  let result = text;
  for (let pass = 0; pass < 3; pass++) {
    const hit = findVerbatimQuote(result, studentInput, minRun);
    if (!hit) break;
    const tokens = tokenizeForVerbatim(result).slice(hit.start, hit.start + hit.len);
    if (tokens.length === 0) break;
    const replacement = buildReplacement(tokens);
    const pattern = new RegExp(
      tokens
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[\\s\\p{P}]+"),
      "iu",
    );
    const next = result.replace(pattern, replacement);
    if (next === result) break;
    result = next;
  }
  return result;
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
): Promise<NarratorOutput> {
  const turnPosition = determineTurnPosition(context);
  const rdsBand = context.rdsBand;
  const studentWords = countWords(context.studentInput || "");
  const wordRange = getRDSWordRange(rdsBand, studentWords);
  const isEn = context.language === "en";
  const complexity = getRDSComplexity(rdsBand);
  const tradeoffDirective = buildTradeoffDirective(context);

  const scenarioContext = [];
  if (context.scenario.companyName) scenarioContext.push(`Empresa: ${context.scenario.companyName}`);
  if (context.scenario.industry) scenarioContext.push(`Industria: ${context.scenario.industry}`);
  if (context.scenario.timelineContext) scenarioContext.push(`Timeline: ${context.scenario.timelineContext}`);

  const stakeholderNames = context.scenario.stakeholders?.map(s => `${s.name} (${s.role})`).join(", ") || "";

  const indicatorContext = (context.indicators || [])
    .map(ind => `${ind.label} (${ind.direction === "down_better" ? "↓ mejor" : "↑ mejor"})`)
    .join(", ");

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
${indicatorContext ? `DOMINIOS DE INDICADORES: ${indicatorContext}` : ""}

${previousDecisions ? `DECISIONES ANTERIORES:\n${previousDecisions}\n` : ""}

DECISIÓN ACTUAL:
"${context.studentInput}"

Genera una narrativa de consecuencias organizacionales con los 4 elementos, basada en la decisión del estudiante y la dinámica del caso. NO necesitas datos numéricos de KPIs — narra los efectos lógicos en los dominios relevantes. Devuelve SOLO JSON válido.`;

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

    const gateResult = runNarratorQualityGates(text, turnPosition);
    if (!gateResult.passed) {
      console.warn(`[Narrator] Quality gate failed: ${gateResult.failedGates.join(", ")}. Regenerating...`);
      try {
        const violationDesc = gateResult.failedGates.map(g => g.reason).join("; ");
        const retryResponse = await generateChatCompletion(
          [
            { role: "system", content: systemPrompt + `\n\nCRITICAL: Your previous response was REJECTED because: ${violationDesc}. Regenerate avoiding these issues. Be purely observational. No evaluative language. No exclamation marks. Include all 4 required elements.` },
            { role: "user", content: userPrompt },
          ],
          { responseFormat: "json", maxTokens: 768, model: context.llmModel, agentName: "narrator", sessionId: parseInt(context.sessionId) || undefined }
        );
        const retryParsed = JSON.parse(retryResponse) as { text?: string; mood?: string };
        if (retryParsed.text) {
          let retryText = retryParsed.text.replace(/!/g, ".");
          const retryGate = runNarratorQualityGates(retryText, turnPosition);
          if (retryGate.passed) {
            text = retryText;
          } else {
            text = regexRepairNarrative(retryText);
          }
        }
      } catch (retryErr) {
        console.error("[Narrator] Regeneration failed, falling back to regex repair:", retryErr);
        text = regexRepairNarrative(text);
      }
    }

    // Phase 1b: 6-word verbatim guard. Re-prompt once if the narrator quoted
    // the student verbatim for 6+ consecutive words; if still failing, paraphrase.
    if (context.studentInput && findVerbatimQuote(text, context.studentInput)) {
      console.warn("[Narrator] Verbatim quote (>=6 words) detected. Regenerating...");
      try {
        const antiQuoteSuffix = isEn
          ? "\n\nCRITICAL: Your previous response copied the student's exact wording. Do NOT quote the student verbatim for more than 6 consecutive words. Paraphrase their stance in your own words."
          : "\n\nCRÍTICO: Tu respuesta anterior copió las palabras exactas del estudiante. NO cites al estudiante de forma literal por más de 6 palabras consecutivas. Parafrasea su postura con tus propias palabras.";
        const retryResp = await generateChatCompletion(
          [
            { role: "system", content: systemPrompt + antiQuoteSuffix },
            { role: "user", content: userPrompt },
          ],
          { responseFormat: "json", maxTokens: 768, model: context.llmModel, agentName: "narrator", sessionId: parseInt(context.sessionId) || undefined }
        );
        const retryParsed = JSON.parse(retryResp) as { text?: string; mood?: string };
        if (retryParsed.text) {
          let retryText = retryParsed.text.replace(/!/g, ".");
          const retryGate = runNarratorQualityGates(retryText, turnPosition);
          if (retryGate.passed && !findVerbatimQuote(retryText, context.studentInput)) {
            text = retryText;
          } else {
            text = paraphraseVerbatim(retryText, context.studentInput, isEn);
          }
        } else {
          text = paraphraseVerbatim(text, context.studentInput, isEn);
        }
      } catch (verbErr) {
        console.error("[Narrator] Verbatim re-prompt failed, paraphrasing programmatically:", verbErr);
        text = paraphraseVerbatim(text, context.studentInput, isEn);
      }

      // After paraphrase, re-validate quality gates and apply regex repair as
      // last-ditch fix to ensure no evaluative language slipped back in.
      const postParaphraseGate = runNarratorQualityGates(text, turnPosition);
      if (!postParaphraseGate.passed) {
        text = regexRepairNarrative(text);
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

interface GateFailure {
  gate: string;
  reason: string;
}

interface QualityGateResult {
  passed: boolean;
  failedGates: GateFailure[];
}

const ANSWER_GIVING_PATTERNS = [
  /\b(la mejor opci[oó]n (es|ser[ií]a|habr[ií]a sido))\b/i,
  /\b(the best (option|choice|approach) (is|would be))\b/i,
  /\b(deber[ií]as? (elegir|seleccionar|optar))\b/i,
  /\b(you should (choose|select|opt))\b/i,
  /\b(claramente la respuesta)\b/i,
  /\b(the answer is clearly)\b/i,
];

function runNarratorQualityGates(text: string, turnPosition: TurnPosition): QualityGateResult {
  const failures: GateFailure[] = [];

  const prohibitedViolations = scanProhibitedLanguage(text);
  if (prohibitedViolations.length > 0) {
    failures.push({ gate: "G1", reason: `Prohibited language: ${prohibitedViolations.join(", ")}` });
  }

  for (const pattern of ANSWER_GIVING_PATTERNS) {
    if (pattern.test(text)) {
      failures.push({ gate: "G2", reason: "Answer-giving detected" });
      break;
    }
  }

  if (turnPosition !== "FINAL") {
    const hasOutcome = /\b(resultado|impacto|efecto|outcome|impact|effect)\b/i.test(text);
    const hasStakeholder = /\b(equipo|cliente|stakeholder|team|customer|empleado|director|gerente|junta|board)\b/i.test(text);
    const hasNewInfo = /\b(datos|informe|reporte|cifra|data|report|figure|número|análisis)\b/i.test(text);
    const hasForward = /\b(próxim|siguient|futuro|ahead|next|upcoming|implica)\b/i.test(text);
    const elementCount = [hasOutcome, hasStakeholder, hasNewInfo, hasForward].filter(Boolean).length;
    if (elementCount < 2) {
      failures.push({ gate: "G6", reason: `Only ${elementCount}/4 narrative elements detected` });
    }
  }

  return {
    passed: failures.length === 0,
    failedGates: failures,
  };
}

function regexRepairNarrative(text: string): string {
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.source === "!") continue;
    text = text.replace(pattern, "");
  }
  return text.replace(/\s{2,}/g, " ").trim();
}

export async function generateFinalOutcome(
  context: AgentContext,
): Promise<string> {
  const isEn = context.language === "en";
  const allDecisions = context.history
    .filter(h => h.role === "user")
    .map((h, i) => `Decisión ${i + 1}: "${h.content}"`)
    .join("\n");

  const allConsequences = context.history
    .filter(h => h.role === "system" || h.role === "npc")
    .map((h, i) => `Consecuencia ${i + 1}: "${h.content.substring(0, 200)}..."`)
    .join("\n");

  const indicatorTrajectory = (context.indicators || [])
    .map(ind => `${ind.label}: ${ind.value}`)
    .join(", ");

  const systemPrompt = `${isEn
    ? "You are a FINAL OUTCOME NARRATOR for Academium."
    : "Eres un NARRADOR DE RESULTADO FINAL para Academium."
  }

${HARD_PROHIBITIONS}
${MENTOR_TONE}

${isEn
  ? `Generate a 120-200 word NARRATIVE PARAGRAPH (not bullets) summarizing the student's journey.
REQUIREMENTS:
- Narrative of the path taken — describe the arc of decisions and their consequences
- Convey a sense of accomplishment — the student navigated complexity; choices were defensible
- Leave the story open-ended — the situation is not fully resolved
- NEVER grade, score, evaluate, rank, or compare to other students
- NEVER use "correct/incorrect", "good/bad decision", "optimal", "ideal"
- Speak in third person about the organizational outcomes
- Tone: calm senior colleague reflecting alongside the student
- NO exclamation marks`
  : `Genera un PÁRRAFO NARRATIVO de 120-200 palabras (NO viñetas) resumiendo el recorrido del estudiante.
REQUISITOS:
- Narrativa del camino tomado — describe el arco de decisiones y sus consecuencias
- Transmite sentido de logro — el estudiante navegó la complejidad; las decisiones fueron defendibles
- Deja la historia abierta — la situación no está totalmente resuelta
- NUNCA califiques, puntúes, evalúes, clasifiques, o compares con otros estudiantes
- NUNCA uses "correcto/incorrecto", "buena/mala decisión", "óptimo", "ideal"
- Habla en tercera persona sobre los resultados organizacionales
- Tono: colega senior calmado reflexionando junto al estudiante
- SIN signos de exclamación`
}` + getLanguageDirective(context.language);

  const userPrompt = `
${isEn ? "SCENARIO" : "ESCENARIO"}: "${context.scenario.title}"
${isEn ? "ROLE" : "ROL"}: ${context.scenario.role}
${isEn ? "OBJECTIVE" : "OBJETIVO"}: ${context.scenario.objective}

${isEn ? "ALL DECISIONS" : "TODAS LAS DECISIONES"}:
${allDecisions}

${isEn ? "KEY CONSEQUENCES" : "CONSECUENCIAS CLAVE"}:
${allConsequences}

${isEn ? "CURRENT INDICATORS" : "INDICADORES ACTUALES"}: ${indicatorTrajectory || "N/A"}

${isEn
  ? "Generate a 120-200 word narrative paragraph summarizing this journey. Return ONLY the text, no JSON."
  : "Genera un párrafo narrativo de 120-200 palabras resumiendo este recorrido. Devuelve SOLO el texto, sin JSON."
}`;

  try {
    let text = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 512, model: context.llmModel, agentName: "finalOutcome", sessionId: parseInt(context.sessionId) || undefined }
    );

    text = text.replace(/!/g, ".").replace(/"/g, "").trim();
    for (const pattern of PROHIBITED_PATTERNS) {
      if (pattern.source === "!") continue;
      text = text.replace(pattern, "");
    }
    text = text.replace(/\s{2,}/g, " ").trim();

    return text;
  } catch (err) {
    console.error("[FinalOutcome] Generation failed:", err);
    return isEn
      ? "The simulation has reached its conclusion. The decisions made throughout this process shaped the organizational trajectory in meaningful ways, and the story continues beyond this point."
      : "La simulación ha llegado a su conclusión. Las decisiones tomadas a lo largo de este proceso moldearon la trayectoria organizacional de maneras significativas, y la historia continúa más allá de este punto.";
  }
}
