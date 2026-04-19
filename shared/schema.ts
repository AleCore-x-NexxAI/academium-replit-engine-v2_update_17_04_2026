import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["student", "professor", "admin"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "abandoned"]);
export const narrativeMoodEnum = pgEnum("narrative_mood", ["neutral", "positive", "negative", "crisis"]);
export const draftStatusEnum = pgEnum("draft_status", ["gathering", "generating", "reviewing", "published", "abandoned"]);
export const bugReportStatusEnum = pgEnum("bug_report_status", ["new", "reviewed", "resolved", "dismissed"]);
export const turnEventTypeEnum = pgEnum("turn_event_type", ["input_rejected", "input_accepted", "agent_call", "turn_completed", "turn_error"]);

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Users table - integrated with Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default("student").notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  viewingAs: userRoleEnum("viewing_as"),
  language: varchar("language", { length: 2 }).default("es").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supported LLM models
export type LLMModel = "gpt-4o" | "gpt-4o-mini" | "gpt-3.5-turbo";

// Agent prompts configuration per scenario
/**
 * PedagogicalIntent — what the professor wants students to learn.
 * Distinct from case content. Intent is the INPUT driving case generation,
 * framework inference (Phase 4), and runtime calibration (Phase 6).
 * Stored on scenarios.pedagogical_intent. Editable only when scenario has
 * zero sessions (PATCH returns 423 Locked otherwise).
 *
 * Reference: Milestone Packet v3.0 — Apéndice C.
 */
export interface PedagogicalIntent {
  teachingGoal: string;
  targetFrameworks: Array<{
    canonicalId: string | null;
    name: string;
  }>;
  targetCompetencies: Array<"C1" | "C2" | "C3" | "C4" | "C5">;
  decisionDimensions?: Array<{
    decisionNumber: number;
    primaryDimension: AcademicDimension;
    secondaryDimension?: AcademicDimension;
  }>;
  courseContext?: string;
  reasoningConstraint?: string;
}

export type AcademicDimension =
  | "analytical" | "strategic" | "stakeholder"
  | "ethical" | "tradeoff";

export const DIMENSION_TO_SIGNAL: Record<AcademicDimension, string> = {
  analytical: "justification",
  strategic: "intent",
  stakeholder: "stakeholderAwareness",
  ethical: "ethicalAwareness",
  tradeoff: "tradeoffAwareness",
};

export const DIMENSION_TO_COMPETENCY: Record<AcademicDimension, "C1" | "C2" | "C3" | "C4" | "C5"> = {
  analytical: "C1",
  strategic: "C2",
  stakeholder: "C3",
  ethical: "C4",
  tradeoff: "C5",
};

export interface AgentPrompts {
  narrator?: string;       // Custom narrator system prompt
  evaluator?: string;      // Custom evaluator system prompt
  domainExpert?: string;   // Custom domain expert system prompt
  director?: string;       // Custom director/intent interpreter prompt
}

// Scenarios table - The Blueprints created by professors
export const scenarios = pgTable("scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  domain: varchar("domain", { length: 100 }).notNull(), // e.g., 'Marketing', 'Ethics', 'HR'
  initialState: jsonb("initial_state").$type<InitialState>().notNull(),
  rubric: jsonb("rubric").$type<Rubric>(),
  llmModel: varchar("llm_model", { length: 50 }).default("gpt-4o"), // LLM model for this scenario
  agentPrompts: jsonb("agent_prompts").$type<AgentPrompts>(), // Custom agent prompts (optional)
  // Phase 3 (Apéndice C): professor's pedagogical intent for this scenario.
  // Drives Phase 4 framework inference, Phase 5 theory-anchored generation,
  // and Phase 6 reasoning calibration. Editable only when scenario has zero
  // sessions; PATCH returns 423 (Locked) otherwise.
  pedagogicalIntent: jsonb("pedagogical_intent").$type<PedagogicalIntent>(),
  isPublished: boolean("is_published").default(false).notNull(),
  isStarted: boolean("is_started").default(false).notNull(), // Professor controls when students can start
  isGlobalDemo: boolean("is_global_demo").default(false).notNull(), // Global demo visible to all students
  joinCode: varchar("join_code", { length: 10 }), // Kahoot-style join code for students
  courseConcepts: text("course_concepts").array(), // Course concept tags (3-8 tags) for analytics
  language: varchar("language", { length: 5 }).default("es").notNull(), // "es" (Spanish) or "en" (English)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Student Enrollments table - Tracks which students are in which simulations
export const studentEnrollments = pgTable("student_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").references(() => users.id).notNull(),
  scenarioId: varchar("scenario_id").references(() => scenarios.id).notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  enrolledVia: varchar("enrolled_via", { length: 20 }).default("email").notNull(), // "email" | "code"
});

