import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanProhibitedLanguage } from "../agents/narrator";

describe("scanProhibitedLanguage – expanded superlative bans", () => {
  it("catches 'impressive' and 'nuanced' in a single sentence", () => {
    const violations = scanProhibitedLanguage(
      "Your impressive analysis showed nuanced thinking."
    );
    assert.ok(
      violations.length >= 2,
      `Expected >= 2 violations but got ${violations.length}: ${JSON.stringify(violations)}`
    );
  });

  it("catches 'sophisticated' and 'thorough'", () => {
    const violations = scanProhibitedLanguage(
      "A sophisticated and thorough review of the data."
    );
    assert.ok(violations.length >= 2, `Expected >= 2 but got ${violations.length}`);
  });

  it("catches 'deep analysis' as a phrase", () => {
    const violations = scanProhibitedLanguage(
      "You performed a deep analysis of the market."
    );
    assert.ok(violations.length >= 1, `Expected >= 1 but got ${violations.length}`);
  });

  it("catches Spanish equivalents: 'impresionante', 'matizado'", () => {
    const violations = scanProhibitedLanguage(
      "Tu análisis impresionante mostró un razonamiento matizado."
    );
    assert.ok(violations.length >= 2, `Expected >= 2 but got ${violations.length}`);
  });

  it("does not false-positive on 'deep' without qualifying noun", () => {
    const violations = scanProhibitedLanguage("The river is deep.");
    const deepMatch = violations.some(v => v.includes("deep"));
    assert.ok(!deepMatch, "Should not flag 'deep' without analysis/reasoning/etc.");
  });

  it("still catches legacy patterns like 'correct' and '!'", () => {
    const violations = scanProhibitedLanguage("That is correct! Well done.");
    assert.ok(violations.length >= 3, `Expected >= 3 but got ${violations.length}`);
  });
});
