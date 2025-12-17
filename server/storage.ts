import {
  users,
  scenarios,
  simulationSessions,
  turns,
  scenarioDrafts,
  type User,
  type UpsertUser,
  type Scenario,
  type InsertScenario,
  type SimulationSession,
  type InsertSimulationSession,
  type Turn,
  type InsertTurn,
  type SimulationState,
  type ScenarioDraft,
  type InsertScenarioDraft,
  type DraftConversationMessage,
  type ExtractedInsights,
  type GeneratedScenarioData,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface AnalyticsData {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  competencyAverages: Record<string, number>;
  scenarioBreakdown: { name: string; count: number }[];
  recentSessions: (SimulationSession & { scenario?: Scenario })[];
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: "student" | "professor" | "admin"): Promise<User | undefined>;

  getScenario(id: string): Promise<Scenario | undefined>;
  getPublishedScenarios(): Promise<Scenario[]>;
  getScenariosByAuthor(authorId: string): Promise<Scenario[]>;
  createScenario(scenario: InsertScenario): Promise<Scenario>;
  updateScenario(id: string, data: Partial<InsertScenario>): Promise<Scenario | undefined>;
  deleteScenario(id: string): Promise<void>;

  getSimulationSession(id: string): Promise<SimulationSession | undefined>;
  getSimulationSessionWithScenario(id: string): Promise<(SimulationSession & { scenario?: Scenario }) | undefined>;
  getUserSessions(userId: string): Promise<(SimulationSession & { scenario?: Scenario })[]>;
  createSimulationSession(session: InsertSimulationSession): Promise<SimulationSession>;
  updateSimulationSession(id: string, data: Partial<InsertSimulationSession>): Promise<SimulationSession | undefined>;

  getTurnsBySession(sessionId: string): Promise<Turn[]>;
  createTurn(turn: InsertTurn): Promise<Turn>;

  getAnalytics(): Promise<AnalyticsData>;

  // Scenario Draft operations
  getScenarioDraft(id: string): Promise<ScenarioDraft | undefined>;
  getScenarioDraftsByAuthor(authorId: string): Promise<ScenarioDraft[]>;
  createScenarioDraft(draft: InsertScenarioDraft): Promise<ScenarioDraft>;
  updateScenarioDraft(id: string, data: Partial<InsertScenarioDraft>): Promise<ScenarioDraft | undefined>;
  addDraftMessage(id: string, message: DraftConversationMessage): Promise<ScenarioDraft | undefined>;
  updateDraftInsights(id: string, insights: ExtractedInsights): Promise<ScenarioDraft | undefined>;
  updateDraftGeneratedScenario(id: string, scenario: GeneratedScenarioData): Promise<ScenarioDraft | undefined>;
  deleteScenarioDraft(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: "student" | "professor" | "admin"): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getScenario(id: string): Promise<Scenario | undefined> {
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, id));
    return scenario;
  }

  async getPublishedScenarios(): Promise<Scenario[]> {
    return await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.isPublished, true))
      .orderBy(desc(scenarios.createdAt));
  }

  async getScenariosByAuthor(authorId: string): Promise<Scenario[]> {
    return await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.authorId, authorId))
      .orderBy(desc(scenarios.createdAt));
  }

  async createScenario(scenario: InsertScenario): Promise<Scenario> {
    const [created] = await db.insert(scenarios).values(scenario).returning();
    return created;
  }

  async updateScenario(id: string, data: Partial<InsertScenario>): Promise<Scenario | undefined> {
    const [updated] = await db
      .update(scenarios)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scenarios.id, id))
      .returning();
    return updated;
  }

  async deleteScenario(id: string): Promise<void> {
    await db.delete(scenarios).where(eq(scenarios.id, id));
  }

  async getSimulationSession(id: string): Promise<SimulationSession | undefined> {
    const [session] = await db
      .select()
      .from(simulationSessions)
      .where(eq(simulationSessions.id, id));
    return session;
  }

  async getSimulationSessionWithScenario(id: string): Promise<(SimulationSession & { scenario?: Scenario }) | undefined> {
    const [result] = await db
      .select()
      .from(simulationSessions)
      .leftJoin(scenarios, eq(simulationSessions.scenarioId, scenarios.id))
      .where(eq(simulationSessions.id, id));

    if (!result) return undefined;

    return {
      ...result.simulation_sessions,
      scenario: result.scenarios || undefined,
    };
  }

  async getUserSessions(userId: string): Promise<(SimulationSession & { scenario?: Scenario })[]> {
    const results = await db
      .select()
      .from(simulationSessions)
      .leftJoin(scenarios, eq(simulationSessions.scenarioId, scenarios.id))
      .where(eq(simulationSessions.userId, userId))
      .orderBy(desc(simulationSessions.updatedAt));

    return results.map((r) => ({
      ...r.simulation_sessions,
      scenario: r.scenarios || undefined,
    }));
  }

  async createSimulationSession(session: InsertSimulationSession): Promise<SimulationSession> {
    const [created] = await db.insert(simulationSessions).values(session).returning();
    return created;
  }

  async updateSimulationSession(id: string, data: Partial<InsertSimulationSession>): Promise<SimulationSession | undefined> {
    const [updated] = await db
      .update(simulationSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(simulationSessions.id, id))
      .returning();
    return updated;
  }

  async getTurnsBySession(sessionId: string): Promise<Turn[]> {
    return await db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, sessionId))
      .orderBy(turns.turnNumber);
  }

  async createTurn(turn: InsertTurn): Promise<Turn> {
    const [created] = await db.insert(turns).values(turn).returning();
    return created;
  }

  async getAnalytics(): Promise<AnalyticsData> {
    const allSessions = await db
      .select()
      .from(simulationSessions)
      .leftJoin(scenarios, eq(simulationSessions.scenarioId, scenarios.id))
      .orderBy(desc(simulationSessions.updatedAt));

    const totalSessions = allSessions.length;
    const completedSessions = allSessions.filter(
      (s) => s.simulation_sessions.status === "completed"
    ).length;

    const competencyTotals: Record<string, { sum: number; count: number }> = {
      strategicThinking: { sum: 0, count: 0 },
      ethicalReasoning: { sum: 0, count: 0 },
      decisionDecisiveness: { sum: 0, count: 0 },
      stakeholderEmpathy: { sum: 0, count: 0 },
    };

    let totalScore = 0;
    let scoreCount = 0;

    for (const session of allSessions) {
      const scoreSummary = session.simulation_sessions.scoreSummary;
      if (scoreSummary) {
        totalScore += scoreSummary.overallScore;
        scoreCount++;

        const competencies = scoreSummary.competencies || {};
        for (const [key, value] of Object.entries(competencies)) {
          if (competencyTotals[key]) {
            competencyTotals[key].sum += value as number;
            competencyTotals[key].count++;
          }
        }
      }
    }

    const competencyAverages: Record<string, number> = {};
    for (const [key, data] of Object.entries(competencyTotals)) {
      competencyAverages[key] = data.count > 0 ? data.sum / data.count : 0;
    }

    const scenarioCounts: Record<string, number> = {};
    for (const session of allSessions) {
      const scenarioTitle = session.scenarios?.title || "Unknown";
      scenarioCounts[scenarioTitle] = (scenarioCounts[scenarioTitle] || 0) + 1;
    }

    const scenarioBreakdown = Object.entries(scenarioCounts).map(
      ([name, count]) => ({ name, count })
    );

    const recentSessions = allSessions.slice(0, 10).map((r) => ({
      ...r.simulation_sessions,
      scenario: r.scenarios || undefined,
    }));

    return {
      totalSessions,
      completedSessions,
      averageScore: scoreCount > 0 ? totalScore / scoreCount : 0,
      competencyAverages,
      scenarioBreakdown,
      recentSessions,
    };
  }

  // Scenario Draft operations
  async getScenarioDraft(id: string): Promise<ScenarioDraft | undefined> {
    const [draft] = await db.select().from(scenarioDrafts).where(eq(scenarioDrafts.id, id));
    return draft;
  }

  async getScenarioDraftsByAuthor(authorId: string): Promise<ScenarioDraft[]> {
    return await db
      .select()
      .from(scenarioDrafts)
      .where(eq(scenarioDrafts.authorId, authorId))
      .orderBy(desc(scenarioDrafts.updatedAt));
  }

  async createScenarioDraft(draft: InsertScenarioDraft): Promise<ScenarioDraft> {
    const [created] = await db.insert(scenarioDrafts).values(draft).returning();
    return created;
  }

  async updateScenarioDraft(id: string, data: Partial<InsertScenarioDraft>): Promise<ScenarioDraft | undefined> {
    const [updated] = await db
      .update(scenarioDrafts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scenarioDrafts.id, id))
      .returning();
    return updated;
  }

  async addDraftMessage(id: string, message: DraftConversationMessage): Promise<ScenarioDraft | undefined> {
    const draft = await this.getScenarioDraft(id);
    if (!draft) return undefined;

    const currentHistory = (draft.conversationHistory || []) as DraftConversationMessage[];
    const [updated] = await db
      .update(scenarioDrafts)
      .set({
        conversationHistory: [...currentHistory, message],
        updatedAt: new Date(),
      })
      .where(eq(scenarioDrafts.id, id))
      .returning();
    return updated;
  }

  async updateDraftInsights(id: string, insights: ExtractedInsights): Promise<ScenarioDraft | undefined> {
    const [updated] = await db
      .update(scenarioDrafts)
      .set({ extractedInsights: insights, updatedAt: new Date() })
      .where(eq(scenarioDrafts.id, id))
      .returning();
    return updated;
  }

  async updateDraftGeneratedScenario(id: string, scenario: GeneratedScenarioData): Promise<ScenarioDraft | undefined> {
    const [updated] = await db
      .update(scenarioDrafts)
      .set({ generatedScenario: scenario, status: "reviewing", updatedAt: new Date() })
      .where(eq(scenarioDrafts.id, id))
      .returning();
    return updated;
  }

  async deleteScenarioDraft(id: string): Promise<void> {
    await db.delete(scenarioDrafts).where(eq(scenarioDrafts.id, id));
  }
}

export const storage = new DatabaseStorage();