// Simulation Sessions table - Active simulations
export const simulationSessions = pgTable("simulation_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  scenarioId: varchar("scenario_id").references(() => scenarios.id).notNull(),
  currentState: jsonb("current_state").$type<SimulationState>().notNull(),
  status: sessionStatusEnum("status").default("active").notNull(),
  scoreSummary: jsonb("score_summary").$type<ScoreSummary>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Turns table - The history log
export const turns = pgTable("turns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => simulationSessions.id).notNull(),
  turnNumber: integer("turn_number").notNull(),
  studentInput: text("student_input").notNull(),
  agentResponse: jsonb("agent_response").$type<TurnResponse>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scenario Drafts table - AI-assisted scenario creation
export const scenarioDrafts = pgTable("scenario_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  status: draftStatusEnum("status").default("gathering").notNull(),
  sourceInput: text("source_input"), // Original text/prompt from professor
  sourceFileUrl: varchar("source_file_url"), // URL to uploaded PDF/document
  extractedInsights: jsonb("extracted_insights").$type<ExtractedInsights>(),
  generatedScenario: jsonb("generated_scenario").$type<GeneratedScenarioData>(),
  conversationHistory: jsonb("conversation_history").$type<DraftConversationMessage[]>().default([]),
  publishedScenarioId: varchar("published_scenario_id").references(() => scenarios.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bug Reports table - MVP feedback collection
export const bugReports = pgTable("bug_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  pageUrl: varchar("page_url"),
  browserInfo: varchar("browser_info"),
  screenshot: text("screenshot"), // Base64 encoded screenshot
  status: bugReportStatusEnum("status").default("new").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// LLM Providers table - Superadmin-managed API configurations
// Note: API keys are stored in Replit Secrets (not in DB). Provider type determines which env var to use.
export const llmProviders = pgTable("llm_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(), // Display name e.g., "OpenAI GPT-4o"
  provider: varchar("provider", { length: 50 }).notNull(), // e.g., "openai", "anthropic", "google"
  modelId: varchar("model_id", { length: 100 }).notNull(), // API model ID e.g., "gpt-4o", "claude-3-opus"
  description: text("description"), // Optional description of model capabilities
  isEnabled: boolean("is_enabled").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(), // Default model for new scenarios
  sortOrder: integer("sort_order").default(0).notNull(), // Display order in dropdowns
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  scenarios: many(scenarios),
  simulationSessions: many(simulationSessions),
  bugReports: many(bugReports),
  enrollments: many(studentEnrollments),
}));

export const studentEnrollmentsRelations = relations(studentEnrollments, ({ one }) => ({
  student: one(users, {
    fields: [studentEnrollments.studentId],
    references: [users.id],
  }),
  scenario: one(scenarios, {
    fields: [studentEnrollments.scenarioId],
    references: [scenarios.id],
  }),
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
}));

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
  author: one(users, {
    fields: [scenarios.authorId],
    references: [users.id],
  }),
  simulationSessions: many(simulationSessions),
}));

