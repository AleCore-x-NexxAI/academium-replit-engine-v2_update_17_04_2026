# Scenario+ Engine

## Overview
Scenario+ is an AI-powered business simulation platform designed for experiential learning. It enables students to practice real-world decision-making within dynamic, text-based scenarios. Professors can author and customize simulation blueprints. The platform uses a multi-agent AI architecture to generate immersive narratives, evaluate student decisions, calculate business impacts, and provide real-time feedback. Its core capabilities include an interactive student "cockpit" with KPI dashboards, a professor authoring studio for scenario creation, and a multi-agent AI engine for narrative generation, competency assessment, and business logic. The project aims to provide an immersive and reflective learning experience, focusing on decision-making processes rather than direct scoring, and empowering educators with flexible content creation tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React and TypeScript, leveraging Vite for development. It uses `shadcn/ui` on Radix UI primitives with Tailwind CSS, following a Fluent Design-inspired "Design System Approach" for professional credibility. State management utilizes Zustand for client-side state and TanStack Query for server state, supporting real-time updates and optimistic UI. The student cockpit features a three-column grid for context, narrative, and feedback.

### Backend
The backend is an Express.js (Node.js) REST API, functioning as the "World Server." It uses PostgreSQL with Drizzle ORM for type-safe data management. Authentication is handled by Replit Auth (OpenID Connect) with `express-session`. A JavaScript-based multi-agent orchestration system (inspired by LangChain.js patterns) processes student turns. This system comprises specialized AI agents: `SimulationDirector`, `ScenarioWeaver/Narrator`, `CompetencyAssessor/Evaluator`, and `BusinessLogicEngine/DomainExpert`. LLM integration uses OpenAI GPT-4o via Replit AI Integrations. The architecture follows a "Stateful World, Stateless Agents" pattern, storing simulation state in PostgreSQL while agents reason without maintaining internal state.

### Data Architecture
The core database includes tables for `users`, `scenarios`, `simulation_sessions`, `turns`, and `sessions`. Key data structures such as `SimulationState` (JSONB for KPIs, history, scores), `KPIs`, `Rubric` (JSONB for scoring criteria), and `HistoryEntry` (role-based messages) are central to managing simulation data.

### API Design
The API provides RESTful endpoints for managing scenarios, simulations, and user authentication. It facilitates actions such as starting new simulations, submitting student turns, and retrieving session data. The turn processing flow involves client input submission, backend agent service invocation, agent workflow execution, and persistent storage of the turn with a response back to the client.

### Design Patterns
The system employs event-driven updates with optimistic UI, a hierarchical agent pattern where a Director manages worker agents, component composition based on atomic design principles, and end-to-end type safety achieved through shared schema types. Role-Based Access Control (RBAC) is implemented to manage user permissions across different routes and functionalities, with specific flows for role selection and administrative access. The student interface is designed for a calm, reflection-focused experience, avoiding visible grades or scores and emphasizing reasoning over correct answers. The professor studio supports both AI-assisted and manual case creation, prioritizing ease of use and professor control.

## External Dependencies

### Third-Party Services
- **Replit Infrastructure**: Replit Auth (OpenID Connect), Replit Object Storage (via Google Cloud Storage client), Replit AI Integrations (OpenAI and Gemini proxies).
- **AI/LLM Services**: Multi-provider architecture supporting up to 6 providers (OpenRouter, Anthropic, OpenAI Direct, Gemini Direct, Replit OpenAI Proxy, Replit Gemini Proxy).

