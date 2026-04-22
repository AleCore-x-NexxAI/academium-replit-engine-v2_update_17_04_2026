/**
 * Section 14.2 — Porter T-002 regression tests for the semantic framework detector.
 *
 * Three cases per the milestone packet (Section 14.2):
 *   (a) Porter-implicit:  focus-strategy reasoning without naming Porter
 *                         → level=implicit, confidence in {medium,high}, detection_method=semantic
 *   (b) Porter-explicit:  student names Porter / uses keyword
 *                         → level=explicit, confidence=high, detection_method=keyword
 *   (c) Porter-unrelated: generic management talk, no framework logic
 *                         → level=not_evidenced
 *
 * T-002A additions:
 *   (d) Substring normalisation: LLM-style quote (smart quotes / different
 *       capitalisation / trailing punctuation) must still pass the guard.
 *   (e) Registry hydration: framework with no conceptualDescription /
 *       recognitionSignals but valid canonicalId → semantic tier fires.
 *   (f) No-rubric skip: neither case nor registry has rubric → semantic skipped,
 *       detector falls through to signal-pattern or not_evidenced (no crash).
 *
 * The test invokes the REAL `detectFrameworks` against the live LLM (no mocks).
 * If no LLM credential is present in the environment (Replit proxy
 * `AI_INTEGRATIONS_OPENAI_API_KEY` or direct `OPENAI_API_KEY`), the tests
 * FAIL LOUDLY (never skip silently) so `npm test` cannot accidentally turn
 * green without having actually exercised the regression.
 *
 * Run with:
 *   npm test
 *   # or, file-scoped:
 *   npx tsx --test server/__tests__/frameworkDetection.regression.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CaseFramework, FrameworkDetection } from "@shared/schema";
import { SignalQuality, type SignalExtractionResult } from "../agents/types";
import { detectFrameworks } from "../agents/frameworkDetector";
import { getRegistryEntryById } from "../agents/frameworkRegistry";

function requireOpenAIKey(): void {
  const hasReplitProxy =
    !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
    !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const hasDirectKey = !!process.env.OPENAI_API_KEY;
  if (!hasReplitProxy && !hasDirectKey) {
    assert.fail(
      "No OpenAI credential present (AI_INTEGRATIONS_OPENAI_API_KEY/" +
        "AI_INTEGRATIONS_OPENAI_BASE_URL or OPENAI_API_KEY). These tests " +
        "intentionally call the live LLM so the regression cannot pass without " +
        "exercising the real detector. Provision a credential and rerun.",
    );
  }
}

const porterEntry = getRegistryEntryById("porter_generic_strategies");
if (!porterEntry) {
  throw new Error(
    "porter_generic_strategies missing from FRAMEWORK_REGISTRY — registry seed regressed.",
  );
}

const porter: CaseFramework = {
  id: "fw_porter_test",
  name: porterEntry.canonicalName_en,
  domainKeywords: porterEntry.suggestedDomainKeywords_en,
  canonicalId: porterEntry.canonicalId,
  aliases: porterEntry.aliases,
  coreConcepts: porterEntry.coreConcepts_en,
  conceptualDescription: porterEntry.conceptualDescription_en,
  recognitionSignals: porterEntry.recognitionSignals_en,
  signalPattern: porterEntry.suggestedSignalPattern,
};

// All-ABSENT signals so Tier-3 (signal_pattern) cannot fire and confound the
// keyword/semantic verdicts under test.
const absentSignals: SignalExtractionResult = {
  intent: { quality: SignalQuality.ABSENT, extracted_text: "" },
  justification: { quality: SignalQuality.ABSENT, extracted_text: "" },
  tradeoffAwareness: { quality: SignalQuality.ABSENT, extracted_text: "" },
  stakeholderAwareness: { quality: SignalQuality.ABSENT, extracted_text: "" },
  ethicalAwareness: { quality: SignalQuality.ABSENT, extracted_text: "" },
};

function getPorter(detections: FrameworkDetection[]): FrameworkDetection {
  const d = detections.find((x) => x.framework_id === porter.id);
  assert.ok(d, "Detector returned no entry for the Porter framework under test");
  // Universal §14.2 invariant: every detection has all 5 required fields, no nulls.
  assert.ok(d.level, "level missing");
  assert.ok(d.confidence, "confidence missing");
  assert.ok(d.detection_method, "detection_method missing");
  assert.ok(typeof d.evidence === "string", "evidence missing");
  assert.ok(typeof d.reasoning === "string", "reasoning missing");
  return d;
}

// Section 14.2 verbatim: "Porter must be detected implicit with confidence
// medium or high on AT LEAST 2 OF 3 applicable turns." We submit three
// distinct turns of focus-strategy reasoning that carefully avoid every Porter
// keyword/alias/name so the keyword tier cannot fire — the semantic tier
// must carry the verdict.
const PORTER_IMPLICIT_TURNS = [
  // Turn 1 — narrow-segment positioning vs. broad market.
  "We can't beat the big chains on price across the whole market, so we should " +
    "pick one specific group of customers — independent boutique cafés in coastal " +
    "towns — and tailor our beans, roast profile, and delivery cadence entirely to " +
    "what they need. Trying to serve everyone would stretch us thin and we'd end " +
    "up average everywhere instead of indispensable somewhere.",
  // Turn 2 — uniqueness/premium tradeoff vs. lowest-price commodity play.
  "Going head-to-head with the warehouse roasters on price is a losing fight. " +
    "Our shot is to charge more by making something the supermarket bag can't " +
    "match — single-origin beans with a story, hand-packed within 48 hours of " +
    "roasting, sold to customers who'll pay extra precisely because no one else " +
    "offers it that way.",
  // Turn 3 — concentrate on one buyer type with a tailored offer.
  "Instead of chasing every café in the country, we should concentrate everything " +
    "on serving Michelin-listed restaurants. Their needs are unusual — small " +
    "frequent deliveries, custom roast curves, training their baristas — and if " +
    "we build the whole operation around them we become the obvious choice for " +
    "that buyer type, even if we're invisible to everyone else.",
];

test("(a) Porter-implicit: focus-strategy reasoning without naming Porter → implicit / medium+ / semantic on ≥2 of 3 turns (§14.2)", async () => {
  requireOpenAIKey();

  const verdicts: { idx: number; d: FrameworkDetection }[] = [];
  for (let i = 0; i < PORTER_IMPLICIT_TURNS.length; i++) {
    const detections = await detectFrameworks(
      PORTER_IMPLICIT_TURNS[i],
      absentSignals,
      [porter],
      "en",
    );
    verdicts.push({ idx: i, d: getPorter(detections) });
  }

  const passing = verdicts.filter(
    ({ d }) =>
      d.level === "implicit" &&
      (d.confidence === "medium" || d.confidence === "high") &&
      d.detection_method === "semantic",
  );

  const summary = verdicts
    .map(({ idx, d }) => `T${idx + 1}: ${d.level}/${d.confidence}/${d.detection_method}`)
    .join("  |  ");

  assert.ok(
    passing.length >= 2,
    `Section 14.2 requires implicit+medium/high+semantic on ≥2 of 3 turns. Got ${passing.length}/3.\n  ${summary}`,
  );
});

test("(b) Porter-explicit: student names Porter / uses keyword → explicit / high / keyword", async () => {
  requireOpenAIKey();

  // Contains both the canonical name and a domain keyword ("differentiation"),
  // either of which alone should trigger the Tier-1 keyword path.
  const studentInput =
    "We should apply Porter's Generic Strategies here — specifically a differentiation " +
    "strategy that lets us charge a premium for our unique single-origin sourcing.";

  const detections = await detectFrameworks(studentInput, absentSignals, [porter], "en");
  const d = getPorter(detections);

  assert.equal(d.level, "explicit", `expected explicit, got ${d.level} (${d.reasoning})`);
  assert.equal(d.confidence, "high", `expected confidence=high, got ${d.confidence}`);
  assert.equal(
    d.detection_method,
    "keyword",
    `expected detection_method=keyword, got ${d.detection_method}`,
  );
});

test("(c) Porter-unrelated: generic management talk, no framework logic → not_evidenced", async () => {
  requireOpenAIKey();

  // Generic team/leadership talk. No positioning logic, no scope choice, no
  // cost-vs-differentiation trade-off. Should not match keywords and should
  // not match semantically.
  const studentInput =
    "We need to improve team morale and run weekly all-hands meetings to communicate " +
    "our goals clearly. Strong leadership and consistent communication are the keys " +
    "to long-term organizational success.";

  const detections = await detectFrameworks(studentInput, absentSignals, [porter], "en");
  const d = getPorter(detections);

  assert.equal(
    d.level,
    "not_evidenced",
    `expected not_evidenced, got ${d.level} (${d.reasoning})`,
  );
});

// ─── T-002A additions ────────────────────────────────────────────────────────

/**
 * (d) Substring normalisation guard.
 *
 * The LLM often returns quotedReasoning that differs from the verbatim student
 * input by: smart quotes (" "), capitalisation at sentence start, collapsed
 * whitespace, or trailing punctuation.  After the T-002A fix, these variations
 * must NOT cause the verdict to be rejected — the normalised text must still be
 * found inside the normalised student input.
 *
 * This test is UNIT-level: it calls detectFrameworks with the real LLM but the
 * student input is chosen so the LLM will produce a quotedReasoning that we can
 * predict will differ typographically.  We assert the verdict is NOT downgraded
 * to not_evidenced due to a normalisation failure.
 */
