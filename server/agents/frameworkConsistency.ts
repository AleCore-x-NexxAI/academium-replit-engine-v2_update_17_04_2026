// Phase 2 §12.3 — consistency check between signal extractor and framework detector.
// Promotes not_evidenced → implicit (low confidence, detection_method "consistency_promoted")
// when the framework's primaryDimension signal is PRESENT/STRONG. Never demotes.
//
// Phase-2 eligibility (per packet adjustment): frameworks with `provenance === "explicit"`
// are eligible. Phase 6 reverts to the strict packet rule (only pedagogicalIntent.targetFrameworks).

import type { CaseFramework, FrameworkDetection } from "@shared/schema";
import type { SignalExtractionResult } from "./types";
import { SIGNAL_FOR_DIMENSION } from "./frameworkRegistry";

export interface PromotionRecord {
  framework_id: string;
  framework_name: string;
  primaryDimension: string;
  signalQuality: number;
  reason: string;
}

export function checkConsistency(
  signals: SignalExtractionResult,
  detections: FrameworkDetection[],
  frameworks: CaseFramework[],
): { detections: FrameworkDetection[]; promotions: PromotionRecord[] } {
  const promotions: PromotionRecord[] = [];
  const fwById = new Map(frameworks.map((f) => [f.id, f]));

  const out = detections.map((det) => {
    if (det.level !== "not_evidenced") return det;

    const fw = fwById.get(det.framework_id);
    if (!fw) return det;

    // Phase-2 eligibility: provenance === "explicit". Frameworks without an
    // explicit provenance default to eligible (legacy course-targeted entries).
    const provenance = fw.provenance ?? "explicit";
    if (provenance !== "explicit") return det;

    if (!fw.primaryDimension) return det;
    const sigKey = SIGNAL_FOR_DIMENSION[fw.primaryDimension];
    const quality = signals[sigKey]?.quality ?? 0;

    // PRESENT (2) or STRONG (3) on the framework's primary dimension.
    if (quality < 2) return det;

    promotions.push({
      framework_id: fw.id,
      framework_name: fw.name,
      primaryDimension: fw.primaryDimension,
      signalQuality: quality,
      reason: `Signal extractor reports ${fw.primaryDimension}=${quality} but detector returned not_evidenced — promoted to implicit (consistency_promoted).`,
    });

    const promoted: FrameworkDetection = {
      ...det,
      level: "implicit",
      confidence: "low",
      detection_method: "consistency_promoted",
      reasoning: `Promoted by consistency check: ${fw.primaryDimension} signal at quality ${quality} contradicts not_evidenced verdict.`,
    };
    return promoted;
  });

  return { detections: out, promotions };
}
