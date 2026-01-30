/**
 * SIMULEARN Engine Version Constants
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
      "3 Decision Points (multiple choice → analytical → integrative)",
      "4 POC Indicators (teamMorale, budgetImpact, operationalRisk, strategicFlexibility)",
      "Lightweight Reflection (1 optional prompt)",
      "Multi-agent orchestration (Director, Narrator, Evaluator, DomainExpert, DepthEvaluator)",
      "AI Guardrails (8 HARD_PROHIBITIONS)",
      "Weak Answer Feedback Loop (2 revision attempts)",
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

export const STRUCTURE_LOCK_NOTICE = `
=== ESTRUCTURA CANÓNICA BLOQUEADA (POC ${POC_VERSION}) ===

Esta estructura está BLOQUEADA para el POC de febrero.
NO modificar sin documentación explícita y etiqueta de versión.

Componentes bloqueados:
- Formato de caso Harvard (120-180 palabras contexto)
- Exactamente 3 puntos de decisión
- 4 indicadores POC
- 1 prompt de reflexión opcional
- Duración objetivo: 20-25 minutos

Cambios futuros requieren:
1. Documentación explícita del cambio
2. Etiqueta de versión (v2.x, v3.x)
3. Compatibilidad hacia atrás donde sea posible
`;