### LLM Provider Architecture (February 2026 - Multi-Provider Scale)
- **Provider Registry** (`server/llm/providers/registry.ts`): Auto-discovers providers from env vars, tracks health/capacity
- **Smart Router** (`server/llm/providers/router.ts`): Least-loaded routing with EMA latency tracking, cross-provider failover
- **6 Supported Providers**: OpenRouter, Anthropic Direct, OpenAI Direct, Gemini Direct, Replit OpenAI Proxy, Replit Gemini Proxy
- **Multi-Key Support**: Each provider accepts comma-separated API keys (e.g., `OPENROUTER_API_KEYS=key1,key2`) for increased quota
- **Model Equivalence**: Automatic model mapping during failover (gpt-4o ↔ claude-sonnet-4 ↔ gemini-2.5-pro)
- **Turn Queue** (`server/llm/turnQueue.ts`): When all providers saturated, returns 202 + job ID; frontend polls for results
- **Monitoring**: `GET /api/monitoring/ai-capacity` returns per-provider stats, queue depth, total capacity
- **Queue Status**: `GET /api/queue/status/:jobId` returns job status (queued/processing/completed/failed) with results
- **Warm-up**: On server start, pings all providers to verify connectivity
- **Frontend Queue UI**: Shows queue position and estimated wait time in SimulationFeed when queued
- **Backward Compatible**: `generateChatCompletion()` interface unchanged; all agents work without modifications

### Environment Variables for AI Providers
- `OPENROUTER_API_KEYS`: Comma-separated OpenRouter API keys (optional)
- `ANTHROPIC_API_KEYS`: Comma-separated Anthropic API keys (optional)
- `OPENAI_DIRECT_API_KEYS`: Comma-separated OpenAI Direct API keys (optional)
- `GEMINI_DIRECT_API_KEYS`: Comma-separated Google Gemini Direct API keys (optional)
- Replit proxies (OpenAI + Gemini) are always available as fallback without keys

### Database
- **PostgreSQL**: Accessed via Neon serverless driver.

### Key NPM Packages
- **Frontend**: React, Wouter, Radix UI, Framer Motion, Recharts, TanStack Query, Zustand.
- **Backend**: Express.js, Drizzle ORM, Passport.js, `express-session`, `p-limit`, `p-retry`.
- **Development**: Vite, esbuild, tsx, Tailwind CSS.

### File Storage
- **Google Cloud Storage**: Used for PDF case study uploads in the Authoring Studio.

## Recent Changes (January 2026)

### Professor Simulation Management Features
- **Simulation Management View** (`/scenarios/:id/manage`): Comprehensive management interface with 4 tabs:
  - **Overview**: View simulation details, standard indicators, and key statistics
  - **Students**: Add students by email, bulk add, generate Kahoot-style join codes
  - **Test**: "Test as Student" mode to experience the full student flow
  - **Settings**: Control simulation start/stop, manage access
- **Interactive Demo Mode** (`/demo-simulation`): Professors can experience the complete student simulation flow with 3 turns of decision-making
- **Simulation Start Control**: Professors must start simulations before students can access them; students see "waiting for professor" message when `isStarted=false`
- **Student Management**: Email invitations, bulk add, join code generation for easy student enrollment
- **"Mis Simulaciones" Management**: Clicking simulation cards opens the management view instead of just editing

### Standard 5 Indicators (Consistent Across All Views)
All simulation views display exactly 5 standard business indicators with consistent IDs and Spanish labels:
1. `revenue` - Ingresos / Presupuesto
2. `morale` - Moral del Equipo
3. `reputation` - Reputación de Marca
4. `efficiency` - Eficiencia Operacional
5. `trust` - Confianza de Stakeholders

### Key Routes
- `/` - Homepage with simulation discovery
- `/professor` - Professor dashboard with "Mis Simulaciones"
- `/explore` - Example simulation with standard indicators
- `/demo-simulation` - Interactive professor demo mode
- `/scenarios/:id/manage` - Simulation management view
- `/simulation/start/:id` - Simulation start page (shows waiting message for students if not started)
- `/studio` - Professor authoring studio for creating scenarios

### Authentication Improvements
- **Fresh Login Flow**: Every login now forces account selection (`prompt: select_account login`, `max_age: 0`)
- **Session Cleanup on Re-login**: If user is already logged in and starts a new login, old session is destroyed first
- **Complete Logout**: Logout clears all cookies (session, pendingRole, isVerifiedAdmin) and destroys session before redirecting to Replit's end session endpoint
- **Account Switching**: Users can now log out and log in with a different account without manually clearing browser cookies

