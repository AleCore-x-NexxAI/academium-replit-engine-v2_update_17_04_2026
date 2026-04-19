// Phase 2 (§4.5) — boot-time canonical migration.
//
// Idempotent. For every scenario whose initialState.frameworks lacks the
// "_phase2MigrationDone" guard, we walk each CaseFramework:
//
//   • If the entry already has a canonicalId and provenance, leave it untouched.
//   • If resolveFrameworkName() returns a registry hit, backfill canonicalId
//     and the semantic fields from the registry.
//   • If it does not resolve, assign a stable custom id "custom_<sha1>" derived
//     from the lowercased trimmed name, fill semantic fields from a single
//     LLM call (suggestFrameworkSemantics), and mark provenance "explicit".
//   • Default accepted_by_professor: true and provenance: "explicit" on any
//     framework that lacks them (Phase 2 has no inferred frameworks yet).
//
// After per-entry canonicalization we dedup by canonicalId, preferring the
// entry with the most populated semantic fields and merging keyword arrays.
//
// We then set initialState._phase2MigrationDone = true so subsequent boots
// skip the entire scenario in O(1) — this is the one-time guard.

import { createHash } from "crypto";
import { db } from "../db";
import { scenarios, type Scenario, type CaseFramework, type InitialState } from "@shared/schema";
import { resolveFrameworkName } from "./frameworkRegistry";
import { eq } from "drizzle-orm";
import { generateChatCompletion } from "../openai";

interface SemanticFill {
  coreConcepts: string[];
  conceptualDescription: string;
  recognitionSignals: string[];
  domainKeywords: string[];
}

export function customCanonicalId(name: string): string {
  const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const hash = createHash("sha1").update(norm).digest("hex").slice(0, 10);
  return `custom_${hash}`;
}

async function suggestFrameworkSemantics(
  name: string,
  language: "es" | "en",
): Promise<SemanticFill> {
  const isEn = language === "en";
  const prompt = isEn
    ? `Given the framework "${name}", return JSON with: keywords (8-12 lowercase domain terms), coreConcepts (4-6 short noun phrases), conceptualDescription (1-2 sentences), recognitionSignals (3-5 short phrases describing the SHAPE of student reasoning when applying it). Return JSON only: {"keywords":["..."],"coreConcepts":["..."],"conceptualDescription":"...","recognitionSignals":["..."]}`
    : `Dado el marco "${name}", retorna JSON con: keywords (8-12 términos de dominio en minúsculas), coreConcepts (4-6 frases nominales cortas), conceptualDescription (1-2 oraciones), recognitionSignals (3-5 frases cortas que describan la FORMA del razonamiento del estudiante cuando lo aplica). Retorna solo JSON: {"keywords":["..."],"coreConcepts":["..."],"conceptualDescription":"...","recognitionSignals":["..."]}`;
  try {
    const raw = await generateChatCompletion(
      [{ role: "user", content: prompt }],
      { responseFormat: "json", maxTokens: 512, model: "gpt-4o-mini", agentName: "phase2MigrationSemanticFill" },
    );
    const parsed: unknown = JSON.parse(raw);
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
    const obj = (parsed && typeof parsed === "object") ? (parsed as Record<string, unknown>) : {};
    return {
      coreConcepts: arr(obj.coreConcepts),
      conceptualDescription: typeof obj.conceptualDescription === "string" ? obj.conceptualDescription.trim() : "",
      recognitionSignals: arr(obj.recognitionSignals),
      domainKeywords: arr(obj.keywords).map((k) => k.toLowerCase()),
    };
  } catch (err) {
    console.warn(`[boot-migration] Semantic fill failed for "${name}":`, err);
    return { coreConcepts: [], conceptualDescription: "", recognitionSignals: [], domainKeywords: [] };
  }
}

function semanticScore(fw: CaseFramework): number {
  let s = 0;
  if (fw.canonicalId) s += 1;
  if (fw.coreConcepts && fw.coreConcepts.length > 0) s += 2;
  if (fw.conceptualDescription && fw.conceptualDescription.trim().length > 0) s += 2;
  if (fw.recognitionSignals && fw.recognitionSignals.length > 0) s += 2;
  if (fw.primaryDimension) s += 1;
  if (fw.aliases && fw.aliases.length > 0) s += 1;
  s += Math.min(fw.domainKeywords?.length ?? 0, 12) * 0.1;
  return s;
}

function dedupByCanonical(frameworks: CaseFramework[]): { result: CaseFramework[]; dropped: number } {
  const byId = new Map<string, CaseFramework>();
  let dropped = 0;
  for (const fw of frameworks) {
    const key = fw.canonicalId || fw.id;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, fw);
      continue;
    }
    dropped++;
    // Keep the entry with the higher semantic score; merge keyword arrays.
    const winner = semanticScore(fw) >= semanticScore(existing) ? fw : existing;
    const loser = winner === fw ? existing : fw;
    const mergedKeywords = Array.from(new Set([...winner.domainKeywords, ...loser.domainKeywords])).slice(0, 12);
    byId.set(key, { ...winner, domainKeywords: mergedKeywords });
  }
  return { result: Array.from(byId.values()), dropped };
}

