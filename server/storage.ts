import {
  users,
  scenarios,
  simulationSessions,
  turns,
  type User,
  type UpsertUser,
  type Scenario,
  type InsertScenario,
  type SimulationSession,
  type InsertSimulationSession,
  type Turn,
  type InsertTurn,
  type SimulationState,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
