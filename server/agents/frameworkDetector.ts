import type { CaseFramework, FrameworkDetection } from "@shared/schema";
import type { SignalExtractionResult } from "./types";
import { generateChatCompletion } from "../openai";

const MIN_QUALITY_MAP: Record<string, number> = { WEAK: 1, PRESENT: 2, STRONG: 3 };

// Phase 2: prohibited evaluative language for the semantic check `explanation`
// field. We do not regenerate; we sanitize because the field is professor-facing
// reasoning text, not student-facing copy.
const PROHIBITED_TOKENS_EN = ["correct", "incorrect", "wrong", "should", "ought", "must", "optimal", "best practice", "right answer", "good answer", "bad answer"];
const PROHIBITED_TOKENS_ES = ["correcto", "incorrecto", "equivocado", "debería", "deberia", "debe", "óptimo", "optimo", "mejor práctica", "mejor practica", "respuesta correcta", "buena respuesta", "mala respuesta"];

function sanitizeExplanation(text: string, language: "es" | "en"): string {
  if (!text) return "";
  const tokens = language === "en" ? PROHIBITED_TOKENS_EN : PROHIBITED_TOKENS_ES;
  let out = text;
  for (const tok of tokens) {
    const re = new RegExp(`\\b${escapeRegex(tok)}\\b`, "gi");
    out = out.replace(re, "—");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

interface SemanticVerdict {
  framework_id: string;
  applied: boolean;
  confidence: "high" | "medium" | "low";
  quotedReasoning: string;
  explanation: string;
}

/**
 * Phase 2 (§4.4): batched semantic check across tracked frameworks.
 * One gpt-4o-mini call per turn covering all candidates. JSON output, ≤256 tokens
 * per framework slot kept low so total stays inside the 1.5s latency budget.
 */
async function semanticFrameworkCheck(
  studentInput: string,
  frameworks: CaseFramework[],
  language: "es" | "en",
): Promise<SemanticVerdict[]> {
  if (frameworks.length === 0) return [];

  const isEn = language === "en";
  const list = frameworks
    .map((fw, i) => {
      const desc = fw.conceptualDescription?.trim() || (isEn
        ? `A framework called "${fw.name}".`
        : `Un marco llamado "${fw.name}".`);
      const recog = fw.recognitionSignals && fw.recognitionSignals.length > 0
        ? (isEn ? `\n  Recognition signals: ${fw.recognitionSignals.join("; ")}` : `\n  Señales de reconocimiento: ${fw.recognitionSignals.join("; ")}`)
        : "";
      return `${i + 1}. id=${fw.id} | ${fw.name}\n  ${isEn ? "Description" : "Descripción"}: ${desc}${recog}`;
    })
    .join("\n");

  const systemPrompt = isEn
    ? `You determine whether a student's reasoning APPLIES specific analytical frameworks, even when the student does not name them. You judge ONLY conceptual application, not correctness.

Rules:
- "applied: true" only if the student's reasoning structure matches the framework's recognition signals.
- "quotedReasoning" MUST be an exact substring of the student's input (verbatim, no paraphrase).
- "explanation" describes which conceptual element of the framework the student exercised. Observation only — never use evaluative language (correct, wrong, should, optimal, best practice).
- "confidence": high = clear structural match, medium = partial alignment, low = faint resemblance.
- If unrelated, return applied=false with quotedReasoning="" and a one-line explanation.`
    : `Determinas si el razonamiento del estudiante APLICA marcos analíticos específicos, incluso cuando el estudiante no los nombra. Juzgas SOLO la aplicación conceptual, no la corrección.

Reglas:
- "applied: true" solo si la estructura del razonamiento del estudiante coincide con las señales de reconocimiento del marco.
- "quotedReasoning" DEBE ser una subcadena exacta del input del estudiante (literal, sin paráfrasis).
- "explanation" describe qué elemento conceptual del marco ejercitó el estudiante. Solo observación — nunca uses lenguaje evaluativo (correcto, incorrecto, debería, óptimo, mejor práctica).
- "confidence": high = coincidencia estructural clara, medium = alineación parcial, low = parecido tenue.
- Si no se relaciona, devuelve applied=false con quotedReasoning="" y una explicación de una línea.`;

  const userPrompt = isEn
    ? `Student input:\n"""${studentInput}"""\n\nFrameworks to evaluate:\n${list}\n\nReturn JSON: {"verdicts":[{"framework_id":"...","applied":true|false,"confidence":"high|medium|low","quotedReasoning":"...","explanation":"..."}]}`
    : `Input del estudiante:\n"""${studentInput}"""\n\nMarcos a evaluar:\n${list}\n\nDevuelve JSON: {"verdicts":[{"framework_id":"...","applied":true|false,"confidence":"high|medium|low","quotedReasoning":"...","explanation":"..."}]}`;

  const maxTokens = Math.min(1024, 128 + frameworks.length * 96);

  let parsed: any;
  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens, model: "gpt-4o-mini", agentName: "semanticFrameworkCheck" },
    );
    parsed = JSON.parse(response);
  } catch (err) {
    console.error("[semanticFrameworkCheck] LLM call failed:", err);
    return [];
  }

  const verdicts: SemanticVerdict[] = [];
  if (!Array.isArray(parsed?.verdicts)) return [];

  for (const v of parsed.verdicts) {
    if (!v || typeof v.framework_id !== "string") continue;
    const fw = frameworks.find((f) => f.id === v.framework_id);
    if (!fw) continue;

    const applied = v.applied === true;
    const confidence: "high" | "medium" | "low" =
      v.confidence === "high" || v.confidence === "medium" || v.confidence === "low" ? v.confidence : "low";
    let quoted = typeof v.quotedReasoning === "string" ? v.quotedReasoning.trim() : "";
    const explanation = sanitizeExplanation(typeof v.explanation === "string" ? v.explanation : "", language);

    // Substring assertion: reject the verdict if the quote is not an exact
    // substring of the student input. Per packet §4.4 this is a hard guard
    // against hallucinated quotes.
    if (applied) {
      // Strict, verbatim, case-sensitive substring assertion (packet hard rule).
      if (!quoted || !studentInput.includes(quoted)) {
        console.warn(`[semanticFrameworkCheck] Rejecting verdict for ${fw.name}: quotedReasoning is not a substring of student input.`);
        verdicts.push({
          framework_id: fw.id,
          applied: false,
          confidence: "low",
          quotedReasoning: "",
          explanation,
        });
        continue;
      }
    }

    verdicts.push({ framework_id: fw.id, applied, confidence, quotedReasoning: quoted, explanation });
  }

  return verdicts;
}

