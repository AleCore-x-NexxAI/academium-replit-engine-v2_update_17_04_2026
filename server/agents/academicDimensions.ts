/**
 * Phase 5 (Apéndice C, §10.2): auto-assignment of academic dimensions to
 * decisions when the professor has not explicitly mapped each decision in
 * `pedagogicalIntent.decisionDimensions`.
 *
 * Defaults by step count:
 *   3-step → [stakeholder, tradeoff, strategic]
 *   4-step → [analytical, stakeholder, tradeoff, strategic]
 *   5-step → [analytical, stakeholder, ethical, tradeoff, strategic]
 *
 * For step counts outside 3..5 we extend by repeating from the 5-step
 * template, but the no-consecutive-same-primary rule is enforced by
 * post-processing (rotating to the next available dimension).
 *
 * If `pedagogicalIntent.targetCompetencies` selects exactly one competency,
 * the no-consecutive-same-primary constraint is explicitly relaxed (per the
 * §10.2 single-competency exception).
 */

import type { AcademicDimension, PedagogicalIntent } from "@shared/schema";
import { DIMENSION_TO_COMPETENCY } from "@shared/schema";

export interface DecisionDimension {
  decisionNumber: number;
  primaryDimension: AcademicDimension;
  secondaryDimension?: AcademicDimension;
}

const TEMPLATE_3: AcademicDimension[] = ["stakeholder", "tradeoff", "strategic"];
const TEMPLATE_4: AcademicDimension[] = ["analytical", "stakeholder", "tradeoff", "strategic"];
const TEMPLATE_5: AcademicDimension[] = ["analytical", "stakeholder", "ethical", "tradeoff", "strategic"];

const ALL_DIMS: AcademicDimension[] = ["analytical", "strategic", "stakeholder", "ethical", "tradeoff"];

function templateFor(stepCount: number): AcademicDimension[] {
  if (stepCount <= 3) return TEMPLATE_3.slice(0, Math.max(1, stepCount));
  if (stepCount === 4) return TEMPLATE_4.slice();
  if (stepCount === 5) return TEMPLATE_5.slice();
  // > 5: extend by cycling TEMPLATE_5
  const out: AcademicDimension[] = TEMPLATE_5.slice();
  let i = 0;
  while (out.length < stepCount) {
    out.push(TEMPLATE_5[i % TEMPLATE_5.length]);
    i++;
  }
  return out;
}

/**
 * Promote dimensions toward the professor's targetCompetencies. If a target
 * competency maps to a dimension absent from the assignment, swap one
 * non-essential slot to include it (keeping the strategic-final + tradeoff
 * presence intact when possible).
 */
function promoteByCompetencies(
  assigned: AcademicDimension[],
  competencies: PedagogicalIntent["targetCompetencies"],
): AcademicDimension[] {
  if (!competencies || competencies.length === 0) return assigned;
  const desired = new Set<AcademicDimension>();
  for (const c of competencies) {
    for (const dim of ALL_DIMS) {
      if (DIMENSION_TO_COMPETENCY[dim] === c) desired.add(dim);
    }
  }
  const present = new Set(assigned);
  const out = assigned.slice();
  for (const dim of desired) {
    if (present.has(dim)) continue;
    // find a slot whose dimension isn't in `desired` and isn't the last (strategic) slot
    const swapIdx = out.findIndex((d, i) => i !== out.length - 1 && !desired.has(d));
    if (swapIdx >= 0) {
      out[swapIdx] = dim;
      present.delete(out[swapIdx]);
      present.add(dim);
    }
  }
  return out;
}

/**
 * Enforce the no-consecutive-same-primary rule unless `singleCompetency` is
 * true (exception). When a duplicate is detected, swap with the next
 * non-conflicting dimension from the alphabet.
 */
function enforceNoConsecutive(
  assigned: AcademicDimension[],
  singleCompetency: boolean,
): AcademicDimension[] {
  if (singleCompetency) return assigned;
  const out = assigned.slice();
  for (let i = 1; i < out.length; i++) {
    if (out[i] === out[i - 1]) {
      const candidate = ALL_DIMS.find((d) => d !== out[i] && d !== out[i + 1]);
      if (candidate) out[i] = candidate;
    }
  }
  return out;
}

