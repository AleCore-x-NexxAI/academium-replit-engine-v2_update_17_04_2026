# Academium Engine

## Overview
Academium is an AI-powered business simulation platform for experiential learning, allowing students to practice real-world decision-making in dynamic, text-based scenarios. Professors can author and customize simulation blueprints. The platform uses a multi-agent AI architecture to generate immersive narratives, evaluate student decisions, calculate business impacts, and provide real-time feedback. Key features include an interactive student "cockpit" with KPI dashboards, a professor authoring studio, and a multi-agent AI engine for narrative generation, competency assessment, and business logic. The project aims to provide an immersive, reflective learning experience focused on decision-making processes and to empower educators with flexible content creation tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

## Engine Specification (MUST READ)
The Engine Packet v2.0 at `docs/ENGINE_PACKET_V2.md` is the governing specification for the simulation engine. All engine work MUST conform to this document. When implementing any engine section (signal extraction, consequence generation, KPI computation, causal explanations, response assembly), read the relevant section of this document first and follow it exactly. In any conflict between this file and prior code, this document governs.

### Frontend
The frontend uses React, TypeScript, and Vite, with `shadcn/ui` on Radix UI primitives and Tailwind CSS for a Fluent Design-inspired "Design System Approach." Zustand manages client-side state, and TanStack Query handles server state for real-time updates and optimistic UI. The student cockpit features a three-column layout for context, narrative, and feedback.

### Backend
The backend is an Express.js (Node.js) REST API, using PostgreSQL with Drizzle ORM. Authentication is via Replit Auth (OpenID Connect) and `express-session`. A JavaScript-based multi-agent orchestration system processes student turns with specialized agents. The pipeline follows Engine Packet v2.0:

**Turn Pipeline (Engine Packet v2.0):**
1. **Input Classifier** (`inputValidator.ts`): 6-gate decision tree (empty → safety → integrity → off_topic → LLM pass criteria → engagement). Returns PASS/NUDGE/BLOCK. MCQ always PASS. Force-PASS after 2 nudges per decision point. Classification is authoritative — no downstream agent can override it to BLOCK.
2. **Signal Extractor** (`signalExtractor.ts`): On PASS, extracts 5 reasoning signals (Intent, Justification, TradeoffAwareness, StakeholderAwareness, EthicalAwareness) scored STRONG(3)/PRESENT(2)/WEAK(1)/ABSENT(0). Computes Response Depth Score (RDS, 0-15) and classifies into bands (SURFACE <5, ENGAGED 5-9, INTEGRATED 10+). Maps signals to C1-C5 competencies.
3. **Director** (`director.ts`): Orchestrates the full pipeline. Runs classifier → signal extraction → intent interpretation → parallel (Evaluator + DomainExpert) → Narrator. Writes DecisionEvidenceLog to SimulationState.
4. **Evaluator + DomainExpert** run in parallel, followed by **Narrator**.

Internal agents (Director, Evaluator, SignalExtractor, InputClassifier) are hardcoded to `gpt-4o-mini`; student-facing agents (DomainExpert, Narrator) use the scenario's configured model. An on-demand explanation endpoint (`POST /api/simulations/:sessionId/explain`) lazily generates detailed causal chains for indicator changes — DomainExpert only returns `shortReason` during turn processing to keep latency low. The architecture follows a "Stateful World, Stateless Agents" pattern, storing simulation state in PostgreSQL while agents reason without maintaining internal state.

### Data Architecture
The database schema includes tables for `users`, `scenarios`, `simulation_sessions`, `turns`, `turn_events`, and `sessions`. The `scenarios` table includes a `courseConcepts` column (`text[]`, nullable) for tagging scenarios with 3–8 course concept tags that enable concept-level analytics. The `turn_events` table provides comprehensive logging of every interaction during turn processing: rejected inputs (with verbatim student text and validator reasoning), accepted inputs, individual agent calls (inputClassifier, signalExtractor, director, evaluator, domainExpert, narrator with their outputs), turn completion summaries, and errors. Key data structures like `SimulationState` (JSONB for KPIs, history, scores, decisionEvidenceLogs, nudgeCounters, integrityFlags), `KPIs`, `Rubric` (JSONB for scoring criteria), and `HistoryEntry` (role-based messages) manage simulation data. `DecisionEvidenceLog` stores per-decision signal extraction results, RDS scores/bands, and C1-C5 competency evidence. Professors can view the full event log for any session via the "Registro de Eventos" tab in the session detail dialog on ScenarioAnalytics.

