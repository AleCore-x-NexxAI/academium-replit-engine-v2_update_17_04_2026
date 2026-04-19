import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, signAdminVerification } from "./replitAuth";
import { processStudentTurn, processReflection, DEFAULT_DIRECTOR_PROMPT } from "./agents/director";
import { DEFAULT_EVALUATOR_PROMPT } from "./agents/evaluator";
import { DEFAULT_NARRATOR_PROMPT } from "./agents/narrator";
import { DEFAULT_DOMAIN_EXPERT_PROMPT } from "./agents/domainExpert";
import { SUPPORTED_MODELS, generateChatCompletion } from "./openai";
import { getCapacityStatus, getJobStatus as getLLMJobStatus } from "./llm";
import { turnQueue, type TurnJob } from "./llm/turnQueue";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import type { AgentContext, DomainExpertOutput, CausalExplanation, DisplayKPI } from "./agents/types";
import { DEFAULT_DECISIONS } from "./agents/constants";
import type { HistoryEntry, InsertScenario, InitialState, DraftConversationMessage, GeneratedScenarioData, AgentPrompts, TurnResponse, SimulationState } from "@shared/schema";

/**
 * Belt-and-suspenders helper: for reflection turns, copy any analytics fields that
 * processReflection may have left undefined back from the prior session state.
 * Both arguments are typed SimulationState — no unsafe casts needed.
 */
function mergeReflectionAnalytics(target: SimulationState, prior: SimulationState): void {
  if (!target.decisionEvidenceLogs?.length && prior.decisionEvidenceLogs?.length) {
    target.decisionEvidenceLogs = prior.decisionEvidenceLogs;
  }
  if (!target.framework_detections?.length && prior.framework_detections?.length) {
    target.framework_detections = prior.framework_detections;
  }
  if (!target.dashboard_summary && prior.dashboard_summary) {
    target.dashboard_summary = prior.dashboard_summary;
  }
  if (
    (!target.indicatorAccumulation || Object.keys(target.indicatorAccumulation).length === 0) &&
    prior.indicatorAccumulation && Object.keys(prior.indicatorAccumulation).length > 0
  ) {
    target.indicatorAccumulation = prior.indicatorAccumulation;
  }
  if (
    (!target.nudgeCounters || Object.keys(target.nudgeCounters).length === 0) &&
    prior.nudgeCounters && Object.keys(prior.nudgeCounters).length > 0
  ) {
    target.nudgeCounters = prior.nudgeCounters;
  }
  if (
    (!target.hintCounters || Object.keys(target.hintCounters).length === 0) &&
    prior.hintCounters && Object.keys(prior.hintCounters).length > 0
  ) {
    target.hintCounters = prior.hintCounters;
  }
  if (!target.integrityFlags?.length && prior.integrityFlags?.length) {
    target.integrityFlags = prior.integrityFlags;
  }
  if (!target.lastTurnNarrative && prior.lastTurnNarrative) {
    target.lastTurnNarrative = prior.lastTurnNarrative;
  }
}

function stripProfessorFields(turnResponse: TurnResponse): TurnResponse {
  const { dashboard_debrief_question, framework_detections, ...rest } = turnResponse;
  const stripped: TurnResponse = { ...rest };
  if (stripped.displayKPIs) {
    stripped.displayKPIs = stripped.displayKPIs.map(({ dashboard_reasoning_link, ...kpi }) => kpi);
  }
  if (stripped.updatedState) {
    const { framework_detections: _fd, dashboard_summary: _ds, ...stateRest } = stripped.updatedState;
    stripped.updatedState = stateRest as SimulationState;
  }
  return stripped;
}
import { llmUsageLogs, turnEvents } from "@shared/schema";
import { db } from "./db";
import { gte, desc, eq, and, inArray, sql } from "drizzle-orm";
import { turns as turnsTable } from "@shared/schema";
import { 
  extractInsights, 
  generateScenario, 
  handleRefinement, 
  generateInitialGreeting 
} from "./agents/authoringAssistant";
import { 
  generateCanonicalCase, 
  convertCanonicalToScenarioData,
  type CanonicalCaseData 
} from "./agents/canonicalCaseGenerator";

const llmModelSchema = z.enum(["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]);

const agentPromptsSchema = z.object({
  narrator: z.string().optional(),
  evaluator: z.string().optional(),
  domainExpert: z.string().optional(),
  director: z.string().optional(),
}).optional();

const createScenarioSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  domain: z.string().min(1),
  llmModel: llmModelSchema.optional(),
  agentPrompts: agentPromptsSchema,
  courseConcepts: z.array(z.string()).max(8).optional(),
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
    caseStudyUrl: z.string().optional(),
    // Enhanced scenario context for AI tailoring
    companyName: z.string().optional(),
    industry: z.string().optional(),
    companySize: z.string().optional(),
    situationBackground: z.string().optional(),
    stakeholders: z.array(z.object({
      name: z.string(),
      role: z.string(),
      interests: z.string(),
      influence: z.enum(["low", "medium", "high"]),
    })).optional(),
    keyConstraints: z.array(z.string()).optional(),
    learningObjectives: z.array(z.string()).optional(),
    difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    timelineContext: z.string().optional(),
    ethicalDimensions: z.array(z.string()).optional(),
    industryContext: z.string().optional(),
    competitiveEnvironment: z.string().optional(),
    resourceConstraints: z.string().optional(),
    culturalContext: z.string().optional(),
    regulatoryEnvironment: z.string().optional(),
    caseContext: z.string().optional(),
    coreChallenge: z.string().optional(),
    reflectionPrompt: z.string().optional(),
    totalDecisions: z.number().int().min(3).max(10).optional(),
    hintButtonEnabled: z.boolean().optional(),
    maxHintsPerTurn: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    frameworks: z.array(z.object({
      id: z.string(),
      name: z.string(),
      domainKeywords: z.array(z.string()),
      signalPattern: z.object({
        requiredSignals: z.array(z.enum(["intent", "justification", "tradeoffAwareness", "stakeholderAwareness", "ethicalAwareness"])),
        minQuality: z.enum(["WEAK", "PRESENT", "STRONG"]),
        additionalKeywords: z.array(z.string()).optional(),
      }).optional(),
    })).optional(),
  }),
  rubric: z.object({
    criteria: z.array(z.object({
      name: z.string(),
      description: z.string(),
      weight: z.number(),
    })),
  }).optional(),
  isPublished: z.boolean().optional(),
  language: z.enum(["es", "en"]).optional(),
});

const startSimulationSchema = z.object({
  scenarioId: z.string().min(1),
});

