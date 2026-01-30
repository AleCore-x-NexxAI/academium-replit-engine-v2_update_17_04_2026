# SIMULEARN Engine

## Overview
SIMULEARN is an AI-powered business simulation platform for experiential learning. It enables students to practice real-world decision-making in dynamic, text-based scenarios. Professors can author and customize simulation blueprints. The platform uses a multi-agent AI architecture to generate immersive narratives, evaluate student decisions, calculate business impacts, and provide real-time feedback. Key capabilities include an interactive student "cockpit" with KPI dashboards, a professor authoring studio, and a multi-agent AI core for narrative generation, competency assessment, and business logic.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript, utilizing Vite. UI components are developed using `shadcn/ui` on Radix UI primitives with Tailwind CSS, following a "Design System Approach" inspired by Fluent Design for professional credibility and cognitive load management. Typography uses Inter for UI/body text and JetBrains Mono for data. The simulation cockpit uses a three-column grid layout for context, narrative, and feedback. State management relies on Zustand for client-side state and TanStack Query for server state and caching, with real-time updates and optimistic UI.

### Backend Architecture
The backend is an Express.js (Node.js) REST API, serving as the "World Server." It uses PostgreSQL with Drizzle ORM for type-safe data management. Authentication is handled by Replit Auth (OpenID Connect) with `express-session`. A JavaScript-based multi-agent orchestration system (using LangChain.js patterns) processes student turns. This system includes specialized AI agents: `SimulationDirector` (orchestrator), `ScenarioWeaver/Narrator` (narrative generation), `CompetencyAssessor/Evaluator` (decision scoring), and `BusinessLogicEngine/DomainExpert` (KPI calculation). LLM integration uses OpenAI GPT-4o via Replit AI Integrations. The system follows a "Stateful World, Stateless Agents" pattern where simulation state is stored in PostgreSQL, and agents reason without maintaining internal state.

### Data Architecture
Core database tables include `users`, `scenarios`, `simulation_sessions`, `turns`, and `sessions`. Key data structures like `SimulationState` (JSONB for KPIs, history, scores), `KPIs`, `Rubric` (JSONB for scoring criteria), and `HistoryEntry` (role-based messages) are central to the system.

### API Design
The API provides RESTful endpoints for managing scenarios, simulations, and user authentication. Key endpoints facilitate starting new simulations, submitting student turns, and retrieving session data. The turn processing flow involves the client submitting input, the backend invoking the agent service, agents executing their workflow, and the backend persisting the turn and returning the response.

### Design Patterns
The system employs event-driven updates with optimistic UI, a hierarchical agent pattern (Director managing worker agents), component composition using atomic design principles, and end-to-end type safety with shared schema types.

## External Dependencies

### Third-Party Services
- **Replit Infrastructure**: Replit Auth (OpenID Connect), Replit Object Storage (via Google Cloud Storage client), Replit AI Integrations (OpenAI proxy).
- **AI/LLM Services**: OpenAI API (GPT-4o, GPT-4o-mini), configured via environment variables.

### Database
- **PostgreSQL**: Accessed via Neon serverless driver for connection pooling and edge-compatible connections, configured via `DATABASE_URL`.

### Key NPM Packages
- **Frontend**: React, Wouter, Radix UI, Framer Motion, Recharts, TanStack Query, Zustand.
- **Backend**: Express.js, Drizzle ORM, Passport.js, `express-session`, `p-limit`, `p-retry`.
- **Development**: Vite, esbuild, tsx, Tailwind CSS.

### File Storage
- **Google Cloud Storage**: Used for PDF case study uploads in the Authoring Studio, integrated via `@google-cloud/storage`.

## Recent Changes

### Session Management & Exit Flow (January 2026)
- **Exit = Immediate Abandonment**: Clicking "Salir y perder progreso" immediately abandons the session via POST `/api/simulations/:sessionId/abandon`. No resume functionality exists - exiting always means permanent loss of progress.
- **Exit Confirmation Dialog**: Warning dialog appears with "Salir y perder progreso" and "Continuar simulación" options. Browser `beforeunload` event warns about refresh/tab close.
- **Student Home Page**: Only shows completed sessions in "Mis Simulaciones Completadas" section. Abandoned sessions are hidden from students but retained in database for professor analytics.
- **Session States**: `active` (in progress), `completed` (finished all decisions), `abandoned` (user exited early). Students can start new simulations anytime without blocking.