### API Design
The API provides RESTful endpoints for managing scenarios, simulations, and user authentication. The turn processing flow involves client input, backend agent service invocation, agent workflow execution, and persistent storage of the turn, with a response to the client. The on-demand explanation endpoint `POST /api/simulations/:sessionId/explain` lazily generates detailed causal chains for indicator changes (DomainExpert only returns `shortReason` during turn processing). The professor analytics suite includes `GET /api/scenarios/:scenarioId/cohort-analytics` which aggregates class-level data: MCQ decision distributions per step, stuck nodes (NUDGE rate per decision point), reasoning style profiles (financial/people/risk/balanced based on competencyScores), class-level competency strengths, concept gap analytics (friction per course concept tag from validation rejections and time analysis), reasoning pattern detection (keyword heuristics for trade-offs, stakeholder mentions, risk mitigation, evidence use, uncertainty awareness, reflection presence), and template-based teaching recommendations. All analytics use "señales/patrones/insights/brechas" language — never grades or rankings. The ScenarioAnalytics page has "Estudiantes" and "Vista de Clase" tabs.

### Internationalization (i18n)
The platform supports Spanish (es) and English (en) via a custom translation system. Key files: `client/src/lib/translations.ts` (translation dictionary with 500+ keys), `client/src/contexts/LanguageContext.tsx` (LanguageProvider, useTranslation hook), `client/src/components/LanguageToggle.tsx` (ES/EN toggle button). Language preference is stored in the `users.language` column (default "es"), persisted via `PATCH /api/users/language`, and cached in localStorage for guest users. The `useTranslation()` hook returns `{ language, setLanguage, t }` where `t("section.key")` looks up translations. All static UI text across every page and component uses `t()` calls. Simulation content (AI responses, scenario narratives) is NOT translated — only the application chrome. The LanguageToggle component appears in every page header. Date formatting uses locale-aware `toLocaleDateString(language === "en" ? "en-US" : "es-ES", ...)`.

### Design Patterns
The system uses event-driven updates with optimistic UI, a hierarchical agent pattern, component composition based on atomic design principles, and end-to-end type safety. Role-Based Access Control (RBAC) manages user permissions. The student interface emphasizes reflection over scoring, and the professor studio supports AI-assisted and manual case creation with a focus on ease of use. Simulations are structured with a configurable number of decision points (3–10, default 3) followed by a reflection step, with "thinking scaffolds" guiding students on how to approach decisions without suggesting answers. Indicators have directionality (`up_better`/`down_better`) influencing UI displays and delta coloring. The system includes LLM resilience with structured errors and frontend auto-retry for transient issues. The dynamic indicator engine builds prompts from actual scenario indicators, and previous decisions influence the domain expert's impact calculations, ensuring context-sensitive results. Input validation is very lenient — accepts any case-relevant response, only rejects gibberish/profanity/completely off-topic. The `needsElaboration` category was removed. Student text is preserved on rejection (uses `mutateAsync` so the promise chain properly prevents clearing). The end-of-simulation results screen (`SessionResults.tsx`) includes an "Overall Status Summary" card between the inspirational message and indicator grid, computing a direction-aware status (Estable/En Riesgo/Situación Crítica) from indicator deltas with strengths/concerns badges showing "mejoró/empeoró X pts".

### Removed Features
The Bug Report UI has been removed: the `BugReportButton` component and `BugReports` page were deleted, and their routes were removed from `App.tsx`. Backend bug report API routes (`/api/bug-reports`) still exist in the codebase but are no longer accessible from the frontend.

## External Dependencies

### Third-Party Services
- **Replit Infrastructure**: Replit Auth (OpenID Connect), Replit Object Storage (via Google Cloud Storage client), Replit AI Integrations (OpenAI and Gemini proxies).
- **AI/LLM Services**: Multi-provider architecture supporting OpenRouter, Anthropic, OpenAI Direct, Gemini Direct, Replit OpenAI Proxy, Replit Gemini Proxy. Features include a provider registry, smart router for load balancing and failover, multi-key support, model equivalence for failover, and a turn queue for managing requests during high load.

### Database
- **PostgreSQL**: Accessed via Neon serverless driver.

### Key NPM Packages
- **Frontend**: React, Wouter, Radix UI, Framer Motion, Recharts, TanStack Query, Zustand.
- **Backend**: Express.js, Drizzle ORM, Passport.js, `express-session`, `p-limit`, `p-retry`.
- **Development**: Vite, esbuild, tsx, Tailwind CSS.

### File Storage
- **Google Cloud Storage**: Used for PDF case study uploads in the Authoring Studio.