# Academium Engine - Compressed

## Overview
Academium is an AI-powered business simulation platform designed for experiential learning. It provides students with text-based scenarios to practice real-world decision-making. The platform uses a multi-agent AI architecture to generate immersive narratives, evaluate student decisions, calculate business impacts, and offer real-time feedback. It includes an interactive student "cockpit" with KPI dashboards and a professor authoring studio for customizing simulation blueprints. The project's core purpose is to deliver an immersive, reflective learning experience focused on decision-making processes and to empower educators with flexible content creation tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The platform is built around a multi-agent AI architecture governed by the Engine Packet v2.0 specification.

### UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with `shadcn/ui` on Radix UI primitives and Tailwind CSS for a Fluent Design-inspired "Design System Approach." Zustand manages client-side state, and TanStack Query handles server state. The student cockpit features a three-column layout, emphasizing reflection over scoring. The professor dashboard, built on Engine Packet v2.0, utilizes `docs/dashboard_blueprint.html` for visual design and data representation, focusing on descriptive data display without grading or ranking. The system supports internationalization for Spanish and English, with `t()` calls for all static UI text.

### Technical Implementations
The backend is an Express.js (Node.js) REST API, using PostgreSQL with Drizzle ORM. Authentication is handled via Replit Auth (OpenID Connect) and `express-session`. A JavaScript-based multi-agent orchestration system processes student turns through a defined pipeline: Input Classifier, Signal Extractor, Director (orchestrates parallel Evaluator, Domain Expert, Narrator), Causal Explainer, and Assembly. Key agents like the Domain Expert use a 3-tier magnitude model for KPI impacts, and the Narrator generates rich, context-sensitive narratives. The system uses a "Stateful World, Stateless Agents" pattern, storing simulation state in PostgreSQL. An on-demand explanation endpoint provides detailed causal chains for indicator changes.

### Feature Specifications
The platform incorporates a robust turn processing pipeline, including a 6-gate input classifier, a signal extractor scoring 5 reasoning signals, and a director orchestrating various agents. It includes a Framework Detector for analytical frameworks and a Debrief Question Generator targeting low-scoring signals. A Dashboard Summary Generator provides session-level analytics for professors. Simulations are structured with configurable decision points and reflection steps, utilizing "thinking scaffolds." Indicators have directionality (e.g., `up_better`/`down_better`) influencing UI displays. Role-Based Access Control (RBAC) manages user permissions.

### Framework Registry (Task #75 + TASK B)
- `server/agents/frameworkRegistry.ts` contains 41 curated bilingual framework entries across 6 disciplines (business, marketing, finance, operations, human_resources, strategy), each with `disciplines: string[]`, bilingual names/descriptions/concepts, `primaryDimension`, aliases, and `disciplineDescriptions` (per-discipline EN/ES blurbs, 25-60 words each).
- `resolveFrameworkName()` handles Porter disambiguation (Five Forces vs Generic Strategies) via alias matching.
- `GET /api/frameworks/registry?language=en|es` endpoint with 1hr server-side TTL cache returns registry for the wizard picker, including `disciplineDescriptions` flattened to requested language.
- The CanonicalCaseCreator wizard uses a grouped 6-discipline accordion picker with 3-item max selection, cross-discipline disable+tooltip for same-framework-under-different-discipline, preview cards showing discipline-specific descriptions in tooltips, and labeled dimension dropdowns in DecisionDimensionsEditor with HelpCircle tooltips for each dimension.
- DecisionDimensionsEditor shows contextual tooltips for all 5 academic dimensions (analytical, strategic, stakeholder, ethical, tradeoff) via HelpCircle icons next to the primary dimension label.
- Reasoning-signals tab filters out placeholder/empty `extracted_text` server-side and shows "No reasoning signals detected yet" when no valid signals exist.
- `mergeReflectionAnalytics` extracted to `server/mergeReflectionAnalytics.ts` with unit tests in `server/__tests__/mergeReflectionAnalytics.test.ts` (12 tests).
- Signal extractor propagates optional `confidence` and `marginalEvidence` fields to the reasoning-signals endpoint.
- Registry validation script: `server/scripts/validateRegistry.ts`.
- Regression tests: `server/__tests__/frameworkRegistry.regression.test.ts` (5 Porter resolution tests).