### AI Guardrails (January 2026)
- 8 HARD_PROHIBITIONS: AI never gives correct answers, never grades visibly, never optimizes for GPA, never reveals evaluation logic
- MENTOR_TONE: Supportive professional mentor persona (not grader/teacher/judge)
- MISUSE_HANDLING: De-escalation for trolling/profanity, maintains neutral academic tone

### Weak Answer Feedback Loop (January 2026)
- Students get up to 2 revision attempts for weak/incomplete answers before final acceptance
- Revision prompts appear in InputConsole banner and FeedbackPanel
- UI shows "Revisión X de 2" counter

### Faculty Visibility Dashboard (January 2026)
- **ProfessorDashboard** (`/professor`): Overview of all professor's scenarios with student participation stats
- **ScenarioAnalytics** (`/scenarios/:id/analytics`): Detailed view of all students for a scenario
- **No Scores Displayed**: Faculty visibility shows raw student responses ONLY - no scores, rankings, or automated judgments
- **Aggregated Themes**: Simple keyword frequency extraction from student responses (no AI-based judgment)
- **ConversationViewer**: Shows decision-by-decision breakdown with "Decisión 1/2/3" labels, "Respuesta del Estudiante", "Narrativa de Simulación", "Reflexión Final"
- **All UI in Spanish**: Professor-facing pages fully translated to Latin American Spanish
- **API Endpoints**: 
  - GET `/api/professor/scenarios` - List scenarios with student counts
  - GET `/api/professor/scenarios/:id/sessions` - List all sessions for a scenario  
  - GET `/api/professor/scenarios/:id/themes` - Aggregated keyword themes from responses
  - GET `/api/professor/sessions/:id/conversation` - Full decision history for a session

### Professor First-Time Flow UX (January 2026)
- **Home Page Redesign**: Professors see a calm landing page with three cards matching Visual Specs:
  1. Curiosity – "What is this?" → Hero tagline + visual simulation preview
  2. Safety – "Can I explore without breaking anything?" → Safety message at bottom
  3. Control – "I decide how to use this." → Two equal paths (AI/Manual) in Create card
- **First Screen Shows ONLY Three Cards**:
  - Card 1: "Explorar un Ejemplo" → /explore (visual simulation mockup)
  - Card 2: "Crear Simulación" → /studio (AI sparkles + Manual pencil icons)
  - Card 3: "Mis Simulaciones" → /professor (visual list hint with "Listo"/"Borrador" badges)
  - Safety message: "Explora libremente. Nada aquí es permanente."
- **First Screen Does NOT Show**: Dashboards, metrics, scenario grids, completed sessions, help cards, header navigation links
- **ExploreExample Page** (`/explore`): Read-only preview showing case context, 3 decision points, and indicator badges. No tutorials, no editing, no scoring - just "what students experience"
- **Simplified Header**: Only SIMULEARN logo, avatar, and logout (no navigation links)
- **Dashboard Access**: Scenario lists and stats are on /professor page, accessed via Card 3
- **Studio Path Selection** (`/studio`): Shows two equal cards - "Crear con IA" and "Crear Manualmente" with same visual weight. No recommendations, no difficulty labels, no skill assumptions. Professor feels "I choose how I work."

### Screen 4A - AI-Assisted Case Creation (January 2026)
- **Simplified Input Form**: Only 3 required inputs plus Generate button
  - "Tema del Caso" text field (placeholder: "Decisión de expansión de mercado para una empresa mediana")
  - "Disciplina / Contexto del Curso" dropdown (default: Negocios; options: Negocios, Marketing, Finanzas, Operaciones, Recursos Humanos, Estrategia)
  - "Nivel Objetivo" dropdown (default: Pregrado; options: Pregrado, Posgrado, Ejecutivo)
  - "Generar Borrador" button (disabled until topic entered)
- **Removed per Visual Specs**: "Contexto Adicional" textarea, "El caso generado incluirá" explanation list, decorative header/icons
- **UX Philosophy**: "This helps me get started — I'm still in charge." No rubrics, no learning objectives, no grading criteria asked upfront.