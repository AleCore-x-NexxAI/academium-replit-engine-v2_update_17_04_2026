# Academium Engine: Multi-Agent Orchestration & Logic (Spec 02)

**Target Audience:** AI Coding Agent / JavaScript/TypeScript Developer
**Purpose:** Define the specific agents, their roles, model assignments, and the orchestration logic that governs their interaction during turn processing.
**Context:** All agents run as in-process JavaScript/TypeScript modules within the Express.js server (see Spec 01). No Python, no LangGraph, no separate microservice.

---

## 1. The Agent Roster

### A. InputValidator (`server/agents/inputValidator.ts`)
* **Role:** Gatekeeper — fast pre-filter before any main simulation processing.
* **Model:** Scenario's configured model (regex pre-check + LLM fallback).
* **Responsibility:** Block only truly problematic input: profanity/unsafe content, empty input, clear nonsense/spam (keyboard mashing), or completely off-topic responses with zero case connection.
* **Output:** `{ isValid: boolean, rejectionReason?, userMessage? }`
* **Key Rule:** No `needsElaboration` category — either accept or reject. When in doubt, always accept.

### B. SimulationDirector (`server/agents/director.ts`)
* **Role:** Intent Interpreter & Orchestrator.
* **Model:** `gpt-4o-mini` (hardcoded, not student-facing — optimized for latency).
* **Responsibility:** Receives student input, interprets intent maximally permissively, and coordinates the turn pipeline. Does not generate narrative directly — delegates to Narrator.
* **Output:** `{ isValid: boolean, interpretedAction?: string, helpfulPrompt?: string }`
* **Key Trait:** Extremely lenient — assumes positive intent, interprets creatively, transforms unclear input into actionable decisions. Only flags true gibberish or harmful content.

### C. CompetencyAssessor / Evaluator (`server/agents/evaluator.ts`)
* **Role:** Internal Grader (scores are for professor dashboard only, never shown to students).
* **Model:** `gpt-4o-mini` (hardcoded, not student-facing).
* **Responsibility:** Evaluates student decisions against four competency dimensions: Strategic Thinking, Ethical Reasoning, Decision Decisiveness, and Stakeholder Empathy.
* **Output:** `{ competencyScores: Record<string, 1-5>, feedback: { score, message, hint? }, flags: string[] }`
* **Key Rule:** Feedback messages are neutral observations, not evaluative judgments. Scores (1-5) are internal tracking only.

### D. BusinessLogicEngine / DomainExpert (`server/agents/domainExpert.ts`)
* **Role:** Subject Matter Expert & Impact Calculator.
* **Model:** Scenario's configured model (maxTokens: 768).
* **Responsibility:** Calculates realistic KPI/indicator impacts based on the student's decision, domain expertise, and scenario context. Enforces tiered impact system (Tier 1: ±3-6, Tier 2: ±7-12, Tier 3: ±13-20) and cost-of-opportunity rule (every decision must have at least one negative impact).
* **Output:** `{ indicatorDeltas, metricExplanations: { shortReason, tier }, reasoning, expertInsight }`
* **Key Detail:** Only returns `shortReason` during turn processing. Detailed `causalChain` is generated on-demand via `POST /api/simulations/:sessionId/explain` (lazy loading for performance).

### E. ScenarioWeaver / Narrator (`server/agents/narrator.ts`)
* **Role:** Consequence Narrator.
* **Model:** Scenario's configured model (maxTokens: 512).
* **Responsibility:** Generates consequence-focused narrative (60-100 words in Spanish). Shows what happened, stakeholder reactions, and forward pressure. Enforces compounding effects from previous decisions.
* **Output:** `{ text: string, mood: "neutral"|"positive"|"negative"|"crisis", suggestedOptions?: string[] }`
* **Key Rules:** No moralizing, no revealing optimal decisions, no drama — just consequences. Ethics emerge implicitly through effects on people, trust, and reputation.

### F. DepthEvaluator (`server/agents/depthEvaluator.ts`)
* **Role:** Response Quality Gatekeeper — checks if student's answer has sufficient depth.
* **Model:** `gpt-4o-mini` (hardcoded, not student-facing).
* **Responsibility:** Validates response depth based on professor-configured strictness per decision point. Checks for priority statement, case reference, and trade-off acknowledgment.
* **Strictness Levels (professor-configurable per decision point):**
  - `lenient`: Accept if >10 characters (no LLM call).
  - `standard`: Accept if at least 1 of 3 dimensions present (regex pre-check, LLM fallback).
  - `strict`: Require at least 2 of 3 dimensions (always uses LLM).
* **Output:** `{ isDeepEnough: boolean, revisionPrompt?, strengthsAcknowledged?, missingConsiderations? }`
* **Key Rule:** Max 1 revision request per decision point (MAX_REVISIONS = 1). After that, auto-accept.

### G. CanonicalCaseGenerator (`server/agents/canonicalCaseGenerator.ts`)
* **Role:** AI-Assisted Scenario Creator.
* **Model:** Scenario's configured model.
* **Responsibility:** Analyzes uploaded PDF case studies and generates complete scenario blueprints (Harvard Business School canonical structure) for professor review.
* **Output:** Complete `GeneratedScenarioData` JSON with title, description, domain, indicators, decision points, stakeholders, and rubric.

---

## 2. Model Assignment Summary

