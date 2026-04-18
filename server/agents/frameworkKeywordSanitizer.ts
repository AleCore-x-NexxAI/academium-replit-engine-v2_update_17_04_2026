/**
 * Framework Keyword Sanitizer
 *
 * Post-processes LLM-generated framework keyword arrays to:
 *   1. Drop keywords shorter than `minLength` (default 4) characters.
 *   2. Drop overly generic stop words (e.g. "problema", "solution") that
 *      cause false positives at detection time.
 *   3. De-duplicate keywords across all frameworks so a single keyword
 *      cannot trigger more than one framework unintentionally.
 *   4. Heuristically classify each keyword as Spanish / English / neutral
 *      and flag frameworks whose keywords contain >`wrongLangThreshold`
 *      tokens from the wrong language so the caller can regenerate just
 *      the keyword list for those frameworks.
 */

import type { CaseFramework } from "@shared/schema";

const GENERIC_STOPWORDS = new Set<string>([
  // Spanish generic terms
  "problema", "problemas",
  "solucion", "solución", "soluciones",
  "idea", "ideas",
  "cosa", "cosas",
  "tema", "temas",
  "asunto", "asuntos",
  "punto", "puntos",
  "parte", "partes",
  "caso", "casos",
  "forma", "formas",
  "manera", "maneras",
  "trabajo", "estudio",
  "analisis", "análisis",
  "decision", "decisión", "decisiones",
  // English generic terms
  "problem", "problems",
  "solution", "solutions",
  "thing", "things",
  "issue", "issues",
  "topic", "topics",
  "case", "cases",
  "part", "parts",
  "way", "ways",
  "work", "study",
  "analysis",
  "decision", "decisions",
]);

const SPANISH_DIACRITICS = /[áéíóúñü]/i;
const SPANISH_SUFFIX = /(ción|sión|idad|mente|miento|anza|azgo|encia|ancia|ería|ístico|ística)$/i;
const ENGLISH_SUFFIX = /(tion|sion|ing|ness|ment|ity|ship|able|ible|less|ful|ous|ize|ise)$/i;

const COMMON_SPANISH_TOKENS = new Set<string>([
  "del", "los", "las", "para", "con", "por", "una", "como", "este", "esta",
  "marco", "mercado", "empresa", "cliente", "clientes",
  "negocio", "negocios", "ventaja", "valor", "recursos", "capacidades",
  "fuerzas", "debilidades", "oportunidades", "amenazas",
  "costo", "beneficio", "presupuesto", "calidad", "precio",
  "competencia", "interno", "externo", "interna", "externa",
  "matriz", "modelo", "marcos",
]);

const COMMON_ENGLISH_TOKENS = new Set<string>([
  "the", "and", "for", "with", "from", "into",
  "market", "value", "customer", "customers", "business",
  "competitive", "advantage", "resource", "resources", "capabilities",
  "strengths", "weaknesses", "opportunities", "threats",
  "framework", "frameworks", "matrix", "model",
  "cost", "benefit", "budget", "quality", "price",
  "internal", "external", "stakeholder", "stakeholders",
]);

/** Classify a single token (no whitespace) as Spanish, English, or neutral. */
function classifyToken(token: string): "es" | "en" | "neutral" {
  const t = token.toLowerCase();
  if (t.length < 3) return "neutral";
  if (SPANISH_DIACRITICS.test(t)) return "es";

  const lex_es = COMMON_SPANISH_TOKENS.has(t);
  const lex_en = COMMON_ENGLISH_TOKENS.has(t);
  if (lex_es && !lex_en) return "es";
  if (lex_en && !lex_es) return "en";

  const suf_es = SPANISH_SUFFIX.test(t);
  const suf_en = ENGLISH_SUFFIX.test(t);
  if (suf_es && !suf_en) return "es";
  if (suf_en && !suf_es) return "en";

  return "neutral";
}

/** Classify a (potentially multi-word) keyword. Majority of classified tokens wins. */
export function classifyKeywordLanguage(keyword: string): "es" | "en" | "neutral" {
  const tokens = keyword.toLowerCase().split(/[\s\-_/]+/).filter(Boolean);
  if (tokens.length === 0) return "neutral";
  let es = 0;
  let en = 0;
  for (const tok of tokens) {
    const c = classifyToken(tok);
    if (c === "es") es++;
    else if (c === "en") en++;
  }
  if (es > en) return "es";
  if (en > es) return "en";
  return "neutral";
}

export interface SanitizeFrameworksOptions {
  /** Drop keywords whose trimmed length is less than this. Default 4. */
  minLength?: number;
  /** If wrongLangCount / classifiedCount exceeds this, flag for regeneration. Default 0.3. */
  wrongLangThreshold?: number;
}

export interface SanitizeFrameworksResult {
  frameworks: CaseFramework[];
  /** Framework ids whose keyword arrays look wrong-language or are empty after sanitisation. */
  needsRegeneration: string[];
}

/**
 * Merge regenerated keyword arrays back into a list of frameworks. Frameworks
 * not present in `regenerated` are returned unchanged. Pure function; the
 * caller is responsible for re-running `sanitizeFrameworks` on the result if
 * minLength / dedup / generic-stopword guarantees should also apply to the
 * regenerated keywords.
 */
export function mergeRegeneratedKeywords(
  frameworks: CaseFramework[],
  regenerated: CaseFramework[]
): CaseFramework[] {
  const map = new Map<string, string[]>();
  for (const fw of regenerated) {
    if (fw && typeof fw.id === "string" && Array.isArray(fw.domainKeywords)) {
      map.set(fw.id, fw.domainKeywords);
    }
  }
  return frameworks.map((fw) =>
    map.has(fw.id) ? { ...fw, domainKeywords: map.get(fw.id)! } : fw,
  );
}

/**
 * Sanitize an array of frameworks. Pure function; safe to unit-test with fixture JSON.
 */
export function sanitizeFrameworks(
  frameworks: CaseFramework[],
  language: "es" | "en" = "es",
  options: SanitizeFrameworksOptions = {}
): SanitizeFrameworksResult {
  const minLength = options.minLength ?? 4;
  const threshold = options.wrongLangThreshold ?? 0.3;
  const wrong: "es" | "en" = language === "es" ? "en" : "es";

  const seenAcross = new Set<string>();
  const sanitized: CaseFramework[] = [];
  const needsRegeneration: string[] = [];

  for (const fw of frameworks ?? []) {
    if (!fw || typeof fw.name !== "string" || !fw.name.trim()) continue;

    const seenLocal = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of fw.domainKeywords ?? []) {
      if (typeof raw !== "string") continue;
      const kw = raw.trim().toLowerCase();
      if (kw.length < minLength) continue;
      if (GENERIC_STOPWORDS.has(kw)) continue;
      if (seenLocal.has(kw) || seenAcross.has(kw)) continue;
      seenLocal.add(kw);
      cleaned.push(kw);
    }
    for (const kw of cleaned) seenAcross.add(kw);

    sanitized.push({ ...fw, domainKeywords: cleaned });

    if (cleaned.length === 0) {
      needsRegeneration.push(fw.id);
      continue;
    }

    let wrongCount = 0;
    let classifiedCount = 0;
    for (const kw of cleaned) {
      const cls = classifyKeywordLanguage(kw);
      if (cls === "neutral") continue;
      classifiedCount++;
      if (cls === wrong) wrongCount++;
    }
    if (classifiedCount >= 2 && wrongCount / classifiedCount > threshold) {
      needsRegeneration.push(fw.id);
    }
  }

  return { frameworks: sanitized, needsRegeneration };
}
