import {
  users,
  scenarios,
  simulationSessions,
  turns,
  scenarioDrafts,
  bugReports,
  llmProviders,
  studentEnrollments,
  turnEvents,
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
  type BugReport,
  type InsertBugReport,
  type LlmProvider,
  type InsertLlmProvider,
  type StudentEnrollment,
  type TurnEvent,
  type InsertTurnEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, inArray } from "drizzle-orm";

export interface AnalyticsData {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  competencyAverages: Record<string, number>;
  scenarioBreakdown: { name: string; count: number }[];
  recentSessions: (SimulationSession & { scenario?: Scenario })[];
}

// Professor Dashboard types
export interface ScenarioWithStats extends Scenario {
  enrollmentCount: number;
  activeCount: number;
  completedCount: number;
}

export interface SessionWithUserInfo extends SimulationSession {
  user?: User;
  scenario?: Scenario;
  turnCount: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  upsertUserWithRole(id: string, role: "student" | "professor" | "admin", isSuperAdmin: boolean): Promise<User | undefined>;
  updateUserRole(id: string, role: "student" | "professor" | "admin"): Promise<User | undefined>;
  updateUserViewingAs(id: string, viewingAs: "student" | "professor" | "admin" | null): Promise<User | undefined>;

  getScenario(id: string): Promise<Scenario | undefined>;
  getScenarioByJoinCode(code: string): Promise<Scenario | undefined>;
  getPublishedScenarios(): Promise<Scenario[]>;
  getScenariosByAuthor(authorId: string): Promise<Scenario[]>;
  createScenario(scenario: InsertScenario): Promise<Scenario>;
  updateScenario(id: string, data: Partial<InsertScenario>): Promise<Scenario | undefined>;
  deleteScenario(id: string): Promise<void>;

  getSimulationSession(id: string): Promise<SimulationSession | undefined>;
  getSimulationSessionWithScenario(id: string): Promise<(SimulationSession & { scenario?: Scenario }) | undefined>;
  getUserSessions(userId: string): Promise<(SimulationSession & { scenario?: Scenario })[]>;
  getActiveSessionForScenario(userId: string, scenarioId: string): Promise<SimulationSession | undefined>;
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

  // Professor Dashboard operations
  getScenariosWithStats(authorId: string): Promise<ScenarioWithStats[]>;
  getSessionsByScenario(scenarioId: string): Promise<SessionWithUserInfo[]>;
  getSessionWithConversation(sessionId: string): Promise<{ session: SessionWithUserInfo; turns: Turn[] } | undefined>;
  deleteSimulationSession(sessionId: string): Promise<void>;
  updateSessionStatus(sessionId: string, status: "active" | "completed" | "abandoned"): Promise<SimulationSession | undefined>;
  deleteScenarioWithSessions(scenarioId: string): Promise<void>;

  // Bug Report operations
  createBugReport(report: InsertBugReport): Promise<BugReport>;
  getBugReports(): Promise<(BugReport & { user?: User })[]>;
  updateBugReportStatus(id: string, status: "new" | "reviewed" | "resolved" | "dismissed"): Promise<BugReport | undefined>;

  // LLM Provider operations (superadmin)
  getLlmProviders(): Promise<LlmProvider[]>;
  getEnabledLlmProviders(): Promise<LlmProvider[]>;
  getLlmProvider(id: string): Promise<LlmProvider | undefined>;
  createLlmProvider(provider: InsertLlmProvider): Promise<LlmProvider>;
  updateLlmProvider(id: string, data: Partial<InsertLlmProvider>): Promise<LlmProvider | undefined>;
  deleteLlmProvider(id: string): Promise<void>;
  
  // User profile operations
  updateUserProfile(id: string, data: { firstName?: string; lastName?: string }): Promise<User | undefined>;
  updateUserLanguage(id: string, language: "es" | "en"): Promise<User | undefined>;
  