| Agent | Model | Rationale |
|-------|-------|-----------|
| Director | `gpt-4o-mini` (hardcoded) | Internal intent parsing — speed over quality |
| Evaluator | `gpt-4o-mini` (hardcoded) | Internal scoring — never student-facing |
| DepthEvaluator | `gpt-4o-mini` (hardcoded) | Internal depth check — speed critical |
| DomainExpert | Scenario's configured model | Student-facing quality matters; maxTokens: 768 |
| Narrator | Scenario's configured model | Student-facing narrative quality; maxTokens: 512 |
| InputValidator | Scenario's configured model | Nuanced relevance checking |
| CanonicalCaseGenerator | Scenario's configured model | Complex generation task |

---

## 3. Orchestration Flow (The "Turn" Logic — Parallelized)

When a student submits a decision via `POST /api/simulations/:sessionId/turn`:

### Phase 1: Concurrent Execution
Two pipelines run **simultaneously** using `Promise.all`:

**Pipeline A — Input Validation:**
- InputValidator performs regex pre-checks (profanity, nonsense, empty).
- If regex passes, InputValidator calls LLM for nuanced relevance check.

**Pipeline B — Agent Processing:**
- Director interprets student intent via LLM.
- If Director accepts, Evaluator + DomainExpert run **in parallel** (`Promise.all`).

### Phase 2: Validation Gate
- **If InputValidator rejects:** Discard all Pipeline B results. Return NUDGE or BLOCK to student immediately. Student text is preserved in the input field.
- **If InputValidator accepts:** Use Pipeline B results and proceed to Phase 3.

### Phase 3: Sequential Completion
1. **Narrator** generates consequence narrative using updated KPIs/indicators from DomainExpert.
2. **DepthEvaluator** checks if the response has sufficient analytical depth.
   - If insufficient and no prior revision: return NUDGE with revision prompt (max 1 per step).
   - If sufficient (or already revised once): proceed.
3. **DB Writes:** Turn record, turn events log, updated `SimulationState` JSONB.
4. **Response:** Full `TurnResponse` JSON returned to client.

### Turn Status System
Every turn response includes one of three statuses:
- **PASS:** Decision accepted, input locked, simulation proceeds to next step.
- **NUDGE:** Preserve student text, ask for elaboration. Max 1 nudge per decision point. Used for: insufficient depth (DepthEvaluator) or off-topic but not harmful (InputValidator).
- **BLOCK:** Reject outright. Used only for: spam, gibberish, profanity, or truly harmful content.

---

## 4. On-Demand Causal Chain (Lazy Explainability)

During turn processing, DomainExpert only computes `shortReason` for each indicator change (one-line explanation). The detailed `causalChain` (2-4 bullet explanation) is **not** computed during the turn to keep latency low.

When the student clicks "Why?" on an indicator:
1. Frontend calls `POST /api/simulations/:sessionId/explain` with the indicator ID and turn context.
2. Backend invokes DomainExpert with focused prompt to generate the causal chain.
3. Response includes the full `MetricExplanation` with `causalChain` array.

---

## 5. Prompt Engineering Strategy

### System Prompt Structure (All Agents)
All agents receive prompts in Spanish (Latinoamérica) with:
- `HARD_PROHIBITIONS`: Content safety guardrails (shared across all agents).
- `MENTOR_TONE`: Encouraging, non-judgmental coaching voice.
- `MISUSE_HANDLING`: How to handle attempts to manipulate the system.
- Agent-specific instructions and output JSON schema.

### Output Format
All agents output **structured JSON only** — no streaming, no markdown wrapping. Each agent has a defined JSON schema enforced via `responseFormat: "json"` in LLM calls.

### Guardrails (`server/agents/guardrails.ts`)
Shared constants defining:
- Hard prohibitions (violence, illegal activity, harassment).
- Mentor tone guidelines.
- Misuse handling patterns.

---

## 6. State Object Structure

The `SimulationState` is stored as JSONB in the `simulation_sessions.current_state` column:

```typescript
interface SimulationState {
  turnCount: number;
  kpis: KPIs;                        // Legacy 5 KPIs (revenue, morale, reputation, efficiency, trust)
  indicators?: Indicator[];           // Professor-defined indicators (id, label, value, direction)
  history: HistoryEntry[];            // Role-based messages (system, user, npc)
  flags: string[];                    // Behavioral flags (STRATEGIC_THINKER, RISK_AWARE, etc.)
  rubricScores: Record<string, number>;
  currentDecision?: number;           // Which decision point (1-based)
  isComplete?: boolean;               // All decisions made + game over
  isReflectionStep?: boolean;         // Waiting for post-case reflection
  reflectionCompleted?: boolean;      // Reflection submitted
  pendingRevision?: boolean;          // Waiting for student to revise weak answer
  revisionAttempts?: number;          // Count of revisions for current decision
  lastStudentInput?: string;          // Original input before revision
}
```

### Simulation Lifecycle
1. **Decision Points 1 through N** (N = 3-10, professor-configured): Student makes decisions, agents process turns.
2. **Reflection Step** (after all decisions): Loose validation (profanity/empty/spam only), student reflects on their experience.
3. **Completion:** Simulation marked as complete after reflection is submitted.

### KPI-Based Game Over
If any KPI drops below critical thresholds (morale/reputation/efficiency/trust < 20, revenue < 10000), the simulation ends early regardless of remaining decision points.

---

## 7. Turn Events Logging

Every interaction during turn processing is logged to the `turn_events` table for professor analytics:
- `input_rejected`: Rejected input with verbatim student text and validator reasoning.
- `input_accepted`: Accepted input.
- `agent_call`: Individual agent execution (director, evaluator, domainExpert, narrator, depthEvaluator) with outputs and duration.
- `turn_completed`: Turn completion summary.
- `turn_error`: Error during processing.