const submitTurnSchema = z.object({
  input: z.string().min(1),
  revisionAttempts: z.number().optional().default(0),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  await setupAuth(app);

  // Dashboard cache (5-minute TTL). Hoisted so cache invalidation hooks can fire
  // from upstream lifecycle events (turn completion, publish, summary regeneration).
  const dashboardCache = new Map<string, { data: any; expiry: number }>();
  function getCached(key: string) {
    const entry = dashboardCache.get(key);
    if (entry && entry.expiry > Date.now()) return entry.data;
    return null;
  }
  function setCache(key: string, data: any) {
    dashboardCache.set(key, { data, expiry: Date.now() + 5 * 60 * 1000 });
  }
  function invalidateDashboardCache(scenarioId: string) {
    const keys = ["class-stats", "module-health", "depth-trajectory", "class-patterns", "students-summary"];
    for (const k of keys) dashboardCache.delete(`${k}-${scenarioId}`);
  }

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

  // Verify super admin code (before login) - issues a short-lived signed cookie.
  // We do NOT use the session here: the subsequent /api/login flow goes through
  // Replit's OIDC end-session URL which destroys the local session, so a cookie
  // is the only reliable way to carry the verification across that round trip.
  app.post("/api/auth/verify-admin-code", async (req: any, res) => {
    try {
      const { code } = req.body;
      const adminCode = process.env.SUPER_ADMIN_CODE;
      
      if (!adminCode) {
        console.error("SUPER_ADMIN_CODE environment variable not set");
        return res.status(500).json({ valid: false, message: "Admin code not configured" });
      }
      
      const valid = code === adminCode;
      
      if (valid) {
        const signedToken = signAdminVerification(Date.now());
        res.cookie("pendingAdminVerify", signedToken, {
          httpOnly: true,
          secure: true,
          maxAge: 2 * 60 * 1000, // 2 minutes - just enough to complete the login redirect
          sameSite: "lax",
        });
      }
      
      res.json({ valid });
    } catch (error) {
      console.error("Error verifying admin code:", error);
      res.status(500).json({ valid: false, message: "Verification failed" });
    }
  });

  // ==================== Agent Configuration Endpoints ====================
  
  // Get all default agent prompts (superadmin only)
  app.get("/api/agents/default-prompts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Superadmin access required" });
      }
      
      res.json({
        director: DEFAULT_DIRECTOR_PROMPT,
        narrator: DEFAULT_NARRATOR_PROMPT,
        evaluator: DEFAULT_EVALUATOR_PROMPT,
        domainExpert: DEFAULT_DOMAIN_EXPERT_PROMPT,
        supportedModels: SUPPORTED_MODELS,
      });
    } catch (error) {
      console.error("Error fetching default prompts:", error);
      res.status(500).json({ message: "Failed to fetch default prompts" });
    }
  });
  
  // Get scenario's LLM configuration and custom prompts (author or superadmin)
  app.get("/api/scenarios/:id/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const scenario = await storage.getScenario(req.params.id);
      
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      
      // Only author or superadmin can view config
      const isAuthor = scenario.authorId === userId;
      const isSuperAdmin = user?.isSuperAdmin;
      
      if (!isAuthor && !isSuperAdmin) {
        return res.status(403).json({ message: "Not authorized to view scenario configuration" });
      }
      
      res.json({
        llmModel: scenario.llmModel || "gpt-4o",
        agentPrompts: scenario.agentPrompts || {},
        supportedModels: SUPPORTED_MODELS,
        defaultPrompts: isSuperAdmin ? {
          director: DEFAULT_DIRECTOR_PROMPT,
          narrator: DEFAULT_NARRATOR_PROMPT,
          evaluator: DEFAULT_EVALUATOR_PROMPT,
          domainExpert: DEFAULT_DOMAIN_EXPERT_PROMPT,
        } : undefined,
      });
    } catch (error) {
      console.error("Error fetching scenario config:", error);
      res.status(500).json({ message: "Failed to fetch scenario configuration" });
    }
  });
  
  // Update scenario's LLM configuration and custom prompts (author or superadmin)
  app.put("/api/scenarios/:id/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const scenario = await storage.getScenario(req.params.id);
      
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      
      // Only author or superadmin can update config
      const isAuthor = scenario.authorId === userId;
      const isSuperAdmin = user?.isSuperAdmin;
      
      if (!isAuthor && !isSuperAdmin) {
        return res.status(403).json({ message: "Not authorized to update scenario configuration" });
      }

      const enrollmentCount = await storage.countScenarioEnrollments(req.params.id);
      if (enrollmentCount > 0) {
        return res.status(409).json({
          message: "Scenario is locked: students are already enrolled",
          code: "SCENARIO_LOCKED",
          enrollmentCount,
        });
      }

      const updateSchema = z.object({
        llmModel: llmModelSchema.optional(),
        agentPrompts: agentPromptsSchema,
      });
      
      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
      }
      
      const updates: any = {};
      if (parseResult.data.llmModel !== undefined) {
        updates.llmModel = parseResult.data.llmModel;
      }
      if (parseResult.data.agentPrompts !== undefined) {
        // Only superadmin can update agent prompts
        if (!isSuperAdmin) {
          return res.status(403).json({ message: "Only superadmins can modify agent prompts" });
        }
        updates.agentPrompts = parseResult.data.agentPrompts;
      }
      
      const updated = await storage.updateScenario(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ message: "Scenario not found after update" });
      }
      res.json({
        llmModel: updated.llmModel || "gpt-4o",
        agentPrompts: updated.agentPrompts || {},
      });
    } catch (error) {
      console.error("Error updating scenario config:", error);
      res.status(500).json({ message: "Failed to update scenario configuration" });
    }
  });

  app.get("/api/scenarios", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;
      
      // For students: only show global demos + enrolled scenarios
      if (user && user.role === "student") {
        const scenarios = await storage.getScenariosForStudent(userId);
        return res.json(scenarios);
      }
      
      // For professors/admins: show all published scenarios
      const scenarios = await storage.getPublishedScenarios();
      res.json(scenarios);
    } catch (error) {
      console.error("Error fetching scenarios:", error);
      res.status(500).json({ message: "Failed to fetch scenarios" });
    }
  });

  // Student join simulation by code
  app.post("/api/scenarios/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Código requerido" });
      }
      
      // Find scenario by join code
      const scenario = await storage.getScenarioByJoinCode(code.toUpperCase());
      
      if (!scenario) {
        return res.status(404).json({ message: "Código inválido o expirado" });
      }
      
      if (!scenario.isPublished) {
        return res.status(400).json({ message: "Esta simulación no está disponible" });
      }
      
      // Enroll student
      await storage.enrollStudent(userId, scenario.id, "code");
      
      res.json({ 
        success: true, 
        scenario: {
          id: scenario.id,
          title: scenario.title,
          description: scenario.description,
          domain: scenario.domain
        }
      });
    } catch (error) {
      console.error("Error joining simulation:", error);
      res.status(500).json({ message: "Error al unirse a la simulación" });
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
      const enrollmentCount = await storage.countScenarioEnrollments(req.params.id);
      res.json({ ...scenario, enrollmentCount, isLocked: enrollmentCount > 0 });
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

      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "admin";
      if (scenario.authorId !== userId && !isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const enrollmentCount = await storage.countScenarioEnrollments(req.params.id);
      if (enrollmentCount > 0) {
        return res.status(409).json({
          message: "Scenario is locked: students are already enrolled",
          code: "SCENARIO_LOCKED",
          enrollmentCount,
        });
      }

      const { title, description, domain, language, initialState, status } = req.body;
      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (domain !== undefined) updateData.domain = domain;
      if (status !== undefined) updateData.status = status;
      if (initialState !== undefined) updateData.initialState = initialState;
      if (language !== undefined) {
        if (language !== "es" && language !== "en") {
          return res.status(400).json({ message: "language must be 'es' or 'en'" });
        }
        updateData.language = language;
      }

      const updated = await storage.updateScenario(req.params.id, updateData);
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

      const enrollmentCount = await storage.countScenarioEnrollments(req.params.id);
      if (enrollmentCount > 0) {
        return res.status(409).json({
          message: "Scenario is locked: students are already enrolled",
          code: "SCENARIO_LOCKED",
          enrollmentCount,
        });
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

      const user = await storage.getUser(userId);
      const isStudentRole = user?.role === "student" && !user?.isSuperAdmin;
      if (isStudentRole && !scenario.isStarted) {
        return res.status(403).json({ message: "El profesor aún no ha iniciado esta simulación." });
      }

      // No more "resume" flow - exiting always means abandonment
      // Users can start new sessions anytime (previous sessions are either completed or abandoned)

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
    let currentDecisionNum = 0;
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      
      const parseResult = submitTurnSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
      }

      const { input, revisionAttempts } = parseResult.data;
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

      const initialState = session.scenario?.initialState;
      const scenarioLlmModel = session.scenario?.llmModel as import("./openai").SupportedModel | undefined;
      const scenarioAgentPrompts = session.scenario?.agentPrompts as import("@shared/schema").AgentPrompts | undefined;
      
      currentDecisionNum = session.currentState.currentDecision || 1;

      const context: AgentContext = {
        sessionId,
        turnCount: session.currentState.turnCount,
        currentKpis: session.currentState.kpis,
        history: session.currentState.history,
        studentInput: input,
        rubric: session.scenario?.rubric || undefined,
        indicators: session.currentState.indicators || initialState?.indicators,
        totalDecisions: initialState?.totalDecisions || initialState?.decisionPoints?.length || DEFAULT_DECISIONS,
        currentDecision: session.currentState.currentDecision || 1,
        decisionPoints: initialState?.decisionPoints,
        llmModel: scenarioLlmModel,
        agentPrompts: scenarioAgentPrompts,
        language: (session.scenario?.language as "es" | "en") || "es",
        nudgeCounters: session.currentState.nudgeCounters || {},
        decisionEvidenceLogs: session.currentState.decisionEvidenceLogs || [],
        integrityFlags: session.currentState.integrityFlags || [],
        indicatorAccumulation: session.currentState.indicatorAccumulation,
        hintCounters: session.currentState.hintCounters || {},
        framework_detections: session.currentState.framework_detections || [],
        dashboard_summary: session.currentState.dashboard_summary,
        lastTurnNarrative: session.currentState.lastTurnNarrative,
        scenario: {
          title: session.scenario?.title || "Business Simulation",
          domain: session.scenario?.domain || "General",
          role: initialState?.role || "Business Leader",
          objective: initialState?.objective || "Navigate the challenge",
          companyName: initialState?.companyName,
          industry: initialState?.industry,
          companySize: initialState?.companySize,
          situationBackground: initialState?.situationBackground,
          stakeholders: initialState?.stakeholders,
          keyConstraints: initialState?.keyConstraints,
          learningObjectives: initialState?.learningObjectives,
          difficultyLevel: initialState?.difficultyLevel,
          timelineContext: initialState?.timelineContext,
          ethicalDimensions: initialState?.ethicalDimensions,
          industryContext: initialState?.industryContext,
          competitiveEnvironment: initialState?.competitiveEnvironment,
          resourceConstraints: initialState?.resourceConstraints,
          culturalContext: initialState?.culturalContext,
          regulatoryEnvironment: initialState?.regulatoryEnvironment,
          subjectMatterContext: initialState?.subjectMatterContext,
          frameworks: initialState?.frameworks,
        },
      };

      const frameworkCount = (initialState?.frameworks ?? []).length;
      if (frameworkCount > 0) {
        console.log(`[Engine] Turn ${context.turnCount + 1} — scenario "${context.scenario.title}" has ${frameworkCount} framework(s): ${(initialState.frameworks ?? []).map((f: any) => f.name).join(", ")}`);
      } else {
        console.log(`[Engine] Turn ${context.turnCount + 1} — no frameworks configured for scenario "${context.scenario.title}"`);
      }

      // S9.1: Check if we're in the reflection step (Step 4)
      const isReflectionStep = session.currentState.isReflectionStep === true;

      const processTurnAndSave = async () => {
        let turnResult;
        if (isReflectionStep) {
          turnResult = await processReflection(context);
        } else {
          turnResult = await processStudentTurn(context, revisionAttempts);
        }

        if (turnResult.turnStatus === "block") {
          if (isReflectionStep) {
            mergeReflectionAnalytics(turnResult.updatedState, session.currentState);
          }
          await storage.updateSimulationSession(sessionId, {
            currentState: turnResult.updatedState,
          });
          return turnResult;
        }

        if (turnResult.requiresRevision || turnResult.turnStatus === "nudge") {
          await storage.updateSimulationSession(sessionId, {
            currentState: turnResult.updatedState,
          });
          return turnResult;
        }

        await storage.createTurn({
          sessionId,
          turnNumber: session.currentState.turnCount + 1,
          studentInput: input,
          agentResponse: turnResult,
        });

        // Belt-and-suspenders: for reflection turns, merge analytics fields from the
        // previously-stored session state so they are never silently dropped.
        if (isReflectionStep) {
          mergeReflectionAnalytics(turnResult.updatedState, session.currentState);
        }

        let sessionUpdate: any = {
          currentState: turnResult.updatedState,
          status: turnResult.isGameOver ? "completed" : "active",
        };

        if (turnResult.isGameOver) {
          const competencies = turnResult.competencyScores || {
            strategicThinking: 3,
            ethicalReasoning: 3,
            decisionDecisiveness: 3,
            stakeholderEmpathy: 3,
          };
          const competencyValues = Object.values(competencies) as number[];
          const avgCompetency = competencyValues.reduce((a, b) => a + b, 0) / competencyValues.length;
          const overallScore = Math.round((avgCompetency / 5) * 100);

          sessionUpdate.scoreSummary = {
            finalKpis: turnResult.updatedState.kpis,
            competencies,
            overallScore,
            feedback: turnResult.feedback.message,
          };
        }

        await storage.updateSimulationSession(sessionId, sessionUpdate);

        // Phase 1a: Invalidate professor dashboard cache when a session completes
        // (game-over) or finishes its reflection step. Both transitions change the
        // class-level analytics that downstream queries rely on.
        if (turnResult.isGameOver || isReflectionStep) {
          invalidateDashboardCache(session.scenarioId);
        }

        return turnResult;
      };

      if (turnQueue.shouldQueue()) {
        const job = turnQueue.enqueue(sessionId, processTurnAndSave);
        return res.status(202).json({
          queued: true,
          jobId: job.id,
          position: job.position,
          estimatedWaitMs: job.estimatedWaitMs,
          message: "Tu decisión está en cola de procesamiento.",
        });
      }

      const turnStartTime = Date.now();
      const turnResult = await processTurnAndSave();

      if (turnResult.turnStatus === "block") {
        return res.status(400).json({
          message: "validation_failed",
          validationError: true,
          turnStatus: "block",
          requiresRevision: false,
          userMessage: turnResult.narrative?.text || "Tu respuesta no cumple con las normas de la simulación.",
        });
      }

      const result = turnResult;
      
      storage.createTurnEvent({
        sessionId,
        userId,
        eventType: "turn_completed",
        turnNumber: currentDecisionNum,
        rawStudentInput: input,
        eventData: {
          durationMs: Date.now() - turnStartTime,
          turnStatus: result.turnStatus || "pass",
          isGameOver: result.isGameOver,
          isReflection: isReflectionStep,
          requiresRevision: result.requiresRevision || false,
          feedbackScore: result.feedback?.score,
          feedbackMessage: result.feedback?.message,
          narrativeMood: result.narrative?.mood,
          indicatorDeltas: result.indicatorDeltas,
          narrativeText: result.narrative?.text,
          options: result.options,
        },
      }).catch(err => console.error("[TurnEvent] Failed to log turn_completed:", err));
      
      const requestingUser = await storage.getUser(userId);
      const effectiveRole = requestingUser?.viewingAs || requestingUser?.role || "student";
      const isStudentRequest = effectiveRole === "student";
      res.json(isStudentRequest ? stripProfessorFields(result) : result);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isLLMError = errorMsg.toLowerCase().includes("rate limit") ||
        errorMsg.toLowerCase().includes("timeout") ||
        errorMsg.toLowerCase().includes("quota") ||
        errorMsg.toLowerCase().includes("429") ||
        errorMsg.toLowerCase().includes("500") ||
        errorMsg.toLowerCase().includes("502") ||
        errorMsg.toLowerCase().includes("503") ||
        errorMsg.toLowerCase().includes("504") ||
        errorMsg.toLowerCase().includes("network") ||
        errorMsg.toLowerCase().includes("econnrefused") ||
        errorMsg.toLowerCase().includes("resource exhausted");
      
      console.error(`[Turn Error] Session ${req.params.sessionId} | LLM=${isLLMError} | ${errorMsg}`);
      
      storage.createTurnEvent({
        sessionId: req.params.sessionId,
        userId: req.user?.claims?.sub,
        eventType: "turn_error",
        turnNumber: currentDecisionNum,
        rawStudentInput: req.body?.input,
        eventData: {
          error: errorMsg,
          isLLMError,
          stack: error?.stack?.substring(0, 500),
        },
      }).catch(err => console.error("[TurnEvent] Failed to log turn_error:", err));
      
      if (isLLMError) {
        return res.status(503).json({
          message: "ai_service_unavailable",
          retryable: true,
          userMessage: "El servicio de IA está temporalmente ocupado. Intenta de nuevo en un momento.",
        });
      }
      
      res.status(500).json({
        message: "processing_error",
        retryable: false,
        userMessage: "Ocurrió un error al procesar tu decisión. Por favor intenta de nuevo.",
      });
    }
  });

  app.post("/api/simulations/:sessionId/explain", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const { metricId } = req.body;

      if (!metricId || typeof metricId !== "string") {
        return res.status(400).json({ message: "metricId is required" });
      }

      const session = await storage.getSimulationSessionWithScenario(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const initialState = session.scenario?.initialState;
      const indicators = session.currentState.indicators || initialState?.indicators || [];
      const indicator = indicators.find((i: any) => i.id === metricId);
      if (!indicator) {
        return res.status(404).json({ message: "Indicator not found" });
      }

      const recentHistory = (session.currentState.history as HistoryEntry[])
        .slice(-6)
        .map(h => `${h.role}: ${h.content}`)
        .join("\n");

      const { generateChatCompletion } = await import("./openai");

      const prompt = `Eres un experto en análisis de negocios para una simulación educativa.

ESCENARIO: "${session.scenario?.title || "Simulación"}"
DOMINIO: ${session.scenario?.domain || "General"}
${initialState?.companyName ? `EMPRESA: ${initialState.companyName}` : ""}
${initialState?.industry ? `INDUSTRIA: ${initialState.industry}` : ""}

INDICADOR: ${indicator.label} (${indicator.id})
VALOR ACTUAL: ${indicator.value}

HISTORIAL RECIENTE:
${recentHistory}

Genera una explicación detallada de por qué este indicador cambió en el último turno.
Responde SOLO en JSON con este formato:
{
  "causalChain": [
    "<bullet 1: qué decisión tomó el estudiante>",
    "<bullet 2: qué mecanismo activó>",
    "<bullet 3: por qué el indicador se movió en esa dirección>",
    "<bullet 4: por qué la magnitud fue la que fue>"
  ]
}

IMPORTANTE: Todo en ESPAÑOL de Latinoamérica. Sé específico al escenario, no genérico.`;

      const response = await generateChatCompletion(
        [
          { role: "system", content: "Eres un analista experto que explica cambios en indicadores de simulaciones de negocios. Responde solo JSON válido." },
          { role: "user", content: prompt },
        ],
        { responseFormat: "json", maxTokens: 512, model: "gpt-4o-mini", agentName: "explainer", sessionId: parseInt(sessionId) || undefined }
      );

      const parsed = JSON.parse(response);
      res.json({
        metricId,
        causalChain: parsed.causalChain || [],
      });
    } catch (error: any) {
      console.error("[Explain] Error generating explanation:", error);
      res.status(500).json({ message: "Error generating explanation" });
    }
  });

  app.post("/api/simulations/:sessionId/hint", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      
      const session = await storage.getSimulationSessionWithScenario(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const currentDecision = session.currentState.currentDecision || 1;
      const hintCounters = session.currentState.hintCounters || {};
      const currentHintCount = hintCounters[currentDecision] || 0;
      const maxHints = session.scenario?.initialState?.maxHintsPerTurn ?? 2;
      const hintEnabled = session.scenario?.initialState?.hintButtonEnabled ?? true;

      if (!hintEnabled) {
        return res.status(403).json({ hint: null, disabled: true });
      }
      if (currentHintCount >= maxHints) {
        return res.json({ hint: null, maxReached: true, maxHints });
      }

      const { generateChatCompletion } = await import("./openai");
      const language = (session.scenario?.language as "es" | "en") || "es";
      const isEn = language === "en";

      const decisionPoints = session.scenario?.initialState?.decisionPoints || [];
      const currentDP = decisionPoints.find((dp: any) => dp.number === currentDecision);
      
      const recentHistory = session.currentState.history.slice(-4)
        .map((h: HistoryEntry) => `${h.role}: ${h.content}`)
        .join("\n");
      
      const hintPrompt = isEn
        ? `You are a helpful business mentor. Provide scaffolding questions or restate relevant case information. NEVER recommend, suggest a preference, or imply a correct answer. 2-3 sentences max.

SCENARIO: ${session.scenario?.title || "Business Simulation"}
OBJECTIVE: ${session.scenario?.initialState?.objective || "Navigate the challenge"}
${currentDP ? `CURRENT DECISION: ${currentDP.prompt}` : ""}

RECENT CONTEXT:
${recentHistory}

Provide a scaffolding hint that helps the student think through this specific decision. Focus on stakeholders, trade-offs, or case details they might consider. NEVER hint at which option is "better".`
        : `Eres un mentor de negocios. Proporciona preguntas de andamiaje o reformula información relevante del caso. NUNCA recomiendes, sugiera una preferencia, ni impliques una respuesta correcta. 2-3 oraciones máximo.

ESCENARIO: ${session.scenario?.title || "Simulación de Negocios"}
OBJETIVO: ${session.scenario?.initialState?.objective || "Navegar el desafío"}
${currentDP ? `DECISIÓN ACTUAL: ${currentDP.prompt}` : ""}

CONTEXTO RECIENTE:
${recentHistory}

Proporciona una pista de andamiaje que ayude al estudiante a reflexionar sobre esta decisión específica. Enfócate en stakeholders, trade-offs, o detalles del caso que podrían considerar. NUNCA insinúes cuál opción es "mejor".`;

      const hint = await generateChatCompletion([
        { role: "user", content: hintPrompt },
      ], { maxTokens: 256 });

      const updatedHintCounters = { ...hintCounters, [currentDecision]: currentHintCount + 1 };
      const updatedState = {
        ...session.currentState,
        hintCounters: updatedHintCounters,
      };
      await storage.updateSimulationSession(sessionId, { currentState: updatedState });

      res.json({ hint, hintsRemaining: maxHints - (currentHintCount + 1), maxHints });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Hint Error] Session ${req.params.sessionId} | ${errorMsg}`);
      
      const isLLMError = errorMsg.toLowerCase().includes("rate limit") ||
        errorMsg.toLowerCase().includes("timeout") ||
        errorMsg.toLowerCase().includes("503") ||
        errorMsg.toLowerCase().includes("network");
      
      res.status(isLLMError ? 503 : 500).json({
        message: isLLMError ? "ai_service_unavailable" : "processing_error",
        retryable: isLLMError,
        userMessage: isLLMError 
          ? "El servicio de IA está temporalmente ocupado. Intenta de nuevo."
          : "No se pudo generar la pista.",
      });
    }
  });


  // Abandon a simulation session (mark as abandoned so user can start fresh)
  app.post("/api/simulations/:sessionId/abandon", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      
      const session = await storage.getSimulationSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (session.status !== "active") {
        return res.status(400).json({ message: "Session is not active" });
      }

      await storage.updateSimulationSession(sessionId, {
        status: "abandoned",
      });

      res.json({ message: "Session abandoned successfully" });
    } catch (error) {
      console.error("Error abandoning session:", error);
      res.status(500).json({ message: "Failed to abandon session" });
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
      const requestingUser = await storage.getUser(userId);
      const effectiveRole = requestingUser?.viewingAs || requestingUser?.role || "student";
      if (effectiveRole === "student") {
        const strippedTurns = turns.map((turn: any) => ({
          ...turn,
          agentResponse: turn.agentResponse ? stripProfessorFields(turn.agentResponse as TurnResponse) : turn.agentResponse,
        }));
        return res.json(strippedTurns);
      }
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

  const updateRoleSchema = z.object({
    role: z.enum(["student", "professor", "admin"]),
  });

  const updateViewingAsSchema = z.object({
    viewingAs: z.enum(["student", "professor", "admin"]).nullable(),
  });

  // Role switching endpoint (changes actual role - legacy, kept for compatibility)
  app.post("/api/users/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      // Only superadmins or admins can switch roles (superadmins should use viewingAs instead)
      if (process.env.NODE_ENV !== "development") {
        if (!currentUser || (currentUser.role !== "admin" && !currentUser.isSuperAdmin)) {
          return res.status(403).json({ message: "Only admins can switch roles" });
        }
      }
      
      const parseResult = updateRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid role", errors: parseResult.error.errors });
      }

      const { role } = parseResult.data;
      const user = await storage.updateUserRole(userId, role);
      
      console.log(`User ${userId} switched role to ${role}`);
      res.json(user);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // View switching endpoint for superadmins (changes view, not actual role)
  app.post("/api/users/view", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      // Only superadmins can switch views
      if (!currentUser || !currentUser.isSuperAdmin) {
        return res.status(403).json({ message: "Only superadmins can switch views" });
      }
      
      const parseResult = updateViewingAsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid view mode", errors: parseResult.error.errors });
      }

      const { viewingAs } = parseResult.data;
      const user = await storage.updateUserViewingAs(userId, viewingAs);
      
      console.log(`Superadmin ${userId} switched view to ${viewingAs || 'default'}`);
      res.json(user);
    } catch (error) {
      console.error("Error updating view mode:", error);
      res.status(500).json({ message: "Failed to update view mode" });
    }
  });

  // Bug Report routes
  const createBugReportSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    pageUrl: z.string().optional().nullable(),
    browserInfo: z.string().optional().nullable(),
    screenshot: z.string().optional().nullable(),
  });

  // Simple token generation for bug reports access
  const bugReportTokens = new Set<string>();
  
  const generateBugReportToken = () => {
    const token = `br_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    bugReportTokens.add(token);
    // Tokens expire after 1 hour
    setTimeout(() => bugReportTokens.delete(token), 60 * 60 * 1000);
    return token;
  };

  const validateBugReportToken = (token: string) => {
    return bugReportTokens.has(token);
  };

  app.post("/api/bug-reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parseResult = createBugReportSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid bug report", errors: parseResult.error.errors });
      }

      const report = await storage.createBugReport({
        ...parseResult.data,
        userId,
      });

      console.log(`[BUG REPORT] New bug report from ${userId}: ${report.title}`);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating bug report:", error);
      res.status(500).json({ message: "Failed to create bug report" });
    }
  });

  // Password authentication for bug reports viewing
  app.post("/api/bug-reports/authenticate", async (req, res) => {
    try {
      const { password } = req.body;
      const correctPassword = process.env.BUG_REPORTS_PASSWORD;
      
      if (!correctPassword) {
        return res.status(500).json({ message: "Bug reports access not configured" });
      }

      if (password === correctPassword) {
        const token = generateBugReportToken();
        res.json({ token, message: "Authenticated successfully" });
      } else {
        res.status(401).json({ message: "Invalid password" });
      }
    } catch (error) {
      console.error("Error authenticating:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  app.get("/api/bug-reports", async (req: any, res) => {
    try {
      // Check for password-based token OR admin authentication
      const token = req.headers["x-bug-reports-token"];
      
      if (token && validateBugReportToken(token)) {
        const reports = await storage.getBugReports();
        return res.json(reports);
      }

      // Fallback to user authentication for admins
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only admins and superadmins can view all bug reports
      if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const reports = await storage.getBugReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      res.status(500).json({ message: "Failed to fetch bug reports" });
    }
  });

  app.patch("/api/bug-reports/:id/status", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const token = req.headers["x-bug-reports-token"];

      // Validate token
      if (!token || !validateBugReportToken(token)) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const validStatuses = ["new", "reviewed", "resolved", "dismissed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updated = await storage.updateBugReportStatus(id, status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating bug report status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  app.post("/api/admin/backfill-session-analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "admin" && user.role !== "professor" && !user.isSuperAdmin)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { sessionId, scenarioId, dryRun } = req.body || {};

      if (sessionId && typeof sessionId !== "string") {
        return res.status(400).json({ message: "sessionId must be a string" });
      }
      if (scenarioId && typeof scenarioId !== "string") {
        return res.status(400).json({ message: "scenarioId must be a string" });
      }

      if (!user.isSuperAdmin && !sessionId && !scenarioId) {
        return res.status(403).json({
          message: "Only superadmins can run a global backfill. Provide sessionId or scenarioId.",
        });
      }

      if (scenarioId && user.role === "professor") {
        const scenario = await storage.getScenario(scenarioId);
        if (!scenario || (scenario.authorId !== userId && !user.isSuperAdmin)) {
          return res.status(403).json({ message: "Not authorized for this scenario" });
        }
      }

      if (sessionId && !user.isSuperAdmin) {
        const session = await storage.getSimulationSessionWithScenario(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });
        if (session.scenario?.authorId !== userId) {
          return res.status(403).json({ message: "Not authorized for this session" });
        }
      }

      const { backfillSessionAnalytics } = await import("./scripts/backfillSessionAnalytics");
      const summary = await backfillSessionAnalytics({
        sessionId,
        scenarioId,
        dryRun: Boolean(dryRun),
      });

      res.json(summary);
    } catch (error) {
      console.error("Error running session analytics backfill:", error);
      res.status(500).json({ message: "Failed to run backfill", error: (error as Error).message });
    }
  });

  app.post("/api/upload/url", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "professor" && user.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized to upload files" });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      
      res.json({ uploadUrl });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.get("/api/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "professor" && user.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized to view analytics" });
      }

      const analyticsData = await storage.getAnalytics();
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ==========================================
  // AI-Assisted Scenario Authoring Endpoints
  // ==========================================

  app.get("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "professor" && user.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const drafts = await storage.getScenarioDraftsByAuthor(userId);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.get("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draft = await storage.getScenarioDraft(req.params.id);

      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      res.json(draft);
    } catch (error) {
      console.error("Error fetching draft:", error);
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  const createDraftSchema = z.object({
    sourceInput: z.string().optional(),
    sourceFileUrl: z.string().optional(),
  });

  app.post("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "professor" && user.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized to create drafts" });
      }

      const parseResult = createDraftSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid data", errors: parseResult.error.errors });
      }

      const { sourceInput, sourceFileUrl } = parseResult.data;

      let extractedInsightsData = undefined;
      let initialGreeting: string;

      if (sourceInput && sourceInput.trim().length > 50) {
        try {
          extractedInsightsData = await extractInsights(sourceInput);
          initialGreeting = await generateInitialGreeting(extractedInsightsData);
        } catch (aiError) {
          console.error("AI extraction error:", aiError);
          initialGreeting = await generateInitialGreeting();
        }
      } else {
        initialGreeting = await generateInitialGreeting();
      }

      const initialMessage: DraftConversationMessage = {
        role: "assistant",
        content: initialGreeting,
        timestamp: new Date().toISOString(),
        metadata: { type: "question" },
      };

      const draft = await storage.createScenarioDraft({
        authorId: userId,
        status: "gathering",
        sourceInput: sourceInput || null,
        sourceFileUrl: sourceFileUrl || null,
        extractedInsights: extractedInsightsData || null,
        conversationHistory: [initialMessage],
      });

      res.status(201).json(draft);
    } catch (error) {
      console.error("Error creating draft:", error);
      res.status(500).json({ message: "Failed to create draft" });
    }
  });

  const chatMessageSchema = z.object({
    message: z.string().min(1),
  });

  app.post("/api/drafts/:id/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draftId = req.params.id;
      const draft = await storage.getScenarioDraft(draftId);

      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const parseResult = chatMessageSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid message" });
      }

      const { message } = parseResult.data;

      const userMessage: DraftConversationMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      const draftAfterUserMessage = await storage.addDraftMessage(draftId, userMessage);
      if (!draftAfterUserMessage) {
        return res.status(500).json({ message: "Failed to save message" });
      }

      const updatedHistory = draftAfterUserMessage.conversationHistory as DraftConversationMessage[];

      let assistantResponse: string;
      let updatedScenario = draft.generatedScenario;

      if (draft.generatedScenario) {
        const refinementResult = await handleRefinement(
          message,
          draft.generatedScenario,
          updatedHistory
        );

        assistantResponse = refinementResult.response;

        if (refinementResult.needsFullRegeneration && draft.extractedInsights) {
          updatedScenario = await generateScenario(draft.extractedInsights, message);
          await storage.updateDraftGeneratedScenario(draftId, updatedScenario);
          assistantResponse = `I've regenerated the scenario with your feedback.\n\n**New Title:** ${updatedScenario.title}\n\n${updatedScenario.description}\n\nWould you like to review the details or make any adjustments?`;
        } else if (refinementResult.updatedScenario) {
          updatedScenario = refinementResult.updatedScenario;
          await storage.updateDraftGeneratedScenario(draftId, updatedScenario);
        }
      } else if (message.toLowerCase().includes("generate") || 
                 message.toLowerCase().includes("create") ||
                 message.toLowerCase().includes("yes") ||
                 message.toLowerCase().includes("go ahead")) {
        
        let insights = draft.extractedInsights;
        
        if (!insights && draft.sourceInput) {
          insights = await extractInsights(draft.sourceInput);
          await storage.updateDraftInsights(draftId, insights);
        }

        if (!insights) {
          insights = await extractInsights(message);
          await storage.updateDraftInsights(draftId, insights);
        }

        await storage.updateScenarioDraft(draftId, { status: "generating" });
        
        updatedScenario = await generateScenario(insights, message);
        await storage.updateDraftGeneratedScenario(draftId, updatedScenario);

        assistantResponse = `I've created an immersive scenario for you!\n\n**${updatedScenario.title}**\n\n${updatedScenario.description}\n\n**Domain:** ${updatedScenario.domain}\n**Difficulty:** ${updatedScenario.initialState.difficultyLevel || "intermediate"}\n\n**Opening:**\n"${updatedScenario.initialState.introText.substring(0, 300)}..."\n\nThis scenario includes ${updatedScenario.initialState.stakeholders?.length || 0} stakeholders and ${updatedScenario.rubric.criteria.length} assessment criteria.\n\nWould you like to:\n- **Review** the full details\n- **Modify** any specific aspect\n- **Publish** this scenario`;
      } else {
        if (!draft.extractedInsights && message.length > 50) {
          const insights = await extractInsights(message);
          await storage.updateDraftInsights(draftId, insights);
          
          assistantResponse = `Excellent! I've analyzed your input and identified these key elements:\n\n**Summary:** ${insights.summary}\n\n**Potential Challenges:**\n${insights.potentialChallenges.map(c => `- ${c}`).join("\n")}\n\n**Learning Opportunities:**\n${insights.learningOpportunities.map(l => `- ${l}`).join("\n")}\n\nShall I generate a full scenario based on this? Or would you like to add more context first?`;
        } else {
          assistantResponse = `I'm ready to help! To create a great scenario, I need:\n\n1. **A business situation** - What challenge should students face?\n2. **Learning objectives** - What skills should they develop?\n3. **Context** - What industry, company size, or constraints?\n\nYou can share a case study, describe a situation, or tell me what you'd like to teach. What would you like to explore?`;
        }
      }

      const assistantMessage: DraftConversationMessage = {
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date().toISOString(),
        metadata: { 
          type: updatedScenario ? "preview" : "question",
          fieldContext: updatedScenario ? "generatedScenario" : undefined,
        },
      };

      const finalDraft = await storage.addDraftMessage(draftId, assistantMessage);

      res.json({
        draft: finalDraft,
        assistantMessage: assistantResponse,
        generatedScenario: updatedScenario,
      });
    } catch (error) {
      console.error("Error processing chat:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // ==================== Canonical Case Generation ====================
  
  const TRADEOFF_LABELS: Record<string, string> = {
    cost_quality: "Costo vs. Calidad",
    speed_accuracy: "Velocidad vs. Precisión",
    short_long_term: "Corto vs. Largo plazo",
    risk_reward: "Riesgo vs. Recompensa",
    individual_team: "Individual vs. Equipo",
    innovation_stability: "Innovación vs. Estabilidad",
  };

  const generateCanonicalCaseSchema = z.object({
    topic: z.string().min(5, "El tema debe tener al menos 5 caracteres"),
    additionalContext: z.string().optional(),
    discipline: z.string().optional(),
    targetLevel: z.string().optional(),
    scenarioObjective: z.string().optional(),
    tradeoffFocus: z.array(z.string()).optional(),
    customTradeoff: z.string().optional(),
    stepCount: z.number().int().min(3).max(10).optional(),
    language: z.enum(["es", "en"]).optional(),
  });

  app.post("/api/canonical-case/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || (user.role !== "professor" && user.role !== "admin")) {
        return res.status(403).json({ message: "No autorizado para crear casos" });
      }

      const parseResult = generateCanonicalCaseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Datos inválidos", errors: parseResult.error.errors });
      }

      const { topic, additionalContext, tradeoffFocus, customTradeoff, stepCount, language: caseLang } = parseResult.data;

      const tradeoffParts: string[] = [];
      if (tradeoffFocus && tradeoffFocus.length > 0) {
        const labels = tradeoffFocus.map(id => TRADEOFF_LABELS[id] || id);
        tradeoffParts.push(`Tensiones predefinidas: ${labels.join(", ")}`);
      }
      if (customTradeoff && customTradeoff.trim()) {
        tradeoffParts.push(`Trade-off personalizado del profesor: ${customTradeoff.trim()}`);
      }

      let builtContext = additionalContext || "";
      if (tradeoffParts.length > 0) {
        const tradeoffSection = `\nEnfoque de trade-offs que el caso debe incorporar en sus decisiones, focus cues y thinking scaffolds:\n${tradeoffParts.join("\n")}`;
        builtContext = builtContext ? `${builtContext}\n${tradeoffSection}` : tradeoffSection;
      }

      const canonicalCase = await generateCanonicalCase(topic, builtContext || undefined, stepCount, caseLang);
      const scenarioData = convertCanonicalToScenarioData(canonicalCase, caseLang);

      const initialMessage: DraftConversationMessage = {
        role: "assistant",
        content: `He generado un caso canónico basado en: "${topic}".\n\nPuedes revisar y editar cada sección antes de publicar.`,
        timestamp: new Date().toISOString(),
        metadata: { type: "preview" },
      };

      const draft = await storage.createScenarioDraft({
        authorId: userId,
        status: "reviewing",
        sourceInput: topic,
        generatedScenario: scenarioData,
        conversationHistory: [initialMessage],
      });

      res.json({ 
        draft, 
        canonicalCase,
        scenarioData 
      });
    } catch (error) {
      console.error("Error generating canonical case:", error);
      res.status(500).json({ message: "Error al generar el caso" });
    }
  });

  app.put("/api/canonical-case/:draftId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draftId = req.params.draftId;
      const draft = await storage.getScenarioDraft(draftId);

      if (!draft) {
        return res.status(404).json({ message: "Borrador no encontrado" });
      }

      if (draft.authorId !== userId) {
        return res.status(403).json({ message: "No autorizado" });
      }

      const { scenarioData } = req.body;
      
      if (!scenarioData) {
        return res.status(400).json({ message: "Datos del escenario requeridos" });
      }

      const updatedDraft = await storage.updateScenarioDraft(draftId, {
        generatedScenario: scenarioData,
      });

      res.json({ draft: updatedDraft });
    } catch (error) {
      console.error("Error updating canonical case:", error);
      res.status(500).json({ message: "Error al actualizar el caso" });
    }
  });

  app.post("/api/scenarios/suggest-framework-keywords", isAuthenticated, async (req: any, res) => {
    try {
      const { frameworkName, caseContext, language } = req.body;
      if (!frameworkName) {
        return res.status(400).json({ message: "frameworkName required" });
      }
      const { generateChatCompletion } = await import("./openai");
      const lang = language === "en" ? "en" : "es";
      const prompt = lang === "en"
        ? `Given the framework "${frameworkName}" taught in a business simulation scenario${caseContext ? ` about: ${caseContext}` : ""}, return 8-15 domain keywords a student might use when applying this framework, and which of the 5 reasoning signals (intent, justification, tradeoffAwareness, stakeholderAwareness, ethicalAwareness) would indicate implicit application. Respond in English. Return JSON only: {"keywords": ["..."], "signalPattern": {"requiredSignals": ["..."], "minQuality": "PRESENT"}}`
        : `Dado el marco teórico "${frameworkName}" enseñado en un escenario de simulación de negocios${caseContext ? ` sobre: ${caseContext}` : ""}, retorna 8-15 palabras clave del dominio que un estudiante podría usar al aplicar este marco, y cuáles de las 5 señales de razonamiento (intent, justification, tradeoffAwareness, stakeholderAwareness, ethicalAwareness) indicarían aplicación implícita. Responde en español. Retorna solo JSON: {"keywords": ["..."], "signalPattern": {"requiredSignals": ["..."], "minQuality": "PRESENT"}}`;

      const response = await generateChatCompletion(
        [{ role: "user", content: prompt }],
        { responseFormat: "json", maxTokens: 512, agentName: "frameworkKeywordSuggester" }
      );
      const parsed = JSON.parse(response);
      res.json({
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        signalPattern: parsed.signalPattern || { requiredSignals: ["justification"], minQuality: "PRESENT" },
      });
    } catch (error) {
      console.error("Error suggesting framework keywords:", error);
      res.status(500).json({ message: "Error generating keyword suggestions" });
    }
  });

  const ALLOWED_AI_FILL_FIELDS = [
    "title",
    "caseContext",
    "studentRole",
    "customTradeoff",
    "reflectionPrompt",
  ] as const;
  type AiFillField = typeof ALLOWED_AI_FILL_FIELDS[number];

  const aiFillSchema = z.object({
    field: z.enum(ALLOWED_AI_FILL_FIELDS),
    language: z.enum(["es", "en"]).default("es"),
    formState: z.object({
      title: z.string().optional().default(""),
      caseContext: z.string().optional().default(""),
      studentRole: z.string().optional().default(""),
      customTradeoff: z.string().optional().default(""),
      reflectionPrompt: z.string().optional().default(""),
      discipline: z.string().optional().default(""),
      targetLevel: z.string().optional().default(""),
      scenarioObjective: z.string().optional().default(""),
      tradeoffs: z.array(z.string()).optional().default([]),
      conceptTags: z.array(z.string()).optional().default([]),
    }),
  });

  function buildContextBlock(state: any, lang: "es" | "en"): string {
    const isEn = lang === "en";
    const lines: string[] = [];
    const labels = isEn
      ? {
          title: "Title",
          discipline: "Discipline",
          level: "Target level",
          objective: "Scenario objective",
          context: "Case context",
          role: "Student role",
          tradeoffs: "Tradeoff focus",
          customTradeoff: "Custom tradeoff",
          reflection: "Reflection prompt",
          concepts: "Course concepts",
        }
      : {
          title: "Título",
          discipline: "Disciplina",
          level: "Nivel objetivo",
          objective: "Objetivo del escenario",
          context: "Contexto del caso",
          role: "Rol del estudiante",
          tradeoffs: "Enfoque de trade-off",
          customTradeoff: "Trade-off personalizado",
          reflection: "Pregunta de reflexión",
          concepts: "Conceptos del curso",
        };
    if (state.title) lines.push(`${labels.title}: ${state.title}`);
    if (state.discipline) lines.push(`${labels.discipline}: ${state.discipline}`);
    if (state.targetLevel) lines.push(`${labels.level}: ${state.targetLevel}`);
    if (state.scenarioObjective) lines.push(`${labels.objective}: ${state.scenarioObjective}`);
    if (state.caseContext) lines.push(`${labels.context}: ${state.caseContext}`);
    if (state.studentRole) lines.push(`${labels.role}: ${state.studentRole}`);
    if (state.tradeoffs?.length) lines.push(`${labels.tradeoffs}: ${state.tradeoffs.join(", ")}`);
    if (state.customTradeoff) lines.push(`${labels.customTradeoff}: ${state.customTradeoff}`);
    if (state.reflectionPrompt) lines.push(`${labels.reflection}: ${state.reflectionPrompt}`);
    if (state.conceptTags?.length) lines.push(`${labels.concepts}: ${state.conceptTags.join(", ")}`);
    return lines.join("\n");
  }

  function fieldInstruction(field: AiFillField, lang: "es" | "en"): { instruction: string; jsonShape: string } {
    const isEn = lang === "en";
    const map: Record<AiFillField, { es: string; en: string }> = {
      title: {
        es: "Genera un título conciso y descriptivo (3-8 palabras) para este caso de simulación de negocios. Sin comillas ni puntuación final.",
        en: "Generate a concise, descriptive title (3-8 words) for this business simulation case. No quotes or trailing punctuation.",
      },
      caseContext: {
        es: "Escribe un contexto de caso profesional (120-180 palabras) al estilo Harvard Business School. Incluye empresa, industria, situación actual y la tensión central. No incluyas la decisión específica.",
        en: "Write a professional case context (120-180 words) in Harvard Business School style. Include company, industry, current situation, and the central tension. Do not include the specific decision.",
      },
      studentRole: {
        es: "Sugiere un rol específico que asumirá el estudiante (ej: 'Director de Operaciones de una empresa de logística regional'). Una sola línea, 8-15 palabras.",
        en: "Suggest a specific role the student will take (e.g., 'Operations Director at a regional logistics company'). Single line, 8-15 words.",
      },
      customTradeoff: {
        es: "Propón un trade-off central específico para este caso, en formato 'X vs. Y' con una breve descripción de la tensión (máx. 25 palabras).",
        en: "Propose a specific central trade-off for this case, in 'X vs. Y' format with a brief description of the tension (max 25 words).",
      },
      reflectionPrompt: {
        es: "Escribe una pregunta de reflexión final (1-2 oraciones) que invite al estudiante a metacognición sobre sus decisiones en este caso.",
        en: "Write a final reflection question (1-2 sentences) inviting the student to metacognition about their decisions in this case.",
      },
    };
    return {
      instruction: map[field][lang],
      jsonShape: '{"value": "..."}',
    };
  }

  app.post("/api/scenarios/manual-ai-fill", isAuthenticated, async (req: any, res) => {
    try {
      const parse = aiFillSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid input", errors: parse.error.errors });
      }
      const { field, language, formState } = parse.data;
      const ctx = buildContextBlock(formState, language);
      const { instruction, jsonShape } = fieldInstruction(field, language);
      const langInstr = language === "en" ? "Respond in English." : "Responde en español.";
      const prompt = `${language === "en" ? "Current draft of a manual case being authored by a professor" : "Borrador actual de un caso siendo creado manualmente por un profesor"}:\n\n${ctx || (language === "en" ? "(empty)" : "(vacío)")}\n\n${instruction}\n\n${langInstr} ${language === "en" ? "Return JSON only" : "Retorna solo JSON"}: ${jsonShape}`;

      const response = await generateChatCompletion(
        [{ role: "user", content: prompt }],
        { responseFormat: "json", maxTokens: 600, agentName: "manualCaseFieldFiller" }
      );
      const parsed = JSON.parse(response);
      const value = typeof parsed.value === "string" ? parsed.value.trim() : "";
      if (!value) {
        return res.status(502).json({ message: "Empty AI response" });
      }
      res.json({ value });
    } catch (error) {
      console.error("Error in manual-ai-fill:", error);
      res.status(500).json({ message: "Error generating field" });
    }
  });

  const aiSuggestListSchema = z.object({
    kind: z.enum(["concepts", "frameworks"]),
    language: z.enum(["es", "en"]).default("es"),
    formState: aiFillSchema.shape.formState,
    existing: z.array(z.string()).optional().default([]),
  });

  app.post("/api/scenarios/manual-ai-suggest-list", isAuthenticated, async (req: any, res) => {
    try {
      const parse = aiSuggestListSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid input", errors: parse.error.errors });
      }
      const { kind, language, formState, existing } = parse.data;
      const ctx = buildContextBlock(formState, language);
      const isEn = language === "en";
      const existingStr = existing.length > 0 ? `\n\n${isEn ? "Already added (do not repeat)" : "Ya agregados (no repetir)"}: ${existing.join(", ")}` : "";
      const instr = kind === "concepts"
        ? (isEn
            ? "Suggest 6 concise course concepts (1-3 words each) relevant to this case that a professor would assess in analytics."
            : "Sugiere 6 conceptos del curso concisos (1-3 palabras cada uno) relevantes para este caso que un profesor evaluaría en analíticas.")
        : (isEn
            ? "Suggest 6 named theoretical frameworks (e.g., 'Porter's Five Forces', 'SWOT', 'Kotter 8 Steps') relevant to this case."
            : "Sugiere 6 marcos teóricos nombrados (ej: 'Cinco Fuerzas de Porter', 'FODA', '8 Pasos de Kotter') relevantes para este caso.");
      const langInstr = isEn ? "Respond in English." : "Responde en español.";
      const prompt = `${isEn ? "Manual case draft" : "Borrador de caso manual"}:\n\n${ctx || (isEn ? "(empty)" : "(vacío)")}${existingStr}\n\n${instr}\n\n${langInstr} ${isEn ? "Return JSON only" : "Retorna solo JSON"}: {"items": ["...", "..."]}`;

      const response = await generateChatCompletion(
        [{ role: "user", content: prompt }],
        { responseFormat: "json", maxTokens: 400, agentName: "manualCaseListSuggester" }
      );
      const parsed = JSON.parse(response);
      const items = Array.isArray(parsed.items)
        ? parsed.items.filter((s: unknown) => typeof s === "string" && s.trim().length > 0).map((s: string) => s.trim()).slice(0, 8)
        : [];
      res.json({ items });
    } catch (error) {
      console.error("Error in manual-ai-suggest-list:", error);
      res.status(500).json({ message: "Error generating suggestions" });
    }
  });

  app.post("/api/drafts/:id/publish", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const draft = await storage.getScenarioDraft(req.params.id);

      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const generatedScenario = draft.generatedScenario as GeneratedScenarioData | null;
      if (!generatedScenario || !generatedScenario.title || !generatedScenario.initialState) {
        return res.status(400).json({ message: "No complete scenario to publish" });
      }

      const scenario = await storage.createScenario({
        authorId: userId,
        title: generatedScenario.title,
        description: generatedScenario.description,
        domain: generatedScenario.domain,
        initialState: generatedScenario.initialState,
        rubric: generatedScenario.rubric,
        courseConcepts: generatedScenario.courseConcepts || null,
        isPublished: true,
        language: req.body.language || "es",
      });

      await storage.updateScenarioDraft(draft.id, {
        status: "published",
        publishedScenarioId: scenario.id,
      });

      // Phase 1a: ensure no stale dashboard cache entries exist for the new scenario id.
      invalidateDashboardCache(scenario.id);

      res.json({ scenario, draftId: draft.id });
    } catch (error) {
      console.error("Error publishing draft:", error);
      res.status(500).json({ message: "Failed to publish scenario" });
    }
  });

  app.delete("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draft = await storage.getScenarioDraft(req.params.id);

      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteScenarioDraft(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ message: "Failed to delete draft" });
    }
  });

  // =====================================================
  // Professor Dashboard Routes
  // =====================================================

  // Helper to check if user is professor or admin
  const isProfessorOrAdmin = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || (user.role !== "professor" && user.role !== "admin")) {
      return res.status(403).json({ message: "Professor or admin access required" });
    }
    req.dbUser = user;
    next();
  };

  // Get professor's scenarios with enrollment stats
  app.get("/api/professor/scenarios", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scenarios = await storage.getScenariosWithStats(userId);
      res.json(scenarios);
    } catch (error) {
      console.error("Error fetching professor scenarios:", error);
      res.status(500).json({ message: "Failed to fetch scenarios" });
    }
  });

  // Get all sessions for a specific scenario (student roster)
  app.get("/api/professor/scenarios/:scenarioId/sessions", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;

      // Verify professor owns this scenario
      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to view this scenario's sessions" });
      }

      const sessions = await storage.getSessionsByScenario(scenarioId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching scenario sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // Get a specific session with full conversation history
  app.get("/api/professor/sessions/:sessionId/conversation", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const result = await storage.getSessionWithConversation(sessionId);
      if (!result) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify professor owns the scenario this session belongs to
      const scenario = await storage.getScenario(result.session.scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to view this session" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching session conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.get("/api/professor/sessions/:sessionId/events", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const session = await storage.getSimulationSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const scenario = await storage.getScenario(session.scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin" && !req.dbUser.isSuperAdmin) {
        return res.status(403).json({ message: "Not authorized to view this session's events" });
      }

      const events = await storage.getTurnEvents(sessionId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching session events:", error);
      res.status(500).json({ message: "Failed to fetch session events" });
    }
  });

  // Update session status (unenroll = "abandoned", re-enroll = "active")
  app.patch("/api/professor/sessions/:sessionId/status", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const { status } = req.body;

      if (!["active", "completed", "abandoned"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Verify session exists and professor owns the scenario
      const session = await storage.getSimulationSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const scenario = await storage.getScenario(session.scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to modify this session" });
      }

      const updated = await storage.updateSessionStatus(sessionId, status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating session status:", error);
      res.status(500).json({ message: "Failed to update session status" });
    }
  });

  // Delete a specific session (remove student from simulation)
  app.delete("/api/professor/sessions/:sessionId", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      // Verify session exists and professor owns the scenario
      const session = await storage.getSimulationSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const scenario = await storage.getScenario(session.scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin" && !req.dbUser.isSuperAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this session" });
      }

      await storage.deleteSimulationSession(sessionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // Delete a scenario and all its sessions
  app.delete("/api/professor/scenarios/:scenarioId", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;

      // Verify scenario exists and professor owns it
      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this scenario" });
      }

      await storage.deleteScenarioWithSessions(scenarioId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scenario:", error);
      res.status(500).json({ message: "Failed to delete scenario" });
    }
  });

  // Cohort analytics: aggregated class-level data for a scenario
  app.get("/api/scenarios/:scenarioId/cohort-analytics", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;

      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin" && !req.dbUser.isSuperAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const allSessions = await storage.getSessionsByScenario(scenarioId);

      if (allSessions.length === 0) {
        return res.json({
          totalStudents: 0,
          completedStudents: 0,
          decisionDistribution: [],
          stuckNodes: [],
          styleProfiles: [],
          classStrengths: [],
          conceptGaps: [],
          reasoningPatterns: [],
          teachingRecommendations: [],
          hasCourseConcepts: !!((scenario as any).courseConcepts?.length),
        });
      }

      const decisionPoints: Array<{
        number: number;
        prompt: string;
        format: string;
        options?: string[];
      }> = (scenario.initialState as any)?.decisionPoints || [];

      const allTurns: Array<{ turnNumber: number; studentInput: string; agentResponse: any; sessionId: string; createdAt: Date | null }> = [];
      const allEvents: Array<{ turnNumber: number | null; eventType: string; eventData: any; sessionId: string; createdAt: Date }> = [];

      for (const session of allSessions) {
        const sessionTurns = await storage.getTurnsBySession(session.id);
        for (const t of sessionTurns) {
          allTurns.push({
            turnNumber: t.turnNumber,
            studentInput: t.studentInput,
            agentResponse: t.agentResponse as any,
            sessionId: session.id,
            createdAt: t.createdAt,
          });
        }
        const sessionEvents = await storage.getTurnEvents(session.id);
        for (const e of sessionEvents) {
          allEvents.push({
            turnNumber: e.turnNumber,
            eventType: e.eventType,
            eventData: e.eventData as any,
            sessionId: session.id,
            createdAt: e.createdAt,
          });
        }
      }

      // 1. Decision Distribution (MCQ choices per step)
      const decisionDistribution: Array<{
        decisionNumber: number;
        prompt: string;
        format: string;
        choices: Array<{ option: string; count: number; percentage: number }>;
        totalResponses: number;
      }> = [];

      const maxTurn = Math.max(
        allTurns.reduce((max, t) => Math.max(max, t.turnNumber), 0),
        decisionPoints.length
      );
      for (let dn = 1; dn <= maxTurn; dn++) {
        const dp = decisionPoints.find(d => d.number === dn);
        const turnsAtStep = allTurns.filter(t => t.turnNumber === dn);
        const uniqueStudents = new Set(turnsAtStep.map(t => t.sessionId)).size;

        if (dp && dp.format === "multiple_choice" && dp.options && dp.options.length > 0) {
          const sessionChoice: Record<string, string> = {};
          for (const t of turnsAtStep) {
            if (sessionChoice[t.sessionId]) continue;
            const input = t.studentInput.trim();
            const matchedOpt = dp.options.find(opt =>
              input.toLowerCase().startsWith(opt.toLowerCase().substring(0, 10)) ||
              input.toLowerCase().includes(opt.toLowerCase())
            );
            sessionChoice[t.sessionId] = matchedOpt || input;
          }
          const choiceCounts: Record<string, number> = {};
          for (const opt of dp.options) choiceCounts[opt] = 0;
          for (const choice of Object.values(sessionChoice)) {
            choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
          }
          const uniqueRespondents = Object.keys(sessionChoice).length;
          decisionDistribution.push({
            decisionNumber: dn,
            prompt: dp.prompt || `Decisión ${dn}`,
            format: "multiple_choice",
            choices: Object.entries(choiceCounts)
              .map(([option, count]) => ({
                option,
                count,
                percentage: uniqueRespondents > 0 ? Math.round((count / uniqueRespondents) * 100) : 0,
              }))
              .sort((a, b) => b.count - a.count),
            totalResponses: uniqueRespondents,
          });
        } else {
          decisionDistribution.push({
            decisionNumber: dn,
            prompt: dp?.prompt || `Decisión ${dn}`,
            format: dp?.format || "written",
            choices: [],
            totalResponses: uniqueStudents,
          });
        }
      }

      // 2. Stuck Nodes (NUDGE counts per decision point)
      const stuckNodes: Array<{
        decisionNumber: number;
        nudgeCount: number;
        totalAttempts: number;
        nudgeRate: number;
      }> = [];

      for (let dn = 1; dn <= maxTurn; dn++) {
        const studentsAtStep = new Set(allTurns.filter(t => t.turnNumber === dn).map(t => t.sessionId));
        const totalStudentsAtStep = studentsAtStep.size;

        const studentsNudged = new Set<string>();
        for (const e of allEvents) {
          if (e.turnNumber === dn && e.eventType === "input_rejected") {
            studentsNudged.add(e.sessionId);
          }
        }
        for (const t of allTurns) {
          if (t.turnNumber === dn && (t.agentResponse?.turnStatus === "nudge" || t.agentResponse?.requiresRevision === true)) {
            studentsNudged.add(t.sessionId);
          }
        }
        const nudgeCount = studentsNudged.size;

        stuckNodes.push({
          decisionNumber: dn,
          nudgeCount,
          totalAttempts: totalStudentsAtStep,
          nudgeRate: totalStudentsAtStep > 0 ? Math.min(100, Math.round((nudgeCount / totalStudentsAtStep) * 100)) : 0,
        });
      }

      // 3. Reasoning Style Profiles (rule-based from competencyScores)
      const studentProfiles: Record<string, Record<string, number[]>> = {};
      for (const t of allTurns) {
        const scores = t.agentResponse?.competencyScores;
        if (scores && typeof scores === "object") {
          if (!studentProfiles[t.sessionId]) studentProfiles[t.sessionId] = {};
          for (const [comp, val] of Object.entries(scores)) {
            if (typeof val === "number") {
              if (!studentProfiles[t.sessionId][comp]) studentProfiles[t.sessionId][comp] = [];
              studentProfiles[t.sessionId][comp].push(val);
            }
          }
        }
      }

      const COMPETENCY_BUCKETS: Record<string, { profile: string; labelEs: string }> = {
        "financial analysis": { profile: "financial", labelEs: "Perfil Financiero" },
        "financial_analysis": { profile: "financial", labelEs: "Perfil Financiero" },
        "financialanalysis": { profile: "financial", labelEs: "Perfil Financiero" },
        "análisis financiero": { profile: "financial", labelEs: "Perfil Financiero" },
        "cost analysis": { profile: "financial", labelEs: "Perfil Financiero" },
        "budget management": { profile: "financial", labelEs: "Perfil Financiero" },
        "stakeholder awareness": { profile: "people", labelEs: "Perfil Humano" },
        "stakeholder_awareness": { profile: "people", labelEs: "Perfil Humano" },
        "stakeholderawareness": { profile: "people", labelEs: "Perfil Humano" },
        "comunicación": { profile: "people", labelEs: "Perfil Humano" },
        "team management": { profile: "people", labelEs: "Perfil Humano" },
        "liderazgo": { profile: "people", labelEs: "Perfil Humano" },
        "leadership": { profile: "people", labelEs: "Perfil Humano" },
        "communication": { profile: "people", labelEs: "Perfil Humano" },
        "risk assessment": { profile: "risk", labelEs: "Perfil de Riesgo" },
        "risk_assessment": { profile: "risk", labelEs: "Perfil de Riesgo" },
        "riskassessment": { profile: "risk", labelEs: "Perfil de Riesgo" },
        "gestión de riesgos": { profile: "risk", labelEs: "Perfil de Riesgo" },
        "risk management": { profile: "risk", labelEs: "Perfil de Riesgo" },
      };

      const profileData: Record<string, { count: number; label: string; sessionIds: string[] }> = {
        financial: { count: 0, label: "Perfil Financiero", sessionIds: [] },
        people: { count: 0, label: "Perfil Humano", sessionIds: [] },
        risk: { count: 0, label: "Perfil de Riesgo", sessionIds: [] },
        balanced: { count: 0, label: "Perfil Equilibrado", sessionIds: [] },
      };

      for (const [sessionId, compScores] of Object.entries(studentProfiles)) {
        const avgs: Record<string, number> = {};
        for (const [comp, vals] of Object.entries(compScores)) {
          avgs[comp.toLowerCase()] = vals.reduce((s, v) => s + v, 0) / vals.length;
        }

        let topProfile = "balanced";
        let topScore = -1;
        for (const [compKey, avg] of Object.entries(avgs)) {
          const bucket = COMPETENCY_BUCKETS[compKey];
          if (bucket && avg > topScore) {
            topScore = avg;
            topProfile = bucket.profile;
          }
        }

        if (topScore < 2.5) {
          topProfile = "balanced";
        }

        profileData[topProfile].count++;
        profileData[topProfile].sessionIds.push(sessionId);
      }

      const isSmallCohort = allSessions.length < 5;
      const extractPhrases = (sessionIds: string[], maxPhrases: number = 3): string[] => {
        if (isSmallCohort) return [];
        const phrases: string[] = [];
        for (const sid of sessionIds) {
          if (phrases.length >= maxPhrases) break;
          const turns = allTurns.filter(t => t.sessionId === sid);
          for (const t of turns) {
            if (phrases.length >= maxPhrases) break;
            const input = t.studentInput.trim();
            if (input.length > 20 && input.length < 200) {
              phrases.push(input.length > 120 ? input.substring(0, 117) + "..." : input);
            }
          }
        }
        return phrases;
      };

      const styleProfiles = Object.entries(profileData)
        .filter(([_, v]) => v.count > 0)
        .map(([key, v]) => ({
          key,
          label: v.label,
          count: v.count,
          representativePhrases: extractPhrases(v.sessionIds),
        }))
        .sort((a, b) => b.count - a.count);

      // 4. Class Strengths (most common high-scoring competencies)
      const compTotals: Record<string, { sum: number; count: number }> = {};
      for (const t of allTurns) {
        const scores = t.agentResponse?.competencyScores;
        if (scores && typeof scores === "object") {
          for (const [comp, val] of Object.entries(scores)) {
            if (typeof val === "number") {
              if (!compTotals[comp]) compTotals[comp] = { sum: 0, count: 0 };
              compTotals[comp].sum += val;
              compTotals[comp].count++;
            }
          }
        }
      }

      const classStrengths = Object.entries(compTotals)
        .map(([name, { sum, count }]) => ({
          name,
          averageScore: Math.round((sum / count) * 10) / 10,
          sampleSize: count,
        }))
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 8);

      // 5. Concept Gaps (Section A)
      const courseConcepts: string[] = (scenario as any).courseConcepts || [];
      const initialState = scenario.initialState as any;
      const conceptGaps: Array<{
        concept: string;
        validationFriction: number;
        timeFriction: number;
        evidenceUse: number;
        combinedFriction: number;
        hardestStep: number | null;
        topExamples: string[];
      }> = [];

      const scenarioFacts: string[] = [];
      if (initialState?.companyName && initialState.companyName.length > 2) scenarioFacts.push(initialState.companyName.toLowerCase());
      if (initialState?.stakeholders) {
        for (const s of initialState.stakeholders) {
          if (s.name && s.name.length > 2) scenarioFacts.push(s.name.toLowerCase());
        }
      }
      if (initialState?.keyConstraints) {
        for (const c of initialState.keyConstraints) {
          const words = c.split(/\s+/).filter((w: string) => w.length > 4);
          scenarioFacts.push(...words.slice(0, 2).map((w: string) => w.toLowerCase()));
        }
      }

      if (courseConcepts.length > 0 && decisionPoints.length > 0) {
        const conceptsPerStep: Record<number, string[]> = {};
        for (const dp of decisionPoints) {
          const stepNum = dp.number;
          const promptLower = (dp.prompt || "").toLowerCase();
          const matchedConcepts = courseConcepts.filter(c => promptLower.includes(c.toLowerCase()));
          if (matchedConcepts.length > 0) {
            conceptsPerStep[stepNum] = matchedConcepts;
          } else {
            const idx = decisionPoints.indexOf(dp);
            const assignedIdx = idx % courseConcepts.length;
            conceptsPerStep[stepNum] = [courseConcepts[assignedIdx]];
          }
        }

        const rejectionsByStep: Record<number, number> = {};
        for (const e of allEvents) {
          if (e.eventType === "input_rejected" && e.turnNumber != null) {
            rejectionsByStep[e.turnNumber] = (rejectionsByStep[e.turnNumber] || 0) + 1;
          }
        }

        const avgTimeByStep: Record<number, number> = {};
        const sessionTurnTimes: Record<string, Record<number, Date>> = {};
        for (const t of allTurns) {
          if (t.createdAt) {
            if (!sessionTurnTimes[t.sessionId]) sessionTurnTimes[t.sessionId] = {};
            if (!sessionTurnTimes[t.sessionId][t.turnNumber] || t.createdAt < sessionTurnTimes[t.sessionId][t.turnNumber]) {
              sessionTurnTimes[t.sessionId][t.turnNumber] = t.createdAt;
            }
          }
        }
        for (const [, turnMap] of Object.entries(sessionTurnTimes)) {
          const sortedTurns = Object.entries(turnMap).map(([n, d]) => ({ n: parseInt(n), d })).sort((a, b) => a.n - b.n);
          for (let i = 1; i < sortedTurns.length; i++) {
            const diffMs = sortedTurns[i].d.getTime() - sortedTurns[i - 1].d.getTime();
            const diffMin = diffMs / 60000;
            if (diffMin > 0 && diffMin < 120) {
              const step = sortedTurns[i].n;
              if (!avgTimeByStep[step]) avgTimeByStep[step] = 0;
              avgTimeByStep[step] += diffMin;
            }
          }
        }
        const sessionCount = Object.keys(sessionTurnTimes).length;
        for (const step of Object.keys(avgTimeByStep)) {
          avgTimeByStep[parseInt(step)] = sessionCount > 0 ? avgTimeByStep[parseInt(step)] / sessionCount : 0;
        }

        const conceptFriction: Record<string, { valFriction: number; timeFriction: number; stepFrictions: Record<number, number> }> = {};
        for (const concept of courseConcepts) {
          conceptFriction[concept] = { valFriction: 0, timeFriction: 0, stepFrictions: {} };
        }

        for (const [stepStr, concepts] of Object.entries(conceptsPerStep)) {
          const step = parseInt(stepStr);
          const rejections = rejectionsByStep[step] || 0;
          const timeAtStep = avgTimeByStep[step] || 0;
          for (const concept of concepts) {
            if (conceptFriction[concept]) {
              conceptFriction[concept].valFriction += rejections;
              conceptFriction[concept].timeFriction += timeAtStep;
              conceptFriction[concept].stepFrictions[step] = rejections + Math.round(timeAtStep);
            }
          }
        }

        for (const concept of courseConcepts) {
          const cf = conceptFriction[concept];
          const combined = cf.valFriction + Math.round(cf.timeFriction);
          let hardestStep: number | null = null;
          let maxStepFriction = 0;
          for (const [step, friction] of Object.entries(cf.stepFrictions)) {
            if (friction > maxStepFriction) {
              maxStepFriction = friction;
              hardestStep = parseInt(step);
            }
          }

          const conceptSteps = Object.keys(conceptsPerStep)
            .filter(s => conceptsPerStep[parseInt(s)]?.includes(concept))
            .map(s => parseInt(s));
          const conceptTurns = allTurns.filter(t => conceptSteps.includes(t.turnNumber));
          const evidenceCount = scenarioFacts.length > 0
            ? conceptTurns.filter(t => scenarioFacts.some(f => t.studentInput.toLowerCase().includes(f))).length
            : 0;
          const evidenceUse = conceptTurns.length > 0
            ? Math.round((evidenceCount / conceptTurns.length) * 100)
            : 0;

          const topExamples: string[] = [];
          if (!isSmallCohort && hardestStep != null) {
            const turnsAtStep = allTurns.filter(t => t.turnNumber === hardestStep);
            const seen = new Set<string>();
            for (const t of turnsAtStep) {
              if (topExamples.length >= 3) break;
              if (seen.has(t.sessionId)) continue;
              seen.add(t.sessionId);
              const input = t.studentInput.trim();
              if (input.length > 15 && input.length < 250) {
                topExamples.push(input.length > 140 ? input.substring(0, 137) + "..." : input);
              }
            }
          }

          conceptGaps.push({
            concept,
            validationFriction: cf.valFriction,
            timeFriction: Math.round(cf.timeFriction * 10) / 10,
            evidenceUse,
            combinedFriction: combined,
            hardestStep,
            topExamples,
          });
        }
        conceptGaps.sort((a, b) => b.combinedFriction - a.combinedFriction);
      }

      // 6. Reasoning Patterns (Section B)
      const allStudentInputs = allTurns.map(t => t.studentInput.toLowerCase());
      const reflectionTurns = allTurns.filter(t => {
        const totalDec = initialState?.totalDecisions || decisionPoints.length || 3;
        return t.turnNumber === totalDec + 1;
      });

      const stakeholderNames = ((initialState?.stakeholders || []) as Array<{ name: string }>)
        .map((s: { name: string }) => s.name.toLowerCase())
        .filter((n: string) => n.length > 2);
      const completedSessionIds = new Set(allSessions.filter(s => s.status === "completed").map(s => s.id));
      const completedInputs = allTurns.filter(t => completedSessionIds.has(t.sessionId)).map(t => t.studentInput.toLowerCase());
      const totalCompletedInputs = completedInputs.length || 1;

      const tradeOffKeywords = ["trade-off", "tradeoff", "por un lado", "sin embargo", "a cambio", "costo-beneficio", "por otro lado", "equilibrio entre", "compromiso entre"];
      const riskKeywords = ["riesgo", "mitigar", "contingencia", "plan b", "prevención", "peor escenario", "worst case"];
      const uncertaintyKeywords = ["no estoy seguro", "podría", "supongo", "asumo", "quizás", "tal vez", "posiblemente"];

      const countPattern = (inputs: string[], keywords: string[]) => {
        return inputs.filter(input => keywords.some(kw => input.includes(kw))).length;
      };

      const tradeOffCount = countPattern(completedInputs, tradeOffKeywords);
      const stakeholderCount = stakeholderNames.length > 0
        ? completedInputs.filter(input => stakeholderNames.some((n: string) => input.includes(n))).length
        : 0;
      const riskCount = countPattern(completedInputs, riskKeywords);
      const evidenceCount = scenarioFacts.length > 0
        ? completedInputs.filter(input => scenarioFacts.some(f => input.includes(f))).length
        : 0;
      const uncertaintyCount = countPattern(completedInputs, uncertaintyKeywords);

      const completedReflections = reflectionTurns.filter(t => completedSessionIds.has(t.sessionId));
      const reflectionKeywords = ["haría diferente", "aprendí", "cambiaría", "me di cuenta", "próxima vez", "en retrospectiva"];
      const reflectionCount = completedReflections.filter(t =>
        reflectionKeywords.some(kw => t.studentInput.toLowerCase().includes(kw))
      ).length;

      const pct = (count: number) => totalCompletedInputs > 0 ? Math.round((count / totalCompletedInputs) * 100) : 0;
      const reflectionPct = completedReflections.length > 0
        ? Math.round((reflectionCount / completedReflections.length) * 100) : 0;

      const reasoningPatterns = [
        { pattern: "Menciona trade-offs", percentage: pct(tradeOffCount), count: tradeOffCount },
        { pattern: "Identifica stakeholders", percentage: pct(stakeholderCount), count: stakeholderCount },
        { pattern: "Considera mitigación de riesgos", percentage: pct(riskCount), count: riskCount },
        { pattern: "Usa evidencia del caso", percentage: pct(evidenceCount), count: evidenceCount },
        { pattern: "Reconoce incertidumbre", percentage: pct(uncertaintyCount), count: uncertaintyCount },
        { pattern: "Reflexión presente", percentage: reflectionPct, count: reflectionCount },
      ].filter(p => p.count > 0 || p.pattern === "Menciona trade-offs" || p.pattern === "Reflexión presente");

      // 7. Teaching Recommendations (Section C)
      const teachingRecommendations: string[] = [];

      if (conceptGaps.length >= 2) {
        const topGaps = conceptGaps.slice(0, 2).map(g => g.concept);
        teachingRecommendations.push(`Principales brechas conceptuales: ${topGaps.join(", ")}. Considere dedicar más tiempo a estos temas en clase.`);
      } else if (conceptGaps.length === 1) {
        teachingRecommendations.push(`Brecha conceptual identificada: ${conceptGaps[0].concept}. Considere reforzar este concepto.`);
      } else {
        const highFrictionSteps = stuckNodes.filter(n => n.nudgeRate >= 30);
        if (highFrictionSteps.length > 0) {
          teachingRecommendations.push(`Alta fricción en ${highFrictionSteps.length} punto(s) de decisión. Revise si los estudiantes tienen suficiente contexto previo.`);
        } else {
          teachingRecommendations.push("Los estudiantes navegan la simulación sin brechas conceptuales significativas.");
        }
      }

      const topFrictionType = (() => {
        const totalValFriction = conceptGaps.reduce((s, g) => s + g.validationFriction, 0);
        const totalTimeFriction = conceptGaps.reduce((s, g) => s + g.timeFriction, 0);
        if (totalValFriction > totalTimeFriction && totalValFriction > 0) {
          return "rechazo de respuestas (los estudiantes envían respuestas que requieren re-elaboración)";
        } else if (totalTimeFriction > 0) {
          return "tiempo prolongado en decisiones (los estudiantes tardan más en formular respuestas)";
        }
        const highNudge = stuckNodes.filter(n => n.nudgeRate >= 40);
        if (highNudge.length > 0) return "orientación frecuente (NUDGE) en puntos clave de decisión";
        return null;
      })();
      if (topFrictionType) {
        teachingRecommendations.push(`Fricción más común: ${topFrictionType}.`);
      } else {
        teachingRecommendations.push("No se detectó fricción significativa en las respuestas del grupo.");
      }

      const weakestPattern = reasoningPatterns.length > 0
        ? reasoningPatterns.reduce((min, p) => p.percentage < min.percentage ? p : min, reasoningPatterns[0])
        : null;
      if (weakestPattern && weakestPattern.percentage < 30) {
        const suggestions: Record<string, string> = {
          "Menciona trade-offs": "Introduzca ejercicios de análisis de disyuntivas antes de la simulación.",
          "Identifica stakeholders": "Realice un mapeo de stakeholders como actividad previa.",
          "Considera mitigación de riesgos": "Agregue una actividad de identificación de riesgos en clase.",
          "Usa evidencia del caso": "Enfatice la importancia de citar datos del caso en las respuestas.",
          "Reconoce incertidumbre": "Fomente la reflexión sobre supuestos y limitaciones de información.",
          "Reflexión presente": "Dedique más tiempo a la etapa de reflexión post-simulación.",
        };
        teachingRecommendations.push(`Próximo paso sugerido: ${suggestions[weakestPattern.pattern] || "Refuerce los patrones de razonamiento menos observados."}`);
      } else {
        teachingRecommendations.push("El grupo muestra un buen balance en los patrones de razonamiento observados.");
      }

      const SIGNAL_CAP = 7;
      const cappedConceptGaps = conceptGaps.slice(0, Math.min(4, conceptGaps.length));
      const remainingSlots = Math.max(SIGNAL_CAP - cappedConceptGaps.length, 2);
      const cappedReasoningPatterns = reasoningPatterns.slice(0, remainingSlots);

      res.json({
        totalStudents: allSessions.length,
        completedStudents: allSessions.filter(s => s.status === "completed").length,
        decisionDistribution,
        stuckNodes,
        styleProfiles,
        classStrengths,
        conceptGaps: cappedConceptGaps,
        reasoningPatterns: cappedReasoningPatterns,
        teachingRecommendations,
        hasCourseConcepts: courseConcepts.length > 0,
      });
    } catch (error) {
      console.error("Error fetching cohort analytics:", error);
      res.status(500).json({ message: "Failed to fetch cohort analytics" });
    }
  });

  // Get aggregated themes from student responses for a scenario
  app.get("/api/professor/scenarios/:scenarioId/themes", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;

      // Verify professor owns this scenario
      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to view this scenario" });
      }

      // Get all sessions for this scenario
      const sessions = await storage.getSessionsByScenario(scenarioId);
      
      // Collect all student responses from completed sessions
      const allResponses: string[] = [];
      for (const session of sessions) {
        if (session.status === "completed" || session.status === "active") {
          const turns = await storage.getTurnsBySession(session.id);
          for (const turn of turns) {
            if (turn.studentInput) {
              allResponses.push(turn.studentInput);
            }
          }
        }
      }

      // Simple keyword extraction (POC level - just word frequency)
      const stopWords = new Set([
        "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "a", "al",
        "en", "con", "por", "para", "que", "se", "es", "son", "como", "pero", "más",
        "ya", "su", "sus", "mi", "tu", "y", "o", "no", "si", "lo", "le", "les",
        "me", "te", "nos", "este", "esta", "esto", "ese", "esa", "eso", "aquí", "ahí",
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have",
        "has", "had", "do", "does", "did", "will", "would", "could", "should", "may",
        "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of",
        "in", "for", "on", "with", "at", "by", "from", "or", "and", "not", "it", "this",
        "that", "i", "you", "he", "she", "we", "they", "what", "which", "who", "when",
        "where", "why", "how", "all", "each", "every", "both", "few", "more", "most",
        "other", "some", "such", "only", "own", "same", "so", "than", "too", "very"
      ]);

      const wordCounts: Record<string, number> = {};
      
      for (const response of allResponses) {
        const words = response.toLowerCase()
          .replace(/[^\wáéíóúñü\s]/g, " ")
          .split(/\s+/)
          .filter(word => word.length > 3 && !stopWords.has(word));
        
        for (const word of words) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      }

      // Get top 20 most common words
      const themes = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word, count]) => ({ word, count }));

      res.json({ 
        themes,
        totalResponses: allResponses.length,
        completedSessions: sessions.filter(s => s.status === "completed").length
      });
    } catch (error) {
      console.error("Error getting themes:", error);
      res.status(500).json({ message: "Failed to get themes" });
    }
  });

  // ============================================================================
  // USER PROFILE ROUTES
  // ============================================================================

  // Update user profile
  app.patch("/api/users/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const updateSchema = z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
      });
      
      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
      }

      const updated = await storage.updateUserProfile(userId, parseResult.data);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update user language preference
  app.patch("/api/users/language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const updateSchema = z.object({
        language: z.enum(["es", "en"]),
      });
      
      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
      }

      const updated = await storage.updateUserLanguage(userId, parseResult.data.language);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating user language:", error);
      res.status(500).json({ message: "Failed to update language" });
    }
  });

  // ============================================================================
  // LLM PROVIDER ROUTES (Superadmin only)
  // ============================================================================

  // Get all LLM providers (superadmin only)
  app.get("/api/llm-providers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Superadmin access required" });
      }

      const providers = await storage.getLlmProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching LLM providers:", error);
      res.status(500).json({ message: "Failed to fetch LLM providers" });
    }
  });

  // Get enabled LLM providers (all authenticated users - for scenario dropdown)
  app.get("/api/llm-providers/enabled", isAuthenticated, async (req, res) => {
    try {
      const providers = await storage.getEnabledLlmProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching enabled LLM providers:", error);
      res.status(500).json({ message: "Failed to fetch LLM providers" });
    }
  });

  // Create LLM provider (superadmin only)
  app.post("/api/llm-providers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Superadmin access required" });
      }

      const createSchema = z.object({
        name: z.string().min(1).max(100),
        provider: z.string().min(1).max(50),
        modelId: z.string().min(1).max(100),
        description: z.string().optional(),
        isEnabled: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });

      const parseResult = createSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
      }

      // If setting as default, unset other defaults first
      if (parseResult.data.isDefault) {
        const existing = await storage.getLlmProviders();
        for (const p of existing) {
          if (p.isDefault) {
            await storage.updateLlmProvider(p.id, { isDefault: false });
          }
        }
      }

      const provider = await storage.createLlmProvider(parseResult.data);
      res.status(201).json(provider);
    } catch (error) {
      console.error("Error creating LLM provider:", error);
      res.status(500).json({ message: "Failed to create LLM provider" });
    }
  });

  // Update LLM provider (superadmin only)
  app.put("/api/llm-providers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Superadmin access required" });
      }

      const { id } = req.params;
      const existing = await storage.getLlmProvider(id);
      if (!existing) {
        return res.status(404).json({ message: "LLM provider not found" });
      }

      const updateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        provider: z.string().min(1).max(50).optional(),
        modelId: z.string().min(1).max(100).optional(),
        description: z.string().nullable().optional(),
        isEnabled: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }).refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: "At least one field must be provided" }
      );

      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.errors });
      }

      // Strip undefined values to prevent overwriting with NULL
      const cleanedData = Object.fromEntries(
        Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
      );

      // If setting as default, unset other defaults first
      if (cleanedData.isDefault) {
        const allProviders = await storage.getLlmProviders();
        for (const p of allProviders) {
          if (p.isDefault && p.id !== id) {
            await storage.updateLlmProvider(p.id, { isDefault: false });
          }
        }
      }

      const updated = await storage.updateLlmProvider(id, cleanedData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating LLM provider:", error);
      res.status(500).json({ message: "Failed to update LLM provider" });
    }
  });

  // Delete LLM provider (superadmin only)
  app.delete("/api/llm-providers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Superadmin access required" });
      }

      const { id } = req.params;
      const existing = await storage.getLlmProvider(id);
      if (!existing) {
        return res.status(404).json({ message: "LLM provider not found" });
      }

      await storage.deleteLlmProvider(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting LLM provider:", error);
      res.status(500).json({ message: "Failed to delete LLM provider" });
    }
  });

  // Generate join code for a scenario (Kahoot-style)
  app.post("/api/scenarios/:scenarioId/generate-code", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;

      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Generate a 6-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const updated = await storage.updateScenario(scenarioId, { joinCode: code });
      res.json({ joinCode: code, scenario: updated });
    } catch (error) {
      console.error("Error generating join code:", error);
      res.status(500).json({ message: "Failed to generate join code" });
    }
  });

  // Toggle simulation start/stop (professor control)
  app.patch("/api/scenarios/:scenarioId/start", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;
      const { isStarted } = req.body;

      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updated = await storage.updateScenario(scenarioId, { isStarted: !!isStarted });
      res.json(updated);
    } catch (error) {
      console.error("Error toggling simulation start:", error);
      res.status(500).json({ message: "Failed to update simulation" });
    }
  });

  // Add a student to a scenario by email
  app.post("/api/scenarios/:scenarioId/students", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;
      const { email } = req.body;

      if (!email || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email required" });
      }

      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      // For now, just log - in production this would send an email
      console.log(`[Simulation] Invitation sent to ${email} for scenario "${scenario.title}"`);
      
      res.json({ 
        success: true, 
        message: `Invitation sent to ${email}`,
        email 
      });
    } catch (error) {
      console.error("Error adding student:", error);
      res.status(500).json({ message: "Failed to add student" });
    }
  });

  // Bulk add students to a scenario
  app.post("/api/scenarios/:scenarioId/students/bulk", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scenarioId } = req.params;
      const { emails } = req.body;

      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: "Array of emails required" });
      }

      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      const validEmails = emails.filter((e: string) => e && e.includes("@"));
      
      // For now, just log - in production this would send emails
      for (const email of validEmails) {
        console.log(`[Simulation] Invitation sent to ${email} for scenario "${scenario.title}"`);
      }
      
      res.json({ 
        success: true, 
        added: validEmails.length,
        message: `Invitations sent to ${validEmails.length} students`
      });
    } catch (error) {
      console.error("Error adding students:", error);
      res.status(500).json({ message: "Failed to add students" });
    }
  });

  // Join a simulation by code (student)
  app.post("/api/simulations/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Join code required" });
      }

      const scenario = await storage.getScenarioByJoinCode(code.toUpperCase());
      if (!scenario) {
        return res.status(404).json({ message: "Invalid code. Please check and try again." });
      }

      if (!scenario.isPublished) {
        return res.status(400).json({ message: "This simulation is not yet available." });
      }

      res.json({ 
        success: true, 
        scenarioId: scenario.id,
        title: scenario.title,
        isStarted: scenario.isStarted
      });
    } catch (error) {
      console.error("Error joining simulation:", error);
      res.status(500).json({ message: "Failed to join simulation" });
    }
  });

  // =========================================================
  // AI Cost Dashboard - Super Admin only
  // =========================================================

  app.get("/api/admin/ai-costs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { period = "7d" } = req.query;

      const now = new Date();
      let since: Date;
      switch (period) {
        case "24h": since = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
        case "7d": since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case "30d": since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case "all": since = new Date(0); break;
        default: since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const logs = await db.select().from(llmUsageLogs)
        .where(gte(llmUsageLogs.createdAt, since))
        .orderBy(desc(llmUsageLogs.createdAt));

      const byProvider: Record<string, { calls: number; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; errors: number }> = {};
      const byAgent: Record<string, { calls: number; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number }> = {};
      const bySession: Record<string, { calls: number; totalTokens: number; costUsd: number; userId: string | null }> = {};
      const byDay: Record<string, { calls: number; totalTokens: number; costUsd: number }> = {};

      let totalCost = 0;
      let totalTokensAll = 0;
      let totalCalls = 0;
      let totalErrors = 0;

      for (const log of logs) {
        const cost = parseFloat(log.costUsd);
        totalCost += cost;
        totalTokensAll += log.totalTokens;
        totalCalls++;
        if (!log.success) totalErrors++;

        const pKey = log.provider;
        if (!byProvider[pKey]) byProvider[pKey] = { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, errors: 0 };
        byProvider[pKey].calls++;
        byProvider[pKey].inputTokens += log.inputTokens;
        byProvider[pKey].outputTokens += log.outputTokens;
        byProvider[pKey].totalTokens += log.totalTokens;
        byProvider[pKey].costUsd += cost;
        if (!log.success) byProvider[pKey].errors++;

        const aKey = log.agentName || "unknown";
        if (!byAgent[aKey]) byAgent[aKey] = { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };
        byAgent[aKey].calls++;
        byAgent[aKey].inputTokens += log.inputTokens;
        byAgent[aKey].outputTokens += log.outputTokens;
        byAgent[aKey].totalTokens += log.totalTokens;
        byAgent[aKey].costUsd += cost;

        if (log.sessionId) {
          const sKey = String(log.sessionId);
          if (!bySession[sKey]) bySession[sKey] = { calls: 0, totalTokens: 0, costUsd: 0, userId: log.userId };
          bySession[sKey].calls++;
          bySession[sKey].totalTokens += log.totalTokens;
          bySession[sKey].costUsd += cost;
        }

        const day = log.createdAt.toISOString().split("T")[0];
        if (!byDay[day]) byDay[day] = { calls: 0, totalTokens: 0, costUsd: 0 };
        byDay[day].calls++;
        byDay[day].totalTokens += log.totalTokens;
        byDay[day].costUsd += cost;
      }

      res.json({
        summary: {
          totalCalls,
          totalTokens: totalTokensAll,
          totalCostUsd: parseFloat(totalCost.toFixed(6)),
          totalErrors,
          period,
        },
        byProvider: Object.entries(byProvider).map(([name, data]) => ({
          name,
          ...data,
          costUsd: parseFloat(data.costUsd.toFixed(6)),
        })),
        byAgent: Object.entries(byAgent).map(([name, data]) => ({
          name,
          ...data,
          costUsd: parseFloat(data.costUsd.toFixed(6)),
        })),
        bySession: Object.entries(bySession)
          .map(([id, data]) => ({
            sessionId: parseInt(id),
            ...data,
            costUsd: parseFloat(data.costUsd.toFixed(6)),
          }))
          .sort((a, b) => b.costUsd - a.costUsd)
          .slice(0, 50),
        byDay: Object.entries(byDay)
          .map(([date, data]) => ({
            date,
            ...data,
            costUsd: parseFloat(data.costUsd.toFixed(6)),
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        recentLogs: logs.slice(0, 100).map(log => ({
          id: log.id,
          provider: log.provider,
          model: log.model,
          inputTokens: log.inputTokens,
          outputTokens: log.outputTokens,
          totalTokens: log.totalTokens,
          costUsd: log.costUsd,
          agentName: log.agentName,
          sessionId: log.sessionId,
          durationMs: log.durationMs,
          success: log.success,
          createdAt: log.createdAt,
        })),
      });
    } catch (error) {
      console.error("[Admin] AI costs query error:", error);
      res.status(500).json({ message: "Failed to fetch AI cost data" });
    }
  });

  // AI Capacity Monitoring
  // =========================================================

  app.get("/api/monitoring/ai-capacity", async (_req: any, res) => {
    try {
      const status = getCapacityStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting AI capacity:", error);
      res.status(500).json({ message: "Failed to get AI capacity status" });
    }
  });

  app.get("/api/queue/status/:jobId", async (req: any, res) => {
    try {
      const { jobId } = req.params;

      const turnJob = turnQueue.getJobStatus(jobId);
      if (turnJob) {
        if (turnJob.result && turnJob.status === "completed") {
          return res.json({ ...turnJob, result: stripProfessorFields(turnJob.result as TurnResponse) });
        }
        return res.json(turnJob);
      }

      const llmJob = getLLMJobStatus(jobId);
      if (llmJob) {
        return res.json(llmJob);
      }

      return res.status(404).json({ message: "Job not found or expired" });
    } catch (error) {
      console.error("Error getting queue status:", error);
      res.status(500).json({ message: "Failed to get queue status" });
    }
  });

  const PROHIBITED_EN = /(\bcorrect\b|\bincorrect\b|good decision|bad decision|well done|\boptimal\b|\bideal\b|best option|should have|you should|\bconsider\b|needs? to|would benefit from|weak student|strong performer|struggling student|\bunfortunately\b|\bfortunately\b|\bsadly\b|\bsurprisingly\b|as expected|!)/i;
  const PROHIBITED_ES = /(\bcorrecto\b|\bincorrecto\b|buena decisi[oó]n|mala decisi[oó]n|bien hecho|\b[oó]ptimo\b|\bideal\b|mejor opci[oó]n|deber[ií]a haber|deber[ií]as|\bconsidera\b|\bnecesita\b|estudiante d[eé]bil|estudiante fuerte|\blamentablemente\b|\bafortunadamente\b|!)/i;
  function hasProhibited(text: string, isEn: boolean): boolean {
    return (isEn ? PROHIBITED_EN : PROHIBITED_ES).test(text);
  }

  async function generateClean(prompt: string, isEn: boolean, agentName: string, maxTokens: number, fallback: string): Promise<string> {
    try {
      let out = (await generateChatCompletion(
        [{ role: "user", content: prompt }],
        { maxTokens, model: "gpt-4o-mini", agentName }
      )).trim().replace(/^["']|["']$/g, "");
      if (hasProhibited(out, isEn)) {
        const retryPrompt = prompt + (isEn
          ? `\n\nThe previous attempt contained prohibited language. Generate again, strictly avoiding: should have, correct, incorrect, well done, optimal, ideal, best option, weak/strong student, unfortunately, fortunately, exclamation marks.`
          : `\n\nEl intento anterior contenía lenguaje prohibido. Genera de nuevo, evitando estrictamente: debería haber, correcto, incorrecto, bien hecho, óptimo, ideal, mejor opción, estudiante débil/fuerte, lamentablemente, afortunadamente, signos de exclamación.`);
        out = (await generateChatCompletion(
          [{ role: "user", content: retryPrompt }],
          { maxTokens, model: "gpt-4o-mini", agentName: agentName + "Retry" }
        )).trim().replace(/^["']|["']$/g, "");
        if (hasProhibited(out, isEn)) return fallback;
      }
      return out;
    } catch {
      return fallback;
    }
  }

  async function verifyScenarioOwner(req: any, res: any, scenarioId: string) {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || (user.role !== "professor" && user.role !== "admin")) {
      res.status(403).json({ message: "Professor access required" });
      return null;
    }
    const scenario = await storage.getScenario(scenarioId);
    if (!scenario) {
      res.status(404).json({ message: "Scenario not found" });
      return null;
    }
    if (scenario.authorId !== userId && user.role !== "admin") {
      res.status(403).json({ message: "Not authorized for this scenario" });
      return null;
    }
    return { user, scenario };
  }

  function getSessionsWithTurns(scenarioId: string) {
    return storage.getSessionsByScenario(scenarioId).then(async (sessions) => {
      const sessionsData = [];
      for (const session of sessions) {
        const turnsList = await db
          .select()
          .from(turnsTable)
          .where(eq(turnsTable.sessionId, session.id))
          .orderBy(turnsTable.turnNumber);
        sessionsData.push({ session, turns: turnsList });
      }
      return sessionsData;
    });
  }

  app.post("/api/admin/scenarios/:scenarioId/backfill-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (user.role !== "admin" && user.role !== "professor")) {
        return res.status(403).json({ message: "Admin or professor access required" });
      }

      const { scenarioId } = req.params;
      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) return res.status(404).json({ message: "Scenario not found" });
      if (scenario.authorId !== userId && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized for this scenario" });
      }

      const initialState = scenario.initialState as any;
      const language = initialState?.language || (scenario as any).language || "es";
      const frameworks = initialState?.frameworks || [];

      const sessionsData = await getSessionsWithTurns(scenarioId);
      const completed = sessionsData.filter(s => s.session.status === "completed");

      const { detectFrameworks } = await import("./agents/frameworkDetector");

      let processedSessions = 0, processedTurns = 0, errors = 0, skipped = 0;

      const compToSignal: Record<string, string> = {
        C1: "justification",
        C2: "intent",
        C3: "stakeholderAwareness",
        C4: "ethicalAwareness",
        C5: "tradeoffAwareness",
      };

      for (const s of completed) {
        const existingState = (s.session.currentState as any) || {};
        const existingLogs: any[] = existingState.decisionEvidenceLogs || [];
        const existingFwDets: any[][] = existingState.framework_detections || [];

        if (existingLogs.length >= s.turns.length && existingFwDets.length >= s.turns.length) {
          skipped++;
          continue;
        }

        const newLogs: any[] = [];
        const newFwDets: any[][] = [];
        let sessionAborted = false;

        for (const turn of s.turns) {
          try {
            const agentResp: any = turn.agentResponse || {};
            const updatedState = agentResp.updatedState || {};

            // Prefer evidence captured at the time of the turn
            if (!updatedState?.decisionEvidenceLogs?.length) {
              // No captured evidence for this turn — abort the whole session to preserve index alignment
              console.warn(`[Backfill] Skipping session ${s.session.id}: turn ${turn.turnNumber} has no captured evidence`);
              sessionAborted = true;
              errors++;
              break;
            }

            const lastLog = updatedState.decisionEvidenceLogs[updatedState.decisionEvidenceLogs.length - 1];
            const signalsDetected = lastLog.signals_detected;
            const rdsScore = lastLog.rds_score;
            const rdsBand = lastLog.rds_band;
            const rawScores = lastLog.raw_signal_scores;
            const competencyEvidence = lastLog.competency_evidence;
            const isMcq = lastLog.isMcq === true;

            const evidenceQuotes: Record<string, string> = {};
            for (const [comp, sigKey] of Object.entries(compToSignal)) {
              const sig = (signalsDetected as any)?.[sigKey];
              if (sig?.extracted_text && sig.quality >= 1) {
                evidenceQuotes[comp] = String(sig.extracted_text).substring(0, 160);
              }
            }

            newLogs.push({
              signals_detected: signalsDetected,
              rds_score: rdsScore,
              rds_band: rdsBand,
              competency_evidence: competencyEvidence,
              raw_signal_scores: rawScores,
              isMcq,
              student_input: turn.studentInput,
              classification: "PASS",
              evidence_quotes: evidenceQuotes,
              turn_number: turn.turnNumber,
            });

            if (!isMcq && frameworks.length > 0 && signalsDetected) {
              const fwDets = detectFrameworks(turn.studentInput, signalsDetected, frameworks, language);
              newFwDets.push(fwDets);
            } else {
              newFwDets.push([]);
            }

            processedTurns++;
          } catch (err) {
            console.error(`[Backfill] Failed turn ${turn.turnNumber} session ${s.session.id}:`, err);
            sessionAborted = true;
            errors++;
            break;
          }
        }

        if (sessionAborted) continue;

        const mergedState = {
          ...existingState,
          decisionEvidenceLogs: newLogs,
          framework_detections: newFwDets,
        };

        await storage.updateSimulationSession(s.session.id, { currentState: mergedState });
        processedSessions++;
      }

      invalidateDashboardCache(scenarioId);

      res.json({ processedSessions, processedTurns, errors, skipped, totalCompleted: completed.length });
    } catch (error) {
      console.error("[Backfill] Fatal error:", error);
      res.status(500).json({ message: "Backfill failed", error: String(error) });
    }
  });

  app.post("/api/scenarios/:scenarioId/class-stats", isAuthenticated, async (req: any, res) => {
    try {
      const { scenarioId } = req.params;
      const cached = getCached(`class-stats-${scenarioId}`);
      if (cached) return res.json(cached);

      const auth = await verifyScenarioOwner(req, res, scenarioId);
      if (!auth) return;

      const sessionsData = await getSessionsWithTurns(scenarioId);
      const completed = sessionsData.filter(s => s.session.status === "completed");
      const inProgress = sessionsData.filter(s => s.session.status === "active");

      let biggestDropPoint: { turn: number; delta: number } | null = null;
      if (completed.length > 0) {
        const maxTurns = Math.max(...completed.map(s => s.turns.length));
        const avgByTurn: number[] = [];
        for (let t = 0; t < maxTurns; t++) {
          let sum = 0, count = 0;
          for (const s of completed) {
            if (s.turns[t]) {
              const resp = s.turns[t].agentResponse as any;
              const band = resp?.updatedState?.decisionEvidenceLogs?.[t]?.rds_band;
              const val = band === "INTEGRATED" ? 3 : band === "ENGAGED" ? 2 : 1;
              sum += val;
              count++;
            }
          }
          avgByTurn.push(count > 0 ? sum / count : 0);
        }
        let maxDrop = 0;
        for (let t = 1; t < avgByTurn.length; t++) {
          const delta = avgByTurn[t] - avgByTurn[t - 1];
          if (delta < maxDrop) {
            maxDrop = delta;
            biggestDropPoint = { turn: t + 1, delta: Math.round(delta * 10) / 10 };
          }
        }
      }

      let appliedCourseTheory: { n: number; m: number } | null = null;
      const scenario = auth.scenario;
      const initialState = scenario.initialState as any;
      const frameworks = initialState?.frameworks;
      if (frameworks && frameworks.length > 0 && completed.length > 0) {
        let n = 0;
        for (const s of completed) {
          const state = s.session.currentState as any;
          const fwDetections = state?.framework_detections || [];
          const hasApplied = fwDetections.some((turnDetections: any[]) =>
            turnDetections?.some((d: any) => d.level === "explicit" || d.level === "implicit")
          );
          if (hasApplied) n++;
        }
        appliedCourseTheory = { n, m: completed.length };
      }

      const result = {
        completed: completed.length,
        inProgress: inProgress.length,
        biggestDropPoint,
        appliedCourseTheory,
      };
      setCache(`class-stats-${scenarioId}`, result);
      res.json(result);
    } catch (error) {
      console.error("Error computing class stats:", error);
      res.status(500).json({ message: "Failed to compute class stats" });
    }
  });

  app.post("/api/scenarios/:scenarioId/module-health", isAuthenticated, async (req: any, res) => {
    try {
      const { scenarioId } = req.params;
      const cached = getCached(`module-health-${scenarioId}`);
      if (cached) return res.json(cached);

      const auth = await verifyScenarioOwner(req, res, scenarioId);
      if (!auth) return;

      const scenario = auth.scenario;
      const initialState = scenario.initialState as any;
      const frameworks: any[] = initialState?.frameworks || [];
      const language = (scenario.initialState as any)?.language || scenario.language || "es";
      const isEn = language === "en";

      if (frameworks.length === 0) {
        const result = { frameworks: [], classDebriefOpener: null };
        setCache(`module-health-${scenarioId}`, result);
        return res.json(result);
      }

      const sessionsData = await getSessionsWithTurns(scenarioId);
      const completed = sessionsData.filter(s => s.session.status === "completed");

      const frameworkResults = await Promise.all(frameworks.map(async (fw: any) => {
        let appliedCount = 0;
        const evidenceTexts: string[] = [];
        for (const s of completed) {
          const state = s.session.currentState as any;
          const fwDetections: any[][] = state?.framework_detections || [];
          let applied = false;
          for (const turnDets of fwDetections) {
            const det = turnDets?.find((d: any) => d.framework_id === fw.id);
            if (det && (det.level === "explicit" || det.level === "implicit")) {
              applied = true;
              if (det.evidence) evidenceTexts.push(det.evidence);
            }
          }
          if (applied) appliedCount++;
        }

        const rate = completed.length > 0 ? appliedCount / completed.length : 0;
        let status: string;
        if (rate >= 0.60) status = "transferring";
        else if (rate >= 0.20) status = "developing";
        else if (rate > 0) status = "not_yet_evidenced";
        else status = "absent";

        let description: string;
        let deeperDescription: string;

        if (completed.length === 0) {
          description = isEn ? "No completed sessions yet." : "No hay sesiones completadas aún.";
          deeperDescription = description;
        } else {
          const fallbackShort = isEn
            ? `${appliedCount} of ${completed.length} students showed application of ${fw.name}.`
            : `${appliedCount} de ${completed.length} estudiantes mostraron aplicación de ${fw.name}.`;
          const descPrompt = isEn
            ? `Framework: "${fw.name}"\nApplied by ${appliedCount} of ${completed.length} students (${status}).\nEvidence samples from student responses:\n${evidenceTexts.slice(0, 5).map((e, i) => `${i+1}. ${e}`).join("\n") || "(No evidence collected)"}\n\nWrite a 2-3 sentence professor-facing description describing how students engaged with this framework. Mention how many students applied it. Describe what sub-concepts appeared or didn't based on the evidence. Descriptive only. No recommendations. No "should", "consider", "need to", "weak student", "strong performer". No exclamation marks. No comparisons by name. Write in English.`
            : `Marco: "${fw.name}"\nAplicado por ${appliedCount} de ${completed.length} estudiantes (${status}).\nEjemplos de evidencia:\n${evidenceTexts.slice(0, 5).map((e, i) => `${i+1}. ${e}`).join("\n") || "(Sin evidencia recopilada)"}\n\nEscribe una descripción de 2-3 oraciones para el profesor. Menciona cuántos estudiantes lo aplicaron. Describe qué sub-conceptos aparecieron o no aparecieron según la evidencia. Solo descriptivo. Sin recomendaciones. Sin "debería", "considera", "necesita", "estudiante débil", "estudiante fuerte". Sin signos de exclamación. Sin comparaciones por nombre. Escribe en español.`;
          description = await generateClean(descPrompt, isEn, "moduleHealthDescription", 200, fallbackShort);

          const deepPrompt = isEn
            ? `Framework: "${fw.name}" (status: ${status})\n${appliedCount} of ${completed.length} students applied it.\nFull evidence set:\n${evidenceTexts.map((e, i) => `${i+1}. ${e}`).join("\n") || "(No evidence)"}\n\nWrite a 3-5 sentence detailed description of how students engaged with this framework across the class. Describe which sub-concepts appeared, which were absent, and how consistently the pattern held. Descriptive only. Same prohibitions as above. Write in English.`
            : `Marco: "${fw.name}" (estado: ${status})\n${appliedCount} de ${completed.length} estudiantes lo aplicaron.\nConjunto completo de evidencia:\n${evidenceTexts.map((e, i) => `${i+1}. ${e}`).join("\n") || "(Sin evidencia)"}\n\nEscribe una descripción detallada de 3-5 oraciones de cómo los estudiantes interactuaron con este marco en la clase. Describe qué sub-conceptos aparecieron, cuáles estuvieron ausentes, y cuán consistente fue el patrón. Solo descriptivo. Mismas prohibiciones. Escribe en español.`;
          deeperDescription = await generateClean(deepPrompt, isEn, "moduleHealthDeeperDescription", 400, description);
        }

        return { id: fw.id, name: fw.name, status, description, deeperDescription };
      }));

      // Class debrief opener — connect lowest competency + lowest framework + worst turn
      const compMap: Record<string, { name: string; nameEs: string; rate: number; worstTurn: number | null }> = {
        C1: { name: "Analytical reasoning", nameEs: "Razonamiento analítico", rate: 0, worstTurn: null },
        C2: { name: "Strategic decision-making", nameEs: "Toma de decisiones estratégicas", rate: 0, worstTurn: null },
        C3: { name: "Stakeholder consideration", nameEs: "Consideración de stakeholders", rate: 0, worstTurn: null },
        C4: { name: "Ethical reasoning", nameEs: "Razonamiento ético", rate: 0, worstTurn: null },
        C5: { name: "Tradeoff awareness", nameEs: "Conciencia de tradeoffs", rate: 0, worstTurn: null },
      };
      for (const [key, info] of Object.entries(compMap)) {
        let count = 0, total = 0;
        const turnAbsence: Record<number, { absent: number; total: number }> = {};
        for (const s of completed) {
          const state = s.session.currentState as any;
          const logs = state?.decisionEvidenceLogs || [];
          logs.forEach((log: any, i: number) => {
            total++;
            const turnNum = i + 1;
            if (!turnAbsence[turnNum]) turnAbsence[turnNum] = { absent: 0, total: 0 };
            turnAbsence[turnNum].total++;
            const ev = log.competency_evidence?.[key];
            if (ev === "demonstrated" || ev === "emerging") count++;
            else turnAbsence[turnNum].absent++;
          });
        }
        info.rate = total > 0 ? count / total : 0;
        let maxAbsRate = 0;
        for (const [turnStr, data] of Object.entries(turnAbsence)) {
          const absRate = data.total > 0 ? data.absent / data.total : 0;
          if (absRate > maxAbsRate) {
            maxAbsRate = absRate;
            info.worstTurn = Number(turnStr);
          }
        }
      }

      const lowestComp = Object.entries(compMap).sort(([, a], [, b]) => a.rate - b.rate)[0];
      const fwOrder: Record<string, number> = { absent: 0, not_yet_evidenced: 1, developing: 2, transferring: 3 };
      const lowestFw = frameworkResults
        .filter(f => f.status !== "transferring")
        .sort((a, b) => (fwOrder[a.status] ?? 4) - (fwOrder[b.status] ?? 4))[0];

      let classDebriefOpener: string | null;
      if (completed.length === 0 || !lowestFw) {
        classDebriefOpener = null;
      } else {
        const targetTurn = lowestComp[1].worstTurn || 1;
        const compName = isEn ? lowestComp[1].name : lowestComp[1].nameEs;
        const openerFallback = isEn
          ? `In Turn ${targetTurn}, you made a decision — what framework were you working from, and what would it have looked like if you had named it explicitly?`
          : `En el Turno ${targetTurn}, tomaste una decisión — ¿desde qué marco estabas trabajando, y cómo se vería si lo nombraras explícitamente?`;
        const openerPrompt = isEn
          ? `You are generating a class debrief opener question for a professor.\nLowest competency: "${compName}" (demonstrated in only ${Math.round(lowestComp[1].rate * 100)}% of assessments)\nLowest-transferring framework: "${lowestFw.name}" (status: ${lowestFw.status})\nMost pronounced gap turn: Turn ${targetTurn}\n\nWrite ONE question (max 2 sentences) that:\n- References Turn ${targetTurn} specifically\n- Connects the framework and the competency\n- Is a genuine open question (ends with "?")\n- Asks students to name the framework they used AND consider a dimension they missed\n- Must not imply any student was wrong\n- No "should have", "what was the right answer", "correct", "incorrect"\n- No exclamation marks\n- Write in English`
          : `Vas a generar una pregunta de apertura de debrief para el profesor.\nCompetencia más baja: "${compName}" (demostrada en solo ${Math.round(lowestComp[1].rate * 100)}% de las evaluaciones)\nMarco con menor transferencia: "${lowestFw.name}" (estado: ${lowestFw.status})\nTurno con mayor brecha: Turno ${targetTurn}\n\nEscribe UNA pregunta (máx 2 oraciones) que:\n- Haga referencia específica al Turno ${targetTurn}\n- Conecte el marco y la competencia\n- Sea una pregunta abierta genuina (termine con "?")\n- Pida a los estudiantes nombrar el marco que usaron Y considerar una dimensión que omitieron\n- No debe implicar que algún estudiante estaba equivocado\n- Sin "deberías haber", "cuál era la respuesta correcta", "correcto", "incorrecto"\n- Sin signos de exclamación\n- Escribe en español`;
        classDebriefOpener = await generateClean(openerPrompt, isEn, "classDebriefOpener", 200, openerFallback);
      }

      const result = { frameworks: frameworkResults, classDebriefOpener };
      setCache(`module-health-${scenarioId}`, result);
      res.json(result);
    } catch (error) {
      console.error("Error computing module health:", error);
      res.status(500).json({ message: "Failed to compute module health" });
    }
  });

  app.post("/api/scenarios/:scenarioId/depth-trajectory", isAuthenticated, async (req: any, res) => {
    try {
      const { scenarioId } = req.params;
      const cached = getCached(`depth-trajectory-${scenarioId}`);
      if (cached) return res.json(cached);

      const auth = await verifyScenarioOwner(req, res, scenarioId);
      if (!auth) return;

      const sessionsData = await getSessionsWithTurns(scenarioId);
      const completed = sessionsData.filter(s => s.session.status === "completed");
      const language = (auth.scenario.initialState as any)?.language || auth.scenario.language || "es";
      const isEn = language === "en";

      if (completed.length === 0) {
        const result = { points: [], annotations: [] };
        setCache(`depth-trajectory-${scenarioId}`, result);
        return res.json(result);
      }

      const maxTurns = Math.max(...completed.map(s => s.turns.length));
      const points: any[] = [];
      const annotations: any[] = [];

      // Pre-fetch NUDGE/BLOCK counts per turn from turn_events for the whole class
      const sessionIds = completed.map(s => s.session.id);
      const nudgeBlockByTurn: Record<number, { nudge: number; block: number }> = {};
      if (sessionIds.length > 0) {
        const events = await db
          .select({
            turnNumber: turnEvents.turnNumber,
            eventType: turnEvents.eventType,
            eventData: turnEvents.eventData,
          })
          .from(turnEvents)
          .where(
            and(
              inArray(turnEvents.sessionId, sessionIds),
              inArray(turnEvents.eventType, ["input_rejected", "agent_call"])
            )
          );
        for (const ev of events) {
          const tn = ev.turnNumber;
          if (tn == null) continue;
          if (!nudgeBlockByTurn[tn]) nudgeBlockByTurn[tn] = { nudge: 0, block: 0 };
          if (ev.eventType === "input_rejected") {
            nudgeBlockByTurn[tn].block++;
          } else if (ev.eventType === "agent_call" && (ev.eventData as any)?.classification === "NUDGE") {
            nudgeBlockByTurn[tn].nudge++;
          }
        }
      }

      for (let t = 0; t < maxTurns; t++) {
        let sum = 0, count = 0;
        let integratedCount = 0, engagedCount = 0, surfaceCount = 0;
        let passCount = 0;
        for (const s of completed) {
          const state = s.session.currentState as any;
          const logs = state?.decisionEvidenceLogs || [];
          if (logs[t]) {
            const band = logs[t].rds_band;
            sum += band === "INTEGRATED" ? 3 : band === "ENGAGED" ? 2 : 1;
            count++;
            if (band === "INTEGRATED") integratedCount++;
            else if (band === "ENGAGED") engagedCount++;
            else surfaceCount++;
            passCount++;
          }
        }
        const turnNum = t + 1;
        const nudgeCount = nudgeBlockByTurn[turnNum]?.nudge || 0;
        const blockCount = nudgeBlockByTurn[turnNum]?.block || 0;
        const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
        const color = avg >= 2.5 ? "green" : avg >= 1.5 ? "blue" : "amber";
        points.push({ turn: t + 1, avg, color });

        let label: string;
        if (t === 0) {
          label = avg >= 2.5 ? "Integrated" : avg >= 1.5 ? "Engaged" : "Surface";
        } else {
          const prev = points[t - 1].avg;
          if (avg >= 2.5) label = "Peaked";
          else if (avg >= 1.5) label = "Engaged";
          else label = avg < prev ? "Dropped" : "Surface";
        }

        const priorAvg = t > 0 ? points[t - 1].avg : null;
        const fallback = isEn
          ? `Average depth ${avg} at Turn ${t + 1} with ${nudgeCount} nudge and ${blockCount} block events.`
          : `Profundidad promedio ${avg} en Turno ${t + 1} con ${nudgeCount} eventos de nudge y ${blockCount} de block.`;
        const annoPrompt = isEn
          ? `Class reasoning depth at Turn ${t + 1}: avg ${avg} (${integratedCount} integrated, ${engagedCount} engaged, ${surfaceCount} surface out of ${count} students).\nClassification events this turn: ${passCount} PASS, ${nudgeCount} NUDGE, ${blockCount} BLOCK.\n${priorAvg !== null ? `Previous turn avg: ${priorAvg} (change: ${(avg - priorAvg).toFixed(1)}).` : "This is the first turn — no prior comparison."}\n\nWrite 1-2 sentences describing what the data shows drove the depth at this turn. Describe only — no recommendations, no teaching advice. No "should", "consider", "need to", "unfortunately", "fortunately". No exclamation marks. Write in English.`
          : `Profundidad de razonamiento de la clase en el Turno ${t + 1}: promedio ${avg} (${integratedCount} integrado, ${engagedCount} engaged, ${surfaceCount} superficial de ${count} estudiantes).\nEventos de clasificación este turno: ${passCount} PASS, ${nudgeCount} NUDGE, ${blockCount} BLOCK.\n${priorAvg !== null ? `Promedio del turno anterior: ${priorAvg} (cambio: ${(avg - priorAvg).toFixed(1)}).` : "Este es el primer turno — no hay comparación previa."}\n\nEscribe 1-2 oraciones describiendo lo que los datos muestran que impulsó la profundidad en este turno. Solo descripción — sin recomendaciones, sin consejos pedagógicos. Sin "debería", "considera", "necesita", "lamentablemente", "afortunadamente". Sin signos de exclamación. Escribe en español.`;
        const description = await generateClean(annoPrompt, isEn, "depthTurnAnnotation", 150, fallback);
        annotations.push({ turn: t + 1, label, description });
      }

      const result = { points, annotations };
      setCache(`depth-trajectory-${scenarioId}`, result);
      res.json(result);
    } catch (error) {
      console.error("Error computing depth trajectory:", error);
      res.status(500).json({ message: "Failed to compute depth trajectory" });
    }
  });

  app.post("/api/scenarios/:scenarioId/class-patterns", isAuthenticated, async (req: any, res) => {
    try {
      const { scenarioId } = req.params;
      const cached = getCached(`class-patterns-${scenarioId}`);
      if (cached) return res.json(cached);

      const auth = await verifyScenarioOwner(req, res, scenarioId);
      if (!auth) return;

      const sessionsData = await getSessionsWithTurns(scenarioId);
      const completed = sessionsData.filter(s => s.session.status === "completed");
      const language = (auth.scenario.initialState as any)?.language || auth.scenario.language || "es";
      const isEn = language === "en";

      const competencyMap: Record<string, { name: string; nameEs: string; count: number; total: number }> = {
        C1: { name: "Analytical reasoning", nameEs: "Razonamiento analítico", count: 0, total: 0 },
        C2: { name: "Strategic decision-making", nameEs: "Toma de decisiones estratégicas", count: 0, total: 0 },
        C3: { name: "Stakeholder consideration", nameEs: "Consideración de stakeholders", count: 0, total: 0 },
        C4: { name: "Ethical reasoning", nameEs: "Razonamiento ético", count: 0, total: 0 },
        C5: { name: "Tradeoff awareness", nameEs: "Conciencia de tradeoffs", count: 0, total: 0 },
      };

      for (const s of completed) {
        const state = s.session.currentState as any;
        const logs = state?.decisionEvidenceLogs || [];
        for (const log of logs) {
          const evidence = log.competency_evidence || {};
          for (const [key, info] of Object.entries(competencyMap)) {
            info.total++;
            const compEvidence = evidence[key];
            if (compEvidence === "demonstrated" || compEvidence === "emerging") {
              info.count++;
            }
          }
        }
      }

      // Collect evidence quotes per competency for AI descriptions
      const competencyEvidence: Record<string, string[]> = { C1: [], C2: [], C3: [], C4: [], C5: [] };
      for (const s of completed) {
        const state = s.session.currentState as any;
        const logs = state?.decisionEvidenceLogs || [];
        for (const log of logs) {
          const evidence = log.competency_evidence || {};
          const quotes = log.evidence_quotes || {};
          for (const key of Object.keys(competencyEvidence)) {
            if (evidence[key] && quotes[key] && competencyEvidence[key].length < 8) {
              competencyEvidence[key].push(String(quotes[key]));
            }
          }
        }
      }

      const patterns = await Promise.all(Object.entries(competencyMap).map(async ([id, info]) => {
        const rate = info.total > 0 ? info.count / info.total : 0;
        let status: string;
        if (rate >= 0.60) status = "transferring";
        else if (rate >= 0.20) status = "developing";
        else status = "not_yet_evidenced";

        const compName = isEn ? info.name : info.nameEs;
        const fallback = isEn
          ? `Observed in ${info.count} of ${info.total} turn-level assessments across the class.`
          : `Observado en ${info.count} de ${info.total} evaluaciones a nivel de turno en toda la clase.`;

        let description = fallback;
        if (info.total > 0) {
          const samples = competencyEvidence[id].slice(0, 5);
          const prompt = isEn
            ? `Competency: "${compName}"\nDemonstrated in ${info.count} of ${info.total} turn-level assessments (${Math.round(rate * 100)}%, status: ${status}).\nEvidence quotes from student responses:\n${samples.map((q, i) => `${i+1}. "${q}"`).join("\n") || "(No evidence quotes available)"}\n\nWrite a 2-3 sentence professor-facing description of how this competency appeared (or didn't) across the class. Mention the rate. Describe the pattern of how students engaged with this competency based on the evidence. Descriptive only. No "should", "consider", "need to", "weak student", "strong student", "unfortunately". No exclamation marks. No naming individual students. Write in English.`
            : `Competencia: "${compName}"\nDemostrada en ${info.count} de ${info.total} evaluaciones a nivel de turno (${Math.round(rate * 100)}%, estado: ${status}).\nCitas de evidencia de respuestas de estudiantes:\n${samples.map((q, i) => `${i+1}. "${q}"`).join("\n") || "(Sin citas de evidencia disponibles)"}\n\nEscribe una descripción de 2-3 oraciones para el profesor sobre cómo esta competencia apareció (o no) en la clase. Menciona la tasa. Describe el patrón con que los estudiantes interactuaron con esta competencia según la evidencia. Solo descriptivo. Sin "debería", "considera", "necesita", "estudiante débil", "estudiante fuerte", "lamentablemente". Sin signos de exclamación. Sin nombrar estudiantes individuales. Escribe en español.`;
          description = await generateClean(prompt, isEn, "classPatternDescription", 250, fallback);
        }

        return {
          id,
          name: compName,
          rate: Math.round(rate * 100) / 100,
          status,
          description,
        };
      }));

      patterns.sort((a, b) => b.rate - a.rate);

      const result = { patterns };
      setCache(`class-patterns-${scenarioId}`, result);
      res.json(result);
    } catch (error) {
      console.error("Error computing class patterns:", error);
      res.status(500).json({ message: "Failed to compute class patterns" });
    }
  });

  app.get("/api/scenarios/:scenarioId/students-summary", isAuthenticated, async (req: any, res) => {
    try {
      const { scenarioId } = req.params;
      const auth = await verifyScenarioOwner(req, res, scenarioId);
      if (!auth) return;

      const language = (auth.scenario.initialState as any)?.language || auth.scenario.language || "es";
      const isEn = language === "en";
      const sessionsData = await getSessionsWithTurns(scenarioId);

      const students = sessionsData.map(({ session, turns: turnsList }) => {
        const state = session.currentState as any;
        const logs = state?.decisionEvidenceLogs || [];
        const isComplete = session.status === "completed";

        const arc: any[] = [];
        for (let i = 0; i < logs.length; i++) {
          const band = logs[i]?.rds_band || "SURFACE";
          const color = band === "INTEGRATED" ? "#1D9E75" : band === "ENGAGED" ? "#378ADD" : "#BA7517";
          arc.push({ turn: i + 1, band: band.toLowerCase(), color });
        }

        let arcLabel = isEn ? "Available when completed" : "Disponible al completar";
        if (isComplete && arc.length > 0) {
          const bands = arc.map(a => a.band);
          const allSame = bands.every(b => b === bands[0]);
          if (allSame) arcLabel = isEn ? "Consistent throughout" : "Consistente";
          else {
            const peak = bands.indexOf("integrated");
            const lastDrop = bands.lastIndexOf("surface");
            if (peak >= 0 && lastDrop > peak) arcLabel = isEn ? `Peaked T${peak + 1} · dropped T${lastDrop + 1}` : `Pico T${peak + 1} · bajó T${lastDrop + 1}`;
            else if (bands.every((b, i) => i === 0 || bands[i] >= bands[i - 1])) arcLabel = isEn ? `Late activator · improved T${bands.length}` : `Activación tardía · mejoró T${bands.length}`;
            else if (bands.every((b, i) => i === 0 || bands[i] <= bands[i - 1])) arcLabel = isEn ? `Early peak · dropped T${bands.length}` : `Pico temprano · bajó T${bands.length}`;
            else arcLabel = isEn ? "Mixed depth" : "Profundidad mixta";
          }
        }

        const keyPattern = isComplete
          ? (state?.dashboard_summary?.session_headline || "—")
          : "—";

        return {
          sessionId: session.id,
          name: (session as any).user?.firstName
            ? `${(session as any).user.firstName} ${(session as any).user.lastName || ""}`.trim()
            : (session as any).user?.email || "Student",
          email: (session as any).user?.email || "",
          status: session.status,
          arc: isComplete ? arc : [],
          arcLabel,
          keyPattern,
          canView: isComplete,
        };
      });

      res.json({ students });
    } catch (error) {
      console.error("Error computing students summary:", error);
      res.status(500).json({ message: "Failed to compute students summary" });
    }
  });

  async function verifySessionAccess(req: any, res: any, sessionId: string) {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || (user.role !== "professor" && user.role !== "admin")) {
      res.status(403).json({ message: "Professor access required" });
      return null;
    }
    const sessionData = await storage.getSessionWithConversation(sessionId);
    if (!sessionData) {
      res.status(404).json({ message: "Session not found" });
      return null;
    }
    const scenario = await storage.getScenario(sessionData.session.scenarioId);
    if (!scenario) {
      res.status(404).json({ message: "Scenario not found" });
      return null;
    }
    if (scenario.authorId !== userId && user.role !== "admin") {
      res.status(403).json({ message: "Not authorized for this session" });
      return null;
    }
    return sessionData;
  }

  app.get("/api/sessions/:sessionId/summary", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const sessionData = await verifySessionAccess(req, res, sessionId);
      if (!sessionData) return;

      const { session, turns: turnsList } = sessionData;
      const state = session.currentState as any;
      const logs = state?.decisionEvidenceLogs || [];

      const arc = logs.map((log: any, i: number) => {
        const band = log?.rds_band || "SURFACE";
        const color = band === "INTEGRATED" ? "#1D9E75" : band === "ENGAGED" ? "#378ADD" : "#BA7517";
        return { turn: i + 1, band: band.toLowerCase(), color };
      });

      const isComplete = session.status === "completed";
      res.json({
        studentName: (session as any).user?.firstName
          ? `${(session as any).user.firstName} ${(session as any).user.lastName || ""}`.trim()
          : (session as any).user?.email || "Student",
        scenarioTitle: (session as any).scenario?.title || "",
        status: session.status,
        isComplete,
        completedAt: isComplete ? session.updatedAt : null,
        dashboardSummary: state?.dashboard_summary || null,
        arc,
      });
    } catch (error) {
      console.error("Error getting session summary:", error);
      res.status(500).json({ message: "Failed to get session summary" });
    }
  });

  // Phase 1a: Regenerate dashboard summary on demand. Used when generation
  // failed silently during the reflection step or when the professor wants a
  // fresh summary after data backfill.
  app.post("/api/sessions/:sessionId/regenerate-summary", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const sessionData = await verifySessionAccess(req, res, sessionId);
      if (!sessionData) return;

      const { session } = sessionData;
      const state = (session.currentState as any) || {};
      const logs = state.decisionEvidenceLogs || [];
      const fwDetections = state.framework_detections || [];

      if (logs.length === 0) {
        return res.status(400).json({ message: "No evidence logs available to summarize" });
      }

      const scenario = await storage.getScenario(session.scenarioId);
      const initialState = (scenario?.initialState as any) || {};
      const frameworks = initialState.frameworks || [];
      const language = initialState.language || (scenario as any)?.language || "es";

      const { generateDashboardSummary } = await import("./agents/director");
      const ctx: any = {
        scenario: { ...scenario, frameworks },
        language,
        currentKpis: state.kpis,
        indicators: state.indicators,
        history: state.history || [],
        turnCount: state.turnCount || logs.length,
        decisionEvidenceLogs: logs,
        framework_detections: fwDetections,
      };

      const newSummary = await generateDashboardSummary(ctx, logs, fwDetections, frameworks);

      const mergedState = { ...state, dashboard_summary: newSummary };
      await storage.updateSimulationSession(sessionId, { currentState: mergedState });
      invalidateDashboardCache(session.scenarioId);

      res.json({ dashboard_summary: newSummary });
    } catch (error) {
      console.error("Error regenerating session summary:", error);
      res.status(500).json({ message: "Failed to regenerate summary" });
    }
  });

  app.get("/api/sessions/:sessionId/chat-history", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const sessionData = await verifySessionAccess(req, res, sessionId);
      if (!sessionData) return;

      const scenario = await storage.getScenario(sessionData.session.scenarioId);
      const decisionPoints = (scenario?.initialState as any)?.decisionPoints || [];

      const chatTurns = sessionData.turns.map((turn) => {
        const dp = decisionPoints.find((d: any) => d.number === turn.turnNumber);
        return {
          number: turn.turnNumber,
          type: dp?.format === "multiple_choice" ? "mcq" : "free_response",
          prompt: dp?.prompt || dp?.situation || "",
          studentInput: turn.studentInput,
        };
      });

      res.json({ turns: chatTurns });
    } catch (error) {
      console.error("Error getting chat history:", error);
      res.status(500).json({ message: "Failed to get chat history" });
    }
  });

  app.get("/api/sessions/:sessionId/debrief-prep", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const sessionData = await verifySessionAccess(req, res, sessionId);
      if (!sessionData) return;

      const state = sessionData.session.currentState as any;
      const logs = state?.decisionEvidenceLogs || [];
      const scenario = await storage.getScenario(sessionData.session.scenarioId);
      const decisionPoints = (scenario?.initialState as any)?.decisionPoints || [];

      const debriefTurns = sessionData.turns.map((turn) => {
        const resp = turn.agentResponse as any;
        const dp = decisionPoints.find((d: any) => d.number === turn.turnNumber);
        const logEntry = logs[turn.turnNumber - 1];
        const band = logEntry?.rds_band || "SURFACE";

        const kpiMovements = (resp?.displayKPIs || []).map((kpi: any) => ({
          label: kpi.label,
          direction: kpi.direction,
          tier: kpi.magnitude?.toLowerCase() || kpi.magnitudeEn?.toLowerCase() || "slight",
          reasoningLink: kpi.dashboard_reasoning_link || "",
        }));

        return {
          number: turn.turnNumber,
          type: dp?.format === "multiple_choice" ? "mcq" : "free_response",
          depth: band.toLowerCase(),
          studentInput: turn.studentInput,
          kpiMovements,
          debriefQuestion: resp?.dashboard_debrief_question || "",
        };
      });

      res.json({ turns: debriefTurns });
    } catch (error) {
      console.error("Error getting debrief prep:", error);
      res.status(500).json({ message: "Failed to get debrief prep" });
    }
  });

  app.get("/api/sessions/:sessionId/reasoning-signals", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const sessionData = await verifySessionAccess(req, res, sessionId);
      if (!sessionData) return;

      const state = sessionData.session.currentState as any;
      const logs = state?.decisionEvidenceLogs || [];
      const language = (state as any)?.language || "es";
      const isEn = language === "en";

      const signalNames = [
        { key: "intent", name: "Strategic decision-making", nameEs: "Toma de decisiones estratégicas" },
        { key: "justification", name: "Analytical reasoning", nameEs: "Razonamiento analítico" },
        { key: "tradeoffAwareness", name: "Tradeoff awareness", nameEs: "Conciencia de tradeoffs" },
        { key: "stakeholderAwareness", name: "Stakeholder consideration", nameEs: "Consideración de stakeholders" },
        { key: "ethicalAwareness", name: "Ethical reasoning", nameEs: "Razonamiento ético" },
      ];

      const signalAverages: Record<string, number> = {};
      const turnSignals: any[] = [];

      // Phase 1a: averages now include MCQ turns. MCQ turns can carry meaningful
      // signals (e.g. tradeoffAwareness from option signatures) and excluding them
      // produced contradictions between this view and the framework detector view.
      for (const sig of signalNames) {
        const sum = logs.reduce((acc: number, l: any) => acc + (l.signals_detected?.[sig.key]?.quality ?? 0), 0);
        signalAverages[sig.key === "justification" ? "analytical" : sig.key === "intent" ? "strategic" : sig.key === "tradeoffAwareness" ? "tradeoff" : sig.key === "stakeholderAwareness" ? "stakeholder" : "ethical"] = logs.length > 0 ? Math.round((sum / logs.length) * 10) / 10 : 0;
      }

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const signals = signalNames.map(sig => {
          const quality = log.signals_detected?.[sig.key]?.quality ?? 0;
          const extractedText = log.signals_detected?.[sig.key]?.extracted_text || "";
          let level: string;
          if (quality >= 2) level = "Demonstrated";
          else if (quality >= 1) level = "Emerging";
          else level = "Not evidenced";

          return {
            name: isEn ? sig.name : sig.nameEs,
            level,
            explanation: extractedText || (isEn ? "No specific evidence extracted." : "No se extrajo evidencia específica."),
          };
        });
        turnSignals.push({ number: i + 1, signals });
      }

      res.json({ signalAverages, turns: turnSignals });
    } catch (error) {
      console.error("Error getting reasoning signals:", error);
      res.status(500).json({ message: "Failed to get reasoning signals" });
    }
  });

  app.get("/api/sessions/:sessionId/kpi-frameworks", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const sessionData = await verifySessionAccess(req, res, sessionId);
      if (!sessionData) return;

      const state = sessionData.session.currentState as any;
      const logs = state?.decisionEvidenceLogs || [];
      const fwDetections: any[][] = state?.framework_detections || [];
      const scenario = await storage.getScenario(sessionData.session.scenarioId);
      const decisionPoints = (scenario?.initialState as any)?.decisionPoints || [];

      const kpiTurns = sessionData.turns.map((turn, idx) => {
        const resp = turn.agentResponse as any;
        const dp = decisionPoints.find((d: any) => d.number === turn.turnNumber);
        const logEntry = logs[turn.turnNumber - 1];
        const band = logEntry?.rds_band || "SURFACE";

        const kpiMovements = (resp?.displayKPIs || []).map((kpi: any) => ({
          kpiId: kpi.indicatorId,
          label: kpi.label,
          direction: kpi.direction,
          tier: kpi.magnitude?.toLowerCase() || "slight",
          reasoningLink: kpi.dashboard_reasoning_link || "",
        }));

        const turnFwDets = fwDetections[idx] || [];
        const frameworkApplications = turnFwDets.map((d: any) => ({
          frameworkId: d.framework_id,
          name: d.framework_name,
          level: d.level,
          evidence: d.evidence || "",
        }));

        return {
          number: turn.turnNumber,
          type: dp?.format === "multiple_choice" ? "mcq" : "free_response",
          depth: band.toLowerCase(),
          kpiMovements,
          frameworkApplications,
        };
      });

      const activeKpis = new Set<string>();
      for (const turn of kpiTurns) {
        for (const kpi of turn.kpiMovements) {
          activeKpis.add(kpi.kpiId);
        }
      }

      res.json({ turns: kpiTurns, activeKpis: Array.from(activeKpis) });
    } catch (error) {
      console.error("Error getting KPI frameworks:", error);
      res.status(500).json({ message: "Failed to get KPI frameworks" });
    }
  });
}