/**
 * Phase 2 detection. Three tiers, in order:
 *   (a) explicit-keyword (regex, confidence high)
 *   (b) semantic LLM check using framework.conceptualDescription
 *   (c) signal-pattern fallback (confidence low)
 *
 * Frameworks with `accepted_by_professor === false` are excluded entirely.
 */
export async function detectFrameworks(
  studentInput: string,
  signals: SignalExtractionResult,
  frameworks: CaseFramework[],
  language: "es" | "en" = "es",
): Promise<FrameworkDetection[]> {
  if (!frameworks || frameworks.length === 0) return [];

  // Filter to engine-eligible frameworks. accepted_by_professor === false
  // (only meaningful for inferred frameworks in Phase 4+) is excluded entirely.
  const eligible = frameworks.filter((fw) => fw.accepted_by_professor !== false);
  if (eligible.length === 0) return [];

  const inputLower = studentInput.toLowerCase();
  const detections: FrameworkDetection[] = [];
  const needsSemantic: CaseFramework[] = [];

  // Tier 1: explicit keyword/name match.
  for (const fw of eligible) {
    const keywordMatch = fw.domainKeywords.find((kw) =>
      new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(studentInput),
    );
    const nameMatch = new RegExp(`\\b${escapeRegex(fw.name)}\\b`, "i").test(studentInput);
    if (nameMatch || keywordMatch) {
      const matchedTerm = nameMatch ? fw.name : (keywordMatch || fw.name);
      const snippet = extractSnippet(studentInput, matchedTerm);
      detections.push({
        framework_id: fw.id,
        framework_name: fw.name,
        level: "explicit",
        evidence: language === "en"
          ? `Student wrote: "${snippet}" — directly using "${matchedTerm}", a key term from the ${fw.name} framework.`
          : `El estudiante escribió: "${snippet}" — usando directamente "${matchedTerm}", un término clave del marco ${fw.name}.`,
        confidence: "high",
        detection_method: "keyword",
        reasoning: language === "en"
          ? `Direct keyword match on "${matchedTerm}".`
          : `Coincidencia directa de palabra clave en "${matchedTerm}".`,
        canonicalId: fw.canonicalId || fw.id,
      });
    } else {
      needsSemantic.push(fw);
    }
  }

  // Tier 2: batched semantic check for the remainder.
  let semantic: SemanticVerdict[] = [];
  if (needsSemantic.length > 0) {
    semantic = await semanticFrameworkCheck(studentInput, needsSemantic, language);
  }
  const semanticById = new Map(semantic.map((v) => [v.framework_id, v]));

  for (const fw of needsSemantic) {
    const v = semanticById.get(fw.id);
    if (v && v.applied) {
      detections.push({
        framework_id: fw.id,
        framework_name: fw.name,
        level: "implicit",
        evidence: language === "en"
          ? `Student wrote: "${v.quotedReasoning}" — applying ${fw.name} conceptually without naming it.`
          : `El estudiante escribió: "${v.quotedReasoning}" — aplicando ${fw.name} conceptualmente sin nombrarlo.`,
        confidence: v.confidence,
        detection_method: "semantic",
        reasoning: v.explanation || (language === "en"
          ? `Semantic alignment with ${fw.name}.`
          : `Alineación semántica con ${fw.name}.`),
        canonicalId: fw.canonicalId || fw.id,
      });
      continue;
    }

    // Tier 3: signal-pattern fallback (only when semantic didn't fire).
    if (fw.signalPattern) {
      const minQ = MIN_QUALITY_MAP[fw.signalPattern.minQuality] ?? 2;
      const signalMap: Record<string, number> = {
        intent: signals.intent.quality,
        justification: signals.justification.quality,
        tradeoffAwareness: signals.tradeoffAwareness.quality,
        stakeholderAwareness: signals.stakeholderAwareness.quality,
        ethicalAwareness: signals.ethicalAwareness.quality,
      };
      const allMet = fw.signalPattern.requiredSignals.every((sig) => (signalMap[sig] ?? 0) >= minQ);
      const additionalKws = fw.signalPattern.additionalKeywords || [];
      const hasAdditional = additionalKws.some((kw) => inputLower.includes(kw.toLowerCase()));
      if (allMet && (hasAdditional || fw.domainKeywords.some((kw) => inputLower.includes(kw.toLowerCase())))) {
        const sigList = fw.signalPattern.requiredSignals.join(", ");
        detections.push({
          framework_id: fw.id,
          framework_name: fw.name,
          level: "implicit",
          evidence: language === "en"
            ? `Reasoning signals (${sigList}) align with ${fw.name} application patterns in the response.`
            : `Las señales de razonamiento (${sigList}) se alinean con patrones de aplicación del marco ${fw.name} en la respuesta.`,
          confidence: "low",
          detection_method: "signal_pattern",
          reasoning: language === "en"
            ? `Signal-pattern fallback: required signals ${sigList} met at quality ≥ ${fw.signalPattern.minQuality}.`
            : `Fallback de patrón de señales: señales requeridas ${sigList} cumplidas con calidad ≥ ${fw.signalPattern.minQuality}.`,
          canonicalId: fw.canonicalId || fw.id,
        });
        continue;
      }
    }

    detections.push({
      framework_id: fw.id,
      framework_name: fw.name,
      level: "not_evidenced",
      evidence: language === "en"
        ? `No direct or indirect evidence of ${fw.name} application detected in this response.`
        : `No se detectó evidencia directa o indirecta de aplicación del marco ${fw.name} en esta respuesta.`,
      confidence: "low",
      detection_method: "none",
      reasoning: language === "en"
        ? `Tier 1 (keyword) and Tier 2 (semantic) returned no match.`
        : `Tier 1 (palabra clave) y Tier 2 (semántico) no devolvieron coincidencias.`,
      canonicalId: fw.canonicalId || fw.id,
    });
  }

  // Preserve original ordering for downstream stability.
  const order = new Map(eligible.map((fw, i) => [fw.id, i]));
  detections.sort((a, b) => (order.get(a.framework_id) ?? 0) - (order.get(b.framework_id) ?? 0));
  return detections;
}

