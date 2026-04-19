// Phase 2 (§4.5) — boot-time canonical migration.
// Idempotent: scans every scenario's initialState.frameworks and backfills
// canonicalId / aliases / coreConcepts / conceptualDescription /
// recognitionSignals / primaryDimension on entries where canonicalId is absent
// AND resolveFrameworkName returns a registry hit. Frameworks that already
// have canonicalId, or that do not match the registry, are left untouched.
import { db } from "../db";
import { scenarios } from "@shared/schema";
import type { CaseFramework } from "@shared/schema";
import { resolveFrameworkName } from "./frameworkRegistry";
import { eq } from "drizzle-orm";

export async function runFrameworkCanonicalMigration(): Promise<{
  scannedScenarios: number;
  updatedScenarios: number;
  canonicalizedFrameworks: number;
}> {
  const allScenarios = await db.select().from(scenarios);
  let updatedScenarios = 0;
  let canonicalized = 0;

  for (const scn of allScenarios) {
    const initialState = scn.initialState as any;
    const frameworks: CaseFramework[] | undefined = initialState?.frameworks;
    if (!Array.isArray(frameworks) || frameworks.length === 0) continue;

    const lang: "es" | "en" = (scn as any).language === "en" ? "en" : "es";
    let mutated = false;
    const next = frameworks.map((fw) => {
      if (!fw || typeof fw.name !== "string") return fw;
      if (fw.canonicalId) return fw; // already canonicalized — skip
      const resolved = resolveFrameworkName(fw.name, lang);
      if (!resolved) return fw;
      mutated = true;
      canonicalized++;
      return {
        ...fw,
        canonicalId: resolved.canonicalId,
        aliases: fw.aliases ?? resolved.aliases,
        coreConcepts: fw.coreConcepts ?? resolved.coreConcepts,
        conceptualDescription: fw.conceptualDescription ?? resolved.conceptualDescription,
        recognitionSignals: fw.recognitionSignals ?? resolved.recognitionSignals,
        primaryDimension: fw.primaryDimension ?? resolved.primaryDimension,
        provenance: fw.provenance ?? "explicit",
      } satisfies CaseFramework;
    });

    if (mutated) {
      try {
        await db
          .update(scenarios)
          .set({ initialState: { ...initialState, frameworks: next } })
          .where(eq(scenarios.id, scn.id));
        updatedScenarios++;
      } catch (err) {
        console.error(`[boot-migration] Failed to update scenario ${scn.id}:`, err);
      }
    }
  }

  console.log(
    `[boot-migration] Scanned ${allScenarios.length} scenarios, updated ${updatedScenarios}, canonicalized ${canonicalized} frameworks.`,
  );
  return {
    scannedScenarios: allScenarios.length,
    updatedScenarios,
    canonicalizedFrameworks: canonicalized,
  };
}