### Student Enrollment System
- **Global Demo Scenarios**: Scenarios marked with `isGlobalDemo=true` are visible to all students automatically
- **Join by Code**: Students can join simulations using a 10-character code provided by professors
- **studentEnrollments Table**: Tracks student access via email invitation or join code
- **Filtered Scenario View**: Students only see global demos + simulations they're enrolled in

### Simulation Flow Structure (S9.1)
- **3 Decisions + Reflection (Step 4)**: Simulations have exactly 3 decision points, followed by a separate reflection step
- **Decision Points**: Each has a `focusCue` highlighting 2-3 key dimensions (stakeholders, constraints, trade-offs) in neutral, mentorship tone
- **Reflection Step**: Appears as "Paso 4: Reflexión" after all decisions; very lax validation (only rejects profanity/empty/spam)
- **Optional Nudge**: "Si quieres, añade 1 aprendizaje y 1 cosa que harías distinto" (non-blocking)
- **State Tracking**: `isReflectionStep` and `reflectionCompleted` in SimulationState; `processReflection()` handles completion

### Thinking Scaffolds (S5.1)
- **Purpose**: Reduce student confusion by guiding HOW to think about a question, not WHAT to choose
- **Format**: "Piensa en:" followed by 2-3 bullet points under each decision prompt
- **Bullet Content**: Reasoning dimensions only (stakeholders, trade-offs, constraints, risk)
- **Rules**: NEVER suggest answers, NEVER give "best practices", NEVER imply a correct choice
- **Implementation**: `thinkingScaffold` array field on DecisionPoint; displayed in InputConsole below focusCue
- **Example**: ["Impacto en el equipo", "Riesgo vs velocidad", "Consecuencias a corto vs largo plazo"]

### Indicator Directionality (S8.1)
- All indicators have a `direction` property: `"up_better"` or `"down_better"`
- `operationalRisk`/risk indicators are `"down_better"`; others typically `"up_better"`
- UI displays directionality under each indicator label (e.g., "↑ mejor" or "↓ mejor")
- Delta coloring respects directionality (green = good for the objective, red = bad)

### LLM Resilience & Error Handling (February 2026)
- **Backend Structured Errors**: Turn/hint routes return `{ message, retryable, userMessage }` with 503 for LLM errors
- **Frontend Auto-Retry**: Turn submissions automatically retry up to 3 times (2s, 4s, 6s delays) for retryable errors (503/AI service), keeping the thinking animation running
- **Non-retryable errors** (validation, auth, session inactive) are NOT retried
- **Friendly Messages**: Students see "El servicio de IA está temporalmente ocupado" instead of raw errors
- **Branding**: All UI references use "Scenario+" (not ScenarioX); lowercase `scenariox` in emails/keys preserved

### Dynamic Indicator Engine (February 2026)
- **Domain Expert Rewrite** (`server/agents/domainExpert.ts`): Prompt builds dynamically from actual scenario indicators instead of hardcoded 4 POC indicators
- **Broken Mapping Removed**: Previously, 4 hardcoded indicators (teamMorale, budgetImpact, operationalRisk, strategicFlexibility) were mapped to 5 standard indicators, causing `strategicFlexibility` to map to BOTH `reputation` AND `trust` (identical deltas). Now the LLM outputs deltas directly for the actual indicator IDs.
- **Context-Sensitive Impacts**: Previous decisions are passed to the domain expert so different decisions produce genuinely different impacts
- **Validation**: `indicatorDeltas` and `metricExplanations` are filtered to only valid indicator IDs from the scenario
- **Evaluator Decision-Specific Feedback**: Evaluator now receives decision number, total decisions, previous decisions, and stage-specific tone instructions so mentor notes are unique per decision
- **Results Page "Why" Explanations**: `SessionResults.tsx` aggregates `metricExplanations` from all turns per indicator; indicator cards are expandable to show causal chain explanations
- **Direction-Aware Delta Coloring**: Results page respects indicator directionality (`up_better` vs `down_better`) for green/red coloring