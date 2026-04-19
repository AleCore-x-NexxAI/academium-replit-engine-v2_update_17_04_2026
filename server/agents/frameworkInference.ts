// Phase 4 (v3.0 §7) — Framework inference subsystem.
//
// Tiers:
//   A. ≥2 explicit professor targets: do nothing (return []).
//   B. Exactly 1 explicit target: anchor mode. Suggest up to 3 complementary
//      registry frameworks that develop dimensions other than the anchor's.
//   C. 0 explicit targets: context mode. Suggest up to 3 registry frameworks
//      most relevant to the case topic + teachingGoal.
//
// All suggestions are persisted with `accepted_by_professor: false` and must
// be opted in by the professor through the FrameworkEditor before runtime
// detection sees them. Hard cap of 3 inferred frameworks at all times.

import { createHash } from "node:crypto";
import type { CaseFramework, FrameworkPrimaryDimension, PedagogicalIntent } from "@shared/schema";
import { FRAMEWORK_REGISTRY, type FrameworkRegistryEntry } from "./frameworkRegistry";
import { generateChatCompletion } from "../openai";

const MAX_INFERRED = 3;
const VALID_DIMENSIONS: FrameworkPrimaryDimension[] = [
  "analytical", "strategic", "tradeoff", "stakeholder", "ethical",
];

// Phase 4 v3.0 §7: when registry doesn't fit, fallback to LLM-generated custom
// framework with canonicalId = `custom_<sha1(name)[:10]>`. The hash is over
// the lowercased trimmed name so the same name maps to the same id (and
// matches the resolver guard in routes.ts canonicalizeIntentFrameworks).
function customCanonicalIdFromName(name: string): string {
  const norm = name.trim().toLowerCase();
  const hash = createHash("sha1").update(norm).digest("hex").slice(0, 10);
  return `custom_${hash}`;
}

// Mirrors the prohibited-language guard in frameworkDetector. The
// inference_reason copy is shown to professors and must avoid evaluative
// verdict tokens that imply a single "correct" choice.
const PROHIBITED_REASON_TOKENS = [
  "correct", "incorrect", "wrong", "right", "should", "must", "optimal",
  "correcto", "incorrecto", "equivocado", "debe", "debería", "óptimo",
];