export const simulationSessionsRelations = relations(simulationSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [simulationSessions.userId],
    references: [users.id],
  }),
  scenario: one(scenarios, {
    fields: [simulationSessions.scenarioId],
    references: [scenarios.id],
  }),
  turns: many(turns),
}));

export const turnsRelations = relations(turns, ({ one }) => ({
  session: one(simulationSessions, {
    fields: [turns.sessionId],
    references: [simulationSessions.id],
  }),
}));

export const scenarioDraftsRelations = relations(scenarioDrafts, ({ one }) => ({
  author: one(users, {
    fields: [scenarioDrafts.authorId],
    references: [users.id],
  }),
  publishedScenario: one(scenarios, {
    fields: [scenarioDrafts.publishedScenarioId],
    references: [scenarios.id],
  }),
}));

// TypeScript interfaces for JSONB columns
export interface KPIs {
  revenue: number;
  morale: number;
  reputation: number;
  efficiency: number;
  trust: number;
}

// Decision point configuration for structured simulations
export interface TradeoffSignature {
  dimension: string;
  cost: string;
  benefit: string;
}

export interface DecisionPoint {
  number: number;
  format: "multiple_choice" | "written";
  prompt: string;
  options?: string[];
  requiresJustification: boolean;
  includesReflection: boolean;
  focusCue?: string;
  thinkingScaffold?: string[];
  depthStrictness?: "lenient" | "standard" | "strict";
  tradeoffSignature?: TradeoffSignature;
  optionSignatures?: Record<string, TradeoffSignature>;
}

// POC Indicator - Constitution Section 9: each indicator has name, definition, directionality, and tooltip
export interface Indicator {
  id: string;
  label: string;
  value: number; // 0-100 or absolute
  description?: string;
  // S8.1: Directionality - tells students what "good" looks like
  direction?: "up_better" | "down_better"; // ↑ mejor or ↓ mejor
}

export const CANONICAL_KPIS_ES: Indicator[] = [
  { id: "K1", label: "Presupuesto / Impacto Financiero", value: 50, direction: "up_better" },
  { id: "K2", label: "Moral del Equipo", value: 50, direction: "up_better" },
  { id: "K3", label: "Reputación de Marca", value: 50, direction: "up_better" },
  { id: "K4", label: "Eficiencia Operativa", value: 50, direction: "up_better" },
  { id: "K5", label: "Confianza de Stakeholders", value: 50, direction: "up_better" },
];
export const CANONICAL_KPIS_EN: Indicator[] = [
  { id: "K1", label: "Budget / Financial Impact", value: 50, direction: "up_better" },
  { id: "K2", label: "Team Morale", value: 50, direction: "up_better" },
  { id: "K3", label: "Brand Reputation", value: 50, direction: "up_better" },
  { id: "K4", label: "Operational Efficiency", value: 50, direction: "up_better" },
  { id: "K5", label: "Stakeholder Trust", value: 50, direction: "up_better" },
];
export function getCanonicalKPIs(language: "es" | "en" = "es"): Indicator[] {
  return language === "en" ? CANONICAL_KPIS_EN.map(k => ({ ...k })) : CANONICAL_KPIS_ES.map(k => ({ ...k }));
}
export const CANONICAL_KPIS: Indicator[] = [
  { id: "K1", label: "Presupuesto / Impacto Financiero", value: 50, direction: "up_better" },
  { id: "K2", label: "Moral del Equipo", value: 50, direction: "up_better" },
  { id: "K3", label: "Reputación de Marca", value: 50, direction: "up_better" },
  { id: "K4", label: "Eficiencia Operativa", value: 50, direction: "up_better" },
  { id: "K5", label: "Confianza de Stakeholders", value: 50, direction: "up_better" },
];

export interface InitialState {
  // POC KPI Configuration - use indicators instead of legacy KPIs
  indicators?: Indicator[]; // New POC-style indicators (team morale, budget impact, etc.)
  kpis: KPIs; // Legacy - kept for backward compatibility
  customKpis?: CustomKPI[]; // Optional additional KPIs beyond the 5 defaults
  
