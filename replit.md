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