export async function runFrameworkCanonicalMigration(): Promise<{
  scannedScenarios: number;
  updatedScenarios: number;
  canonicalizedFrameworks: number;
  customAssigned: number;
  duplicatesDropped: number;
}> {
  const allScenarios: Scenario[] = await db.select().from(scenarios);
  let updatedScenarios = 0;
  let canonicalized = 0;
  let customAssigned = 0;
  let duplicatesDropped = 0;

  for (const scn of allScenarios) {
    const rawState: InitialState | null = scn.initialState ?? null;
    if (!rawState || !Array.isArray(rawState.frameworks) || rawState.frameworks.length === 0) {
      continue;
    }
    if (rawState._phase2MigrationDone === true) continue;

    const lang: "es" | "en" = scn.language === "en" ? "en" : "es";
    const original = rawState.frameworks;
    const next: CaseFramework[] = [];
    let mutated = false;

    for (const fw of original) {
      if (!fw || typeof fw.name !== "string") {
        next.push(fw);
        continue;
      }

      // Default acceptance + provenance for Phase 2 (no inferred frameworks yet).
      const baseDefaults: Partial<CaseFramework> = {};
      if (fw.accepted_by_professor === undefined) baseDefaults.accepted_by_professor = true;
      if (!fw.provenance) baseDefaults.provenance = "explicit";

      // Already canonicalized — only apply default fills, do not overwrite.
      if (fw.canonicalId) {
        const merged: CaseFramework = { ...fw, ...baseDefaults };
        if (Object.keys(baseDefaults).length > 0) mutated = true;
        next.push(merged);
        continue;
      }

      const resolved = resolveFrameworkName(fw.name, lang);
      if (resolved) {
        const merged: CaseFramework = {
          ...fw,
          ...baseDefaults,
          canonicalId: resolved.canonicalId,
          aliases: fw.aliases ?? resolved.aliases,
          coreConcepts: fw.coreConcepts ?? resolved.coreConcepts,
          conceptualDescription: fw.conceptualDescription ?? resolved.conceptualDescription,
          recognitionSignals: fw.recognitionSignals ?? resolved.recognitionSignals,
          primaryDimension: fw.primaryDimension ?? resolved.primaryDimension,
        };
        canonicalized++;
        mutated = true;
        next.push(merged);
        continue;
      }

      // Unresolved — assign stable custom_<hash> id and (if missing) backfill
      // semantic fields via a single short LLM call.
      const stableId = customCanonicalId(fw.name);
      const needsSemantics =
        !fw.coreConcepts?.length || !fw.recognitionSignals?.length || !fw.conceptualDescription;
      const fill = needsSemantics
        ? await suggestFrameworkSemantics(fw.name, lang)
        : null;

      const merged: CaseFramework = {
        ...fw,
        ...baseDefaults,
        canonicalId: stableId,
        coreConcepts: fw.coreConcepts && fw.coreConcepts.length > 0
          ? fw.coreConcepts
          : (fill?.coreConcepts ?? []),
        conceptualDescription: fw.conceptualDescription && fw.conceptualDescription.trim().length > 0
          ? fw.conceptualDescription
          : (fill?.conceptualDescription ?? ""),
        recognitionSignals: fw.recognitionSignals && fw.recognitionSignals.length > 0
          ? fw.recognitionSignals
          : (fill?.recognitionSignals ?? []),
        domainKeywords: fw.domainKeywords && fw.domainKeywords.length >= 2
          ? fw.domainKeywords
          : Array.from(new Set([...(fw.domainKeywords ?? []), ...(fill?.domainKeywords ?? [])])).slice(0, 12),
      };
      customAssigned++;
      mutated = true;
      next.push(merged);
    }

    // Dedup by canonicalId, keeping the most-populated entry and merging keywords.
    const { result: deduped, dropped } = dedupByCanonical(next);
    if (dropped > 0) {
      mutated = true;
      duplicatesDropped += dropped;
    }

    // Always set the one-time guard so we skip in O(1) next boot, even if
    // nothing required mutation (idempotency through the flag itself).
    const updatedState: InitialState = {
      ...rawState,
      frameworks: deduped,
      _phase2MigrationDone: true,
    };

    try {
      await db.update(scenarios).set({ initialState: updatedState }).where(eq(scenarios.id, scn.id));
      if (mutated) updatedScenarios++;
    } catch (err) {
      console.error(`[boot-migration] Failed to update scenario ${scn.id}:`, err);
    }
  }

  console.log(
    `[boot-migration] Scanned ${allScenarios.length} scenarios, updated ${updatedScenarios}, canonicalized ${canonicalized} (registry) + ${customAssigned} (custom), dropped ${duplicatesDropped} duplicates.`,
  );
  return {
    scannedScenarios: allScenarios.length,
    updatedScenarios,
    canonicalizedFrameworks: canonicalized,
    customAssigned,
    duplicatesDropped,
  };
}