  // Decision structure configuration
  decisionPoints?: DecisionPoint[]; // Configurable decision sequence
  totalDecisions?: number; // Default: 3 for POC
  
  introText: string;
  role: string;
  objective: string;
  caseStudyUrl?: string;
  
  // Canonical Case Structure (Harvard Business School style)
  caseContext?: string; // 120-180 word professional case context
  coreChallenge?: string; // The central business challenge
  reflectionPrompt?: string; // Final reflection prompt after all decisions
  
  // Enhanced scenario context for AI tailoring
  companyName?: string;
  industry?: string;
  companySize?: string; // "startup", "small", "medium", "large", "enterprise"
  situationBackground?: string; // Detailed background on the crisis/situation
  stakeholders?: Stakeholder[];
  keyConstraints?: string[]; // Budget limits, time pressure, regulations, etc.
  learningObjectives?: string[]; // What students should learn
  difficultyLevel?: "beginner" | "intermediate" | "advanced";
  timelineContext?: string; // "immediate crisis", "3-month project", etc.
  ethicalDimensions?: string[]; // Ethical considerations in this scenario (legacy, kept for backward compat)
  industryContext?: string; // Specific industry dynamics
  competitiveEnvironment?: string;
  resourceConstraints?: string;
  culturalContext?: string;
  regulatoryEnvironment?: string;
  
  // Subject matter context for Domain Expert
  subjectMatterContext?: string; // Expert knowledge context for this scenario
  
  hintButtonEnabled?: boolean;
  maxHintsPerTurn?: 1 | 2 | 3 | 4 | 5;
  frameworks?: CaseFramework[];
  // Phase 2 (§4.5) one-time migration guard. When true, the canonical
  // framework migration has already processed this scenario and we skip it
  // in O(1) on subsequent boots.
  _phase2MigrationDone?: boolean;
}

export type FrameworkPrimaryDimension =
  | "analytical"
  | "strategic"
  | "tradeoff"
  | "stakeholder"
  | "ethical";

export interface CaseFramework {
  id: string;
  name: string;
  domainKeywords: string[];
  signalPattern?: {
    requiredSignals: Array<"intent" | "justification" | "tradeoffAwareness" | "stakeholderAwareness" | "ethicalAwareness">;
    minQuality: "WEAK" | "PRESENT" | "STRONG";
    additionalKeywords?: string[];
  };
  // Phase 2 (v3.0 §4.5 + v2.0 §7): canonical registry alignment.
  canonicalId?: string;
  aliases?: string[];
  coreConcepts?: string[];
  conceptualDescription?: string;
  recognitionSignals?: string[];
  primaryDimension?: FrameworkPrimaryDimension;
  provenance?: "explicit" | "inferred";
  inference_reason?: string;
  accepted_by_professor?: boolean;
  accepted_at?: string;
}

export interface FrameworkDetection {
  framework_id: string;
  framework_name: string;
  level: "explicit" | "implicit" | "not_evidenced";
  evidence: string;
  // Phase 2 (v3.0 §6.2 / Apéndice D.2): required fields. The 5th detection_method
  // value "consistency_promoted" is set by checkConsistency (§12.3).
  confidence: "high" | "medium" | "low";
  detection_method: "keyword" | "semantic" | "signal_pattern" | "none" | "consistency_promoted";
  reasoning: string;
  canonicalId: string;
}

