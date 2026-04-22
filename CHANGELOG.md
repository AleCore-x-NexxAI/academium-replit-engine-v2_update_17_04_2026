# Changelog

All notable changes to Academium are documented here. Sections refer to
*Milestone Packet v3.0* unless otherwise noted.

## [Unreleased] — v3.0 milestone candidate

### Pending before tag
- **Gate 14.10 (end-to-end milestone test)** — must be executed manually in
  the UI per Section 14.10's 12 acceptance criteria. Once the run is
  archived, this section is replaced by `## [v3.0-milestone] — YYYY-MM-DD`.

### Fixed — T-002A: semantic framework detection reliability (Task #80)
- `server/agents/frameworkDetector.ts` — three targeted fixes:
  - **Substring normalisation guard**: anti-hallucination quote check now compares
    both sides after NFKC, lowercase, smart-quote fold, dash fold, whitespace
    collapse and leading/trailing punctuation strip.  Valid LLM quotes that differ
    only by capitalisation, smart quotes or trailing punctuation are no longer
    incorrectly rejected as hallucinations.
  - **Registry hydration**: before building the semantic prompt, any framework
    missing `conceptualDescription` or `recognitionSignals` is hydrated from
    `getRegistryEntryById(canonicalId)`.  Frameworks with no rubric in either
    source skip the semantic tier and emit a structured `console.warn` (no silent
    `not_evidenced` anymore).
  - **Tier-1 keyword tightening**: only multi-word domain keywords now qualify as
    explicit Tier-1 triggers; single-word generic terms (`focus`, `positioning`,
    `niche`, etc.) are reserved for the Tier-3 signal-pattern fallback so they no
    longer pre-empt the semantic tier on vague matches.  Framework name and aliases
    remain Tier-1 triggers.  The sync backfill path mirrors this tightening.
  - **Observable failures**: JSON parse errors, empty `verdicts` arrays, and
    per-framework missing verdicts now emit a single structured `console.warn` per
    event (framework name + reason) instead of silently returning `not_evidenced`.
- `server/routes.ts` — new endpoint
  `POST /api/admin/scenarios/:scenarioId/redetect-frameworks` (professor + admin
  auth).  Uses the full async `detectFrameworks` path (Tier 1 + Tier 2 semantic +
  Tier 3) to rewrite `framework_detections` in `simulation_sessions.currentState`
  for all completed sessions.  Accepts `?sessionId=` to scope to one session and
  `?force=true` to reprocess sessions that already have detections.  Invalidates
  the dashboard cache on completion.
- `server/__tests__/frameworkDetection.regression.test.ts` — three T-002A
  regression cases added:
  - **(d)** normalisation guard: LLM-style smart-quoted / recapitalised quote must
    not trigger the hallucination rejection path.
  - **(e)** registry hydration: a `CaseFramework` with no `conceptualDescription`
    / `recognitionSignals` but a valid `canonicalId` must hydrate from the registry
    and still have the semantic tier fire.
  - **(f)** no-rubric skip: a framework with no rubric and no `canonicalId` must
    not crash; it falls through to `not_evidenced` with a structured warning.

### Added — Section 14 verification scaffolding (Task #69)
- `server/__tests__/frameworkDetection.regression.test.ts` — Section 14.2
  Porter regression suite. Three live-LLM cases:
  - **(a) implicit:** three distinct focus-strategy turns without naming
    Porter; passes when `level=implicit`, `confidence ∈ {medium, high}`,
    `detection_method=semantic` on **≥2 of 3 turns** (verbatim §14.2).
  - **(b) explicit:** student names Porter / uses domain keyword →
    `level=explicit`, `confidence=high`, `detection_method=keyword`.
  - **(c) unrelated:** generic management talk → `level=not_evidenced`.
  - Fail-loud guard: `assert.fail` if neither `AI_INTEGRATIONS_OPENAI_API_KEY`
    + `AI_INTEGRATIONS_OPENAI_BASE_URL` nor `OPENAI_API_KEY` is present —
    the suite cannot pass without exercising the real LLM detector. Note:
    the multi-provider router may failover across providers; the suite
    asserts behavior of `detectFrameworks` end-to-end, not provider identity.