function sanitizeReason(text: string): string {
  if (!text || typeof text !== "string") return "";
  let out = text;
  for (const tok of PROHIBITED_REASON_TOKENS) {
    const re = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, "—");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function toFrameworkFromRegistry(
  entry: FrameworkRegistryEntry,
  language: "es" | "en",
  reason: string,
  provenance: "inferred_from_anchor" | "inferred_from_context",
): CaseFramework {
  return {
    id: `fw_inf_${entry.canonicalId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: language === "en" ? entry.canonicalName_en : entry.canonicalName_es,
    domainKeywords: (language === "en" ? entry.suggestedDomainKeywords_en : entry.suggestedDomainKeywords_es)
      .map((k) => k.toLowerCase()),
    canonicalId: entry.canonicalId,
    aliases: entry.aliases,
    coreConcepts: language === "en" ? entry.coreConcepts_en : entry.coreConcepts_es,
    conceptualDescription:
      language === "en" ? entry.conceptualDescription_en : entry.conceptualDescription_es,
    recognitionSignals: language === "en" ? entry.recognitionSignals_en : entry.recognitionSignals_es,
    primaryDimension: entry.primaryDimension,
    signalPattern: entry.suggestedSignalPattern,
    provenance,
    inference_reason: sanitizeReason(reason),
    accepted_by_professor: false,
  };
}

interface ScenarioContext {
  topic?: string;
  caseContext?: string;
  domain?: string;
}

interface LLMCustomFramework {
  name: string;
  dimension: FrameworkPrimaryDimension;
  description: string;
  coreConcepts: string[];
  signalKeywords: string[];
}

interface LLMSuggestion {
  canonicalId?: string;
  custom?: LLMCustomFramework;
  reason: string;
}

async function askLLMForFrameworkPicks(args: {
  language: "es" | "en";
  intent: PedagogicalIntent;
  scenarioContext: ScenarioContext;
  excludedIds: Set<string>;
  anchor?: FrameworkRegistryEntry;
  limit: number;
}): Promise<LLMSuggestion[]> {
  const { language, intent, scenarioContext, excludedIds, anchor, limit } = args;

  // Build a compact catalogue of registry candidates the LLM can pick from.
  const catalogue = FRAMEWORK_REGISTRY
    .filter((e) => !excludedIds.has(e.canonicalId))
    .map((e) => {
      const name = language === "en" ? e.canonicalName_en : e.canonicalName_es;
      const desc = language === "en" ? e.conceptualDescription_en : e.conceptualDescription_es;
      return `- ${e.canonicalId} | ${name} | dim=${e.primaryDimension} | ${desc.slice(0, 140)}`;
    })
    .join("\n");

  const anchorBlock = anchor
    ? language === "en"
      ? `Anchor framework already chosen by professor: ${anchor.canonicalName_en} (canonicalId=${anchor.canonicalId}, primary dimension=${anchor.primaryDimension}). Pick complements that develop OTHER dimensions and reinforce the anchor's reasoning.`
      : `Marco ancla ya elegido por el profesor: ${anchor.canonicalName_es} (canonicalId=${anchor.canonicalId}, dimensión primaria=${anchor.primaryDimension}). Elige complementos que desarrollen OTRAS dimensiones y refuercen el razonamiento del ancla.`
    : "";

  const intentBlock = language === "en"
    ? `Teaching goal: ${intent.teachingGoal}\nTarget competencies: ${(intent.targetCompetencies || []).join(", ") || "(none)"}\nCourse context: ${intent.courseContext || "(none)"}`
    : `Objetivo de enseñanza: ${intent.teachingGoal}\nCompetencias objetivo: ${(intent.targetCompetencies || []).join(", ") || "(ninguna)"}\nContexto del curso: ${intent.courseContext || "(ninguno)"}`;

  const ctxBlock = language === "en"
    ? `Scenario topic: ${scenarioContext.topic || "(unknown)"}\nDomain: ${scenarioContext.domain || "(unknown)"}\nCase context: ${(scenarioContext.caseContext || "").slice(0, 600)}`
    : `Tema del escenario: ${scenarioContext.topic || "(desconocido)"}\nDominio: ${scenarioContext.domain || "(desconocido)"}\nContexto del caso: ${(scenarioContext.caseContext || "").slice(0, 600)}`;

  const instructions = language === "en"
    ? `You are helping a business professor expand the set of analytical frameworks tracked in a simulation. Pick at most ${limit} frameworks that best complement the professor's intent.

PREFER frameworks from the catalogue below (use \`canonicalId\`).
ONLY IF no catalogue entry truly fits the case, you may propose a CUSTOM framework with a real, recognized name (e.g. "Jobs-to-be-Done", "OODA Loop"). Do NOT invent novel framework names.

Do NOT propose any framework whose canonicalId is in the exclusion list. For each pick, provide a one-sentence neutral reason describing what reasoning shape it would surface — avoid words like "correct", "should", or "optimal".

Valid dimensions: ${VALID_DIMENSIONS.join(", ")}.`
    : `Estás ayudando a un profesor de negocios a ampliar el conjunto de marcos analíticos rastreados en una simulación. Elige como máximo ${limit} marcos que mejor complementen la intención del profesor.

PREFIERE marcos del catálogo a continuación (usa \`canonicalId\`).
SOLO SI ningún marco del catálogo encaja realmente con el caso, puedes proponer un marco PERSONALIZADO con un nombre real y reconocido (ej. "Jobs-to-be-Done", "OODA Loop"). NO inventes nombres novedosos.

NO propongas ningún marco cuyo canonicalId esté en la lista de exclusión. Para cada elección, proporciona una razón neutra de una oración que describa qué forma de razonamiento haría visible — evita palabras como "correcto", "debe" u "óptimo".

Dimensiones válidas: ${VALID_DIMENSIONS.join(", ")}.`;

  const prompt = `${instructions}

${anchorBlock}

${intentBlock}

${ctxBlock}

Catalogue (canonicalId | name | dimension | description):
${catalogue}

Excluded canonicalIds (do not pick): ${Array.from(excludedIds).join(", ") || "(none)"}

Respond with JSON only. Each suggestion must have EITHER a \`canonicalId\` from the catalogue OR a \`custom\` object — never both:
{"suggestions":[
  {"canonicalId":"...","reason":"..."},
  {"custom":{"name":"...","dimension":"strategic","description":"...","coreConcepts":["..."],"signalKeywords":["..."]},"reason":"..."}
]}`;

  let raw: string;
  try {
    raw = await generateChatCompletion(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", maxTokens: 512, agentName: "frameworkInference" },
    );
  } catch (err) {
    console.error("[frameworkInference] LLM call failed:", err);
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const list = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(list)) return [];

  const out: LLMSuggestion[] = [];
  const seenIds = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const reason = typeof obj.reason === "string" ? obj.reason : "";

    // Catalogue pick.
    if (typeof obj.canonicalId === "string" && obj.canonicalId) {
      const canonicalId = obj.canonicalId;
      if (excludedIds.has(canonicalId)) continue;
      if (!FRAMEWORK_REGISTRY.some((e) => e.canonicalId === canonicalId)) continue;
      if (seenIds.has(canonicalId)) continue;
      seenIds.add(canonicalId);
      out.push({ canonicalId, reason });
      if (out.length >= limit) break;
      continue;
    }

    // Custom-fallback pick.
    if (obj.custom && typeof obj.custom === "object") {
      const c = obj.custom as Record<string, unknown>;
      const name = typeof c.name === "string" ? c.name.trim() : "";
      const dimension = c.dimension as FrameworkPrimaryDimension;
      const description = typeof c.description === "string" ? c.description : "";
      const coreConcepts = Array.isArray(c.coreConcepts)
        ? (c.coreConcepts.filter((x) => typeof x === "string") as string[])
        : [];
      const signalKeywords = Array.isArray(c.signalKeywords)
        ? (c.signalKeywords.filter((x) => typeof x === "string") as string[])
        : [];
      if (!name || name.length < 3) continue;
      if (!VALID_DIMENSIONS.includes(dimension)) continue;
      if (!description) continue;
      const cid = customCanonicalIdFromName(name);
      if (excludedIds.has(cid)) continue;
      if (seenIds.has(cid)) continue;
      seenIds.add(cid);
      out.push({
        custom: { name, dimension, description, coreConcepts, signalKeywords },
        reason,
      });
      if (out.length >= limit) break;
    }
  }
  return out;
}

function toFrameworkFromCustom(
  c: LLMCustomFramework,
  language: "es" | "en",
  reason: string,
  provenance: "inferred_from_anchor" | "inferred_from_context",
): CaseFramework {
  const canonicalId = customCanonicalIdFromName(c.name);
  return {
    id: `fw_inf_${canonicalId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: c.name,
    domainKeywords: (c.signalKeywords || []).map((k) => k.toLowerCase()).slice(0, 8),
    canonicalId,
    aliases: [],
    coreConcepts: c.coreConcepts.slice(0, 6),
    conceptualDescription: sanitizeReason(c.description),
    recognitionSignals: c.signalKeywords.slice(0, 6),
    primaryDimension: c.dimension,
    signalPattern: undefined,
    provenance,
    inference_reason: sanitizeReason(reason),
    accepted_by_professor: false,
  };
}

/**
 * Returns up to 3 inferred CaseFramework entries to attach to a scenario.
 * Always returns [] when intent has 2+ explicit targets (Tier A) or when the
 * scenario already carries 3+ inferred frameworks (cap respected).
 */
export async function inferFrameworks(
  scenarioContext: ScenarioContext,
  pedagogicalIntent: PedagogicalIntent | null | undefined,
  existingFrameworks: CaseFramework[],
  language: "es" | "en" = "es",
): Promise<CaseFramework[]> {
  if (!pedagogicalIntent || !pedagogicalIntent.teachingGoal) return [];

  const explicitTargets = (pedagogicalIntent.targetFrameworks || []).filter((t) => t?.canonicalId);

  // Tier A: ≥2 explicit targets — no inference, professor has been clear.
  if (explicitTargets.length >= 2) return [];

  // Hard cap. Count any inferred items already attached so we never exceed 3.
  const existingInferredCount = existingFrameworks.filter(
    (f) => f.provenance === "inferred_from_anchor" || f.provenance === "inferred_from_context" || f.provenance === "inferred",
  ).length;
  const remaining = MAX_INFERRED - existingInferredCount;
  if (remaining <= 0) return [];

  // Avoid suggesting anything already on the scenario or already a target.
  const excluded = new Set<string>();
  for (const fw of existingFrameworks) {
    if (fw.canonicalId) excluded.add(fw.canonicalId);
  }
  for (const t of explicitTargets) {
    if (t.canonicalId) excluded.add(t.canonicalId);
  }

  const provenance: "inferred_from_anchor" | "inferred_from_context" =
    explicitTargets.length === 1 ? "inferred_from_anchor" : "inferred_from_context";

  const anchorEntry = explicitTargets.length === 1
    ? FRAMEWORK_REGISTRY.find((e) => e.canonicalId === explicitTargets[0].canonicalId)
    : undefined;

  const picks = await askLLMForFrameworkPicks({
    language,
    intent: pedagogicalIntent,
    scenarioContext,
    excludedIds: excluded,
    anchor: anchorEntry,
    limit: remaining,
  });

  const result: CaseFramework[] = [];
  const seen = new Set<string>();
  for (const pick of picks) {
    // Catalogue branch.
    if (pick.canonicalId) {
      if (seen.has(pick.canonicalId)) continue;
      const entry = FRAMEWORK_REGISTRY.find((e) => e.canonicalId === pick.canonicalId);
      if (!entry) continue;
      // Tier B server-side complementarity guard: never return a framework
      // whose primaryDimension matches the anchor's. The LLM is instructed
      // to do this in the prompt, but we cannot trust it — enforce here.
      if (anchorEntry && entry.primaryDimension === anchorEntry.primaryDimension) continue;
      seen.add(pick.canonicalId);
      result.push(toFrameworkFromRegistry(entry, language, pick.reason, provenance));
      if (result.length >= remaining) break;
      continue;
    }
    // Custom-fallback branch (no registry entry fits).
    if (pick.custom) {
      const cid = customCanonicalIdFromName(pick.custom.name);
      if (seen.has(cid)) continue;
      // Same Tier B complementarity guard for custom dimensions.
      if (anchorEntry && pick.custom.dimension === anchorEntry.primaryDimension) continue;
      seen.add(cid);
      result.push(toFrameworkFromCustom(pick.custom, language, pick.reason, provenance));
      if (result.length >= remaining) break;
    }
  }
  return result;
}
