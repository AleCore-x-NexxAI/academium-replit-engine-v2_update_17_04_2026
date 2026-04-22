import { describe, it } from "node:test";
import assert from "node:assert/strict";

function computeModuleHealth(
  frameworks: Array<{ id: string; canonicalId?: string; provenance?: string }>,
  completed: Array<{ framework_detections: Array<Array<{ framework_id: string; level: string; confidence: string; detection_method: string }>> }>,
  targetFrameworkIds: Set<string>,
) {
  const results = frameworks.map((fw) => {
    let appliedCount = 0;
    let weightedSum = 0;
    const methodDist: Record<string, number> = {};

    for (const session of completed) {
      const fwDetections = session.framework_detections || [];
      let applied = false;
      let sessionScore = 0;

      for (const turnDets of fwDetections) {
        const det = turnDets?.find((d) => d.framework_id === fw.id);
        if (det) {
          const m = det.detection_method || "keyword";
          methodDist[m] = (methodDist[m] || 0) + 1;
          if (det.level === "explicit" || det.level === "implicit") {
            applied = true;
          }
          const dm = det.detection_method || "keyword";
          if (dm !== "signal_pattern" && dm !== "consistency_promoted") {
            if (det.level === "explicit" || (det.level === "implicit" && det.confidence === "high")) {
              sessionScore = Math.max(sessionScore, 1.0);
            } else if (det.level === "implicit" && det.confidence === "medium") {
              sessionScore = Math.max(sessionScore, 0.5);
            }
          }
        }
      }
      if (applied) appliedCount++;
      weightedSum += sessionScore;
    }

    const rate = completed.length > 0 ? appliedCount / completed.length : 0;
    const weightedScore = completed.length > 0 ? weightedSum / completed.length : 0;
    let status: string;
    if (weightedScore >= 0.60) status = "transferring";
    else if (weightedScore >= 0.30) status = "developing";
    else if (weightedScore > 0) status = "not_yet_evidenced";
    else status = "absent";

    return {
      id: fw.id,
      name: fw.id,
      status,
      rate,
      weightedScore,
      appliedCount_weighted_sum: weightedSum,
      completed: completed.length,
      detection_method_distribution: methodDist,
      canonicalId: fw.canonicalId || fw.id,
    };
  });

  const isTarget = (f: { id: string; canonicalId?: string }) =>
    targetFrameworkIds.has(f.canonicalId || f.id);
  const target = results.filter(isTarget);
  const suggested = results.filter((f) => !isTarget(f));
  return { target, suggested, frameworks: results };
}

describe("C2 — Confidence-weighted Module Health", () => {
  const porter = { id: "porter", canonicalId: "porter-gs", provenance: "explicit" };
  const swot = { id: "swot", canonicalId: "swot-analysis", provenance: "explicit" };

  it("Porter target / SWOT suggested with mixed detections", () => {
    const session1 = [
      [
        { framework_id: "porter", level: "explicit", confidence: "high", detection_method: "keyword" },
        { framework_id: "swot", level: "implicit", confidence: "medium", detection_method: "semantic" },
      ],
    ];
    const session2 = [
      [
        { framework_id: "porter", level: "implicit", confidence: "low", detection_method: "semantic" },
        { framework_id: "swot", level: "implicit", confidence: "low", detection_method: "semantic" },
      ],
    ];

    const completed = [
      { framework_detections: session1 },
      { framework_detections: session2 },
    ];

    const targetIds = new Set(["porter-gs"]);
    const result = computeModuleHealth([porter, swot], completed, targetIds);

    assert.strictEqual(result.target.length, 1);
    assert.strictEqual(result.target[0].id, "porter");
    assert.strictEqual(result.suggested.length, 1);
    assert.strictEqual(result.suggested[0].id, "swot");

    const porterResult = result.frameworks.find((f) => f.id === "porter")!;
    assert.ok(Math.abs(porterResult.weightedScore - 0.5) < 0.001);
    assert.strictEqual(porterResult.status, "developing");

    const swotResult = result.frameworks.find((f) => f.id === "swot")!;
    assert.ok(Math.abs(swotResult.weightedScore - 0.25) < 0.001);
    assert.strictEqual(swotResult.status, "not_yet_evidenced");
  });

  it("two implicit-low sessions → absent (not transferring)", () => {
    const completed = [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low", detection_method: "semantic" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low", detection_method: "semantic" }]] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.strictEqual(p.weightedScore, 0);
    assert.strictEqual(p.status, "absent");
    assert.strictEqual(p.rate, 1.0);
  });

  it("one implicit-medium + one implicit-low → not_yet_evidenced", () => {
    const completed = [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "medium", detection_method: "semantic" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low", detection_method: "semantic" }]] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.ok(Math.abs(p.weightedScore - 0.25) < 0.001);
    assert.strictEqual(p.status, "not_yet_evidenced");
  });

  it("two explicit sessions → transferring", () => {
    const completed = [
      { framework_detections: [[{ framework_id: "porter", level: "explicit", confidence: "high", detection_method: "keyword" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "explicit", confidence: "high", detection_method: "keyword" }]] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.strictEqual(p.weightedScore, 1.0);
    assert.strictEqual(p.status, "transferring");
  });

  it("no completed sessions → absent with zero score", () => {
    const result = computeModuleHealth([porter], [], new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.strictEqual(p.weightedScore, 0);
    assert.strictEqual(p.status, "absent");
    assert.strictEqual(p.completed, 0);
  });

  it("implicit-high counts as 1.0 session score", () => {
    const completed = [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "high", detection_method: "semantic" }]] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.strictEqual(p.weightedScore, 1.0);
    assert.strictEqual(p.status, "transferring");
  });

  it("signal_pattern detection → session score 0", () => {
    const completed = [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low", detection_method: "signal_pattern" }]] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.strictEqual(p.weightedScore, 0);
    assert.strictEqual(p.status, "absent");
  });

  it("surfaces both rate and weightedScore", () => {
    const completed = [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "low", detection_method: "semantic" }]] },
      { framework_detections: [[{ framework_id: "porter", level: "explicit", confidence: "high", detection_method: "keyword" }]] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.strictEqual(p.rate, 1.0);
    assert.ok(Math.abs(p.weightedScore - 0.5) < 0.001);
    assert.strictEqual(p.appliedCount_weighted_sum, 1.0);
    assert.strictEqual(p.completed, 2);
  });

  it("consistency_promoted with medium confidence → session score 0 (method excluded)", () => {
    const completed = [
      { framework_detections: [[{ framework_id: "porter", level: "implicit", confidence: "medium", detection_method: "consistency_promoted" }]] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.strictEqual(p.weightedScore, 0);
    assert.strictEqual(p.status, "absent");
    assert.strictEqual(p.rate, 1.0);
  });

  it("detection_method_distribution aggregates across turns", () => {
    const completed = [
      { framework_detections: [
        [{ framework_id: "porter", level: "explicit", confidence: "high", detection_method: "keyword" }],
        [{ framework_id: "porter", level: "implicit", confidence: "medium", detection_method: "semantic" }],
      ] },
    ];
    const result = computeModuleHealth([porter], completed, new Set(["porter-gs"]));
    const p = result.frameworks[0];
    assert.deepStrictEqual(p.detection_method_distribution, { keyword: 1, semantic: 1 });
  });
});
