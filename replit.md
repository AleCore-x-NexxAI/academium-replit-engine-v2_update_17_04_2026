# Scenario+ Engine

## Overview
Scenario+ is an AI-powered business simulation platform for experiential learning, allowing students to practice real-world decision-making in dynamic, text-based scenarios. Professors can author and customize simulation blueprints. The platform uses a multi-agent AI architecture to generate immersive narratives, evaluate student decisions, calculate business impacts, and provide real-time feedback. Key features include an interactive student "cockpit" with KPI dashboards, a professor authoring studio, and a multi-agent AI engine for narrative generation, competency assessment, and business logic. The project aims to provide an immersive, reflective learning experience focused on decision-making processes and to empower educators with flexible content creation tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React, TypeScript, and Vite, with `shadcn/ui` on Radix UI primitives and Tailwind CSS for a Fluent Design-inspired "Design System Approach." Zustand manages client-side state, and TanStack Query handles server state for real-time updates and optimistic UI. The student cockpit features a three-column layout for context, narrative, and feedback.

### Backend
The backend is an Express.js (Node.js) REST API, using PostgreSQL with Drizzle ORM. Authentication is via Replit Auth (OpenID Connect) and `express-session`. A JavaScript-based multi-agent orchestration system, inspired by LangChain.js, processes student turns. This system includes specialized AI agents: `SimulationDirector`, `ScenarioWeaver/Narrator`, `CompetencyAssessor/Evaluator`, and `BusinessLogicEngine/DomainExpert`. LLM integration uses OpenAI GPT-4o via Replit AI Integrations. The architecture follows a "Stateful World, Stateless Agents" pattern, storing simulation state in PostgreSQL while agents reason without maintaining internal state.

### Data Architecture
The database schema includes tables for `users`, `scenarios`, `simulation_sessions`, `turns`, and `sessions`. Key data structures like `SimulationState` (JSONB for KPIs, history, scores), `KPIs`, `Rubric` (JSONB for scoring criteria), and `HistoryEntry` (role-based messages) manage simulation data.

### API Design
The API provides RESTful endpoints for managing scenarios, simulations, and user authentication. The turn processing flow involves client input, backend agent service invocation, agent workflow execution, and persistent storage of the turn, with a response to the client.

### Design Patterns
The system uses event-driven updates with optimistic UI, a hierarchical agent pattern, component composition based on atomic design principles, and end-to-end type safety. Role-Based Access Control (RBAC) manages user permissions. The student interface emphasizes reflection over scoring, and the professor studio supports AI-assisted and manual case creation with a focus on ease of use. Simulations are structured with 3 decision points followed by a reflection step, with "thinking scaffolds" guiding students on how to approach decisions without suggesting answers. Indicators have directionality (`up_better`/`down_better`) influencing UI displays and delta coloring. The system includes LLM resilience with structured errors and frontend auto-retry for transient issues. The dynamic indicator engine builds prompts from actual scenario indicators, and previous decisions influence the domain expert's impact calculations, ensuring context-sensitive results.

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