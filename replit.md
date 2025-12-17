# SIMULEARN Engine

## Overview

SIMULEARN is an AI-powered business simulation platform for experiential learning. It enables students to practice real-world decision-making in dynamic, text-based scenarios while professors can author and customize simulation blueprints. The system uses a multi-agent AI architecture to generate immersive narratives, evaluate student decisions, calculate business impacts, and provide real-time feedback.

The platform features:
- **Student Simulation Interface**: An interactive "cockpit" view with live KPI dashboards, narrative feeds, and decision input
- **Professor Authoring Studio**: Tools for creating and customizing simulation scenarios
- **Multi-Agent AI Core**: Specialized agents for narrative generation, competency assessment, and business logic calculation
- **Real-time Feedback**: Immediate consequences, competency scoring, and pedagogical guidance

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript (Vite build system)

**UI Component System**: shadcn/ui built on Radix UI primitives with Tailwind CSS for styling. Design follows a "Design System Approach" inspired by Fluent Design and Linear, emphasizing professional credibility, information hierarchy, and cognitive load management suitable for educational productivity tools.

**Typography**: Inter font family for UI/body text, JetBrains Mono for data/metrics. Strict type scale ensures visual hierarchy (4xl for hero titles down to xs for labels).

**Layout System**: Three-column grid layout for the simulation cockpit:
- Left panel (320px): Context, KPIs, scenario info
- Center panel (fluid): Narrative feed and input console
- Right panel (360px): Feedback and competency visualization

**State Management**:
- Zustand for client-side simulation state (history, KPIs, feedback, processing status)
- TanStack Query for server state and API caching
- Real-time updates using fetch with optimistic UI patterns

**Key Component Architecture**:
- `SimulationFeed`: Scrollable message history with role-based styling (system/NPC/user)
- `KPIDashboard`: Animated metric cards with delta indicators and critical state warnings
- `FeedbackPanel`: Radar chart for competency visualization and turn-by-turn feedback
- `InputConsole`: Text input with suggested options and submission controls

### Backend Architecture

**API Layer**: Express.js (Node.js) REST API serving as the "World Server"

**Database**: PostgreSQL with Drizzle ORM for type-safe schema-first development

**Authentication**: Replit Auth (OpenID Connect) with session management via express-session and connect-pg-simple

**Multi-Agent Service**: JavaScript-based agent orchestration system (using LangChain.js patterns) that processes student turns through specialized AI agents:

1. **SimulationDirector** (Orchestrator): Validates intent, routes tasks to workers, aggregates outputs into structured JSON responses
2. **ScenarioWeaver/Narrator**: Generates immersive business narrative with NPC dialogue
3. **CompetencyAssessor/Evaluator**: Scores decisions against rubric criteria, identifies learning flags
4. **BusinessLogicEngine/DomainExpert**: Calculates KPI deltas based on cause-effect rules

**Agent Flow**:
```
Student Input → Director validates intent → Parallel execution:
  - Evaluator scores decision against rubric
  - Domain Expert calculates KPI impacts  
  - Narrator generates narrative using evaluation/KPI context
→ Director aggregates into TurnResponse → Frontend updates
```

**LLM Integration**: OpenAI GPT-4o via Replit AI Integrations with rate limiting and retry logic

### Data Architecture

**Core Database Tables**:
- `users`: Student/professor/admin accounts (integrated with Replit Auth)
- `scenarios`: Simulation blueprints with initial state, rubric, domain metadata
- `simulation_sessions`: Active/completed simulation instances with current state (KPIs, history)
- `turns`: Historical log of student inputs and agent responses per session
- `sessions`: Session storage for Replit Auth

**State Management Pattern**: "Stateful World, Stateless Agents" - simulation state stored in PostgreSQL as single source of truth; agents read state, reason, and propose updates without maintaining internal state.

**Key Data Structures**:
- `SimulationState`: JSONB containing KPIs, history entries, competency scores, current mood
- `KPIs`: Revenue (absolute), Morale/Reputation/Efficiency/Trust (percentages 0-100)
- `Rubric`: JSONB with scoring criteria and weights for competency assessment
- `HistoryEntry`: Role-based messages (system/user/npc) with optional speaker attribution

### API Design

**RESTful Endpoints**:
- `GET /api/scenarios` - List published scenarios
- `GET /api/scenarios/authored` - Professor's created scenarios
- `POST /api/scenarios` - Create new scenario
- `POST /api/simulations` - Start new simulation session
- `GET /api/simulations/:id` - Get session state and history
- `POST /api/simulations/:id/turn` - Submit student decision, get agent response
- `GET /api/auth/user` - Get current authenticated user