### Calibration Conservatism (TASK C)
- **Module Health target/suggested split**: When `pedagogicalIntent.targetFrameworks` exists, frameworks matching intent IDs are classified as target; otherwise `provenance === "explicit"` classifies as target, rest as suggested. Response includes `detection_method_distribution`, `rate`, `weightedScore`, `appliedCount_weighted_sum`, `completed` per framework. UI renders detection breakdown row below each framework card.
- **Confidence-weighted "transferring" threshold**: Module Health status now uses `weightedScore` (not raw rate). Session scores: 1.0 for explicit/implicit-high, 0.5 for implicit-medium, 0.0 for implicit-low/signal_pattern/consistency_promoted. Thresholds: >=0.60 transferring, >=0.30 developing, >0 not_yet_evidenced, 0 absent.
- **Applied Course Theory tightened**: Requires `explicit` or `implicit` with `confidence: "medium"|"high"`. Excludes `signal_pattern` and `consistency_promoted` detection methods. Implicit-low no longer counts.
- **Semantic implicit floor (§T-003B)**: In `frameworkDetector.ts`, inputs <10 words have semantic verdicts rejected (falls through to Tier 3 signal-pattern). Inputs 10-14 words are downgraded to confidence "low". >=15 words unchanged.
- **Compatibility manifest**: Version bumped to `v3.0-phase-6a`. Two new entries: `module-health.target-split`, `class-stats.applied-course-theory-strict`.
- **Unit tests**: `server/__tests__/calibration.moduleHealth.test.ts` (10 tests), `calibration.appliedCourseTheory.test.ts` (9 tests), `calibration.semanticFloor.test.ts` (8 tests) — all pass.

### Pedagogical Intent Hardening (Task #92)
- Required fields: teachingGoal (≥20 chars), targetDisciplines (≥1), courseContext (≥20 chars). Server validates at POST /api/canonical-case/generate with accumulated 400 errors. Client shows inline errors after first Generate attempt.
- `PedagogicalIntent.targetDisciplines?: string[]` added to schema + Zod. Client sends `selectedDisciplines` array in generate payload.
- `buildIntentBlock` in canonicalCaseGenerator.ts now emits: coreConcepts per framework from registry, DISCIPLINE ANCHORING block, TRADEOFF REALISM block.
- Post-gen gate 5b flags `discipline_coverage_missing` when no generated framework maps to a selected discipline.
- Auto-inference (`inferFrameworks`) disabled in routes.ts `runInferenceAndPersist`; `frameworkInference.ts` file preserved.
- Narrator `PROHIBITED_PATTERNS` expanded with 14 new entries (impressive, remarkable, sophisticated, thoughtful, thorough, nuanced, deep+qualifier, ES equivalents). `scanProhibitedLanguage` exported for testing.
- Director `BANNED_SUPERLATIVES_EN/ES` expanded; headline prompt adds "deep analysis/reasoning/..." ban phrases.
- Unit test: `server/__tests__/narrator.prohibitedLanguage.test.ts` (6 cases).

### Professor Dashboard (Part C)
The professor dashboard at `/scenarios/:scenarioId/dashboard` provides a 3-tab view (Analytics/Students/Control) with:
- **Analytics Tab**: 4 stat cards (completed, in progress, biggest drop point, applied course theory), Module Health section (framework detection rates with status badges), Reasoning Depth trajectory chart (Recharts LineChart), Class Patterns section (competency rates with progress bars), Students table with reasoning arc dots and session links.
- **Student Session Modal**: 4-tab modal (Chat history, Debrief prep, Reasoning signals with RadarChart, KPI+Frameworks trajectory table). All endpoints are professor-only with scenario ownership verification.
- **Backend Endpoints**: `class-stats`, `module-health`, `depth-trajectory`, `class-patterns`, `students-summary`, `session summary`, `chat-history`, `debrief-prep`, `reasoning-signals`, `kpi-frameworks` — all with 5-minute server-side cache.
- **Visual Reference**: `docs/dashboard_blueprint.html` (528 lines) — blueprint for colors, typography, spacing.
- **Status Colors**: Integrated/Positive `#1D9E75`, Engaged/Info `#378ADD`, Surface/Emerging `#BA7517`, Absent/Negative `#D85A30`.

### System Design Choices
The architecture emphasizes event-driven updates with optimistic UI, a hierarchical agent pattern, and component composition based on atomic design principles. It features end-to-end type safety. The system includes LLM resilience with structured errors and frontend auto-retry. The dynamic indicator engine builds prompts from scenario indicators, and previous decisions influence the domain expert's impact calculations for context-sensitive results. Input validation is lenient, preserving student text on rejection.

## External Dependencies

### Third-Party Services
- **Replit Infrastructure**: Replit Auth (OpenID Connect), Replit Object Storage, Replit AI Integrations (OpenAI and Gemini proxies).
- **AI/LLM Services**: Multi-provider architecture supporting OpenRouter, Anthropic, OpenAI Direct, Gemini Direct, Replit OpenAI Proxy, Replit Gemini Proxy, with a smart router for load balancing and failover.
- **Google Cloud Storage**: Used for PDF case study uploads in the Authoring Studio.

### Database
- **PostgreSQL**: Accessed via Neon serverless driver.

### Key NPM Packages
- **Frontend**: React, Wouter, Radix UI, Framer Motion, Recharts, TanStack Query, Zustand.
- **Backend**: Express.js, Drizzle ORM, Passport.js, `express-session`, `p-limit`, `p-retry`.
- **Development**: Vite, esbuild, tsx, Tailwind CSS.