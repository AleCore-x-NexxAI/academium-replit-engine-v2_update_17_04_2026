import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processStudentTurn } from "./agents/director";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import type { AgentContext } from "./agents/types";
import type { HistoryEntry, InsertScenario, InitialState, DraftConversationMessage, GeneratedScenarioData } from "@shared/schema";
import { 
  extractInsights, 
  generateScenario, 
  handleRefinement, 
  generateInitialGreeting 
} from "./agents/authoringAssistant";

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

      const initialState = session.scenario?.initialState;
      const scenarioLlmModel = session.scenario?.llmModel as import("./openai").SupportedModel | undefined;
      const scenarioAgentPrompts = session.scenario?.agentPrompts as import("@shared/schema").AgentPrompts | undefined;
      
      const context: AgentContext = {
        sessionId,
        turnCount: session.currentState.turnCount,
        currentKpis: session.currentState.kpis,
        history: session.currentState.history,
        studentInput: input,
        rubric: session.scenario?.rubric || undefined,
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
        },
      };

      const result = await processStudentTurn(context);

      await storage.createTurn({
        sessionId,
        turnNumber: session.currentState.turnCount + 1,
        studentInput: input,
        agentResponse: result,
      });

      let sessionUpdate: any = {
        currentState: result.updatedState,
        status: result.isGameOver ? "completed" : "active",
      };

      if (result.isGameOver) {
        const competencies = result.competencyScores || {
          strategicThinking: 3,
          ethicalReasoning: 3,
          decisionDecisiveness: 3,
          stakeholderEmpathy: 3,
        };
        
        const competencyValues = Object.values(competencies) as number[];
        const avgCompetency = competencyValues.reduce((a, b) => a + b, 0) / competencyValues.length;
        const overallScore = Math.round((avgCompetency / 5) * 100);

        sessionUpdate.scoreSummary = {
          finalKpis: result.updatedState.kpis,
          competencies,
          overallScore,
          feedback: result.feedback.message,
        };
      }

      await storage.updateSimulationSession(sessionId, sessionUpdate);

      res.json(result);
    } catch (error) {
      console.error("Error processing turn:", error);
      res.status(500).json({ message: "Failed to process turn" });
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
    } catch (error) {
      console.error("Error generating hint:", error);
      res.status(500).json({ message: "Failed to generate hint" });
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
      if (scenario.authorId !== userId && req.dbUser.role !== "admin") {
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
}
