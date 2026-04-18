/**
 * Unit tests for frameworkKeywordSanitizer.
 *
 * Run with: npx tsx --test server/agents/frameworkKeywordSanitizer.test.ts
 *
 * Uses Node's built-in test runner so no extra dependencies are required.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CaseFramework } from "@shared/schema";
import {
  sanitizeFrameworks,
  classifyKeywordLanguage,
  mergeRegeneratedKeywords,
} from "./frameworkKeywordSanitizer";

// Fixture: parsed JSON output as it would arrive from the LLM, with messy keywords.
const fixtureES: CaseFramework[] = [
  {
    id: "fw_001",
    name: "Análisis de Stakeholders",
    domainKeywords: [
      "stakeholders", // shared with fw_002 below — must dedupe
      "interesados",
      "Influencia",       // mixed case — should normalise
      "po",               // < 4 chars — drop
      "problema",         // generic stopword — drop
      "expectativas",
      "expectativas",     // duplicate within framework — drop
    ],
  },
  {
    id: "fw_002",
    name: "Análisis Costo-Beneficio",
    domainKeywords: [
      "stakeholders",     // duplicate across frameworks — drop here
      "costo",
      "beneficio",
      "rentabilidad",
      "viabilidad",
    ],
  },
];

test("strips keywords shorter than 4 chars and generic stopwords", () => {
  const { frameworks } = sanitizeFrameworks(fixtureES, "es");
  const fw1 = frameworks.find((f) => f.id === "fw_001")!;
  assert.ok(!fw1.domainKeywords.includes("po"), "should drop 3-char keyword");
  assert.ok(!fw1.domainKeywords.includes("problema"), "should drop generic stopword");
});

test("deduplicates keywords across frameworks", () => {
  const { frameworks } = sanitizeFrameworks(fixtureES, "es");
  const fw1 = frameworks.find((f) => f.id === "fw_001")!;
  const fw2 = frameworks.find((f) => f.id === "fw_002")!;
  assert.equal(fw1.domainKeywords.includes("stakeholders"), true);
  assert.equal(fw2.domainKeywords.includes("stakeholders"), false,
    "stakeholders should appear in only the first framework");
});

test("normalises keywords to lowercase trimmed and dedupes within a framework", () => {
  const { frameworks } = sanitizeFrameworks(fixtureES, "es");
  const fw1 = frameworks.find((f) => f.id === "fw_001")!;
  assert.ok(fw1.domainKeywords.includes("influencia"));
  const expectativas = fw1.domainKeywords.filter((k) => k === "expectativas");
  assert.equal(expectativas.length, 1, "duplicates within a framework should be removed");
});

test("flags Spanish frameworks whose keywords are mostly English", () => {
  const wrongLangFixture: CaseFramework[] = [
    {
      id: "fw_swot",
      name: "Análisis FODA",
      domainKeywords: [
        "strengths",
        "weaknesses",
        "opportunities",
        "threats",
        "competitive",
      ],
    },
  ];
  const { needsRegeneration } = sanitizeFrameworks(wrongLangFixture, "es");
  assert.deepEqual(needsRegeneration, ["fw_swot"]);
});

test("does NOT flag a clean Spanish framework", () => {
  const cleanES: CaseFramework[] = [
    {
      id: "fw_es",
      name: "Análisis FODA",
      domainKeywords: ["fortalezas", "debilidades", "oportunidades", "amenazas"],
    },
  ];
  const { needsRegeneration } = sanitizeFrameworks(cleanES, "es");
  assert.deepEqual(needsRegeneration, []);
});

test("flags English frameworks whose keywords are mostly Spanish", () => {
  const wrongLangEN: CaseFramework[] = [
    {
      id: "fw_swot_en",
      name: "SWOT Analysis",
      domainKeywords: ["fortalezas", "debilidades", "oportunidades", "amenazas"],
    },
  ];
  const { needsRegeneration } = sanitizeFrameworks(wrongLangEN, "en");
  assert.deepEqual(needsRegeneration, ["fw_swot_en"]);
});

test("flags frameworks whose keyword arrays are entirely emptied by sanitisation", () => {
  const allDropped: CaseFramework[] = [
    {
      id: "fw_empty",
      name: "Marco vacío",
      domainKeywords: ["po", "ab", "problema", "tema"],
    },
  ];
  const { frameworks, needsRegeneration } = sanitizeFrameworks(allDropped, "es");
  assert.equal(frameworks[0].domainKeywords.length, 0);
  assert.deepEqual(needsRegeneration, ["fw_empty"]);
});

test("classifyKeywordLanguage detects accented Spanish, English suffixes, and neutral tokens", () => {
  assert.equal(classifyKeywordLanguage("rentabilidad"), "es");
  assert.equal(classifyKeywordLanguage("competitive"), "en");
  assert.equal(classifyKeywordLanguage("strategy"), "neutral");
  assert.equal(classifyKeywordLanguage("acción"), "es");
  assert.equal(classifyKeywordLanguage("management"), "en");
});

test("mergeRegeneratedKeywords replaces ONLY flagged frameworks' keywords", () => {
  const cleaned: CaseFramework[] = [
    { id: "fw_a", name: "FODA", domainKeywords: ["strengths", "weaknesses"] },
    { id: "fw_b", name: "Costo-Beneficio", domainKeywords: ["costo", "beneficio"] },
  ];
  const regenerated: CaseFramework[] = [
    { id: "fw_a", name: "FODA", domainKeywords: ["fortalezas", "debilidades", "oportunidades"] },
  ];
  const merged = mergeRegeneratedKeywords(cleaned, regenerated);
  const a = merged.find((f) => f.id === "fw_a")!;
  const b = merged.find((f) => f.id === "fw_b")!;
  assert.deepEqual(a.domainKeywords, ["fortalezas", "debilidades", "oportunidades"]);
  assert.deepEqual(b.domainKeywords, ["costo", "beneficio"], "non-flagged framework must stay intact");
});

test("regenerate-and-merge round trip: flagged framework gets fresh keywords and is no longer flagged", () => {
  // Step 1: simulate the original LLM output for a Spanish case where one framework's keywords drifted to English.
  const original: CaseFramework[] = [
    {
      id: "fw_swot",
      name: "Análisis FODA",
      domainKeywords: ["strengths", "weaknesses", "opportunities", "threats", "competitive"],
    },
    {
      id: "fw_cb",
      name: "Análisis Costo-Beneficio",
      domainKeywords: ["costo", "beneficio", "rentabilidad", "viabilidad"],
    },
  ];

  // Step 2: first sanitisation should flag fw_swot only.
  const first = sanitizeFrameworks(original, "es");
  assert.deepEqual(first.needsRegeneration, ["fw_swot"]);

  // Step 3: simulate the LLM regen returning Spanish keywords for the flagged framework.
  const fakeRegenLLMOutput: CaseFramework[] = [
    {
      id: "fw_swot",
      name: "Análisis FODA",
      domainKeywords: ["fortalezas", "debilidades", "oportunidades", "amenazas"],
    },
  ];
  const merged = mergeRegeneratedKeywords(first.frameworks, fakeRegenLLMOutput);

  // Step 4: re-sanitise the merged result — it should no longer be flagged and dedup must still hold.
  const second = sanitizeFrameworks(merged, "es");
  assert.deepEqual(second.needsRegeneration, [], "post-regen list should be clean");
  const swot = second.frameworks.find((f) => f.id === "fw_swot")!;
  assert.deepEqual(swot.domainKeywords, ["fortalezas", "debilidades", "oportunidades", "amenazas"]);
  const cb = second.frameworks.find((f) => f.id === "fw_cb")!;
  assert.deepEqual(cb.domainKeywords, ["costo", "beneficio", "rentabilidad", "viabilidad"]);
});

test("multi-word keywords are classified by majority of tokens", () => {
  // "análisis de mercado" — accented + COMMON_SPANISH "mercado" => Spanish.
  assert.equal(classifyKeywordLanguage("análisis de mercado"), "es");
  // "market analysis" — both tokens English-lex => English.
  assert.equal(classifyKeywordLanguage("market analysis"), "en");
});
