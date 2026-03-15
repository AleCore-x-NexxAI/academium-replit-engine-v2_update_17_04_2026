/**
 * Academium Engine Version Constants
 * 
 * VERSIONING NOTE (IMPORTANT):
 * This structure is LOCKED for POC v1.
 * Any future changes must be:
 * - Explicitly documented
 * - Version-tagged
 * - Backward-compatible where possible
 */

export const POC_VERSION = "v1.0";

export const VERSION_ROADMAP = {
  current: "v1.0",
  
  v1: {
    name: "POC Foundation",
    status: "LOCKED",
    features: [
      "Canonical Case Structure (120-180 word context)",
      "Configurable Decision Points (3–10, default 3; multiple choice → analytical → integrative)",
      "4 POC Indicators (teamMorale, budgetHealth, operationalRisk, strategicFlexibility)",
      "Lightweight Reflection (1 optional prompt)",
      "Multi-agent orchestration (Director, Narrator, Evaluator, DomainExpert, DepthEvaluator)",
      "AI Guardrails (8 HARD_PROHIBITIONS)",
      "S4.1/S4.2 Relevance+Structure Validation (no length quota, 1 max revision)",
      "Faculty Visibility Dashboard (no scores displayed)",
    ],
  },
  
  v2: {
    name: "Decision Depth Enhancement",
    status: "PLANNED",
    plannedFeatures: [
      "Enhanced decision complexity analysis",
      "Adaptive difficulty based on student responses",
      "Expanded indicator set beyond 4 POC indicators",
      "Multi-path branching narratives",
      "Session analytics for professors",
    ],
  },
  
  v3: {
    name: "Competency Mapping & Analytics",
    status: "PLANNED",
    plannedFeatures: [
      "Competency framework integration",
      "Rubric-based grading (professor-controlled)",
      "Learning analytics dashboard",
      "Cross-session student progress tracking",
      "Cohort comparison analytics",
      "Export to LMS (Canvas, Moodle, Blackboard)",
    ],
  },
};

export const DEFAULT_DECISIONS = 3;
export const MIN_DECISIONS = 3;
export const MAX_DECISIONS = 10;

export const STRUCTURE_LOCK_NOTICE = `
=== ESTRUCTURA CANÓNICA (POC ${POC_VERSION}) ===

Componentes base:
- Formato de caso Harvard (120-180 palabras contexto)
- Puntos de decisión configurables (${MIN_DECISIONS}–${MAX_DECISIONS}, por defecto ${DEFAULT_DECISIONS})
- 4 indicadores POC
- 1 prompt de reflexión opcional
- Duración objetivo: proporcional al número de decisiones
`;