**Turn Processing Flow**:
1. Client POST to `/api/simulations/:sessionId/turn` with student input
2. Backend calls Python agent service `/process-turn` endpoint
3. Agents execute orchestrated workflow (validate → evaluate → calculate → narrate)
4. Response includes narrative, KPI updates, feedback, suggested options
5. Backend persists turn to database and returns response to client

### Design Patterns

**Event-Driven Updates**: Frontend uses optimistic updates with rollback on errors. Processing status tracked via Zustand store to show "thinking" states.

**Hierarchical Agent Pattern**: Director agent manages worker agents (Narrator, Evaluator, Domain Expert) in supervisor-worker topology.

**Component Composition**: Atomic design principles with shadcn/ui primitives composed into domain-specific components.

**Type Safety**: End-to-end TypeScript with shared schema types between frontend/backend via `@shared/schema` imports.

## External Dependencies

### Third-Party Services

**Replit Infrastructure**:
- Replit Auth (OpenID Connect authentication)
- Replit Object Storage via Google Cloud Storage client
- Replit AI Integrations (OpenAI proxy, billed to Replit credits)

**AI/LLM Services**:
- OpenAI API (GPT-4o for reasoning, GPT-4o-mini for faster tasks)
- Configured via `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` environment variables

### Database

**PostgreSQL** via Neon serverless driver:
- Connection pooling with `@neondatabase/serverless`
- WebSocket transport for edge-compatible connections
- Accessed via `DATABASE_URL` environment variable

### Key NPM Packages

**Frontend**:
- React 18+ with Wouter for routing
- Radix UI primitives (@radix-ui/react-*)
- Framer Motion for animations
- Recharts for KPI/competency visualization
- TanStack Query for data fetching
- Zustand for state management

**Backend**:
- Express.js with TypeScript
- Drizzle ORM with drizzle-kit for migrations
- Passport.js with openid-client for auth
- Express-session with connect-pg-simple for session storage
- p-limit and p-retry for concurrency control and resilience

**Development**:
- Vite for frontend bundling
- esbuild for server bundling
- tsx for TypeScript execution
- Tailwind CSS with PostCSS

### Agent Service (JavaScript)

The multi-agent system is implemented in JavaScript/TypeScript within the Express.js backend:
- `server/agents/director.ts` - Orchestrates agent workflow
- `server/agents/evaluator.ts` - Competency assessment
- `server/agents/domainExpert.ts` - KPI calculations
- `server/agents/narrator.ts` - Narrative generation
- `server/agents/types.ts` - Shared type definitions
- Uses OpenAI API via Replit AI Integrations

### File Storage

Google Cloud Storage integration via `@google-cloud/storage` for PDF case study uploads in the Authoring Studio. Uses Replit sidecar authentication endpoint for credential exchange.

## Recent Changes

### December 2025
- **Enhanced Scenario Authoring with 15+ Rich Metadata Fields**: Extended InitialState schema and Studio form to capture comprehensive business context:
  - Company context: companyName, industry, companySize, situationBackground
  - Stakeholders: Structured array with name, role, interests, influence level
  - Environment: industryContext, competitiveEnvironment, regulatoryEnvironment, culturalContext, resourceConstraints
  - Pedagogy: learningObjectives, ethicalDimensions, difficultyLevel (beginner/intermediate/advanced)
  - Timeline: timelineContext, keyConstraints
- **AI Agents Now Use Enhanced Context**: All three agents (Narrator, Evaluator, DomainExpert) incorporate the rich scenario metadata in their prompts for more tailored, context-aware simulations
- **Studio Form Reorganized**: Six logical sections (Basic Info, Company Context, Player Role, Stakeholders, Environment & Constraints, Learning Objectives) with comprehensive input fields
- Added seed data system (3 sample business scenarios) for immediate testing
- Implemented SessionResults page with final KPIs, competency radar chart, and decision replay
- Added PDF upload functionality to Authoring Studio with Object Storage integration
- Created Analytics Dashboard for professors with session metrics and competency heatmaps
- Fixed API response parsing in mutations (apiRequest returns Response, needs .json())
- Fixed router configuration (separate Switch blocks for auth/unauth states)
- Fixed p-retry AbortError import (named export instead of pRetry.AbortError)

## Key Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/` | Home | Authenticated |
| `/simulation/start/:scenarioId` | SimulationStart | Authenticated |
| `/simulation/:sessionId` | Simulation | Authenticated |
| `/simulation/:sessionId/results` | SessionResults | Authenticated |
| `/studio` | Studio | Professors only |
| `/analytics` | Analytics | Professors only |