/**
 * Synchronous variant for offline backfill paths that cannot await an LLM
 * (admin /backfill-analysis endpoint). Falls back to keyword + signal-pattern.
 */
export function detectFrameworksSync(
  studentInput: string,
  signals: SignalExtractionResult,
  frameworks: CaseFramework[],
  language: "es" | "en" = "es",
): FrameworkDetection[] {
  if (!frameworks || frameworks.length === 0) return [];
  const eligible = frameworks.filter((fw) => fw.accepted_by_professor !== false);
  const inputLower = studentInput.toLowerCase();

  return eligible.map((fw): FrameworkDetection => {
    const keywordMatch = fw.domainKeywords.find((kw) =>
      new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(studentInput),
    );
    const nameMatch = new RegExp(`\\b${escapeRegex(fw.name)}\\b`, "i").test(studentInput);
    if (nameMatch || keywordMatch) {
      const matchedTerm = nameMatch ? fw.name : (keywordMatch || fw.name);
      const snippet = extractSnippet(studentInput, matchedTerm);
      return {
        framework_id: fw.id,
        framework_name: fw.name,
        level: "explicit",
        evidence: language === "en"
          ? `Student wrote: "${snippet}" — directly using "${matchedTerm}", a key term from the ${fw.name} framework.`
          : `El estudiante escribió: "${snippet}" — usando directamente "${matchedTerm}", un término clave del marco ${fw.name}.`,
        confidence: "high",
        detection_method: "keyword",
        reasoning: language === "en"
          ? `Direct keyword match on "${matchedTerm}".`
          : `Coincidencia directa de palabra clave en "${matchedTerm}".`,
        canonicalId: fw.canonicalId || fw.id,
      };
    }
    if (fw.signalPattern) {
      const minQ = MIN_QUALITY_MAP[fw.signalPattern.minQuality] ?? 2;
      const sm: Record<string, number> = {
        intent: signals.intent.quality,
        justification: signals.justification.quality,
        tradeoffAwareness: signals.tradeoffAwareness.quality,
        stakeholderAwareness: signals.stakeholderAwareness.quality,
        ethicalAwareness: signals.ethicalAwareness.quality,
      };
      const allMet = fw.signalPattern.requiredSignals.every((sig) => (sm[sig] ?? 0) >= minQ);
      const addKw = fw.signalPattern.additionalKeywords || [];
      const hasAddKw = addKw.some((kw) => inputLower.includes(kw.toLowerCase()));
      if (allMet && (hasAddKw || fw.domainKeywords.some((kw) => inputLower.includes(kw.toLowerCase())))) {
        const sigList = fw.signalPattern.requiredSignals.join(", ");
        return {
          framework_id: fw.id,
          framework_name: fw.name,
          level: "implicit",
          evidence: language === "en"
            ? `Reasoning signals (${sigList}) align with ${fw.name} application patterns in the response.`
            : `Las señales de razonamiento (${sigList}) se alinean con patrones de aplicación del marco ${fw.name} en la respuesta.`,
          confidence: "low",
          detection_method: "signal_pattern",
          reasoning: language === "en"
            ? `Signal-pattern fallback: required signals ${sigList} met at quality ≥ ${fw.signalPattern.minQuality}.`
            : `Fallback de patrón de señales.`,
          canonicalId: fw.canonicalId || fw.id,
        };
      }
    }
    return {
      framework_id: fw.id,
      framework_name: fw.name,
      level: "not_evidenced",
      evidence: language === "en"
        ? `No direct or indirect evidence of ${fw.name} application detected in this response.`
        : `No se detectó evidencia directa o indirecta de aplicación del marco ${fw.name} en esta respuesta.`,
      confidence: "low",
      detection_method: "none",
      reasoning: language === "en" ? `Sync backfill: no keyword and no signal-pattern match.` : `Backfill sincrónico: sin coincidencia.`,
      canonicalId: fw.canonicalId || fw.id,
    };
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSnippet(text: string, term: string, maxLen: number = 120): string {
  const regex = new RegExp(escapeRegex(term), "i");
  const match = text.match(regex);
  if (!match || match.index === undefined) {
    return text.length > maxLen ? text.substring(0, maxLen).trim() + "..." : text.trim();
  }
  const idx = match.index;
  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, idx - half);
  let end = Math.min(text.length, idx + term.length + half);
  if (start > 0) {
    const spaceIdx = text.indexOf(" ", start);
    if (spaceIdx !== -1 && spaceIdx < idx) start = spaceIdx + 1;
  }
  if (end < text.length) {
    const spaceIdx = text.lastIndexOf(" ", end);
    if (spaceIdx !== -1 && spaceIdx > idx + term.length) end = spaceIdx;
  }
  let snippet = text.substring(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}