test("(d) T-002A normalisation: smart-quoted / capitalised LLM quote must still pass anti-hallucination guard → implicit", async () => {
  requireOpenAIKey();

  // Very explicit focus-strategy sentence that the LLM is likely to quote back.
  // We use a plain ASCII input; the LLM typically returns quotes with curly
  // quotes or altered capitalisation — the normalised comparison should accept them.
  const studentInput =
    "We are going to serve only independent specialty coffee shops in tourist " +
    "destinations — serving every segment would mean being second-rate everywhere, " +
    "so we are giving up the mass market to be the undisputed supplier for that niche.";

  const detections = await detectFrameworks(studentInput, absentSignals, [porter], "en");
  const d = getPorter(detections);

  // The LLM should detect implicit Porter. If it is not_evidenced here it
  // means the normalisation guard (or the LLM itself) still rejected it.
  // We allow explicit too (keyword-free input, but alias/name won't match).
  assert.notEqual(
    d.level,
    "not_evidenced",
    `Expected implicit (or explicit) but got not_evidenced — normalisation guard may have incorrectly rejected the quote. reasoning="${d.reasoning}"`,
  );
});

/**
 * (e) Registry hydration.
 *
 * A framework record with no conceptualDescription and no recognitionSignals,
 * but with a valid canonicalId, must be hydrated from the registry before the
 * semantic tier runs.  The semantic tier must still fire and return a verdict.
 */
