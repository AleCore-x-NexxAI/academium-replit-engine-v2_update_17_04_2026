# Academium Engine: System Architecture & Tech Stack (Spec 01)

**Target Audience:** AI Coding Agent / Senior Developer
**Purpose:** Define the high-level infrastructure, technology stack, and architectural patterns for the Academium Engine.
**Context:** This system builds dynamic, text-based business simulations using a multi-agent AI core for experiential learning.

---

## 1. High-Level Architecture Pattern
**Pattern:** Monolithic Server with In-Process Agentic Orchestration.
**Core Philosophy:** "Stateful World, Stateless Agents." The simulation state (JSONB in PostgreSQL) is the single source of truth; agents read state, reason via LLM calls, and return structured JSON updates.

### System Components
1. **Frontend Client (The Stage):** React/Vite SPA for students (simulation cockpit) and professors (authoring studio + analytics).
2. **Core Backend (The World Server):** Express.js (Node.js) monolith that handles auth, API routes, simulation state, agent orchestration, and database persistence — all in one process.
3. **Agent Modules (The Brain):** JavaScript/TypeScript modules running in-process within the Express server. No separate microservice, no Python, no Redis queue.
4. **LLM Provider Layer:** Multi-provider architecture with smart routing, load balancing, failover, and model equivalence across six provider backends.
5. **File Storage:** Replit Object Storage (Google Cloud Storage) for PDF case study uploads in the Authoring Studio.

---

## 2. Technology Stack

### Frontend
* **Framework:** React 18+ (SPA, NOT Next.js)
* **Bundler:** Vite
* **Language:** TypeScript (Strict Mode)
* **Routing:** Wouter (lightweight client-side routing)
* **Styling:** Tailwind CSS + shadcn/ui (Radix UI Primitives)
* **State Management:** Zustand (Client State) + TanStack Query v5 (Server State)
* **Animation:** Framer Motion
* **Charts:** Recharts (for KPI dashboards and analytics)

### Backend
* **Runtime:** Node.js 20+
* **Framework:** Express.js
* **Language:** TypeScript
* **Database:** PostgreSQL (accessed via Neon serverless driver)
* **ORM:** Drizzle ORM (schema-first, type-safe)
* **Auth:** Replit Auth (OpenID Connect) via Passport.js + `express-session`
* **Concurrency:** `p-limit` (turn queue for managing concurrent LLM requests), `p-retry` (resilient LLM calls)

### Agent System (In-Process JavaScript Modules)
* **Runtime:** Same Node.js process as Express server — no separate service
* **LLM Providers (6 backends):**
  - OpenRouter (multi-model gateway)
  - Anthropic (Claude models, direct API)
  - OpenAI Direct (GPT-4o, GPT-4o-mini)
  - Gemini Direct (Google AI Studio)
  - Replit OpenAI Proxy (platform-provided)
  - Replit Gemini Proxy (platform-provided)
* **Smart Router:** Provider registry with load balancing, automatic failover, multi-key support, and model equivalence mapping for cross-provider fallback.
* **Turn Queue:** `p-limit`-based queue ensuring concurrent student turns don't overwhelm LLM rate limits.
* **No Vector DB:** Scenario context is passed directly in prompts; no RAG pipeline.

### Infrastructure
* **Hosting:** Replit (single deployment unit)
* **No Docker, no Redis, no microservices** — everything runs in one process.
* **File Storage:** Replit Object Storage (Google Cloud Storage client) for PDF uploads.

---

## 3. Data Flow Architecture

### Flow A: The "Game Loop" (Student Turn — Parallelized)
1. **Student** submits a decision (text input) via the React frontend.
2. **Backend** receives the request at `POST /api/simulations/:sessionId/turn`.
3. **Phase 1 (Concurrent):**
   - **InputValidator** runs regex checks + LLM validation.
   - **Simultaneously:** Director interprets intent → Evaluator + DomainExpert calculate scores and KPI impacts (in parallel).
4. **Phase 2 (Validation Gate):**
   - If InputValidator fails: discard LLM results, return NUDGE or BLOCK status to student.
   - If InputValidator passes: use the already-computed LLM results, proceed to Phase 3.
5. **Phase 3 (Sequential):**
   - **Narrator** generates consequence narrative based on updated state.
   - **DepthEvaluator** checks response depth (professor-configurable strictness).
   - DB writes: turn record, turn events, updated `SimulationState` JSONB.
6. **Response:** Full `TurnResponse` JSON returned to frontend (no streaming).

### Flow B: On-Demand Explanation
1. **Student** clicks "Why?" on an indicator delta.
2. **Frontend** calls `POST /api/simulations/:sessionId/explain` with the indicator ID.
3. **Backend** generates a detailed causal chain via DomainExpert (lazy-loaded, not computed during turn).
4. **Response:** Causal chain explanation returned to frontend.

### Flow C: The "Authoring Loop" (Professor Create)
1. **Professor** uploads a PDF case study via the Authoring Studio.
2. **Backend** stores the PDF in Replit Object Storage.
3. **CanonicalCaseGenerator** agent analyzes the PDF text and drafts a scenario blueprint (JSON).
4. **Frontend** renders the blueprint for professor review and refinement.

### Flow D: Professor Analytics
1. **Professor** views class analytics via `GET /api/scenarios/:scenarioId/cohort-analytics`.
2. **Backend** aggregates: decision distributions per step, stuck nodes (NUDGE rates), reasoning style profiles, and class-level competency strengths.

---

## 4. Security & Scalability
* **Sandboxing:** Agents output structured JSON only — no code execution.
* **Rate Limiting:** Turn queue (`p-limit`) prevents LLM provider rate limit exhaustion.
* **Failover:** Smart router automatically falls back to equivalent models on different providers.
* **Multi-Key Support:** Multiple API keys per provider for higher throughput.
* **Auth:** Replit Auth (OpenID Connect) with session-based authentication via Passport.js.
* **Turn Status:** Every turn returns one of three statuses: PASS (accept + lock + proceed), NUDGE (preserve text, ask for elaboration, max 1 per step), BLOCK (spam/gibberish/profanity only).

---

## 5. Directory Structure (Single Monorepo)
```text
/client              (React/Vite Frontend)
  /src
    /components      (UI components, shadcn/ui)
    /pages           (Route pages)
    /stores          (Zustand stores)
    /hooks           (Custom hooks)
    /lib             (Utilities, query client)
/server              (Express.js Backend)
  /agents            (AI agent modules: director, evaluator, narrator, etc.)
  /llm               (LLM provider layer)
    /providers       (Individual provider implementations + router)
  /replit_integrations (Replit-specific integrations)
/shared              (Shared types & schema)
  schema.ts          (Drizzle ORM schema + TypeScript interfaces)
  /models            (Shared data models)
```

---

## 6. Key Configuration
* **Simulation Length:** 3–10 decision points (professor-configured per scenario, default 3) followed by a reflection step.
* **LLM Model Selection:** Per-scenario configuration; professors choose the model for student-facing agents.
* **Internal Agents:** Director, Evaluator, and DepthEvaluator are hardcoded to `gpt-4o-mini` for low latency (not student-facing).
* **Depth Strictness:** Professor-configurable per decision point: `lenient`, `standard`, or `strict`.