export interface DashboardSummary {
  session_headline: string;
  signal_averages: {
    analytical: number;
    strategic: number;
    tradeoff: number;
    stakeholder: number;
    ethical: number;
  };
  framework_summary: Array<{
    framework_id: string;
    best_level: "explicit" | "implicit" | "not_evidenced";
    turn_of_best_application: number | null;
    // Phase 1c (Section 6.2): aggregate counts and provenance per framework.
    // Lazily backfilled at dashboard read-time when missing.
    explicit_turns?: number;
    implicit_turns?: number;
    not_evidenced_turns?: number;
    framework_name?: string;
    canonicalId?: string;
    provenance?: "course_target" | "inferred" | "consistency_promoted";
    detection_method_distribution?: {
      keyword?: number;
      semantic?: number;
      signal_pattern?: number;
      none?: number;
      consistency_promoted?: number;
    };
  }>;
  // Phase 1a: explicit generation status. "ok" = LLM headline succeeded;
  // "fallback" = deterministic headline (LLM threw); "regenerated" = produced
  // by /regenerate-summary. UI uses this to expose retry affordances.
  generation_status?: "ok" | "fallback" | "regenerated";
}

export interface Stakeholder {
  name: string;
  role: string;
  interests: string;
  influence: "low" | "medium" | "high";
}

export interface RubricCriterion {
  name: string;
  description: string;
  weight: number;
}

export interface RubricAttachment {
  name: string;
  url: string;
  size?: number;
}

export interface Rubric {
  criteria: RubricCriterion[];
  attachment?: RubricAttachment; // Optional uploaded rubric document
}

// Custom KPI for optional additional metrics
export interface CustomKPI {
  id: string; // Unique identifier
  label: string; // Display name
  value: number; // Initial value
  unit: "percentage" | "absolute" | "currency"; // How to display
  description?: string;
}

export interface HistoryEntry {
  role: "system" | "user" | "npc";
  content: string;
  speaker?: string;
  timestamp: string;
}

export interface SignalScoreEntry {
  quality: 0 | 1 | 2 | 3;
  extracted_text: string;
  // Phase 1c (Section 6.5): optional fields. Phase 4 will populate.
  confidence?: "high" | "medium" | "low";
  marginal_evidence?: string;
}

export interface SignalExtractionEntry {
  intent: SignalScoreEntry;
  justification: SignalScoreEntry;
  tradeoffAwareness: SignalScoreEntry;
  stakeholderAwareness: SignalScoreEntry;
  ethicalAwareness: SignalScoreEntry;
}

export type EvidenceLevelEntry = "demonstrated" | "emerging" | "not_evidenced";

export interface CompetencyEvidenceEntry {
  C1: EvidenceLevelEntry;
  C2: EvidenceLevelEntry;
  C3: EvidenceLevelEntry;
  C4: EvidenceLevelEntry;
  C5: EvidenceLevelEntry;
}

export interface DecisionEvidenceLogEntry {
  signals_detected: SignalExtractionEntry;
  rds_score: number | null;
  rds_band: "SURFACE" | "ENGAGED" | "INTEGRATED" | null;
  competency_evidence: CompetencyEvidenceEntry;
  raw_signal_scores: {
    intent: number;
    justification: number;
    tradeoffAwareness: number;
    stakeholderAwareness: number;
    ethicalAwareness: number;
  };
  isMcq?: boolean;
  student_input?: string;
  classification?: "PASS" | "NUDGE" | "BLOCK";
  evidence_quotes?: Partial<Record<"C1" | "C2" | "C3" | "C4" | "C5", string>>;
  turn_number?: number;
}

export interface IndicatorAccumulationEntry {
  trajectory: "positive" | "negative" | "mixed" | "neutral";
  consecutiveNegativeTurns: number;
  consecutivePositiveTurns: number;
  lastTier: 1 | 2 | 3 | null;
  totalMovements: number;
  firstAppearanceTurn: number | null;
}

export interface DisplayKPIEntry {
  indicatorId: string;
  label: string;
  direction: "up" | "down";
  magnitude: "Ligero" | "Moderado" | "Significativo";
  magnitudeEn: "Slight" | "Moderate" | "Significant";
  tier: 1 | 2 | 3;
  delta: number;
  shortReason: string;
  dashboard_reasoning_link?: string;
}

export interface CausalExplanationEntry {
  indicatorId: string;
  decisionReference: string;
  causalMechanism: string;
  directionalConnection: string;
}

