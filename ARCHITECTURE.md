# Academium Engine — Complete Technical Documentation

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Multi-Agent AI System](#6-multi-agent-ai-system)
7. [LLM Provider System](#7-llm-provider-system)
8. [Simulation Turn Flow (Step by Step)](#8-simulation-turn-flow-step-by-step)
9. [Scenario Creation & Authoring](#9-scenario-creation--authoring)
10. [Student Enrollment System](#10-student-enrollment-system)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Complete API Reference](#12-complete-api-reference)
13. [Usage Logging & Cost Tracking](#13-usage-logging--cost-tracking)
14. [Guardrails & Safety](#14-guardrails--safety)
15. [Configuration & Environment](#15-configuration--environment)
16. [User Flows](#16-user-flows)

---

## 1. Platform Overview

Academium is an AI-powered business simulation platform designed for Universidad de Boyaca. It provides experiential learning through interactive, text-based business scenarios where students make real-world decisions and see their consequences play out through AI-generated narratives.

### Core Concept

Students enter a business simulation where they assume a specific role (e.g., Operations Director, Marketing VP). They face 3 decision points followed by a reflection step. Each decision changes business indicators (Team Morale, Budget Impact, Operational Risk, etc.) and generates a professional narrative describing the consequences. The system evaluates student reasoning depth without revealing scores, emphasizing learning over grading.

### Key Design Principles

- **Reflection Over Scoring**: Students see consequences and trade-offs, not grades. Competency scores are tracked internally for professors but never shown to students during the simulation.
- **Maximal Permissiveness**: The AI tries to find a valid business action in almost any student input rather than rejecting it. The system is designed to say "yes, and..." rather than "no."
- **Thinking Scaffolds Over Answers**: Students receive guidance on HOW to think about a decision (e.g., "Consider: team capacity, budget constraints, stakeholder expectations") without being told WHAT to decide.
- **Opportunity Cost Rule**: Every decision must have at least one negative impact on an indicator. There are no "perfect" choices — only trade-offs.
- **Stateful World, Stateless Agents**: All simulation state is persisted in PostgreSQL. AI agents reason from context passed to them on each call without maintaining internal memory.

### Language

The entire UI and all AI-generated content is in Latin American Spanish.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Zustand   │  │ TanStack │  │ Wouter   │  │ shadcn/ui +      │  │
│  │ Store     │  │ Query    │  │ Router   │  │ Tailwind CSS     │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │
└────────────────────────────┬───────────────────────────────────────┘
                             │ HTTP REST API
┌────────────────────────────▼───────────────────────────────────────┐
│                      Backend (Express.js + Node.js)                │
│  ┌──────────┐  ┌──────────────────────────┐  ┌─────────────────┐  │
│  │ Routes   │  │ Multi-Agent Orchestrator  │  │ Replit Auth     │  │
│  │ (REST)   │  │ (Director → Agents)       │  │ (OIDC/Passport) │  │
│  └──────────┘  └────────────┬─────────────┘  └─────────────────┘  │
│                              │                                     │
│  ┌──────────────────────────▼─────────────────────────────────┐   │
│  │              LLM Provider System                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │OpenRouter│ │ Gemini   │ │ Replit   │ │ Anthropic    │  │   │
│  │  │(4 keys) │ │ Direct   │ │ Proxies  │ │ / OpenAI     │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │   │
│  │  Smart Router → Load Balancer → Failover → Turn Queue      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐  │
│  │ Drizzle ORM         │  │ Object Storage (Google Cloud)      │  │
│  │ (PostgreSQL / Neon)  │  │ (PDF uploads for case studies)     │  │
│  └──────────┬──────────┘  └────────────────────────────────────┘  │
└─────────────┼──────────────────────────────────────────────────────┘
              │
    ┌─────────▼─────────┐
    │   PostgreSQL DB    │
    │   (Neon Serverless)│
    └───────────────────┘
```

### Architecture Pattern: Stateful World, Stateless Agents

- **Stateful World**: All simulation state (KPIs, indicators, decision history, scores) is persisted in the `simulation_sessions.currentState` JSONB column after every turn.
- **Stateless Agents**: AI agents receive context as input on each call, reason about it, and return structured output. They never maintain internal state between calls.
- This means any agent can be swapped, retried, or run on a different provider without affecting simulation consistency.

---

## 3. Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Wouter | Client-side routing |
| Zustand | Client-side state management (simulation store) |
| TanStack Query v5 | Server state, caching, mutations |
| shadcn/ui + Radix UI | Component library (Buttons, Cards, Dialogs, Sidebar, etc.) |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animations |
| Recharts | Charts and data visualization |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Express.js | HTTP server and API routing |
| Node.js | Runtime |
| Drizzle ORM | Database queries and schema definition |
| Neon Serverless Driver | PostgreSQL connection (serverless-compatible) |
| Passport.js | Authentication middleware |
| openid-client | Replit OIDC integration |
| express-session + connect-pg-simple | Session storage in PostgreSQL |
| p-limit | Concurrency control for LLM calls |
| Zod | Request validation (via drizzle-zod) |

### Infrastructure
| Technology | Purpose |
|---|---|
| Replit | Hosting, CI/CD, domain |
| Neon PostgreSQL | Serverless database |
| Google Cloud Storage | File uploads (PDF case studies) |
| Replit Auth (OIDC) | Identity provider |
| Replit AI Integrations | Proxied access to OpenAI and Gemini APIs |

---

## 4. Database Schema

### Tables Overview

The database has 9 tables managing users, scenarios, simulations, AI logs, and system state.

#### `users`
Stores all platform users (students, professors, admins).

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID, auto-generated |
| `email` | varchar (unique) | User email from Replit Auth |
| `firstName` | varchar | First name |
| `lastName` | varchar | Last name |
| `profileImageUrl` | varchar | Avatar URL |
| `role` | enum: student, professor, admin | Primary role (locked after first assignment) |
| `isSuperAdmin` | boolean | Elevated privileges, bypasses all role checks |
| `viewingAs` | enum: student, professor, admin | Allows admins to view the platform as another role |
| `createdAt` | timestamp | Account creation time |
| `updatedAt` | timestamp | Last profile update |

#### `scenarios`
Business simulation blueprints created by professors.

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID |
| `authorId` | varchar (FK → users) | Professor who created it |
| `title` | varchar(255) | Scenario title |
| `description` | text | Summary description |
| `domain` | varchar(100) | Academic domain (Marketing, Finance, Ethics, etc.) |
| `initialState` | jsonb (`InitialState`) | Full scenario configuration (see below) |
| `rubric` | jsonb (`Rubric`) | Scoring criteria and competency weights |
| `llmModel` | varchar(50) | Default LLM model (e.g., "gpt-4o") |
| `agentPrompts` | jsonb (`AgentPrompts`) | Custom prompts for each agent (optional overrides) |
| `isPublished` | boolean | Visible to students |
| `isStarted` | boolean | Professor has activated — students can begin |
| `isGlobalDemo` | boolean | Visible to ALL students (not just enrolled) |
| `joinCode` | varchar(10) | 6-char Kahoot-style access code |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last edit |

**`InitialState` (JSONB structure):**
```typescript
{
  indicators: Indicator[]        // Custom business metrics with direction
  kpis: KPIs                     // { revenue, morale, reputation, efficiency, trust }
  customKpis: object             // Additional KPIs if needed
  decisionPoints: DecisionPoint[] // Array of 3 structured decisions
  totalDecisions: number         // Always 3 for POC
  introText: string              // Opening narrative
  role: string                   // Student's character role
  objective: string              // What the student is trying to achieve
  caseContext: string            // Harvard Business School-style background
  coreChallenge: string          // The central tension/dilemma
  reflectionPrompt: string       // Final reflection question (Step 4)
  companyName: string            // Fictional company name
  industry: string               // Industry sector
  stakeholders: string[]         // Key characters/groups
  constraints: string[]          // Limitations the student faces
  timeHorizon: string            // Time frame for decisions
  backgroundInfo: string         // Additional context
  coreQuestion: string           // The fundamental question being explored
}
```

**`Indicator` structure:**
```typescript
{
  id: string          // e.g., "teamMorale"
  label: string       // e.g., "Moral del Equipo"
  value: number       // Current value (0-100)
  description: string // What this indicator measures
  direction: string   // "up_better" or "down_better" — affects UI coloring
}
```

**`DecisionPoint` structure:**
```typescript
{
  number: number                    // 1, 2, or 3
  format: string                    // "multiple_choice" or "written"
  prompt: string                    // The decision question
  options: string[]                 // MC options (if applicable)
  requiresJustification: boolean    // MCQ requires text explanation
  includesReflection: boolean       // Step 4 (reflection)
  focusCue: string                  // Neutral framing hint
  thinkingScaffold: string[]        // 2-4 reasoning dimensions
}
```

#### `student_enrollments`
Tracks which students have access to which scenarios.

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID |
| `studentId` | varchar (FK → users) | The enrolled student |
| `scenarioId` | varchar (FK → scenarios) | The scenario they can access |
| `enrolledAt` | timestamp | When they enrolled |
| `enrolledVia` | varchar(20) | "email" or "code" |

#### `simulation_sessions`
Active simulation instances — one per student per scenario attempt.

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID |
| `userId` | varchar (FK → users) | The student running this session |
| `scenarioId` | varchar (FK → scenarios) | Which scenario is being simulated |
| `currentState` | jsonb (`SimulationState`) | Full mutable state (see below) |
| `status` | enum: active, completed, abandoned | Session lifecycle status |
| `scoreSummary` | jsonb (`ScoreSummary`) | Final scores (populated on completion) |
| `createdAt` | timestamp | Session start time |
| `updatedAt` | timestamp | Last turn time |

**`SimulationState` (JSONB structure):**
```typescript
{
  turnCount: number              // How many turns completed
  kpis: KPIs                     // Current KPI values
  indicators: Indicator[]        // Current indicator values (mutated after each turn)
  history: HistoryEntry[]        // Full conversation log
  flags: string[]                // Behavioral flags from evaluator
  rubricScores: object           // Running competency scores
  currentDecision: number        // Which decision point is active (1-3)
  isComplete: boolean            // All decisions + reflection done
  isReflectionStep: boolean      // Currently on Step 4
  competencyScores: object       // Per-competency running averages
  metricExplanations: object     // "Why?" data for each indicator change
}
```

**`HistoryEntry` structure:**
```typescript
{
  role: "user" | "npc" | "system"  // Who sent this message
  content: string                   // The message text
  timestamp: string                 // ISO timestamp
  turnNumber: number                // Which turn this belongs to
  metadata: object                  // Additional data (thinking scaffolds, etc.)
}
```

#### `turns`
Individual turn records within a simulation session.

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID |
| `sessionId` | varchar (FK → simulation_sessions) | Parent session |
| `turnNumber` | integer | Sequential turn number |
| `studentInput` | text | What the student submitted |
| `agentResponse` | jsonb (`TurnResponse`) | Full AI response (see below) |
| `createdAt` | timestamp | When the turn was processed |

**`TurnResponse` (JSONB structure):**
```typescript
{
  narrative: string                // AI-generated consequence story
  kpiUpdates: object               // New KPI values after this turn
  indicatorDeltas: object[]        // { indicatorId, delta, reason } for each changed metric
  feedback: string                 // Evaluator's neutral observation
  options: string[]                // Next decision's MC options (if applicable)
  isGameOver: boolean              // KPI fell below threshold
  competencyScores: object         // Evaluator scores for this turn
  requiresRevision: boolean        // Student needs to elaborate
  revisionPrompt: string           // What to tell the student
  metricExplanations: object       // "Why?" causal chains per indicator
  thinkingScaffold: string[]       // Next decision's reasoning dimensions
  focusCue: string                 // Next decision's framing hint
  isReflectionStep: boolean        // Moving to Step 4
}
```

#### `scenario_drafts`
Work-in-progress scenarios during AI-assisted authoring.

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID |
| `authorId` | varchar (FK → users) | The professor |
| `status` | enum: gathering, generating, reviewing, published, abandoned | Draft lifecycle |
| `sourceInput` | text | Original topic/description from professor |
| `sourceFileUrl` | varchar | Uploaded PDF URL (if any) |
| `extractedInsights` | jsonb | AI-extracted themes from source material |
| `generatedScenario` | jsonb | The full generated scenario data |
| `conversationHistory` | jsonb | Chat messages with the Authoring Assistant |
| `publishedScenarioId` | varchar (FK → scenarios) | Link to published scenario |
| `createdAt` | timestamp | Draft creation time |
| `updatedAt` | timestamp | Last edit |

#### `bug_reports`
User-submitted feedback and bug reports.

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID |
| `userId` | varchar (FK → users) | Reporter |
| `title` | varchar(255) | Bug title |
| `description` | text | Detailed description |
| `pageUrl` | varchar | URL where the issue occurred |
| `browserInfo` | varchar | Browser/OS metadata |
| `screenshot` | text | Base64-encoded screenshot |
| `status` | enum: new, reviewed, resolved, dismissed | Triage status |
| `createdAt` | timestamp | Report time |

#### `llm_providers`
Configurable LLM provider entries for the admin panel.

| Column | Type | Description |
|---|---|---|
| `id` | varchar (PK) | UUID |
| `name` | varchar(100) | Display name |
| `provider` | varchar(50) | Provider type (openai, gemini, etc.) |
| `modelId` | varchar(100) | API model identifier |
| `description` | text | Human-readable description |
| `isEnabled` | boolean | Active or disabled |
| `isDefault` | boolean | Default selection for new scenarios |
| `sortOrder` | integer | Display order |

#### `llm_usage_logs`
Fire-and-forget usage tracking for every LLM call.

| Column | Type | Description |
|---|---|---|
| `id` | serial (PK) | Auto-increment |
| `provider` | varchar | Which provider handled this call |
| `model` | varchar | Which model was used |
| `inputTokens` | integer | Prompt tokens consumed |
| `outputTokens` | integer | Completion tokens generated |
| `totalTokens` | integer | Sum of input + output |
| `costUsd` | varchar | Calculated cost in USD |
| `durationMs` | integer | Latency in milliseconds |
| `agentName` | varchar | Which agent made the call (director, narrator, etc.) |
| `sessionId` | varchar | Simulation session ID (for correlation) |
| `userId` | varchar | User who triggered the call |
| `success` | boolean | Whether the call succeeded |
| `errorMessage` | text | Error details (truncated to 500 chars) |
| `createdAt` | timestamp | Call timestamp |

#### `sessions`
Express session storage (managed by connect-pg-simple).

| Column | Type | Description |
|---|---|---|
| `sid` | varchar (PK) | Session ID |
| `sess` | jsonb | Serialized session data |
| `expire` | timestamp | Expiration time (indexed) |

### Database Enums

| Enum | Values |
|---|---|
| `userRoleEnum` | student, professor, admin |
| `sessionStatusEnum` | active, completed, abandoned |
| `narrativeMoodEnum` | neutral, positive, negative, crisis |
| `draftStatusEnum` | gathering, generating, reviewing, published, abandoned |
| `bugReportStatusEnum` | new, reviewed, resolved, dismissed |

### Entity Relationships

```
users ──┬── scenarios (authorId)
        ├── simulation_sessions (userId)
        ├── student_enrollments (studentId)
        ├── scenario_drafts (authorId)
        └── bug_reports (userId)

scenarios ──┬── simulation_sessions (scenarioId)
            ├── student_enrollments (scenarioId)
            └── scenario_drafts (publishedScenarioId)

simulation_sessions ── turns (sessionId)
```

---

## 5. Authentication & Authorization

### Replit Auth (OpenID Connect)

The platform uses Replit's OIDC provider for identity verification. No passwords are stored.

**Login Flow:**
1. User clicks "Iniciar Sesion" on the landing page.
2. Frontend redirects to `/api/login?role=student` (or `professor`).
3. Backend sets a `pendingRole` cookie and redirects to Replit's OIDC authorization endpoint.
4. User authenticates with their Replit account.
5. Replit redirects back to `/api/callback` with an authorization code.
6. Backend exchanges the code for tokens, extracts user claims (sub, email, name, profile_image).
7. Backend calls `storage.upsertUser()` to create or update the user in the database.
8. If this is a first-time login, the `pendingRole` cookie determines the initial role.
9. On subsequent logins, the existing role is preserved (role is locked after first assignment).
10. User is redirected to the home page.

**Session Management:**
- Sessions are stored in PostgreSQL via `connect-pg-simple`.
- Session TTL: 7 days.
- Cookies: `httpOnly: true`, `secure: true`, `sameSite: "lax"`.
- Automatic token refresh: If the access token is expired, `isAuthenticated` middleware uses the refresh token to obtain new tokens transparently.

### Role-Based Access Control (RBAC)

| Role | Capabilities |
|---|---|
| **Student** | Join scenarios via code, run simulations, view own results |
| **Professor** | All student capabilities + create/edit/manage scenarios, view student sessions and analytics, invite students |
| **Admin** | All professor capabilities + system settings |
| **Super Admin** | All admin capabilities + manage LLM providers, view AI costs, modify default agent prompts, delete any session, access all scenarios regardless of ownership |

**Super Admin Verification:**
1. User navigates to the role selection page and chooses "Admin."
2. A dialog appears requesting a verification code.
3. The code is sent to `POST /api/auth/verify-admin-code` and compared against `process.env.SUPER_ADMIN_CODE`.
4. If valid, `req.session.adminCodeVerified = true` is set.
5. During the OIDC callback, if this flag is present, the user is created with `isSuperAdmin: true`.

**`viewingAs` Feature:**
Super Admins can switch their "view" to see the platform as a student or professor without changing their actual role. This is managed by:
- `POST /api/users/view` updates `users.viewingAs`.
- Frontend uses `user.viewingAs || user.role` for UI decisions.
- The `RoleSwitcher` component in the header provides the toggle.
- `RoleProtectedRoute` always grants access to `isSuperAdmin` users regardless of role requirements.

### Auth Middleware

- `isAuthenticated` (server/replitAuth.ts): Checks `req.isAuthenticated()`, handles automatic token refresh, and attaches the database user to `req.dbUser`.
- `RoleProtectedRoute` (client component): Wraps frontend routes and checks `allowedRoles` against `user.role` or `user.isSuperAdmin`.

### Fresh Login

`GET /api/fresh-login` clears the local session and Replit session cookies simultaneously, enabling account switching on shared devices.

---

## 6. Multi-Agent AI System

The simulation engine uses a hierarchical multi-agent architecture inspired by LangChain.js. Each agent is a specialized function that receives context and returns structured output. The **Director** orchestrates the flow.

### Agent Overview

```
Student Input
     │
     ▼
┌─────────────────┐
│ Input Validator  │ ← Quick regex + LLM relevance check
└────────┬────────┘
         │ (if valid)
         ▼
┌─────────────────┐
│    Director      │ ← Orchestrator: interprets intent, manages flow
│                  │
│  ┌─────────────┐ │
│  │interpretIntent│ ← Translates casual language to business action
│  └──────┬──────┘ │
│         │         │
│  ┌──────▼──────┐ │
│  │Depth Evaluator│ ← Checks reasoning quality (S4.2 Rule)
│  └──────┬──────┘ │
│         │         │
│    (if deep enough)│
│         │         │
│  ┌──────▼──────────────────────────┐
│  │  Parallel Execution              │
│  │  ┌──────────┐  ┌──────────────┐ │
│  │  │Evaluator │  │Domain Expert │ │
│  │  │(Scores)  │  │(KPI Deltas)  │ │
│  │  └──────────┘  └──────────────┘ │
│  └──────────────────┬──────────────┘
│                     │               │
│         ┌───────────▼────────┐      │
│         │     Narrator       │      │
│         │  (Consequence Story)│      │
│         └────────────────────┘      │
└─────────────────────────────────────┘
         │
         ▼
   TurnResponse → Frontend
```

### Agent 1: Input Validator (`server/agents/inputValidator.ts`)

**Purpose:** First line of defense. Validates student input before any simulation processing.

**Checks (in order):**
1. **Empty/Too Short**: Minimum 3 characters.
2. **Profanity Filter**: Regex-based detection of severe Spanish and English insults.
3. **Nonsense/Gibberish**: Detects keyboard mashing (e.g., "asdf"), repeated characters, or strings with no letters.
4. **LLM Relevance Check**: Calls a lightweight model (gpt-4o-mini) to verify the input shows reasoning connected to the case — mentions actions, explains "why," or references case elements.
5. **Needs Elaboration**: Identifies valid but overly brief inputs (e.g., "Reduce costs" without explanation).

**MCQ Bypass:** When the current decision point has `format: "multiple_choice"` and `requiresJustification: false`, the input validator is skipped entirely. The student just picks an option.

**Returns:** `{ isValid: boolean, userMessage: string }`

### Agent 2: Director (`server/agents/director.ts`)

**Purpose:** The orchestrator. Interprets student intent, manages the simulation flow, coordinates all other agents, and assembles the final response.

**Key Functions:**

1. **`interpretIntent(input, context)`**: Takes the student's raw text and converts it into a clear business action. The system is "maximally permissive" — it tries to find a valid action in almost any input. Example: *"fire them lol"* becomes *"Dramatic cost reduction through workforce restructuring."*

2. **Depth Check**: Calls the Depth Evaluator. If the student's reasoning is too shallow AND `revisionAttempts < MAX_REVISIONS`, returns a `requiresRevision` response instead of processing the turn.

3. **Parallel Agent Calls**: If depth is sufficient, runs the Evaluator and Domain Expert in parallel (using `Promise.all`) for efficiency.

4. **Narrator Call**: Takes the interpreted action + KPI impacts + evaluation to generate the consequence narrative.

5. **State Management**: 
   - Applies `indicatorDeltas` from the Domain Expert to the current indicator values.
   - Checks for **Game Over** conditions (morale, reputation, efficiency, or trust below 20, OR revenue below 10,000).
   - Advances `currentDecision` counter.
   - Checks if the simulation should enter the **Reflection Step** (Decision 4 / Step 4).

6. **Reflection Step**: When all 3 decisions are complete, the Director generates a reflection prompt based on the scenario's `reflectionPrompt` template and the student's decision history.

**Constants:**
- `MAX_REVISIONS = 2`: Maximum times a student can be asked to revise before auto-accepting.

### Agent 3: Evaluator (`server/agents/evaluator.ts`)

**Purpose:** The "Silent Observer." Tracks student performance across competencies. This feedback is for professors only — students never see scores during the simulation.

**Competencies Scored (1-5 scale):**

| Competency | What It Measures |
|---|---|
| `strategicThinking` | Long-term vision, goal alignment, systemic analysis |
| `ethicalReasoning` | Recognition of human impact and moral tensions |
| `decisionDecisiveness` | Clarity and firmness in taking action |
| `stakeholderEmpathy` | Consideration of different stakeholder perspectives |

**Behavior:**
- Receives the student's decision, the interpreted intent, the decision number, total decisions, and previous decisions.
- Generates a 1-2 sentence neutral observation in Spanish (never evaluative language).
- Assigns behavioral flags (e.g., `STRATEGIC_THINKER`, `RISK_AWARE`, `NEEDS_DEEPER_ANALYSIS`).
- Compares current input against previous decisions to track evolution in student reasoning.
- Stage-specific tone: feedback varies based on whether this is Decision 1 (exploratory), 2 (analytical), or 3 (integrative).

### Agent 4: Domain Expert (`server/agents/domainExpert.ts`)

**Purpose:** The "Business Analyst." Calculates the numerical impact of decisions on KPIs and custom indicators.

**How It Works:**
1. Receives the student's interpreted action and the current state of all indicators.
2. Builds a dynamic prompt from the actual scenario indicators (not hardcoded).
3. Determines which indicators change and by how much.
4. Enforces the **Opportunity Cost Rule**: Every decision must have at least one negative impact.

**Delta Tiers:**

| Tier | Range | When Applied |
|---|---|---|
| Tier 1 (Minor) | +/-3 to +/-6 | Indirect or minor impact |
| Tier 2 (Standard) | +/-7 to +/-12 | Direct, expected impact — most common |
| Tier 3 (Major) | +/-13 to +/-20 | Dramatic or extreme decisions |

**Constraints:**
- 3-4 indicators must change per turn.
- Delta values are clamped to +/-20.
- Each changed indicator includes a `shortReason` (1 sentence) and `causalChain` (multi-step logic explanation) for the "Why?" feature.
- Previous decisions influence impact calculations (context-sensitive).

**Returns:**
```typescript
{
  indicatorDeltas: { indicatorId: string, delta: number, shortReason: string, causalChain: string }[]
  metricExplanations: { [indicatorId: string]: { shortReason: string, causalChain: string } }
}
```

### Agent 5: Narrator (`server/agents/narrator.ts`)

**Purpose:** Generates the professional narrative describing the consequences of the student's decision.

**Structure (enforced in prompt):**
1. **Consequence** (1-2 sentences): What happened as a direct result.
2. **Stakeholder Reaction** (1 sentence): How a key character or group responded.
3. **Forward Pressure** (1 sentence): What new tension or challenge emerges.

**Rules:**
- 60-100 words total.
- Professional, neutral tone — no moralizing or drama.
- No evaluative language ("excellent decision," "mistake," etc.).
- Latin American Spanish.
- References specific stakeholders and scenario elements.

### Agent 6: Depth Evaluator (`server/agents/depthEvaluator.ts`)

**Purpose:** Ensures the student provides sufficient reasoning before their decision is processed.

**S4.2 Rule — Acceptance Criteria (needs at least 1):**

| Criterion | Example |
|---|---|
| **Priority** | Student indicates what they're optimizing for |
| **Case Reference** | Mentions specific scenario elements, stakeholders, or resources |
| **Trade-off/Risk** | Acknowledges a disadvantage or risk of their choice |

**Behavior:**
- If the input meets at least one criterion: `isDeepEnough: true`.
- If not deep enough AND `revisionAttempts < MAX_REVISIONS (1)`: Returns a revision prompt.
- If `revisionAttempts >= 1`: Auto-accepts regardless of depth (keeps flow moving).
- May include a non-blocking "Mentor Nudge" even when accepting, suggesting how to strengthen future reasoning.
- Becomes progressively more lenient as `revisionAttempts` increases.

### Agent 7: Authoring Assistant (`server/agents/authoringAssistant.ts`)

**Purpose:** Conversational AI for iteratively creating scenarios. Used in the "Studio" drafts workflow.

**How It Differs from Canonical Case Generator:**
- **Authoring Assistant**: Chat-based, iterative. Professor has a conversation to refine a scenario over multiple messages. Flexible, open-ended.
- **Canonical Case Generator**: One-click structured generation. Professor fills a form (topic, trade-offs, discipline), clicks generate, and gets a complete case instantly. Rigid HBS-style structure.

### Agent 8: Canonical Case Generator (`server/agents/canonicalCaseGenerator.ts`)

**Purpose:** One-click generation of Harvard Business School-style cases with a strictly defined structure.

**Enforced Structure:**
- Section 1: Context (120-180 words, neutral tone)
- Section 2: Core Challenge (single business dilemma)
- Section 3: Decision 1 — Strategic Orientation (Multiple Choice)
- Section 4: Decision 2 — Analytical (Written justification required)
- Section 5: Decision 3 — Integrative (Written, must reference previous choices)
- Each decision has a `focusCue` and `thinkingScaffold`
- Duration target: 20-25 minutes

**Generated Indicators (fixed for POC):**
1. Moral del Equipo (Team Morale) — `up_better`
2. Impacto Presupuestario (Budget Impact) — `down_better`
3. Riesgo Operacional (Operational Risk) — `down_better`
4. Flexibilidad Estrategica (Strategic Flexibility) — `up_better`

### Thinking Scaffolds & Focus Cues

These are pedagogical tools defined at each Decision Point to guide reasoning without revealing answers.

**Focus Cue (`focusCue`):**
A short mentorship-style nudge that sets the tension for the current decision. Example: *"Considera el impacto en el equipo, los inversionistas, y la reputacion del producto."*

**Thinking Scaffold (`thinkingScaffold`):**
A list of 3-4 reasoning dimensions for the student to consider. Displayed as a "Piensa en:" checklist above the input area. Example: `["Capacidad del equipo", "Expectativas de inversionistas", "Riesgo vs. Velocidad"]`

These appear in the `InputConsole` component as visual prompts but never suggest what the student should decide.

---

## 7. LLM Provider System

The platform uses a sophisticated multi-provider architecture for resilience, cost optimization, and high concurrency.

### Provider Registry (`server/llm/providers/registry.ts`)

On startup, the registry checks environment variables and initializes all available providers:

| Provider | Env Variable(s) | Slots | Cost Tier |
|---|---|---|---|
| Replit OpenAI Proxy | (built-in integration) | 10 | 1 (cheapest) |
| Replit Gemini Proxy | (built-in integration) | 10 | 1 |
| OpenRouter | `OPENROUTER_API_KEYS` (comma-separated) | 30 per key | 2 |
| Gemini Direct | `GEMINI_DIRECT_API_KEYS` (comma-separated) | 25 per key | 2 |
| OpenAI Direct | (env variable) | 15 per key | 3 |
| Anthropic Direct | (env variable) | 20 per key | 4 (most expensive) |

**Multi-Key Support:** Providers that accept multiple API keys (like OpenRouter with 4 keys) multiply their slot count. With 4 OpenRouter keys, that is 120 concurrent slots from OpenRouter alone.

**Current Configuration:** With 4 OpenRouter keys + Gemini Direct + 2 Replit proxies, the system has approximately 165 concurrent AI slots available.

### Smart Router (`server/llm/providers/router.ts`)

The router uses a "Least-Loaded" strategy with cost and health awareness:

**Selection Algorithm:**
1. **Filter**: Remove unhealthy or rate-limited providers and those with no available slots.
2. **Sort by Cost Tier**: Prefer cheaper providers (Replit proxies first, then OpenRouter/Gemini, then direct APIs).
3. **Sort by Utilization**: Among same-cost providers, prefer the one with lower `activeRequests / maxConcurrent` ratio.
4. **Tie-break**: Use available slot count.

**Automatic Failover:**
If a provider fails (timeout, rate limit, error), the router:
1. Catches the error.
2. Marks the provider as potentially unhealthy.
3. Immediately retries the request on the next best available provider.
4. Continues until all providers are exhausted or one succeeds.

### Model Equivalence (`server/llm/providers/types.ts`)

When failing over to a different provider, the system maps models to their closest equivalents:

| Requested Model | OpenRouter Equivalent | Gemini Equivalent | Anthropic Equivalent |
|---|---|---|---|
| gpt-4o | openai/gpt-4o | gemini-1.5-pro | claude-sonnet-4-20250514 |
| gpt-4o-mini | openai/gpt-4o-mini | gemini-1.5-flash | claude-sonnet-4-20250514 |

### Key Rotation

The `BaseProvider` class uses round-robin key rotation via `getNextKey()`. Each API call cycles through the available keys for that provider, distributing load evenly.

### Concurrency Control

Each provider uses `p-limit` to enforce strict slot limits. If a provider's slots are all in use, requests are queued at the provider level.

### Rate Limit Handling

When a provider returns a 429 status or "Resource Exhausted" error:
- The provider is marked `rateLimitedUntil = now + 30 seconds`.
- During this window, the router skips this provider entirely.
- After the window expires, the provider is eligible again.

### Request Timeouts

Every LLM request has a hard 90-second timeout enforced via `AbortController`. If the model doesn't respond within 90 seconds, the request is aborted and failed over.

### Turn Queue (`server/llm/turnQueue.ts`)

A higher-level queue that manages complete simulation turns (which involve multiple sequential LLM calls):

- Each turn requires `SLOTS_PER_TURN = 4` available slots before processing begins.
- This prevents a turn from starting and then getting throttled mid-way through the agent pipeline.
- Maximum queue size: 100 pending turns.
- If the queue is full, new requests receive a "server busy" response.

### Job Queue (`server/llm/providers/queue.ts`)

A lower-level queue for individual LLM completions:
- When total system capacity is reached, individual requests are queued.
- `MAX_QUEUE_SIZE = 200`.
- Requests in the queue are processed as slots become available.

---

## 8. Simulation Turn Flow (Step by Step)

This is the complete journey of a student's decision from button click to UI update.

### Step 1: Frontend Submission

**Component:** `InputConsole.tsx`

The student types their decision (or selects an MCQ option) and clicks "Enviar Decision."

**Data sent:**
```typescript
{ input: string, revisionAttempts: number }
```

The `revisionAttempts` counter tracks how many times the student has tried to answer the current decision point (starts at 0, increments if the system asks for revision).

### Step 2: Mutation Dispatch

**Component:** `Simulation.tsx`

The `handleSubmit` function:
1. Clears any previous validation errors.
2. Calls `submitMutation.mutate(input)`.
3. Sets `processing: true` in the Zustand store.
4. Shows "Thinking Steps" UI (animated indicators like "Analyzing decision...", "Calculating impact...", "Generating narrative...").

### Step 3: API Request

**Endpoint:** `POST /api/simulations/:sessionId/turn`

**Body:** `{ input: string, revisionAttempts: number }`

### Step 4: Server-Side Input Validation

**File:** `server/routes.ts` → `server/agents/inputValidator.ts`

1. Loads the session and scenario from the database.
2. Checks if the current decision point is MCQ without justification — if so, **skips validation entirely**.
3. Otherwise, runs the Input Validator:
   - Quick regex checks (empty, profanity, gibberish).
   - LLM relevance check (gpt-4o-mini).
4. If invalid: Returns `400 Bad Request` with the validation message. The frontend shows this in a red banner.

### Step 5: Context Assembly

**File:** `server/routes.ts`

If input is valid, the server assembles an `AgentContext` object containing:
- Session history (previous turns)
- Current KPIs and indicator values
- Scenario metadata (role, objective, domain, stakeholders)
- Custom agent prompts (if professor configured any)
- Decision point configuration (prompt, format, thinking scaffold, focus cue)
- Current decision number and total decisions

### Step 6: Director Orchestration

**File:** `server/agents/director.ts` → `processStudentTurn(context, revisionAttempts)`

#### 6a. Intent Interpretation
Calls `interpretIntent()` — an LLM call that converts the student's raw text into a clear business action.

#### 6b. Depth Evaluation
Calls `evaluateDepth()` — checks if the student provided sufficient reasoning.

**If depth is insufficient and `revisionAttempts < 1`:**
- Returns `{ requiresRevision: true, revisionPrompt: "..." }`.
- The turn is NOT processed. The student sees the revision prompt and tries again.
- `revisionAttempts` increments on the frontend.

**If `revisionAttempts >= 1`:** Auto-accepts regardless of depth.

#### 6c. Parallel Agent Execution
Runs two agents simultaneously via `Promise.all`:

**Evaluator** → Returns:
- Competency scores (1-5 per competency)
- Neutral observation message
- Behavioral flags

**Domain Expert** → Returns:
- Indicator deltas (which metrics change and by how much)
- Metric explanations (shortReason + causalChain per indicator)

#### 6d. Narrator Call
Takes all the above results and generates the consequence narrative (60-100 words).

#### 6e. State Finalization
1. **Apply Indicator Deltas**: Adds delta values to current indicator values, clamping results to 0-100.
2. **Update KPIs**: Applies any KPI changes.
3. **Game Over Check**: If morale, reputation, efficiency, or trust falls below 20 (or revenue below 10,000), sets `isGameOver: true`.
4. **Decision Counter**: Increments `currentDecision`.
5. **Reflection Check**: If all 3 decisions are complete, sets `isReflectionStep: true` and generates the reflection prompt.
6. **History Update**: Appends the student's input and the AI's response to the history array.
7. **Save State**: Writes the updated `SimulationState` back to `simulation_sessions.currentState`.

### Step 7: Turn Persistence

**File:** `server/routes.ts`

Creates a record in the `turns` table with the full `TurnResponse` as JSONB.

### Step 8: Response to Client

Returns the `TurnResponse` JSON with status 200.

### Step 9: Zustand Store Update

**File:** `client/src/stores/simulationStore.ts` → `addTurn()`

1. Appends the student's input to `history` as a `user` entry.
2. Appends the AI narrative to `history` as an `npc` entry.
3. Updates `kpis` and `indicators` with new values.
4. Updates `competencyScores` running averages.
5. Stores `metricExplanations` for the "Why?" tooltips.
6. Updates `currentDecision` and checks `isReflectionStep` / `isGameOver`.
7. Sets `processing: false`.

### Step 10: UI Re-render

- **SimulationFeed**: Scrolls to show the new narrative message.
- **KPIDashboard**: Animates bars to new values, shows delta arrows with direction-aware coloring (green = improvement, red = deterioration, based on `up_better`/`down_better`).
- **InputConsole**: Loads the next decision point's prompt, thinking scaffold, and focus cue. Or transitions to the Reflection view or Results page.

### Token Consumption Per Turn

A typical turn involves 3-4 LLM calls:
1. **Intent Interpretation**: ~500 input / ~100 output tokens
2. **Depth Evaluation**: ~400 input / ~100 output tokens
3. **Evaluator**: ~600 input / ~200 output tokens
4. **Domain Expert**: ~700 input / ~300 output tokens
5. **Narrator**: ~500 input / ~200 output tokens

**Approximate total per turn:** ~2,700 input + ~900 output = ~3,600 tokens

**Per complete simulation (3 decisions + reflection):** ~14,000-15,000 tokens

---

## 9. Scenario Creation & Authoring

Professors have two distinct approaches to creating scenarios.

### Approach A: Canonical Case Generator (One-Click)

**Component:** `CanonicalCaseCreator.tsx`

**Flow:**
1. **Input Form**: Professor fills in:
   - Topic (brief description of the central business theme)
   - Discipline (Business, Marketing, Finance, Ethics, etc.)
   - Target Level (Undergraduate, Graduate, Executive)
   - Scenario Objective (Decision-making, Crisis management, etc.)
   - Trade-off Focus (predefined tensions like "Cost vs. Quality", "Short vs. Long term")
   - Custom Trade-off (optional free text)

2. **Generation**: Clicks "Generar" → calls `POST /api/canonical-case/generate`.
   - Backend builds a structured prompt with all inputs.
   - Calls the `generateCanonicalCase()` function.
   - LLM generates a complete case following the strict HBS-style template.
   - Result is transformed via `convertCanonicalToScenarioData()` into the simulation engine format.
   - A `scenario_draft` is created with status `reviewing`.

3. **Review/Edit Phase**: The generated case is displayed in a structured preview.
   - **Editor Mode Lock**: Fields are read-only by default (`opacity-70`). Professor must toggle "Modo Edicion" to enable editing.
   - **Editable Fields**: Title, description, case context, core challenge, decision prompts, MCQ options, thinking scaffolds, focus cues, indicator names/values, reflection prompt.
   - **Live Sync**: Edits update both the UI state and the underlying `scenarioData` simultaneously.

4. **Save/Publish**:
   - **Save**: `PUT /api/canonical-case/:draftId` persists changes to the draft.
   - **Publish**: `POST /api/drafts/:id/publish` creates a permanent `scenario` record, generates a `joinCode`, and marks the draft as `published`.

### Approach B: Authoring Assistant (Conversational)

**Component:** `AIAuthoringChat.tsx` (within Studio page)

**Flow:**
1. Professor starts a new draft in the Studio.
2. Enters source material (paste text, upload PDF, or just describe the topic).
3. The system extracts insights from the source material using AI.
4. Professor chats with the Authoring Assistant to iteratively refine the scenario.
5. Each message in the conversation can modify the draft's `generatedScenario` data.
6. When satisfied, professor publishes the draft.

**Key Difference:**
- Canonical Generator: Fill form → click → get complete case → edit → publish. Fast, structured, predictable.
- Authoring Assistant: Chat → iterate → refine → chat more → publish. Flexible, open-ended, more professor control.

### Manual Case Creation

**Component:** `ManualCaseCreator.tsx`

Professors can also create scenarios entirely by hand using a form-based editor, defining every field manually without AI assistance.

---

## 10. Student Enrollment System

### How Students Access Scenarios

Students can access scenarios through three mechanisms:

#### 1. Join Code (Kahoot-style)
- Professor generates a 6-character alphanumeric code (e.g., `AB12CD`) via "Generar Codigo de Acceso" in the Simulation Management page.
- Code is stored in `scenarios.joinCode`.
- Professor shares the code (copy button provided).
- Student enters the code on their Home page dashboard.
- `POST /api/scenarios/join` validates the code and enrolls the student.
- A record is created in `student_enrollments` with `enrolledVia: "code"`.

#### 2. Email Invitation
- **Individual**: `POST /api/scenarios/:scenarioId/students` — professor enters one email.
- **Bulk**: `POST /api/scenarios/:scenarioId/students/bulk` — professor pastes multiple emails (comma, newline, or semicolon separated).
- Creates enrollment records with `enrolledVia: "email"`.
- Note: In the current POC, email sending is a placeholder (logged but not actually sent).

#### 3. Global Demo
- Scenarios with `isGlobalDemo: true` appear for ALL students, regardless of enrollment.
- Used for demo/showcase scenarios.

### The isPublished / isStarted Flow

These two boolean flags on the `scenarios` table control access in sequence:

```
isPublished = false  → Scenario is invisible to students
isPublished = true   → Scenario appears in student lists / can be joined via code
isStarted = false    → Students see "Esperando al profesor" (Waiting for professor)
isStarted = true     → Students can click "Comenzar Simulacion" and start
```

**Backend Enforcement:** `POST /api/simulations/start` checks `isStarted` for student users and returns `403 Forbidden` if the professor hasn't started the simulation yet. This is enforced server-side, not just in the UI.

**Professor Toggle:** `PATCH /api/scenarios/:scenarioId/start` flips the `isStarted` flag.

### Enrollment vs. Session

| Concept | Table | Meaning |
|---|---|---|
| **Enrollment** | `student_enrollments` | Student has PERMISSION to access the scenario (the "roster") |
| **Session** | `simulation_sessions` | Student has STARTED the simulation (active instance created) |

A student can be enrolled without having a session (they haven't started yet). The home page queries both to show available and in-progress simulations.

### Professor Management

In the Simulation Management page (`/scenarios/:scenarioId/manage`), professors can:
- View all enrolled students with their names, emails, and session statuses.
- See status badges: "Completado" (finished), "En progreso" (active), "Inscrito" (enrolled but not started).
- Delete individual student sessions (trash icon with confirmation dialog).
- Generate or regenerate join codes.
- Toggle `isStarted` to open/close the simulation.

---

## 11. Frontend Architecture

### Routing (`App.tsx`)

| Path | Component | Access |
|---|---|---|
| `/` (unauthenticated) | `Landing` | Public |
| `/select-role` | `RoleSelection` | Public |
| `/` (authenticated) | `Home` | All roles |
| `/explore` | `ExploreExample` | All roles |
| `/simulation/start/:scenarioId` | `SimulationStart` | All roles |
| `/simulation/:sessionId` | `Simulation` | All roles |
| `/simulation/:sessionId/results` | `SessionResults` | All roles |
| `/professor` | `ProfessorDashboard` | Professor, Admin |
| `/studio` | `Studio` | Professor, Admin |
| `/scenarios/:scenarioId/manage` | `SimulationManagement` | Professor, Admin |
| `/scenarios/:scenarioId/edit` | `ScenarioEdit` | Professor, Admin |
| `/scenarios/:scenarioId/analytics` | `ScenarioAnalytics` | Professor, Admin |
| `/analytics` | `Analytics` | Professor, Admin |
| `/settings` | `Settings` | Admin |
| `/admin/ai-costs` | `AiCostDashboard` | Super Admin |
| `/bug-reports` | `BugReports` | Admin |

### State Management

**Zustand Store (`simulationStore.ts`):**
Manages all active simulation state on the client:
- `history`: Full conversation log (user/npc/system messages)
- `kpis`: Current KPI values
- `indicators`: Current indicator values with directions
- `currentDecision`: Which decision point is active
- `isReflectionStep`: Whether we're on Step 4
- `isGameOver`: Whether a KPI crashed below 20
- `processing`: Loading state during turn processing
- `competencyScores`: Running averages (internal)
- `metricExplanations`: "Why?" data per indicator
- `revisionAttempts`: Counter for current decision point

**TanStack Query:** Handles all server state (fetching scenarios, sessions, user data) with automatic caching, refetching, and cache invalidation after mutations.

### Simulation Page (Three-Column Layout)

The main simulation interface uses a responsive three-column layout:

```
┌────────────────┬────────────────────────────┬──────────────────┐
│  Left Column   │     Center Column          │  Right Column    │
│                │                            │                  │
│  CaseContext   │  SimulationFeed            │  KPIDashboard    │
│  Panel         │  (chat-style history)      │  (live metrics)  │
│                │                            │                  │
│  - Title       │  - User messages           │  - Indicator     │
│  - Industry    │  - NPC responses           │    bars          │
│  - Role        │  - System notifications    │  - Delta arrows  │
│  - Objective   │  - Thinking indicators     │  - "Why?" expand │
│  - Context     │                            │                  │
│  - Challenge   │  ─────────────────────     │  FeedbackPanel   │
│  - Decision    │  InputConsole              │  (mentor notes)  │
│    Structure   │  - Decision prompt         │                  │
│    Progress    │  - Focus Cue               │                  │
│                │  - Thinking Scaffold       │                  │
│  (collapsible) │  - Text input / MCQ        │                  │
│                │  - "Enviar" button         │                  │
└────────────────┴────────────────────────────┴──────────────────┘
```

### Key Components

**`SimulationFeed.tsx`**: Renders `HistoryEntry` items in a chat-style scrollable list. Distinguishes between:
- `user` messages: Primary color bubbles, right-aligned
- `npc` messages: Left-aligned with character avatars
- `system` messages: Centered, muted styling
- Thinking indicator with animated steps while AI processes

**`InputConsole.tsx`**: The student interaction area. Supports:
- Free-text input with `Textarea`
- Multiple-choice options with `RadioGroup`
- Focus Cue display (mentorship hint)
- Thinking Scaffold display ("Piensa en:" checklist)
- Revision prompts when depth is insufficient
- Reflection step input (final Step 4)

**`KPIDashboard.tsx`**: Real-time display of business metrics.
- Animated progress bars for each indicator (0-100)
- Delta arrows showing change from last turn
- Direction-aware coloring: green = improvement, red = deterioration (respects `up_better` vs `down_better`)
- Expandable "Why?" sections showing `shortReason` and `causalChain` per indicator

**`CaseContextPanel.tsx`**: Collapsible left sidebar with:
- Scenario title and industry
- Student's role and objective
- Case context (Harvard-style background)
- Core challenge description
- Decision structure progress tracker (Decision 1 → 2 → 3 → Reflection)

**`FeedbackPanel.tsx`**: Right sidebar section showing:
- "Mentor Notes" — neutral observation from the Evaluator after each decision
- "Revision Prompts" — when the student needs to elaborate
- Never shows scores or evaluative language

**`SessionResults.tsx`**: Post-simulation debriefing page with:
- Inspirational hero section ("Experience Completed")
- Indicator cards grid: Initial vs. Final values with visual change indicators
- "Why it changed" expandable sections aggregating causal chains across all turns
- Decision Timeline: Vertical timeline showing each decision and its narrative consequence
- Closing message emphasizing trade-offs over "correct" answers

### Other Important Components

**`RoleProtectedRoute.tsx`**: Authorization wrapper for routes. Checks `allowedRoles` against `user.role`. Always allows `isSuperAdmin`.

**`RoleSwitcher.tsx`**: Header component for Super Admins to switch their view between student/professor/admin perspectives.

**`AIAuthoringChat.tsx`**: Chat interface for the Authoring Assistant (conversational scenario creation).

**`CanonicalCaseCreator.tsx`**: Form + preview interface for one-click case generation.

**`ManualCaseCreator.tsx`**: Form-based manual scenario editor.

### Hooks

| Hook | Purpose |
|---|---|
| `useAuth.ts` | Manages authenticated user state, login/logout |
| `use-toast.ts` | UI notification system (success, error, info toasts) |
| `use-mobile.tsx` | Responsive design detection (mobile vs. desktop) |

### Utilities

| File | Purpose |
|---|---|
| `queryClient.ts` | TanStack Query configuration with default fetcher and `apiRequest` helper for mutations |
| `authUtils.ts` | Replit Auth integration helpers |
| `utils.ts` | General utilities (`cn` for class merging, etc.) |

---

## 12. Complete API Reference

### Authentication & Users

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/auth/user` | Get current user profile and claims | Auth |
| POST | `/api/auth/verify-admin-code` | Verify super admin code | Public |
| POST | `/api/users/role` | Update user role | Auth |
| POST | `/api/users/view` | Update viewingAs for role switching | Auth |
| PATCH | `/api/users/profile` | Update name/profile | Auth |
| GET | `/api/fresh-login` | Clear session for account switching | Auth |

### Scenarios

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/scenarios` | List available scenarios (filtered by role) | Auth |
| GET | `/api/scenarios/authored` | List professor's own scenarios | Professor |
| GET | `/api/scenarios/:id` | Get full scenario details | Auth |
| POST | `/api/scenarios` | Create new scenario | Professor |
| PUT | `/api/scenarios/:id` | Update scenario | Professor (author) |
| DELETE | `/api/scenarios/:id` | Delete scenario | Professor (author) |
| POST | `/api/scenarios/join` | Join scenario via code | Student |
| POST | `/api/scenarios/:id/generate-code` | Generate join code | Professor |
| PATCH | `/api/scenarios/:id/start` | Toggle isStarted | Professor |

### Simulations

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/api/simulations/start` | Start new simulation session | Auth |
| GET | `/api/simulations/sessions` | List user's sessions | Auth |
| GET | `/api/simulations/:sessionId` | Get session status/state | Auth |
| POST | `/api/simulations/:sessionId/turn` | Submit decision (core turn flow) | Auth |
| POST | `/api/simulations/:sessionId/hint` | Request AI hint | Auth |
| POST | `/api/simulations/:sessionId/abandon` | Abandon session | Auth |
| GET | `/api/simulations/:sessionId/history` | Get full message history | Auth |

### Professor Dashboard

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/professor/scenarios` | Scenarios with enrollment/completion stats | Professor |
| GET | `/api/professor/scenarios/:id/sessions` | Student roster with session status | Professor |
| GET | `/api/professor/sessions/:id/conversation` | View student's full conversation | Professor |
| PATCH | `/api/professor/sessions/:id/status` | Update session status | Professor |
| DELETE | `/api/professor/sessions/:id` | Delete student session | Professor/SuperAdmin |
| DELETE | `/api/professor/scenarios/:id` | Delete scenario + all sessions | Professor |
| GET | `/api/professor/scenarios/:id/themes` | AI-generated aggregate themes | Professor |

### Student Enrollment

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/api/scenarios/:id/students` | Invite student by email | Professor |
| POST | `/api/scenarios/:id/students/bulk` | Invite multiple students | Professor |

### AI Authoring & Drafts

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/drafts` | List professor's drafts | Professor |
| GET | `/api/drafts/:id` | Get draft details | Professor |
| POST | `/api/drafts` | Create new draft | Professor |
| POST | `/api/drafts/:id/chat` | Chat with Authoring Assistant | Professor |
| POST | `/api/drafts/:id/publish` | Publish draft as scenario | Professor |
| DELETE | `/api/drafts/:id` | Delete draft | Professor |
| POST | `/api/canonical-case/generate` | Generate canonical case | Professor |
| PUT | `/api/canonical-case/:draftId` | Update generated case data | Professor |

### Agent & LLM Configuration

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/agents/default-prompts` | Get system default agent prompts | Super Admin |
| GET | `/api/scenarios/:id/config` | Get scenario LLM config | Professor |
| PUT | `/api/scenarios/:id/config` | Update scenario LLM config | Professor |
| GET | `/api/llm-providers` | List all LLM providers | Super Admin |
| GET | `/api/llm-providers/enabled` | List enabled providers | Professor |
| POST | `/api/llm-providers` | Add new provider | Super Admin |
| PUT | `/api/llm-providers/:id` | Update provider | Super Admin |
| DELETE | `/api/llm-providers/:id` | Delete provider | Super Admin |
| GET | `/api/admin/ai-costs` | AI usage and cost dashboard data | Super Admin |

### Analytics

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/analytics` | Platform-wide analytics | Professor |

### Monitoring & Utilities

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/monitoring/ai-capacity` | Real-time AI service capacity | Admin |
| GET | `/api/queue/status/:jobId` | Check queued job status | Auth |
| POST | `/api/bug-reports` | Submit bug report | Auth |
| POST | `/api/bug-reports/authenticate` | Auth for bug report viewer | Admin |
| GET | `/api/bug-reports` | List bug reports | Admin |
| PATCH | `/api/bug-reports/:id/status` | Update bug report status | Admin |
| POST | `/api/upload/url` | Generate pre-signed upload URL | Auth |
| GET | `/public-objects/:filePath` | Serve public files from object storage | Public |

---

## 13. Usage Logging & Cost Tracking

### How Usage Logging Works

Every LLM call is logged to the `llm_usage_logs` table via a **fire-and-forget** mechanism.

**Fire-and-Forget Pattern:**
```typescript
logUsage({ provider, model, tokens, ... }).catch(() => {});
```
- The `logUsage()` call is NOT awaited.
- The response returns to the user immediately while the log write happens in the background.
- If logging fails, the error is swallowed — a logging failure never causes a user-facing error.

### Data Logged Per Call

| Field | Description |
|---|---|
| `provider` | Which provider handled the call (e.g., "OpenRouter", "Replit Gemini") |
| `model` | Specific model used (e.g., "gpt-4o", "gemini-1.5-pro") |
| `inputTokens` | Prompt tokens consumed |
| `outputTokens` | Completion tokens generated |
| `totalTokens` | Sum of input + output |
| `costUsd` | Calculated cost based on provider pricing |
| `durationMs` | Latency in milliseconds |
| `agentName` | Which agent made the call (director, narrator, evaluator, domainExpert, etc.) |
| `sessionId` | Simulation session ID for correlation |
| `userId` | User who triggered the call |
| `success` | Whether the call succeeded |
| `errorMessage` | Error details (truncated to 500 chars) |

### Cost Calculation

```
Cost = (inputTokens * inputPricePerMillion + outputTokens * outputPricePerMillion) / 1,000,000
```

**Provider Pricing (per million tokens):**

| Provider | Model | Input Price | Output Price |
|---|---|---|---|
| OpenAI Direct | gpt-4o | $2.50 | $10.00 |
| OpenRouter | gpt-4o | $2.50 | $10.00 |
| Replit OpenAI | any | $0.00 | $0.00 |
| Replit Gemini | any | $0.00 | $0.00 |
| Fallback | unknown | $0.50 | $1.50 |

### AI Cost Dashboard (`/admin/ai-costs`)

Super Admin-only page showing:
- **Summary Cards**: Total cost, total calls, total tokens, error rate
- **Daily Cost Chart**: Bar chart of spending trends over time
- **Provider Breakdown**: Table showing usage per provider
- **Agent Breakdown**: Table showing which agent consumes the most tokens/cost
- **Session Breakdown**: Top 50 most expensive sessions
- **Recent Logs**: Last 100 LLM calls with status, latency, and cost

**Endpoint:** `GET /api/admin/ai-costs?period=24h|7d|30d|all`

---

## 14. Guardrails & Safety

### System Guardrails (`server/agents/guardrails.ts`)

Non-negotiable rules enforced across ALL AI agents:

**Hard Prohibitions:**
1. **No "Correct" Answers**: Agents must never reveal the "best" choice or suggest what should have been chosen.
2. **No Visible Scoring**: No numbers, grades, percentages, or evaluative terms ("excellent," "bad," "mistake") in student-facing messages.
3. **No GPA/Grade Optimization**: Focus on business learning, not academic performance.
4. **No Internal Logic Revelation**: Rubrics, metrics, and calculation methods remain hidden from students.
5. **Emotional Neutrality**: Professional tone regardless of student provocation.

**Mentor Tone:**
- Calm, realistic, constructive.
- Latin American Spanish (never Peninsular Spanish).
- No anglicisms: "stakeholders" → "partes interesadas", "feedback" → "retroalimentacion".

**Misuse Handling:**
- Trolling, nonsense, or profanity → redirect to the business scenario without judgment.
- Never escalate, never moralize, never break character.

**Implicit Ethics Rule:**
- Agents never ask direct ethical questions ("Is this ethical?").
- Instead, they show ethical consequences through narrative ("The union has requested an emergency meeting").

**Opportunity Cost Rule:**
- Every decision must negatively impact at least one indicator.
- There are no "perfect" choices — only trade-offs.

---

## 15. Configuration & Environment

### Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `SUPER_ADMIN_CODE` | Code to verify super admin status |
| `OPENROUTER_API_KEYS` | Comma-separated OpenRouter API keys |
| `OPENROUTER3_API_KEY` | Additional OpenRouter key |
| `OPENROUTER4_API_KEY` | Additional OpenRouter key |
| `GEMINI_DIRECT_API_KEYS` | Comma-separated Gemini API keys |
| `REPL_ID` | Replit environment ID (auto-set) |
| `ISSUER_URL` | OIDC issuer URL (default: `https://replit.com/oidc`) |
| `SESSION_SECRET` | Express session encryption key |

### Project Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `tsx server/index.ts` | Start development server (Express + Vite) |
| `npm run build` | `vite build` | Build frontend for production |
| `npm run db:push` | `drizzle-kit push` | Sync schema to database |
| `npm run seed` | `tsx server/seed.ts` | Seed sample data |

### Vite Configuration

- Frontend and backend run on the same port via Vite middleware in development.
- All aliases are pre-configured (`@/` for client/src, `@shared/` for shared/, `@assets/` for attached assets).
- No proxy configuration needed — the Express server serves both the API and the Vite dev server.

### Key File Locations

| Purpose | Path |
|---|---|
| Database schema | `shared/schema.ts` |
| API routes | `server/routes.ts` |
| Database connection | `server/db.ts` |
| Storage interface | `server/storage.ts` |
| Auth setup | `server/replitAuth.ts` |
| Agent: Director | `server/agents/director.ts` |
| Agent: Narrator | `server/agents/narrator.ts` |
| Agent: Evaluator | `server/agents/evaluator.ts` |
| Agent: Domain Expert | `server/agents/domainExpert.ts` |
| Agent: Input Validator | `server/agents/inputValidator.ts` |
| Agent: Depth Evaluator | `server/agents/depthEvaluator.ts` |
| Agent: Guardrails | `server/agents/guardrails.ts` |
| Agent: Canonical Case Gen | `server/agents/canonicalCaseGenerator.ts` |
| Agent: Authoring Assistant | `server/agents/authoringAssistant.ts` |
| LLM Provider System | `server/llm/` |
| LLM Router | `server/llm/providers/router.ts` |
| LLM Registry | `server/llm/providers/registry.ts` |
| Usage Logger | `server/llm/usageLogger.ts` |
| Turn Queue | `server/llm/turnQueue.ts` |
| Simulation Store | `client/src/stores/simulationStore.ts` |
| Simulation Page | `client/src/pages/Simulation.tsx` |
| Results Page | `client/src/pages/SessionResults.tsx` |
| Professor Dashboard | `client/src/pages/ProfessorDashboard.tsx` |
| Simulation Management | `client/src/pages/SimulationManagement.tsx` |
| Studio | `client/src/pages/Studio.tsx` |

---

## 16. User Flows

### Student Flow

```
1. Land on Landing page → Click "Iniciar Sesion"
2. Authenticate via Replit Auth
3. Select role: "Estudiante" on RoleSelection page
4. Home dashboard shows:
   - Available simulations (enrolled + global demos)
   - "Join Simulation" input for entering a join code
   - Active/completed session cards
5. Enter join code → Enrolled in scenario
6. Click scenario card → SimulationStart page
   - See scenario briefing (title, role, objective, context)
   - If professor hasn't started: "Esperando al profesor" screen
   - If started: "Comenzar Simulacion" button
7. Start simulation → Simulation page (three-column layout)
   - Read case context in left panel
   - See initial narrative in center feed
   - View starting indicators in right panel
8. Decision 1 (Strategic Orientation):
   - Read decision prompt + focus cue + thinking scaffold
   - Submit MCQ selection or written response
   - If depth insufficient → revision prompt → try again
   - See consequence narrative + indicator changes + mentor note
9. Decision 2 (Analytical):
   - Same flow with written justification required
10. Decision 3 (Integrative):
    - Same flow, must reference previous choices
11. Reflection Step (Step 4):
    - Reflection prompt based on decision history
    - Write reflective analysis
12. Results page:
    - Indicator cards (Initial vs. Final with "Why?")
    - Decision timeline
    - Closing message about trade-offs
```

### Professor Flow

```
1. Authenticate → Select role: "Profesor"
2. Professor Dashboard shows:
   - Authored scenarios with enrollment/completion stats
   - Quick actions (create new, manage existing)
3. Create scenario (choose one):
   a. Canonical Case Generator:
      - Fill form (topic, discipline, trade-offs)
      - Click "Generar" → AI generates complete case
      - Review in structured preview
      - Toggle "Modo Edicion" to edit
      - Publish when ready
   b. Authoring Assistant:
      - Chat with AI to iteratively build scenario
      - Provide source material or describe topic
      - AI generates and refines based on conversation
      - Publish when ready
   c. Manual Creation:
      - Fill all fields manually
      - Define decision points, indicators, context
      - Publish
4. Manage scenario (/scenarios/:id/manage):
   - Overview tab: scenario details, edit link
   - Estudiantes tab:
     - Generate join code → share with students
     - Invite by email (individual or bulk)
     - View enrolled students (name, email, status)
     - Delete student sessions
   - Toggle "isStarted" to open simulation for students
5. Monitor progress:
   - View each student's session status
   - View student conversation histories
   - Access scenario-specific analytics
   - Generate AI-powered aggregate themes across all students
```

### Super Admin Flow

```
1. Authenticate → Enter super admin code → Role assigned with isSuperAdmin
2. Access everything professors can access, plus:
   - Settings page: System-wide configuration
   - AI Cost Dashboard: Token usage, costs, provider breakdowns
   - Default Agent Prompts: Edit system-wide agent behavior
   - LLM Provider Management: Add/edit/disable providers
   - Bug Reports: Triage user-submitted issues
   - Role Switcher: View platform as student or professor
   - Delete any session from any scenario (regardless of ownership)
```

---

## Appendix: Architecture Decision Records

### Why Multi-Agent Instead of Single LLM Call?

Each agent has a specialized, constrained task. This produces:
- More consistent output (smaller, focused prompts perform better than mega-prompts).
- Parallel execution (Evaluator + Domain Expert run simultaneously).
- Independent tunability (change the narrator's tone without affecting scoring logic).
- Better error isolation (if the narrator fails, the Domain Expert's calculations are still valid).

### Why Stateful World, Stateless Agents?

- Agents don't need memory — they receive full context on each call.
- Any agent call can be retried on a different provider without side effects.
- Simulation state is always the database, not split across agent memories.
- Makes the system resilient to partial failures.

### Why Multi-Provider LLM Architecture?

- No single provider can guarantee 100% uptime.
- Cost optimization: Use free Replit proxies when available, fall back to paid APIs.
- Capacity: During peak usage (e.g., 30 students simultaneously), a single provider's rate limits would be insufficient.
- The 165-slot system with automatic failover can handle dozens of concurrent simulations without queuing.

### Why 3 Decisions + Reflection?

- **Decision 1 (Strategic)**: Establishes the student's initial orientation via MCQ. Low friction entry point.
- **Decision 2 (Analytical)**: Requires written justification. Forces deeper thinking.
- **Decision 3 (Integrative)**: Must reference previous choices. Tests ability to synthesize.
- **Reflection (Step 4)**: Post-decision metacognition. Students analyze their own reasoning process.

This structure mirrors Bloom's taxonomy progression: Knowledge → Analysis → Synthesis → Evaluation.

### Why Direction-Aware Indicators?

Some indicators are "better when higher" (Team Morale) and others are "better when lower" (Operational Risk). Without directionality:
- A -5 delta on "Operational Risk" would show as red (negative), when it's actually an improvement.
- The `direction` field (`up_better` / `down_better`) ensures the UI correctly colors deltas green for improvements and red for deterioration, regardless of the mathematical sign.
