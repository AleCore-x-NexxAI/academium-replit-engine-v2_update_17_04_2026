# SIMULEARN Engine

## Overview
SIMULEARN is an AI-powered business simulation platform designed for experiential learning. It enables students to practice real-world decision-making within dynamic, text-based scenarios. Professors can author and customize simulation blueprints. The platform uses a multi-agent AI architecture to generate immersive narratives, evaluate student decisions, calculate business impacts, and provide real-time feedback. Its core capabilities include an interactive student "cockpit" with KPI dashboards, a professor authoring studio for scenario creation, and a multi-agent AI engine for narrative generation, competency assessment, and business logic. The project aims to provide an immersive and reflective learning experience, focusing on decision-making processes rather than direct scoring, and empowering educators with flexible content creation tools.

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
- **Replit Infrastructure**: Replit Auth (OpenID Connect), Replit Object Storage (via Google Cloud Storage client), Replit AI Integrations (OpenAI proxy).
- **AI/LLM Services**: OpenAI API (GPT-4o, GPT-4o-mini).

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