- `package.json` — `npm test` (runs `server/__tests__/**/*.test.ts` plus
  `server/agents/**/*.test.ts`) and `npm run validate-manifest`
  (Section 6.4 compatibility-manifest validator) scripts wired in.

### Fixed
- `client/src/pages/ScenarioDashboard.tsx` — eliminated 18 `TS18048`
  ("possibly undefined") diagnostics across `moduleHealth`, `depthTrajectory`
  and `classPatterns` render branches by tightening the outer truthy
  comparisons (`(x?.y?.length ?? 0) > 0`) and narrowing the inner branches.
  Four `TS2322` diagnostics on lines 939–942 (query-result variance) remain
  pre-existing and out of scope for Task #69.

---

## v3.0 phase history (in implementation order)

### Phase 1 — Foundation (Sections 3, 6, 12.6) — *merged*
Section 14.1 / 14.4 acceptance items closed. Compatibility manifest
established (`compatibility-manifest.json`) and validator script wired
(`scripts/validate-manifest.ts`, run via `npm run validate-manifest`).

### Phase 2 — Framework canonicalization & semantic detection (Sections 4, 5) — *merged*
- `server/agents/frameworkRegistry.ts` — 13 canonical entries (Porter,
  SWOT, PESTEL, BCG, Value Chain, RBV, Stakeholder, Cost-Benefit, BATNA,
  Blue Ocean, Ansoff, Balanced Scorecard) with bilingual `coreConcepts`,
  `conceptualDescription`, `recognitionSignals`.
- `frameworkDetector.ts` — three-tier detector
  (keyword → semantic → signal_pattern) with `level`, `confidence`,
  `detection_method`, `evidence`, `reasoning` on every output.
- `checkConsistency` — promote-only reconciliation between signal extractor
  and detector verdicts (`detection_method=consistency_promoted`).
- One-time legacy migration on boot (`_phase2MigrationDone` guard).

### Phase 3 — Pedagogical intent infrastructure (Section 8) — *merged*
- `pedagogical_intent` column + `PedagogicalIntent` schema.
- `GET`/`PATCH` `/api/scenarios/:id/pedagogical-intent` endpoints.
- Teaching Intent UI page; intent-echo surfaces across dashboard.
- Edit lock once any session exists.

### Phase 4 — Framework inference subsystem (Section 7) — *merged*
- `inferFrameworks` agent. Caps suggestions at 3, requires opt-in via
  `accepted_by_professor`. Inference disabled when ≥2 target frameworks
  already exist. `FrameworkEditor` UI surfaces "Suggested" badges with
  `inference_reason` tooltips.

### Phase 5 — Theory-anchored case generation (Sections 9, 10) — *merged*
- Generator extended with `targetFrameworkIds`, `primaryDimension`,
  `dimensionRationale` per `DecisionPoint`.
- Quality gates: dimension coverage ≥ ⌈stepCount × 0.66⌉, framework
  coverage on at least one decision, no consecutive same-dimension unless
  specified, full semantic-field completeness.
- Professor review checkpoint with regenerate-single-decision.
- Decision-design rules (stakeholder, tradeoff, analytical, strategic,
  ethical) auto-enforced.

### Phase 6 — Reasoning environment calibration (Section 11) — *merged*
- Narrator framework-responsive (no naming, coherent consequence chains).
- Signal extractor dimension-weighted with marginal-evidence promotion
  (cap PRESENT, never STRONG).
- Debrief generator intent-anchored.
- Dashboard summary intent-aware.
- Module Health target/suggested split with `detection_method_distribution`.

---

## Cohesion invariants — *do not regress* (Section 14.11)
- PASS / NUDGE / BLOCK classification logic unchanged.
- Five behavioral invariants respected end-to-end.
- Prohibited-language gates active on narrator, debrief, summary, module
  health descriptions, framework inference reasons, semantic check.
- Student text preserved verbatim across PASS / NUDGE / BLOCK.
- Compatibility manifest validates on every CI build.
- T-002 features intact: framework entry field, theory-shaped generation,
  decision continuity, edit-before-publish, reasoning arc rendering,
  session summary, debrief prep cards, KPI trajectory.
