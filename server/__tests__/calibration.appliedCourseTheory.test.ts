import { describe, it } from "node:test";
import assert from "node:assert/strict";

function computeAppliedCourseTheory(
  eligibleIds: Set<string>,
  sessions: Array<{ framework_detections: Array<Array<{ framework_id: string; level: string; confidence?: string; detection_method?: string }>> }>,
) {
  let n = 0;
  for (const s of sessions) {
    const fwDetections = s.framework_detections || [];
    const hasApplied = fwDetections.some((turnDetections) =>
      turnDetections?.some(
        (d) => {
          if (!eligibleIds.has(d.framework_id)) return false;
          const dm = d.detection_method || "keyword";
          if (dm === "signal_pattern" || dm === "consistency_promoted") return false;
          return d.level === "explicit" ||
            (d.level === "implicit" && (d.confidence === "medium" || d.confidence === "high"));
        },
      ),
    );
    if (hasApplied) n++;
  }
  return { n, m: sessions.length };
}

describe("C3 — Applied Course Theory strict threshold", () => {
  const eligibleIds = new Set(["porter"]);

  it("implicit-low only → NOT applied", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low" }]] },
    ]);
    assert.strictEqual(result.n, 0);
  });

  it("explicit → applied", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "explicit", confidence: "high" }]] },
    ]);
    assert.strictEqual(result.n, 1);
  });

  it("implicit-medium → applied", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "medium" }]] },
    ]);
    assert.strictEqual(result.n, 1);
  });

  it("implicit-high → applied", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "high" }]] },
    ]);
    assert.strictEqual(result.n, 1);
  });

  it("signal_pattern with medium confidence → NOT applied (method excluded)", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "medium", detection_method: "signal_pattern" }]] },
    ]);
    assert.strictEqual(result.n, 0);
  });

  it("consistency_promoted with high confidence → NOT applied (method excluded)", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "high", detection_method: "consistency_promoted" }]] },
    ]);
    assert.strictEqual(result.n, 0);
  });

  it("not_evidenced level → NOT applied", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "not_evidenced", confidence: "low" }]] },
    ]);
    assert.strictEqual(result.n, 0);
  });

  it("mixed 6 sessions: 3 applied, 3 not → n=3, m=6", () => {
    const sessions = [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "explicit", confidence: "high" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "medium" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "high" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "not_evidenced", confidence: "low" }]] },
    ];
    const result = computeAppliedCourseTheory(eligibleIds, sessions);
    assert.strictEqual(result.n, 3);
    assert.strictEqual(result.m, 6);
  });

  it("no confidence field on implicit → NOT applied", () => {
    const result = computeAppliedCourseTheory(eligibleIds, [
      { framework_detections: [[{ framework_id: "porter", level: "implicit" }]] },
    ]);
    assert.strictEqual(result.n, 0);
  });
});