export interface SimulationState {
  turnCount: number;
  kpis: KPIs;
  indicators?: Indicator[];
  history: HistoryEntry[];
  flags: string[];
  rubricScores: Record<string, number>;
  currentDecision?: number;
  isComplete?: boolean;
  isReflectionStep?: boolean;
  reflectionCompleted?: boolean;
  pendingRevision?: boolean;
  revisionAttempts?: number;
  lastStudentInput?: string;
  decisionEvidenceLogs?: DecisionEvidenceLogEntry[];
  nudgeCounters?: Record<number, number>;
  integrityFlags?: boolean[];
  indicatorAccumulation?: Record<string, IndicatorAccumulationEntry>;
  hintCounters?: Record<number, number>;
  lastTurnNarrative?: string;
  framework_detections?: FrameworkDetection[][];
  dashboard_summary?: DashboardSummary;
}

export interface NarrativeResponse {
  text: string;
  speaker?: string;
  mood: "neutral" | "positive" | "negative" | "crisis";
}

export interface KPIUpdate {
  value: number;
  delta: number;
}

export interface FeedbackResponse {
  score: number;
  message: string;
  hint?: string;
}

// POC Metric Explainability - "Why?" feature
export interface MetricExplanation {
  shortReason: string; // One-line visible explanation e.g., "Moral +4: el equipo valora la calidad"
  causalChain: string[]; // 2-4 bullet expandable explanation chain
  tier: 1 | 2 | 3; // Magnitude tier (1: ±1-3, 2: ±4-7, 3: ±8-12)
}

export interface TurnResponse {
  narrative: NarrativeResponse;
  kpiUpdates: Record<string, KPIUpdate>;
  indicatorDeltas?: Record<string, number>;
  feedback: FeedbackResponse;
  options?: string[];
  isGameOver: boolean;
  competencyScores?: Record<string, number>;
  turnStatus?: "pass" | "nudge" | "block";
  requiresRevision?: boolean;
  revisionPrompt?: string;
  revisionAttempt?: number;
  maxRevisions?: number;
  metricExplanations?: Record<string, MetricExplanation>;
  displayKPIs?: DisplayKPIEntry[];
  causalExplanations?: CausalExplanationEntry[];
  decisionAcknowledgment?: string;
  dashboard_debrief_question?: string;
  framework_detections?: FrameworkDetection[];
  updatedState?: SimulationState;
}

export interface ScoreSummary {
  finalKpis: KPIs;
  competencies: Record<string, number>;
  overallScore: number;
  feedback: string;
}

// AI Authoring Assistant types
export interface ExtractedInsights {
  summary: string;
  businessContext: string;
  keyCharacters: string[];
  potentialChallenges: string[];
  learningOpportunities: string[];
  suggestedDomain: string;
  suggestedDifficulty: "beginner" | "intermediate" | "advanced";
}

export interface GeneratedScenarioData {
  title: string;
  description: string;
  domain: string;
  initialState: InitialState;
  rubric: Rubric;
  isComplete: boolean;
  confidence: number; // 0-100 - how confident the AI is about this scenario
  courseConcepts?: string[];
  // Phase 3 (Apéndice C): pedagogical intent forwarded from generation through publish.
  pedagogicalIntent?: PedagogicalIntent;
}

export interface DraftConversationMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  metadata?: {
    type: "question" | "refinement" | "preview" | "confirmation";
    fieldContext?: string; // Which field this relates to
  };
}

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Phase 3 (Apéndice C): runtime validation for PedagogicalIntent.
export const academicDimensionSchema = z.enum([
  "analytical", "strategic", "stakeholder", "ethical", "tradeoff",
]);

export const targetFrameworkSchema = z.object({
  canonicalId: z.string().nullable(),
  name: z.string().min(1),
});

export const decisionDimensionSchema = z.object({
  decisionNumber: z.number().int().min(1),
  primaryDimension: academicDimensionSchema,
  secondaryDimension: academicDimensionSchema.optional(),
});