  // Student Enrollment operations
  getStudentEnrollments(studentId: string): Promise<{ scenarioId: string }[]>;
  isStudentEnrolled(studentId: string, scenarioId: string): Promise<boolean>;
  enrollStudent(studentId: string, scenarioId: string, via: "email" | "code"): Promise<void>;
  enrollStudentsByEmail(scenarioId: string, emails: string[]): Promise<{ added: number; notFound: string[] }>;
  getScenariosForStudent(studentId: string): Promise<Scenario[]>;
  getGlobalDemoScenarios(): Promise<Scenario[]>;

  createTurnEvent(event: InsertTurnEvent): Promise<TurnEvent>;
  getTurnEvents(sessionId: string): Promise<TurnEvent[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user exists first
    const existingUser = await this.getUser(userData.id as string);
    
    if (existingUser) {
      // Existing user: only update profile info, keep existing role
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id as string))
        .returning();
      return user;
    }
    
    // NEW user: set role from userData (defaults to student if not provided)
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        role: userData.role || "student" as const,
        isSuperAdmin: userData.isSuperAdmin ?? false,
      })
      .returning();
    
    console.log(`[Storage] Created NEW user ${userData.email} with role: ${user.role}, isSuperAdmin: ${user.isSuperAdmin}`);
    return user;
  }

  async upsertUserWithRole(id: string, role: "student" | "professor" | "admin", isSuperAdmin: boolean): Promise<User | undefined> {
    const existingUser = await this.getUser(id);
    
    if (!existingUser) {
      return undefined;
    }
    
    const [user] = await db
      .update(users)
      .set({ role, isSuperAdmin, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    console.log(`[Storage] Updated user ${id} role to: ${role}, isSuperAdmin: ${isSuperAdmin}`);
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

  async updateUserViewingAs(id: string, viewingAs: "student" | "professor" | "admin" | null): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ viewingAs, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getScenario(id: string): Promise<Scenario | undefined> {
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, id));
    return scenario;
  }

  async getScenarioByJoinCode(code: string): Promise<Scenario | undefined> {
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.joinCode, code));
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

  async getActiveSessionForScenario(userId: string, scenarioId: string): Promise<SimulationSession | undefined> {
    const [session] = await db
      .select()
      .from(simulationSessions)
      .where(
        and(
          eq(simulationSessions.userId, userId),
          eq(simulationSessions.scenarioId, scenarioId),
          eq(simulationSessions.status, "active")
        )
      )
      .orderBy(desc(simulationSessions.updatedAt))
      .limit(1);
    return session;
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

  async updateTurn(turnId: string, updates: Partial<Pick<Turn, "agentResponse">>): Promise<Turn | undefined> {
    const [updated] = await db.update(turns).set(updates).where(eq(turns.id, turnId)).returning();
    return updated;
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

  // Professor Dashboard operations
  async getScenariosWithStats(authorId: string): Promise<ScenarioWithStats[]> {
    const authorScenarios = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.authorId, authorId))
      .orderBy(desc(scenarios.createdAt));

    const results: ScenarioWithStats[] = [];
    
    for (const scenario of authorScenarios) {
      const sessions = await db
        .select()
        .from(simulationSessions)
        .where(eq(simulationSessions.scenarioId, scenario.id));

      const enrollmentCount = sessions.length;
      const activeCount = sessions.filter(s => s.status === "active").length;
      const completedCount = sessions.filter(s => s.status === "completed").length;

      results.push({
        ...scenario,
        enrollmentCount,
        activeCount,
        completedCount,
      });
    }

    return results;
  }

  async getSessionsByScenario(scenarioId: string): Promise<SessionWithUserInfo[]> {
    const results = await db
      .select()
      .from(simulationSessions)
      .leftJoin(users, eq(simulationSessions.userId, users.id))
      .leftJoin(scenarios, eq(simulationSessions.scenarioId, scenarios.id))
      .where(eq(simulationSessions.scenarioId, scenarioId))
      .orderBy(desc(simulationSessions.updatedAt));

    const sessionsWithTurns: SessionWithUserInfo[] = [];

    for (const result of results) {
      const turnsList = await db
        .select()
        .from(turns)
        .where(eq(turns.sessionId, result.simulation_sessions.id));

      sessionsWithTurns.push({
        ...result.simulation_sessions,
        user: result.users || undefined,
        scenario: result.scenarios || undefined,
        turnCount: turnsList.length,
      });
    }

    return sessionsWithTurns;
  }

  async getSessionWithConversation(sessionId: string): Promise<{ session: SessionWithUserInfo; turns: Turn[] } | undefined> {
    const [result] = await db
      .select()
      .from(simulationSessions)
      .leftJoin(users, eq(simulationSessions.userId, users.id))
      .leftJoin(scenarios, eq(simulationSessions.scenarioId, scenarios.id))
      .where(eq(simulationSessions.id, sessionId));

    if (!result) return undefined;

    const turnsList = await db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, sessionId))
      .orderBy(turns.turnNumber);

    return {
      session: {
        ...result.simulation_sessions,
        user: result.users || undefined,
        scenario: result.scenarios || undefined,
        turnCount: turnsList.length,
      },
      turns: turnsList,
    };
  }

  async deleteSimulationSession(sessionId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // First delete all turns for this session (child records first)
      await tx.delete(turns).where(eq(turns.sessionId, sessionId));
      // Then delete the session
      await tx.delete(simulationSessions).where(eq(simulationSessions.id, sessionId));
    });
  }

  async updateSessionStatus(sessionId: string, status: "active" | "completed" | "abandoned"): Promise<SimulationSession | undefined> {
    const [updated] = await db
      .update(simulationSessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(simulationSessions.id, sessionId))
      .returning();
    return updated;
  }

  async deleteScenarioWithSessions(scenarioId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // First get all sessions for this scenario
      const sessions = await tx
        .select()
        .from(simulationSessions)
        .where(eq(simulationSessions.scenarioId, scenarioId));

      // Delete all turns for all sessions (child records first)
      for (const session of sessions) {
        await tx.delete(turns).where(eq(turns.sessionId, session.id));
      }

      // Delete all sessions
      await tx.delete(simulationSessions).where(eq(simulationSessions.scenarioId, scenarioId));

      // Delete all drafts referencing this scenario
      await tx.delete(scenarioDrafts).where(eq(scenarioDrafts.publishedScenarioId, scenarioId));

      // Finally delete the scenario
      await tx.delete(scenarios).where(eq(scenarios.id, scenarioId));
    });
  }

  // Bug Report operations
  async createBugReport(report: InsertBugReport): Promise<BugReport> {
    const [created] = await db.insert(bugReports).values(report).returning();
    return created;
  }

  async getBugReports(): Promise<(BugReport & { user?: User })[]> {
    const results = await db
      .select()
      .from(bugReports)
      .leftJoin(users, eq(bugReports.userId, users.id))
      .orderBy(desc(bugReports.createdAt));

    return results.map((r) => ({
      ...r.bug_reports,
      user: r.users || undefined,
    }));
  }

  async updateBugReportStatus(id: string, status: "new" | "reviewed" | "resolved" | "dismissed"): Promise<BugReport | undefined> {
    const [updated] = await db
      .update(bugReports)
      .set({ status })
      .where(eq(bugReports.id, id))
      .returning();
    return updated;
  }

  // LLM Provider operations
  async getLlmProviders(): Promise<LlmProvider[]> {
    return await db
      .select()
      .from(llmProviders)
      .orderBy(llmProviders.sortOrder, llmProviders.name);
  }

  async getEnabledLlmProviders(): Promise<LlmProvider[]> {
    return await db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.isEnabled, true))
      .orderBy(llmProviders.sortOrder, llmProviders.name);
  }

  async getLlmProvider(id: string): Promise<LlmProvider | undefined> {
    const [provider] = await db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.id, id));
    return provider;
  }

  async createLlmProvider(provider: InsertLlmProvider): Promise<LlmProvider> {
    const [created] = await db
      .insert(llmProviders)
      .values(provider)
      .returning();
    return created;
  }

  async updateLlmProvider(id: string, data: Partial<InsertLlmProvider>): Promise<LlmProvider | undefined> {
    // First get existing provider to merge values
    const [existing] = await db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.id, id));
    
    if (!existing) return undefined;

    // Merge existing values with new data, only updating fields that are explicitly provided
    const mergedData = {
      name: data.name ?? existing.name,
      provider: data.provider ?? existing.provider,
      modelId: data.modelId ?? existing.modelId,
      description: data.description !== undefined ? data.description : existing.description,
      isEnabled: data.isEnabled ?? existing.isEnabled,
      isDefault: data.isDefault ?? existing.isDefault,
      sortOrder: data.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(llmProviders)
      .set(mergedData)
      .where(eq(llmProviders.id, id))
      .returning();
    return updated;
  }

  async deleteLlmProvider(id: string): Promise<void> {
    await db.delete(llmProviders).where(eq(llmProviders.id, id));
  }

  // User profile operations
  async updateUserProfile(id: string, data: { firstName?: string; lastName?: string }): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async updateUserLanguage(id: string, language: "es" | "en"): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ language, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Student Enrollment operations
  async getStudentEnrollments(studentId: string): Promise<{ scenarioId: string }[]> {
    const enrollments = await db
      .select({ scenarioId: studentEnrollments.scenarioId })
      .from(studentEnrollments)
      .where(eq(studentEnrollments.studentId, studentId));
    return enrollments;
  }

  async isStudentEnrolled(studentId: string, scenarioId: string): Promise<boolean> {
    const [enrollment] = await db
      .select()
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.studentId, studentId),
          eq(studentEnrollments.scenarioId, scenarioId)
        )
      );
    return !!enrollment;
  }

  async enrollStudent(studentId: string, scenarioId: string, via: "email" | "code"): Promise<void> {
    const existing = await this.isStudentEnrolled(studentId, scenarioId);
    if (!existing) {
      await db.insert(studentEnrollments).values({
        studentId,
        scenarioId,
        enrolledVia: via,
      });
    }
  }

  async enrollStudentsByEmail(scenarioId: string, emails: string[]): Promise<{ added: number; notFound: string[] }> {
    const notFound: string[] = [];
    let added = 0;

    for (const email of emails) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()));
      
      if (user) {
        const existing = await this.isStudentEnrolled(user.id, scenarioId);
        if (!existing) {
          await db.insert(studentEnrollments).values({
            studentId: user.id,
            scenarioId,
            enrolledVia: "email",
          });
          added++;
        }
      } else {
        notFound.push(email);
      }
    }

    return { added, notFound };
  }

  async getScenariosForStudent(studentId: string): Promise<Scenario[]> {
    // Get scenarios where student is enrolled
    const enrollments = await this.getStudentEnrollments(studentId);
    const enrolledScenarioIds = enrollments.map(e => e.scenarioId);
    
    // Get global demo scenarios
    const globalDemos = await this.getGlobalDemoScenarios();
    
    // Get enrolled scenarios
    let enrolledScenarios: Scenario[] = [];
    if (enrolledScenarioIds.length > 0) {
      enrolledScenarios = await db
        .select()
        .from(scenarios)
        .where(
          and(
            inArray(scenarios.id, enrolledScenarioIds),
            eq(scenarios.isPublished, true)
          )
        );
    }
    
    // Combine and dedupe by ID
    const allScenarios = [...globalDemos];
    for (const scenario of enrolledScenarios) {
      if (!allScenarios.some(s => s.id === scenario.id)) {
        allScenarios.push(scenario);
      }
    }
    
    return allScenarios;
  }

  async getGlobalDemoScenarios(): Promise<Scenario[]> {
    const demos = await db
      .select()
      .from(scenarios)
      .where(
        and(
          eq(scenarios.isGlobalDemo, true),
          eq(scenarios.isPublished, true)
        )
      );
    return demos;
  }

  async createTurnEvent(event: InsertTurnEvent): Promise<TurnEvent> {
    const [created] = await db.insert(turnEvents).values(event).returning();
    return created;
  }

  async getTurnEvents(sessionId: string): Promise<TurnEvent[]> {
    return await db
      .select()
      .from(turnEvents)
      .where(eq(turnEvents.sessionId, sessionId))
      .orderBy(turnEvents.createdAt);
  }
}

export const storage = new DatabaseStorage();
