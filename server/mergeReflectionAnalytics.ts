import type { SimulationState } from "@shared/schema";

export function mergeReflectionAnalytics(target: SimulationState, prior: SimulationState): void {
  if (!target.decisionEvidenceLogs?.length && prior.decisionEvidenceLogs?.length) {
    target.decisionEvidenceLogs = prior.decisionEvidenceLogs;
  }
  if (!target.framework_detections?.length && prior.framework_detections?.length) {
    target.framework_detections = prior.framework_detections;
  }
  if (!target.dashboard_summary && prior.dashboard_summary) {
    target.dashboard_summary = prior.dashboard_summary;
  } else if (target.dashboard_summary && prior.dashboard_summary) {
    const tgt = target.dashboard_summary;
    const prv = prior.dashboard_summary;
    if (tgt.framework_summary && prv.framework_summary) {
      tgt.framework_summary = tgt.framework_summary.map((entry) => {
        const priorEntry = prv.framework_summary.find((p) => p.framework_id === entry.framework_id);
        if (!priorEntry) return entry;
        return {
          ...priorEntry,
          ...entry,
          explicit_turns: entry.explicit_turns ?? priorEntry.explicit_turns,
          implicit_turns: entry.implicit_turns ?? priorEntry.implicit_turns,
          not_evidenced_turns: entry.not_evidenced_turns ?? priorEntry.not_evidenced_turns,
          framework_name: entry.framework_name ?? priorEntry.framework_name,
          canonicalId: entry.canonicalId ?? priorEntry.canonicalId,
          provenance: entry.provenance ?? priorEntry.provenance,
          detection_method_distribution:
            entry.detection_method_distribution ?? priorEntry.detection_method_distribution,
        };
      });
    }
  }
  if (
    (!target.indicatorAccumulation || Object.keys(target.indicatorAccumulation).length === 0) &&
    prior.indicatorAccumulation && Object.keys(prior.indicatorAccumulation).length > 0
  ) {
    target.indicatorAccumulation = prior.indicatorAccumulation;
  }
  if (
    (!target.nudgeCounters || Object.keys(target.nudgeCounters).length === 0) &&
    prior.nudgeCounters && Object.keys(prior.nudgeCounters).length > 0
  ) {
    target.nudgeCounters = prior.nudgeCounters;
  }
  if (
    (!target.hintCounters || Object.keys(target.hintCounters).length === 0) &&
    prior.hintCounters && Object.keys(prior.hintCounters).length > 0
  ) {
    target.hintCounters = prior.hintCounters;
  }
  if (!target.integrityFlags?.length && prior.integrityFlags?.length) {
    target.integrityFlags = prior.integrityFlags;
  }
  if (!target.lastTurnNarrative && prior.lastTurnNarrative) {
    target.lastTurnNarrative = prior.lastTurnNarrative;
  }
}
