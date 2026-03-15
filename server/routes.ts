import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processStudentTurn, processReflection, DEFAULT_DIRECTOR_PROMPT } from "./agents/director";
import { DEFAULT_EVALUATOR_PROMPT } from "./agents/evaluator";
import { DEFAULT_NARRATOR_PROMPT } from "./agents/narrator";
import { DEFAULT_DOMAIN_EXPERT_PROMPT } from "./agents/domainExpert";
import { validateSimulationInput } from "./agents/inputValidator";
import { SUPPORTED_MODELS } from "./openai";
import { getCapacityStatus, getJobStatus as getLLMJobStatus } from "./llm";
import { turnQueue, type TurnJob } from "./llm/turnQueue";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import type { AgentContext } from "./agents/types";
import { DEFAULT_DECISIONS } from "./agents/constants";
import type { HistoryEntry, InsertScenario, InitialState, DraftConversationMessage, GeneratedScenarioData, AgentPrompts } from "@shared/schema";
import { llmUsageLogs } from "@shared/schema";
import { db } from "./db";
import { gte, desc } from "drizzle-orm";
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
  revisionAttempts: z.number().optional().default(0),
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

  // Verify super admin code (before login) - stores verification in session
  app.post("/api/auth/verify-admin-code", async (req: any, res) => {
    try {
      const { code } = req.body;
      const adminCode = process.env.SUPER_ADMIN_CODE;
      
      if (!adminCode) {
        console.error("SUPER_ADMIN_CODE environment variable not set");
        return res.status(500).json({ valid: false, message: "Admin code not configured" });
      }
      
      const valid = code === adminCode;
      
      // Store verification result in session (server-side, cannot be spoofed)
      if (valid) {
        req.session.adminCodeVerified = true;
        req.session.adminCodeVerifiedAt = Date.now();
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

      // Fetch user to check role for admin access
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "admin";
      if (scenario.authorId !== userId && !isAdmin) {
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
      
      // Determine if the current decision point is MCQ without justification required
      currentDecisionNum = session.currentState.currentDecision || 1;
      const decisionPoints = initialState?.decisionPoints as Array<{ format?: string; requiresJustification?: boolean }> | undefined;
      const currentDP = decisionPoints?.[currentDecisionNum - 1];
      const isMcqNoJustification = currentDP?.format === "multiple_choice" && !currentDP?.requiresJustification;

      // CRITICAL: Validate input BEFORE any main processing
      // Skip validation for MCQ decisions where the professor set requiresJustification=false
      // (the student only needs to pick an option, no reasoning required)
      if (!isMcqNoJustification) {
        const recentHistory = (session.currentState.history as HistoryEntry[])
          .slice(-4)
          .map(h => `${h.role}: ${h.content}`)
          .join("\n");
        
        const validationResult = await validateSimulationInput(
          input,
          {
            title: session.scenario?.title || "Business Simulation",
            objective: initialState?.objective || "Navigate the challenge",
            recentHistory,
          },
          { model: "gpt-4o-mini" }
        );
        
        if (!validationResult.isValid) {
          console.log(`[Turn] Input validation failed for session ${sessionId}: ${validationResult.rejectionReason}`);
          storage.createTurnEvent({
            sessionId,
            userId,
            eventType: "input_rejected",
            turnNumber: currentDecisionNum,
            rawStudentInput: input,
            eventData: {
              reason: validationResult.rejectionReason,
              userMessage: validationResult.userMessage,
              decisionPointNumber: currentDecisionNum,
            },
          }).catch(err => console.error("[TurnEvent] Failed to log input_rejected:", err));
          return res.status(400).json({
            message: "validation_failed",
            validationError: true,
            turnStatus: "block",
            requiresRevision: false,
            userMessage: validationResult.userMessage || "Tu respuesta no cumple con las normas de la simulación. Por favor, proporciona una respuesta apropiada y relacionada con el caso.",
          });
        }

        storage.createTurnEvent({
          sessionId,
          userId,
          eventType: "input_accepted",
          turnNumber: currentDecisionNum,
          rawStudentInput: input,
          eventData: {
            decisionPointNumber: currentDecisionNum,
            validatedBy: "llm",
          },
        }).catch(err => console.error("[TurnEvent] Failed to log input_accepted:", err));
      } else {
        storage.createTurnEvent({
          sessionId,
          userId,
          eventType: "input_accepted",
          turnNumber: currentDecisionNum,
          rawStudentInput: input,
          eventData: {
            decisionPointNumber: currentDecisionNum,
            validatedBy: "mcq_bypass",
          },
        }).catch(err => console.error("[TurnEvent] Failed to log mcq input_accepted:", err));
      }
      
      const context: AgentContext = {
        sessionId,
        turnCount: session.currentState.turnCount,
        currentKpis: session.currentState.kpis,
        history: session.currentState.history,
        studentInput: input,
        rubric: session.scenario?.rubric || undefined,
        // POC: Decision tracking
        indicators: session.currentState.indicators || initialState?.indicators,
        totalDecisions: initialState?.totalDecisions || initialState?.decisionPoints?.length || DEFAULT_DECISIONS,
        currentDecision: session.currentState.currentDecision || 1,
        decisionPoints: initialState?.decisionPoints,
        // Per-scenario LLM configuration
        llmModel: scenarioLlmModel,
        agentPrompts: scenarioAgentPrompts,
        scenario: {
          title: session.scenario?.title || "Business Simulation",
          domain: session.scenario?.domain || "General",
          role: initialState?.role || "Business Leader",
          objective: initialState?.objective || "Navigate the challenge",
          // Enhanced context for AI tailoring
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
        },
      };

      // S9.1: Check if we're in the reflection step (Step 4)
      const isReflectionStep = session.currentState.isReflectionStep === true;

      // Helper: process the turn and save results
      const processTurnAndSave = async () => {
        let turnResult;
        if (isReflectionStep) {
          turnResult = await processReflection(context);
        } else {
          turnResult = await processStudentTurn(context, revisionAttempts);
        }

        if (turnResult.requiresRevision) {
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
        return turnResult;
      };

      // Check if AI providers are saturated — if so, queue the turn
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

      // Providers have capacity — process synchronously
      const turnStartTime = Date.now();
      const result = await processTurnAndSave();
      
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
      
      res.json(result);
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

      const { generateChatCompletion } = await import("./openai");
      
      const recentHistory = session.currentState.history.slice(-4)
        .map((h: HistoryEntry) => `${h.role}: ${h.content}`)
        .join("\n");
      
      const hintPrompt = `You are a helpful business mentor in a simulation game.

SCENARIO: ${session.scenario?.title || "Business Simulation"}
OBJECTIVE: ${session.scenario?.initialState?.objective || "Navigate the challenge successfully"}
ROLE: ${session.scenario?.initialState?.role || "Business Leader"}

CURRENT SITUATION:
${recentHistory}

CURRENT KPIs:
- Revenue: $${session.currentState.kpis.revenue.toLocaleString()}
- Team Morale: ${session.currentState.kpis.morale}%
- Reputation: ${session.currentState.kpis.reputation}%
- Efficiency: ${session.currentState.kpis.efficiency}%
- Trust: ${session.currentState.kpis.trust}%

Provide a helpful, encouraging hint (2-3 sentences) that guides the student toward good decision-making without giving away the "answer." Focus on:
- Key stakeholders they should consider
- Trade-offs they might be missing
- Questions they should ask themselves

Be constructive and educational, not judgmental.`;

      const hint = await generateChatCompletion([
        { role: "user", content: hintPrompt },
      ], { maxTokens: 256 });

      res.json({ hint });
    } catch (error: any) {
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

      const { topic, additionalContext, tradeoffFocus, customTradeoff, stepCount } = parseResult.data;

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

      const canonicalCase = await generateCanonicalCase(topic, builtContext || undefined, stepCount);
      const scenarioData = convertCanonicalToScenarioData(canonicalCase);

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
        isPublished: true,
      });

      await storage.updateScenarioDraft(draft.id, {
        status: "published",
        publishedScenarioId: scenario.id,
      });

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
  app.get("/api/professor/scenarios/:scenarioId/cohort-analytics", isAuthenticated, isProfessorOrAdmin, async (req: any, res) => {
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
          decisionDistribution: [],
          stuckNodes: [],
          styleProfiles: [],
          classStrengths: [],
        });
      }

      const decisionPoints: Array<{
        number: number;
        prompt: string;
        format: string;
        options?: string[];
      }> = (scenario.initialState as any)?.decisionPoints || [];

      const allTurns: Array<{ turnNumber: number; studentInput: string; agentResponse: any; sessionId: string }> = [];
      const allEvents: Array<{ turnNumber: number | null; eventType: string; eventData: any; sessionId: string }> = [];

      for (const session of allSessions) {
        const sessionTurns = await storage.getTurnsBySession(session.id);
        for (const t of sessionTurns) {
          allTurns.push({
            turnNumber: t.turnNumber,
            studentInput: t.studentInput,
            agentResponse: t.agentResponse as any,
            sessionId: session.id,
          });
        }
        const sessionEvents = await storage.getTurnEvents(session.id);
        for (const e of sessionEvents) {
          allEvents.push({
            turnNumber: e.turnNumber,
            eventType: e.eventType,
            eventData: e.eventData as any,
            sessionId: session.id,
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

      const maxTurn = allTurns.reduce((max, t) => Math.max(max, t.turnNumber), 0);
      for (let dn = 1; dn <= maxTurn; dn++) {
        const dp = decisionPoints.find(d => d.number === dn);
        const turnsAtStep = allTurns.filter(t => t.turnNumber === dn);
        const totalResponses = turnsAtStep.length;

        if (dp && dp.format === "multiple_choice" && dp.options && dp.options.length > 0) {
          const choiceCounts: Record<string, number> = {};
          for (const opt of dp.options) choiceCounts[opt] = 0;
          for (const t of turnsAtStep) {
            const input = t.studentInput.trim();
            const matchedOpt = dp.options.find(opt =>
              input.toLowerCase().startsWith(opt.toLowerCase().substring(0, 10)) ||
              input.toLowerCase().includes(opt.toLowerCase())
            );
            if (matchedOpt) {
              choiceCounts[matchedOpt] = (choiceCounts[matchedOpt] || 0) + 1;
            } else {
              choiceCounts[input] = (choiceCounts[input] || 0) + 1;
            }
          }
          decisionDistribution.push({
            decisionNumber: dn,
            prompt: dp.prompt || `Decisión ${dn}`,
            format: "multiple_choice",
            choices: Object.entries(choiceCounts)
              .filter(([_, c]) => c > 0)
              .map(([option, count]) => ({
                option,
                count,
                percentage: totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0,
              }))
              .sort((a, b) => b.count - a.count),
            totalResponses,
          });
        } else {
          decisionDistribution.push({
            decisionNumber: dn,
            prompt: dp?.prompt || `Decisión ${dn}`,
            format: dp?.format || "written",
            choices: [],
            totalResponses,
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

      const STYLE_RULES: Array<{
        label: string;
        labelEs: string;
        test: (avgs: Record<string, number>) => boolean;
      }> = [
        {
          label: "financial",
          labelEs: "Perfil Financiero",
          test: (avgs) => {
            const fin = Math.max(
              avgs["financial analysis"] || 0,
              avgs["financial_analysis"] || 0,
              avgs["financialAnalysis"] || 0,
              avgs["análisis financiero"] || 0
            );
            return fin >= 3.5;
          },
        },
        {
          label: "people",
          labelEs: "Perfil Humano",
          test: (avgs) => {
            const people = Math.max(
              avgs["stakeholder awareness"] || 0,
              avgs["stakeholder_awareness"] || 0,
              avgs["stakeholderAwareness"] || 0,
              avgs["comunicación"] || 0,
              avgs["team management"] || 0,
              avgs["liderazgo"] || 0
            );
            return people >= 3.5;
          },
        },
        {
          label: "risk",
          labelEs: "Perfil de Riesgo",
          test: (avgs) => {
            const risk = Math.max(
              avgs["risk assessment"] || 0,
              avgs["risk_assessment"] || 0,
              avgs["riskAssessment"] || 0,
              avgs["gestión de riesgos"] || 0
            );
            return risk >= 3.5;
          },
        },
      ];

      const profileData: Record<string, { count: number; label: string; sessionIds: string[] }> = {};
      for (const rule of STYLE_RULES) {
        profileData[rule.label] = { count: 0, label: rule.labelEs, sessionIds: [] };
      }
      profileData["balanced"] = { count: 0, label: "Perfil Equilibrado", sessionIds: [] };

      for (const [sessionId, compScores] of Object.entries(studentProfiles)) {
        const avgs: Record<string, number> = {};
        for (const [comp, vals] of Object.entries(compScores)) {
          avgs[comp.toLowerCase()] = vals.reduce((s, v) => s + v, 0) / vals.length;
        }
        let matched = false;
        for (const rule of STYLE_RULES) {
          if (rule.test(avgs)) {
            profileData[rule.label].count++;
            profileData[rule.label].sessionIds.push(sessionId);
            matched = true;
            break;
          }
        }
        if (!matched) {
          profileData["balanced"].count++;
          profileData["balanced"].sessionIds.push(sessionId);
        }
      }

      const extractPhrases = (sessionIds: string[], maxPhrases: number = 3): string[] => {
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

      res.json({
        totalStudents: allSessions.length,
        completedStudents: allSessions.filter(s => s.status === "completed").length,
        decisionDistribution,
        stuckNodes,
        styleProfiles,
        classStrengths,
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

      // Check turn queue first, then LLM queue
      const turnJob = turnQueue.getJobStatus(jobId);
      if (turnJob) {
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
}