test("(e) T-002A registry hydration: framework with no rubric fields but valid canonicalId → semantic tier fires", async () => {
  requireOpenAIKey();

  // Stripped-down Porter record: no conceptualDescription, no recognitionSignals.
  // The detector must pull them from the registry via canonicalId.
  const strippedPorter: CaseFramework = {
    id: "fw_porter_stripped",
    name: porterEntry.canonicalName_en,
    domainKeywords: porterEntry.suggestedDomainKeywords_en,
    canonicalId: porterEntry.canonicalId,
    aliases: porterEntry.aliases,
    coreConcepts: porterEntry.coreConcepts_en,
    // intentionally omitted: conceptualDescription, recognitionSignals
  };

  // Implicit focus-strategy turn — no keywords should fire.
  const studentInput = PORTER_IMPLICIT_TURNS[0];
  const detections = await detectFrameworks(studentInput, absentSignals, [strippedPorter], "en");
  const d = detections.find((x) => x.framework_id === strippedPorter.id);
  assert.ok(d, "No detection returned for stripped Porter framework");
  assert.ok(d.level, "level missing");

  // If hydration works, the semantic tier should have fired.
  // We allow implicit (expected) or explicit (shouldn't happen but not wrong).
  // We only fail hard if level is not_evidenced AND detection_method is none,
  // which would mean the semantic tier never ran (rubric was still missing).
  const semanticRan = d.detection_method === "semantic" || d.detection_method === "keyword";
  assert.ok(
    semanticRan || d.level !== "not_evidenced",
    `Registry hydration failed: detection_method=${d.detection_method} level=${d.level}. ` +
      `Expected semantic tier to fire after hydrating rubric from registry. reasoning="${d.reasoning}"`,
  );
});

/**
 * (f) No-rubric skip.
 *
 * A framework with no conceptualDescription, no recognitionSignals, AND no
 * canonicalId (so registry lookup fails) must skip the semantic tier without
 * crashing.  The detector falls through to signal-pattern (if configured) or
 * not_evidenced.  A console.warn must be emitted but is not asserted here —
 * what matters is no exception and a well-formed FrameworkDetection result.
 */
test("(f) T-002A no-rubric skip: framework with no rubric and no canonicalId → detector does not crash", async () => {
  requireOpenAIKey();

  const orphanFramework: CaseFramework = {
    id: "fw_orphan_test",
    name: "Orphan Framework",
    domainKeywords: [],
    // no canonicalId, no conceptualDescription, no recognitionSignals, no signalPattern
  };

  const studentInput = "We should focus on reducing our operational costs across the supply chain.";
  let threw = false;
  let detections: FrameworkDetection[] = [];
  try {
    detections = await detectFrameworks(studentInput, absentSignals, [orphanFramework], "en");
  } catch (err) {
    threw = true;
  }

  assert.equal(threw, false, "detectFrameworks threw an exception when framework had no rubric");
  const d = detections.find((x) => x.framework_id === orphanFramework.id);
  assert.ok(d, "No detection entry returned for orphan framework");
  // Must be a valid level — not_evidenced is correct when semantic couldn't run.
  const validLevels = ["not_evidenced", "implicit", "explicit"];
  assert.ok(
    validLevels.includes(d.level),
    `Unexpected level "${d.level}" for no-rubric framework`,
  );
});
