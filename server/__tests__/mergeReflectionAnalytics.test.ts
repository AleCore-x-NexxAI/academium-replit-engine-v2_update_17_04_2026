import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeReflectionAnalytics } from "../mergeReflectionAnalytics";
import type { SimulationState } from "@shared/schema";

function makeState(overrides: Partial<SimulationState> = {}): SimulationState {
  return {
    decisionEvidenceLogs: [],
    framework_detections: [],
    dashboard_summary: undefined,
    indicatorAccumulation: {},
    nudgeCounters: {},
    hintCounters: {},
    integrityFlags: [],
    lastTurnNarrative: undefined,
    ...overrides,
  } as unknown as SimulationState;
}

describe("mergeReflectionAnalytics", () => {
  it("copies decisionEvidenceLogs from prior when target is empty", () => {
    const prior = makeState({ decisionEvidenceLogs: [{ rds_band: "ENGAGED" } as any] });
    const target = makeState({ decisionEvidenceLogs: [] });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual(target.decisionEvidenceLogs?.length, 1);
  });

  it("does not overwrite target decisionEvidenceLogs when populated", () => {
    const prior = makeState({ decisionEvidenceLogs: [{ rds_band: "ENGAGED" } as any] });
    const target = makeState({ decisionEvidenceLogs: [{ rds_band: "SURFACE" } as any] });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual((target.decisionEvidenceLogs?.[0] as any).rds_band, "SURFACE");
  });

  it("copies framework_detections from prior when target is empty", () => {
    const prior = makeState({ framework_detections: [[{ framework_id: "fw1", level: "explicit" }]] as any });
    const target = makeState({ framework_detections: [] });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual(target.framework_detections?.length, 1);
  });

  it("copies dashboard_summary from prior when target has none", () => {
    const summary = {
      session_headline: "Test",
      signal_averages: { analytical: 1, strategic: 0, tradeoff: 0, stakeholder: 0, ethical: 0 },
      framework_summary: [],
    };
    const prior = makeState({ dashboard_summary: summary } as any);
    const target = makeState({ dashboard_summary: undefined });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual(target.dashboard_summary?.session_headline, "Test");
  });

  it("merges framework_summary optional fields from prior into target", () => {
    const priorSummary = {
      session_headline: "prior",
      signal_averages: { analytical: 0, strategic: 0, tradeoff: 0, stakeholder: 0, ethical: 0 },
      framework_summary: [{
        framework_id: "fw1",
        best_level: "explicit",
        turn_of_best_application: 1,
        explicit_turns: 3,
        implicit_turns: 2,
        not_evidenced_turns: 1,
        framework_name: "Framework One",
        canonicalId: "fw1_canonical",
        provenance: "course_target",
        detection_method_distribution: { keyword: 4, semantic: 1 },
      }],
    };
    const targetSummary = {
      session_headline: "new",
      signal_averages: { analytical: 0, strategic: 0, tradeoff: 0, stakeholder: 0, ethical: 0 },
      framework_summary: [{
        framework_id: "fw1",
        best_level: "implicit",
        turn_of_best_application: 2,
      }],
    };
    const prior = makeState({ dashboard_summary: priorSummary } as any);
    const target = makeState({ dashboard_summary: targetSummary } as any);
    mergeReflectionAnalytics(target, prior);

    const merged = target.dashboard_summary?.framework_summary?.[0] as any;
    assert.strictEqual(merged.best_level, "implicit");
    assert.strictEqual(merged.turn_of_best_application, 2);
    assert.strictEqual(merged.explicit_turns, 3);
    assert.strictEqual(merged.implicit_turns, 2);
    assert.strictEqual(merged.not_evidenced_turns, 1);
    assert.strictEqual(merged.framework_name, "Framework One");
    assert.strictEqual(merged.canonicalId, "fw1_canonical");
    assert.strictEqual(merged.provenance, "course_target");
    assert.deepStrictEqual(merged.detection_method_distribution, { keyword: 4, semantic: 1 });
  });

  it("preserves target session_headline when both have summaries", () => {
    const priorSummary = {
      session_headline: "old",
      signal_averages: { analytical: 0, strategic: 0, tradeoff: 0, stakeholder: 0, ethical: 0 },
      framework_summary: [],
    };
    const targetSummary = {
      session_headline: "new",
      signal_averages: { analytical: 1, strategic: 0, tradeoff: 0, stakeholder: 0, ethical: 0 },
      framework_summary: [],
    };
    const prior = makeState({ dashboard_summary: priorSummary } as any);
    const target = makeState({ dashboard_summary: targetSummary } as any);
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual(target.dashboard_summary?.session_headline, "new");
  });

  it("copies indicatorAccumulation from prior when target is empty", () => {
    const prior = makeState({ indicatorAccumulation: { kpi1: { direction: "up", count: 2 } } } as any);
    const target = makeState({ indicatorAccumulation: {} });
    mergeReflectionAnalytics(target, prior);
    assert.ok((target.indicatorAccumulation as any)?.kpi1);
  });

  it("copies nudgeCounters from prior when target is empty", () => {
    const prior = makeState({ nudgeCounters: { depth: 2 } } as any);
    const target = makeState({ nudgeCounters: {} });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual((target.nudgeCounters as any)?.depth, 2);
  });

  it("copies hintCounters from prior when target is empty", () => {
    const prior = makeState({ hintCounters: { level1: 1 } } as any);
    const target = makeState({ hintCounters: {} });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual((target.hintCounters as any)?.level1, 1);
  });

  it("copies integrityFlags from prior when target is empty", () => {
    const prior = makeState({ integrityFlags: ["flagA"] } as any);
    const target = makeState({ integrityFlags: [] });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual(target.integrityFlags?.length, 1);
  });

  it("copies lastTurnNarrative from prior when target has none", () => {
    const prior = makeState({ lastTurnNarrative: "Prior narrative" } as any);
    const target = makeState({ lastTurnNarrative: undefined });
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual(target.lastTurnNarrative, "Prior narrative");
  });

  it("does not overwrite target lastTurnNarrative when populated", () => {
    const prior = makeState({ lastTurnNarrative: "Prior narrative" } as any);
    const target = makeState({ lastTurnNarrative: "Target narrative" } as any);
    mergeReflectionAnalytics(target, prior);
    assert.strictEqual(target.lastTurnNarrative, "Target narrative");
  });
});