/**
 * Build the per-decision dimension assignments. Always returns exactly
 * `stepCount` entries with primaryDimension populated. Honors any explicit
 * mappings supplied by the professor in `pedagogicalIntent.decisionDimensions`
 * and fills remaining slots from the §10.2 template (then promotes/enforces).
 */
export function assignDecisionDimensions(
  pedagogicalIntent: PedagogicalIntent,
  stepCount: number,
): DecisionDimension[] {
  const explicit = new Map<number, DecisionDimension>();
  if (pedagogicalIntent.decisionDimensions) {
    for (const dd of pedagogicalIntent.decisionDimensions) {
      if (dd.decisionNumber >= 1 && dd.decisionNumber <= stepCount) {
        explicit.set(dd.decisionNumber, dd);
      }
    }
  }

  const template = templateFor(stepCount);
  const filled: AcademicDimension[] = [];
  for (let i = 0; i < stepCount; i++) {
    const ex = explicit.get(i + 1);
    filled.push(ex ? ex.primaryDimension : template[i]);
  }

  const promoted = promoteByCompetencies(filled, pedagogicalIntent.targetCompetencies);
  const singleCompetency = (pedagogicalIntent.targetCompetencies?.length ?? 0) === 1;
  const finalAssignments = enforceNoConsecutive(promoted, singleCompetency);

  // Re-merge with explicit overrides so any explicit value takes precedence
  // over the post-processing.
  return finalAssignments.map((primary, i) => {
    const ex = explicit.get(i + 1);
    if (ex) return ex;
    return { decisionNumber: i + 1, primaryDimension: primary };
  });
}

export type DecisionDimension = ReturnType<typeof assignDecisionDimensions>[number];

/**
 * Per-dimension constraint text (§10.3) injected into prompts. The strings
 * are in either Spanish or English so the prompt remains pure-language.
 */
export function dimensionConstraintFor(
  dim: AcademicDimension,
  language: "es" | "en",
): string {
  if (language === "en") {
    switch (dim) {
      case "analytical":
        return "ANALYTICAL DECISION: include at least one numeric data point or an explicit causal claim in the prompt or option text. Force the student to interpret data or trace cause-and-effect.";
      case "stakeholder":
        return "STAKEHOLDER DECISION: name at least two distinct stakeholders with non-aligned interests in the prompt or options. Make the tension between their interests explicit.";
      case "tradeoff":
        return "TRADEOFF DECISION: the prompt MUST name both a concrete cost and a concrete benefit of the choice. Populate `tradeoffSignature` with { dimension, cost, benefit }, all non-empty.";
      case "ethical":
        return "ETHICAL DECISION: frame the decision as a tension between two legitimate goods (not good vs. evil). The prompt should make both sides defensible on principle.";
      case "strategic":
        return "STRATEGIC DECISION: present at least two defensible strategic paths in the prompt or options. Each path should imply different long-term consequences.";
    }
  }
  switch (dim) {
    case "analytical":
      return "DECISIÓN ANALÍTICA: incluye al menos un dato numérico o una afirmación causal explícita en el prompt o las opciones. Obliga al estudiante a interpretar datos o rastrear causa-efecto.";
    case "stakeholder":
      return "DECISIÓN DE STAKEHOLDERS: nombra al menos dos stakeholders distintos con intereses no alineados en el prompt o las opciones. Haz explícita la tensión entre sus intereses.";
    case "tradeoff":
      return "DECISIÓN DE TRADE-OFF: el prompt DEBE nombrar tanto un costo concreto como un beneficio concreto de la elección. Completa `tradeoffSignature` con { dimension, cost, benefit }, todos no vacíos.";
    case "ethical":
      return "DECISIÓN ÉTICA: enmarca la decisión como una tensión entre dos bienes legítimos (no bien vs. mal). El prompt debe hacer defendibles ambos lados por principio.";
    case "strategic":
      return "DECISIÓN ESTRATÉGICA: presenta al menos dos caminos estratégicos defendibles en el prompt o las opciones. Cada camino debe implicar consecuencias de largo plazo distintas.";
  }
}
