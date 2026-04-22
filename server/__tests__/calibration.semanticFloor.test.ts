import { describe, it } from "node:test";
import assert from "node:assert/strict";

interface SemanticVerdict {
  applied: boolean;
  confidence: "high" | "medium" | "low";
  quotedReasoning: string;
  explanation: string;
}

interface Detection {
  framework_id: string;
  framework_name: string;
  level: string;
  confidence: string;
  detection_method: string;
  reasoning: string;
}

function applySemanticFloor(
  studentInput: string,
  fw: { id: string; name: string; canonicalId: string },
  verdict: SemanticVerdict,
  language: "en" | "es" = "en",
): Detection {
  const inputWordCount = studentInput.trim().split(/\s+/).filter(w => w.length > 0).length;

  if (inputWordCount < 10 && verdict.applied) {
    return {
      framework_id: fw.id,
      framework_name: fw.name,
      level: "not_evidenced",
      confidence: "low",
      detection_method: "none",
      reasoning: language === "en"
        ? "Input too short (fewer than 10 words) to sustain a semantic implicit detection."
        : "Entrada demasiado corta (menos de 10 palabras) para sostener una detección semántica implícita.",
    };
  }

  if (inputWordCount < 15 && verdict.applied) {
    verdict.confidence = "low";
  }

  if (verdict.applied) {
    return {
      framework_id: fw.id,
      framework_name: fw.name,
      level: "implicit",
      confidence: verdict.confidence,
      detection_method: "semantic",
      reasoning: verdict.explanation || `Semantic alignment with ${fw.name}.`,
    };
  }

  return {
    framework_id: fw.id,
    framework_name: fw.name,
    level: "not_evidenced",
    confidence: "low",
    detection_method: "none",
    reasoning: "Tier 1 (keyword) and Tier 2 (semantic) returned no match.",
  };
}

describe("C4 — Semantic implicit floor for short/vague inputs", () => {
  const fw = { id: "porter", name: "Porter's Generic Strategies", canonicalId: "porter-gs" };
  const makeVerdict = (): SemanticVerdict => ({
    applied: true,
    confidence: "medium",
    quotedReasoning: "niche market focus",
    explanation: "Student implicitly references competitive positioning.",
  });

  it("8-word input → rejected (Floor B, not_evidenced)", () => {
    const input = "niche market, focus, less competition, works great";
    const det = applySemanticFloor(input, fw, makeVerdict());
    assert.strictEqual(det.level, "not_evidenced");
    assert.strictEqual(det.detection_method, "none");
    assert.ok(det.reasoning.includes("fewer than 10 words"));
  });

  it("12-word input → downgraded to low confidence (Floor A)", () => {
    const input = "I think we should focus on a niche market segment for better results";
    const det = applySemanticFloor(input, fw, makeVerdict());
    assert.strictEqual(det.level, "implicit");
    assert.strictEqual(det.confidence, "low");
    assert.strictEqual(det.detection_method, "semantic");
  });

  it("20-word input → unchanged (medium confidence preserved)", () => {
    const input = "We need to consider whether focusing on a specific market niche would give us a competitive advantage over the broader players in this sector area";
    const det = applySemanticFloor(input, fw, makeVerdict());
    assert.strictEqual(det.level, "implicit");
    assert.strictEqual(det.confidence, "medium");
    assert.strictEqual(det.detection_method, "semantic");
  });

  it("exactly 10 words → not rejected by Floor B, but downgraded by Floor A", () => {
    const input = "we should focus on a niche market for competitive positioning";
    const det = applySemanticFloor(input, fw, makeVerdict());
    assert.strictEqual(det.level, "implicit");
    assert.strictEqual(det.confidence, "low");
  });

  it("exactly 15 words → not downgraded by Floor A", () => {
    const input = "we should focus on a niche market segment for competitive positioning in this specific industry space";
    const det = applySemanticFloor(input, fw, makeVerdict());
    assert.strictEqual(det.level, "implicit");
    assert.strictEqual(det.confidence, "medium");
  });

  it("Floor B reasoning in Spanish", () => {
    const input = "mercado nicho enfoque competencia funciona bien";
    const det = applySemanticFloor(input, fw, makeVerdict(), "es");
    assert.strictEqual(det.level, "not_evidenced");
    assert.ok(det.reasoning.includes("menos de 10 palabras"));
  });

  it("empty input → rejected", () => {
    const det = applySemanticFloor("", fw, makeVerdict());
    assert.strictEqual(det.level, "not_evidenced");
  });

  it("verdict not applied → not_evidenced regardless of length", () => {
    const notApplied: SemanticVerdict = { ...makeVerdict(), applied: false };
    const input = "This is a long input with plenty of words that would normally pass the floor checks easily";
    const det = applySemanticFloor(input, fw, notApplied);
    assert.strictEqual(det.level, "not_evidenced");
  });
});