export const pedagogicalIntentSchema = z.object({
  teachingGoal: z.string().min(1),
  targetFrameworks: z.array(targetFrameworkSchema).default([]),
  targetCompetencies: z.array(z.enum(["C1", "C2", "C3", "C4", "C5"])).default([]),
  decisionDimensions: z.array(decisionDimensionSchema).optional(),
  courseContext: z.string().optional(),
  reasoningConstraint: z.string().optional(),
});

// PATCH accepts partials; teachingGoal cannot be cleared once set.
export const pedagogicalIntentPatchSchema = pedagogicalIntentSchema.partial();

export const insertScenarioSchema = createInsertSchema(scenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSimulationSessionSchema = createInsertSchema(simulationSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTurnSchema = createInsertSchema(turns).omit({
  id: true,
  createdAt: true,
});

export const insertScenarioDraftSchema = createInsertSchema(scenarioDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBugReportSchema = createInsertSchema(bugReports).omit({
  id: true,
  createdAt: true,
});

export const insertLlmProviderSchema = createInsertSchema(llmProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// LLM Usage Logs - AI cost tracking
export const llmUsageLogs = pgTable("llm_usage_logs", {
  id: serial("id").primaryKey(),
  provider: varchar("provider").notNull(),
  model: varchar("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  costUsd: varchar("cost_usd").notNull(),
  agentName: varchar("agent_name"),
  sessionId: integer("session_id"),
  userId: varchar("user_id"),
  durationMs: integer("duration_ms"),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_llm_usage_created").on(table.createdAt),
  index("idx_llm_usage_provider").on(table.provider),
  index("idx_llm_usage_session").on(table.sessionId),
]);

export const insertLlmUsageLogSchema = createInsertSchema(llmUsageLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertLlmUsageLog = z.infer<typeof insertLlmUsageLogSchema>;
export type LlmUsageLog = typeof llmUsageLogs.$inferSelect;

export const turnEvents = pgTable("turn_events", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").references(() => simulationSessions.id).notNull(),
  userId: varchar("user_id"),
  eventType: turnEventTypeEnum("event_type").notNull(),
  turnNumber: integer("turn_number"),
  rawStudentInput: text("raw_student_input"),
  eventData: jsonb("event_data").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_turn_events_session").on(table.sessionId),
  index("idx_turn_events_type").on(table.eventType),
  index("idx_turn_events_created").on(table.createdAt),
]);

export const turnEventsRelations = relations(turnEvents, ({ one }) => ({
  session: one(simulationSessions, {
    fields: [turnEvents.sessionId],
    references: [simulationSessions.id],
  }),
}));

export const insertTurnEventSchema = createInsertSchema(turnEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertTurnEvent = z.infer<typeof insertTurnEventSchema>;
export type TurnEvent = typeof turnEvents.$inferSelect;

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Scenario = typeof scenarios.$inferSelect;
export type InsertSimulationSession = z.infer<typeof insertSimulationSessionSchema>;
export type SimulationSession = typeof simulationSessions.$inferSelect;
export type InsertTurn = z.infer<typeof insertTurnSchema>;
export type Turn = typeof turns.$inferSelect;
export type InsertScenarioDraft = z.infer<typeof insertScenarioDraftSchema>;
export type ScenarioDraft = typeof scenarioDrafts.$inferSelect;
export type InsertBugReport = z.infer<typeof insertBugReportSchema>;
export type BugReport = typeof bugReports.$inferSelect;
export type InsertLlmProvider = z.infer<typeof insertLlmProviderSchema>;
export type LlmProvider = typeof llmProviders.$inferSelect;

export const insertStudentEnrollmentSchema = createInsertSchema(studentEnrollments).omit({
  id: true,
  enrolledAt: true,
});
export type InsertStudentEnrollment = z.infer<typeof insertStudentEnrollmentSchema>;
export type StudentEnrollment = typeof studentEnrollments.$inferSelect;

// Re-export chat models for Gemini integration
export * from "./models/chat";
