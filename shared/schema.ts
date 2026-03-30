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
export interface DecisionPoint {
  number: number; // 1, 2, 3, etc.
  format: "multiple_choice" | "written"; // Input format
  prompt: string; // The decision prompt/question
  options?: string[]; // For multiple_choice format
  requiresJustification: boolean; // Whether student must explain their reasoning
  includesReflection: boolean; // Whether to prompt for reflection after consequences
  // S7.1: Focus cue to help students orient their thinking (2-3 key dimensions)
  focusCue?: string; // e.g., "Considera el impacto en el equipo, los plazos y el riesgo."
  // S5.1: Thinking scaffold - 2-3 bullets to guide reasoning (NO answers, NO best practices)
  thinkingScaffold?: string[]; // e.g., ["Impacto en el equipo", "Riesgo vs velocidad", "Consecuencias a corto vs largo plazo"]
  // S5/S6.2: Professor-configured depth strictness per decision
  depthStrictness?: "lenient" | "standard" | "strict";
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

export interface SimulationState {
  turnCount: number;
  kpis: KPIs;
  indicators?: Indicator[]; // POC-style indicators
  history: HistoryEntry[];
  flags: string[];
  rubricScores: Record<string, number>;
  currentDecision?: number; // Which decision point we're on (1, 2, 3, etc.)
  isComplete?: boolean; // Whether all decisions have been made
  // S9.1: Reflection as separate Step 4 (post-case)
  isReflectionStep?: boolean; // True when all 3 decisions are done, waiting for reflection
  reflectionCompleted?: boolean; // True after student submits reflection
  // Weak answer revision tracking
  pendingRevision?: boolean; // Whether we're waiting for a revision
  revisionAttempts?: number; // How many times student has revised current decision
  lastStudentInput?: string; // Original input before revision
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
  // S14/S6: Explicit turn status
  turnStatus?: "pass" | "nudge" | "block";
  // Weak answer handling (kept for backward compat)
  requiresRevision?: boolean;
  revisionPrompt?: string;
  revisionAttempt?: number;
  maxRevisions?: number;
  // POC "Why?" Explainability
  metricExplanations?: Record<string, MetricExplanation>;
  // S9.1: Server state for reflection step tracking
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
