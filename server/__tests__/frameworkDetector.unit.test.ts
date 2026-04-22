/**
 * Unit tests for frameworkDetector helpers — NO LLM REQUIRED.
 *
 * These tests are purely deterministic and cover the substring normalisation
 * guard added in T-002A so a silent regression in the normalisation logic
 * cannot reach CI undetected.
 *
 * Run with:
 *   npx tsx --test server/__tests__/frameworkDetector.unit.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeForMatch } from "../agents/frameworkDetector";

// ─── normalizeForMatch unit tests ────────────────────────────────────────────

test("normalizeForMatch: ASCII round-trip is stable", () => {
  assert.equal(normalizeForMatch("hello world"), "hello world");
  assert.equal(normalizeForMatch("HELLO WORLD"), "hello world");
});

test("normalizeForMatch: folds smart/curly single quotes to ASCII apostrophe", () => {
  // Both opening and closing smart single quotes are folded to ASCII '.
  // The strip only removes sentence-ending punctuation (.,;:!?) so the folded
  // apostrophes survive when in the middle or at the edges of the string.
  const withLeft  = normalizeForMatch("\u2018smart single left\u2019");
  const withRight = normalizeForMatch("smart single right\u2019");
  assert.equal(withLeft,  "'smart single left'");
  assert.equal(withRight, "smart single right'");
});

test("normalizeForMatch: folds smart/curly double quotes to ASCII double-quote", () => {
  // Both opening and closing smart double quotes become ASCII ".
  // Sentence-ending strip does NOT remove quotes, so they survive.
  const withLeft  = normalizeForMatch("\u201chello\u201d");
  const withRight = normalizeForMatch("\u201ehello\u201f");
  assert.equal(withLeft,  '"hello"');
  assert.equal(withRight, '"hello"');
});

test("normalizeForMatch: folds em-dash and en-dash to ASCII hyphen", () => {
  assert.equal(normalizeForMatch("cost\u2014benefit"), "cost-benefit");
  assert.equal(normalizeForMatch("cost\u2013benefit"), "cost-benefit");
});

test("normalizeForMatch: collapses multiple whitespace characters", () => {
  assert.equal(normalizeForMatch("hello   world"), "hello world");
  assert.equal(normalizeForMatch("hello\t\nworld"), "hello world");
});

test("normalizeForMatch: strips leading and trailing punctuation", () => {
  // Trailing period (common LLM quote artefact).
  assert.equal(normalizeForMatch("hello world."), "hello world");
  // Leading punctuation.
  assert.equal(normalizeForMatch("...hello world"), "hello world");
});

test("normalizeForMatch: applies NFKC normalisation (ligatures, fullwidth)", () => {
  // ﬁ (fi ligature U+FB01) → "fi" after NFKC
  const ligature = normalizeForMatch("\uFB01nancial");
  assert.ok(ligature.startsWith("fi"), `Expected NFKC to decompose ligature, got: ${ligature}`);
});

// ─── normalizedIncludes behaviour (tested via the exported normalizeForMatch) ─

test("normalizedIncludes behaviour: capitalised LLM quote found in lowercase-normalised input", () => {
  const studentInput = "we should pick one specific group of customers and serve them exclusively.";
  // LLM might return the quote with a capital first letter and trailing period.
  const llmQuote    = "We should pick one specific group of customers and serve them exclusively.";

  const normInput = normalizeForMatch(studentInput);
  const normQuote = normalizeForMatch(llmQuote);
  assert.ok(
    normInput.includes(normQuote),
    `Normalised input should contain normalised LLM quote.\ninput: "${normInput}"\nquote: "${normQuote}"`,
  );
});

test("normalizedIncludes behaviour: smart-quoted LLM quote found in ASCII input", () => {
  const studentInput = 'we call it the "focus approach" for the niche segment.';
  // LLM might return the same string with curly double quotes.
  const llmQuote    = "we call it the \u201cfocus approach\u201d for the niche segment";

  const normInput = normalizeForMatch(studentInput);
  const normQuote = normalizeForMatch(llmQuote);
  assert.ok(
    normInput.includes(normQuote),
    `Normalised input should contain smart-quoted LLM quote.\ninput: "${normInput}"\nquote: "${normQuote}"`,
  );
});

test("normalizedIncludes behaviour: hallucinated quote (not in input) is still rejected after normalisation", () => {
  const studentInput = "we should focus on operational efficiency.";
  const hallucination = "we should pivot to an entirely new market segment";

  const normInput = normalizeForMatch(studentInput);
  const normHallucination = normalizeForMatch(hallucination);
  assert.equal(
    normInput.includes(normHallucination),
    false,
    "Hallucinated quote must NOT be found in the normalised student input",
  );
});
