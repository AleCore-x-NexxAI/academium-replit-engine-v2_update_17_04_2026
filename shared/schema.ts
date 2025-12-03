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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["student", "professor", "admin"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "abandoned"]);
export const narrativeMoodEnum = pgEnum("narrative_mood", ["neutral", "positive", "negative", "crisis"]);

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scenarios table - The Blueprints created by professors
export const scenarios = pgTable("scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  domain: varchar("domain", { length: 100 }).notNull(), // e.g., 'Marketing', 'Ethics', 'HR'
  initialState: jsonb("initial_state").$type<InitialState>().notNull(),
  rubric: jsonb("rubric").$type<Rubric>(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  scenarios: many(scenarios),
  simulationSessions: many(simulationSessions),
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

// TypeScript interfaces for JSONB columns
export interface KPIs {
  revenue: number;
  morale: number;
  reputation: number;
  efficiency: number;
  trust: number;
}

export interface InitialState {
  kpis: KPIs;
  introText: string;
  role: string;
  objective: string;
  caseStudyUrl?: string;
}

export interface RubricCriterion {
  name: string;
  description: string;
  weight: number;
}

export interface Rubric {
  criteria: RubricCriterion[];
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
  history: HistoryEntry[];
  flags: string[];
  rubricScores: Record<string, number>;
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

export interface TurnResponse {
  narrative: NarrativeResponse;
  kpiUpdates: Record<string, KPIUpdate>;
  feedback: FeedbackResponse;
  options?: string[];
  isGameOver: boolean;
  competencyScores?: Record<string, number>;
}

export interface ScoreSummary {
  finalKpis: KPIs;
  competencies: Record<string, number>;
  overallScore: number;
  feedback: string;
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Scenario = typeof scenarios.$inferSelect;
export type InsertSimulationSession = z.infer<typeof insertSimulationSessionSchema>;
export type SimulationSession = typeof simulationSessions.$inferSelect;
export type InsertTurn = z.infer<typeof insertTurnSchema>;
export type Turn = typeof turns.$inferSelect;
