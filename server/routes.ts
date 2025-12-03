import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processStudentTurn } from "./agents/director";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import type { AgentContext } from "./agents/types";
import type { HistoryEntry, InsertScenario, InitialState } from "@shared/schema";

const createScenarioSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  domain: z.string().min(1),
  initialState: z.object({
    role: z.string(),
    objective: z.string(),
    introText: z.string(),
    kpis: z.object({
      revenue: z.number(),
      morale: z.number(),
      reputation: z.number(),
      efficiency: z.number(),
      trust: z.number(),
    }),
  }),
  rubric: z.object({
    criteria: z.array(z.object({
      name: z.string(),
      description: z.string(),
      weight: z.number(),
    })),
  }).optional(),
  isPublished: z.boolean().optional(),
});

const startSimulationSchema = z.object({
  scenarioId: z.string().min(1),
});

const submitTurnSchema = z.object({
  input: z.string().min(1),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  await setupAuth(app);

  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/scenarios", isAuthenticated, async (req, res) => {
    try {
      const scenarios = await storage.getPublishedScenarios();
      res.json(scenarios);
    } catch (error) {
      console.error("Error fetching scenarios:", error);
      res.status(500).json({ message: "Failed to fetch scenarios" });
    }
  });

  app.get("/api/scenarios/authored", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== "professor" && user.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const scenarios = await storage.getScenariosByAuthor(userId);
      res.json(scenarios);
    } catch (error) {
      console.error("Error fetching authored scenarios:", error);
      res.status(500).json({ message: "Failed to fetch scenarios" });
    }
  });

  app.get("/api/scenarios/:id", isAuthenticated, async (req, res) => {
    try {
      const scenario = await storage.getScenario(req.params.id);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      res.json(scenario);
    } catch (error) {
      console.error("Error fetching scenario:", error);
      res.status(500).json({ message: "Failed to fetch scenario" });
    }
  });

  app.post("/api/scenarios", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "professor" && user.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized to create scenarios" });
      }

      const parseResult = createScenarioSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid scenario data", errors: parseResult.error.errors });
      }

      const scenario = await storage.createScenario({
        ...parseResult.data,
        authorId: userId,
      });
      res.status(201).json(scenario);
    } catch (error) {
      console.error("Error creating scenario:", error);
      res.status(500).json({ message: "Failed to create scenario" });
    }
  });

  app.put("/api/scenarios/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scenario = await storage.getScenario(req.params.id);

      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }

      if (scenario.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updated = await storage.updateScenario(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating scenario:", error);
      res.status(500).json({ message: "Failed to update scenario" });
    }
  });

  app.delete("/api/scenarios/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scenario = await storage.getScenario(req.params.id);

      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }

      if (scenario.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteScenario(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scenario:", error);
      res.status(500).json({ message: "Failed to delete scenario" });
    }
  });

  app.get("/api/simulations/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/simulations/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getSimulationSessionWithScenario(req.params.sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.post("/api/simulations/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const parseResult = startSimulationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const { scenarioId } = parseResult.data;
      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }

      const initialHistory: HistoryEntry[] = [
        {
          role: "system",
          content: scenario.initialState.introText,
          timestamp: new Date().toISOString(),
        },
      ];

      const session = await storage.createSimulationSession({
        userId,
        scenarioId,
        currentState: {
          turnCount: 0,
          kpis: scenario.initialState.kpis,
          history: initialHistory,
          flags: [],
          rubricScores: {},
        },
        status: "active",
      });

      res.status(201).json({ sessionId: session.id, initialState: session.currentState });
    } catch (error) {
      console.error("Error starting simulation:", error);
      res.status(500).json({ message: "Failed to start simulation" });
    }
  });

  app.post("/api/simulations/:sessionId/turn", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      
      const parseResult = submitTurnSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
      }

      const { input } = parseResult.data;
      const session = await storage.getSimulationSessionWithScenario(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (session.status !== "active") {
        return res.status(400).json({ message: "Session is not active" });
      }

      const context: AgentContext = {
        sessionId,
        turnCount: session.currentState.turnCount,
        currentKpis: session.currentState.kpis,
        history: session.currentState.history,
        studentInput: input,
        rubric: session.scenario?.rubric || undefined,
        scenario: {
          title: session.scenario?.title || "Business Simulation",
          domain: session.scenario?.domain || "General",
          role: session.scenario?.initialState?.role || "Business Leader",
          objective: session.scenario?.initialState?.objective || "Navigate the challenge",
        },
      };

      const result = await processStudentTurn(context);

      await storage.createTurn({
        sessionId,
        turnNumber: session.currentState.turnCount + 1,
        studentInput: input,
        agentResponse: result,
      });

      await storage.updateSimulationSession(sessionId, {
        currentState: result.updatedState,
        status: result.isGameOver ? "completed" : "active",
        ...(result.isGameOver && {
          scoreSummary: {
            finalKpis: result.updatedState.kpis,
            competencies: result.competencyScores || {},
            overallScore: result.feedback.score,
            feedback: result.feedback.message,
          },
        }),
      });

      res.json(result);
    } catch (error) {
      console.error("Error processing turn:", error);
      res.status(500).json({ message: "Failed to process turn" });
    }
  });

  app.get("/api/simulations/:sessionId/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getSimulationSession(req.params.sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const turns = await storage.getTurnsBySession(req.params.sessionId);
      res.json(turns);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/users/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;

      if (!["student", "professor"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(userId, role);
      res.json(user);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });
}
