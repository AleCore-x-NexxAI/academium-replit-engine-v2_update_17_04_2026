import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Brain, ArrowLeft, Loader2, AlertTriangle, FileText, X, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KPIDashboard } from "@/components/KPIDashboard";
import { SimulationFeed } from "@/components/SimulationFeed";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { InputConsole } from "@/components/InputConsole";
import { CaseContextPanel } from "@/components/CaseContextPanel";
import { useSimulationStore } from "@/stores/simulationStore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SimulationSession, Scenario, TurnResponse, KPIs, Indicator, DecisionPoint } from "@shared/schema";
import { t as tSim, type SimulationLanguage } from "@/lib/i18n";

function getThinkingSteps(lang: SimulationLanguage) {
  return [
    { message: tSim("sim.thinking.1", lang), completed: false },
    { message: tSim("sim.thinking.2", lang), completed: false },
    { message: tSim("sim.thinking.3", lang), completed: false },
    { message: tSim("sim.thinking.4", lang), completed: false },
  ];
}
export default function Simulation() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [previousKpis, setPreviousKpis] = useState<KPIs | undefined>();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showMobileCasePanel, setShowMobileCasePanel] = useState(false);
  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastTurnStatus, setLastTurnStatus] = useState<"pass" | "nudge" | "block" | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintMaxReached, setHintMaxReached] = useState(false);
  const [hintsRemaining, setHintsRemaining] = useState(2);
  const [isHintLoading, setIsHintLoading] = useState(false);

  const {
    history,
    kpis,
    indicators,
    previousIndicators,
    isProcessing,
    thinkingSteps,
    competencyScores,
    currentFeedback,
    isGameOver,
    mode,
    options,
    currentDecision,
    totalDecisions,
    decisionPoints,
    // S9.1: Reflection step tracking
    isReflectionStep,
    reflectionCompleted,
    pendingRevision,
    revisionPrompt,
    revisionAttempts,
    maxRevisions,
    metricExplanations,
    setProcessing,
    setThinkingSteps,
    updateThinkingStep,
    addTurn,
    handleRevisionRequest,
    initializeSession,
    resetStore,
  } = useSimulationStore();

  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery<SimulationSession & { scenario?: Scenario }>({
    queryKey: ["/api/simulations", sessionId],
    enabled: !!sessionId && isAuthenticated,
  });

  const lang: SimulationLanguage = (session?.scenario?.language as SimulationLanguage) || "es";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: tSim("sim.auth.login", lang),
        description: tSim("sim.auth.login.desc", lang),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast, lang]);

  useEffect(() => {
    if (sessionError && isUnauthorizedError(sessionError as Error)) {
      toast({
        title: tSim("sim.auth.expired", lang),
        description: tSim("sim.auth.expired.desc", lang),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [sessionError, toast, lang]);

  // Only initialize the session once when first loaded, not on every refetch
  // This preserves currentFeedback after turns are submitted
  const initializedRef = useRef(false);
  
  useEffect(() => {
    if (session && !initializedRef.current) {
      initializedRef.current = true;
      const initialState = session.scenario?.initialState;
      initializeSession(
        session.id,
        session.currentState.kpis,
        session.currentState.history,
        "guided",
        initialState?.indicators || [],
        initialState?.totalDecisions || initialState?.decisionPoints?.length || 0,
        initialState?.decisionPoints || []
      );
      const cd = session.currentState.currentDecision || 1;
      const serverHintCounters = session.currentState.hintCounters || {};
      const hintMax = initialState?.maxHintsPerTurn ?? 2;
      const usedHints = serverHintCounters[cd] || 0;
      setHintsRemaining(Math.max(0, hintMax - usedHints));
      setHintMaxReached(usedHints >= hintMax);
    }
    return () => {
      initializedRef.current = false;
      resetStore();
    };
  }, [session?.id, initializeSession, resetStore]);

  // Prevent accidental navigation away - warn about losing progress
  useEffect(() => {
    if (isGameOver) return; // Don't warn if simulation is complete

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = tSim("sim.beforeunload", lang);
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGameOver]);

  // Handle back button click with confirmation
  const handleBackClick = useCallback(() => {
    if (isGameOver) {
      navigate("/");
    } else {
      setShowExitDialog(true);
    }
  }, [isGameOver, navigate]);

  const confirmExit = useCallback(async () => {
    try {
      // Abandon the session before navigating away
      await apiRequest("POST", `/api/simulations/${sessionId}/abandon`);
    } catch (error) {
      console.error("Error abandoning session:", error);
    }
    setShowExitDialog(false);
    navigate("/");
  }, [navigate, sessionId]);

  const MAX_AUTO_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 6000];
  const [queueStatus, setQueueStatus] = useState<{ position: number; estimatedWaitMs: number } | null>(null);

  const pollForResult = async (jobId: string): Promise<TurnResponse> => {
    const MAX_POLLS = 120;
    const POLL_INTERVAL = 1500;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      try {
        const res = await fetch(`/api/queue/status/${jobId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(t("simulation.jobExpired"));
          }
          continue;
        }

        const job = await res.json();

        if (job.status === "queued" || job.status === "processing") {
          setQueueStatus({
            position: job.position || 0,
            estimatedWaitMs: job.estimatedWaitMs || 15000,
          });
          continue;
        }

        setQueueStatus(null);

        if (job.status === "completed" && job.result) {
          return job.result as TurnResponse;
        }

        if (job.status === "failed") {
          throw new Error(job.error || t("simulation.processingError"));
        }
      } catch (error: any) {
        if (error.message?.includes("expiró") || error.message?.includes("Error al procesar")) {
          setQueueStatus(null);
          throw error;
        }
      }
    }

    setQueueStatus(null);
    throw new Error(t("simulation.processingTooLong"));
  };

  const submitMutation = useMutation({
    mutationFn: async (input: string) => {
      let lastError: any = null;
      
      for (let attempt = 0; attempt < MAX_AUTO_RETRIES + 1; attempt++) {
        try {
          const response = await apiRequest("POST", `/api/simulations/${sessionId}/turn`, {
            input,
            revisionAttempts: pendingRevision ? revisionAttempts : 0,
          });

          const data = await response.json();

          if (response.status === 202 && data.queued && data.jobId) {
            setQueueStatus({
              position: data.position || 1,
              estimatedWaitMs: data.estimatedWaitMs || 15000,
            });
            return await pollForResult(data.jobId);
          }

          return data as TurnResponse;
        } catch (error: any) {
          lastError = error;
          const errorMessage = error?.message || "";
          
          let errorData: any = {};
          try {
            const jsonMatch = errorMessage.match(/^\d+:\s*(.+)$/);
            if (jsonMatch && jsonMatch[1]) {
              errorData = JSON.parse(jsonMatch[1]);
            }
          } catch (e) {}
          
          const isRetryable = errorData.retryable === true || 
            errorMessage.includes("503") ||
            errorMessage.includes("ai_service_unavailable");
          const isValidation = errorData.validationError || errorData.message === "validation_failed";
          const isAuthError = errorMessage.includes("401") || errorMessage.includes("403");
          const isLastAttempt = attempt >= MAX_AUTO_RETRIES;
          
          if (!isRetryable || isValidation || isAuthError || isLastAttempt) {
            throw error;
          }
          
          console.log(`[Retry] Attempt ${attempt + 1}/${MAX_AUTO_RETRIES} after ${RETRY_DELAYS[attempt]}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        }
      }
      
      throw lastError;
    },
    onMutate: () => {
      setPreviousKpis({ ...kpis });
      setProcessing(true);
      const steps = getThinkingSteps(lang);
      setThinkingSteps(steps.map((s) => ({ ...s })));

      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex < steps.length) {
          updateThinkingStep(stepIndex, true);
          stepIndex++;
        } else {
          clearInterval(interval);
        }
      }, 800);

      return { interval };
    },
    onSuccess: (response, input) => {
      const status = response.turnStatus || null;
      setLastTurnStatus(status);
      if (status === "block" && !response.requiresRevision) {
        setValidationError(response.narrative?.text || tSim("input.validation.block", lang));
        queryClient.invalidateQueries({ queryKey: ["/api/simulations", sessionId] });
        return;
      }
      if (response.requiresRevision) {
        handleRevisionRequest(response);
      } else {
        addTurn(input, response);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/simulations", sessionId] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: tSim("sim.auth.expired", lang),
          description: tSim("sim.auth.expired.desc", lang),
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      const errorMessage = error?.message || "";
      let errorData: any = {};
      try {
        const jsonMatch = errorMessage.match(/^\d+:\s*(.+)$/);
        if (jsonMatch && jsonMatch[1]) {
          errorData = JSON.parse(jsonMatch[1]);
        }
      } catch (e) {}
      
      if (errorData.validationError || errorData.message === "validation_failed") {
        const userMessage = errorData.userMessage || t("simulation.responseError");
        setValidationError(userMessage);
        setLastTurnStatus("block");
        return;
      }
      
      if (errorMessage.includes("not active") || errorMessage.includes("Session is not active")) {
        toast({
          title: tSim("sim.completed", lang),
          description: tSim("sim.completed.desc", lang),
        });
        return;
      }
      
      const isAIError = errorData.retryable === true || 
        errorMessage.includes("503") || 
        errorMessage.includes("ai_service_unavailable");
      
      toast({
        title: isAIError ? tSim("sim.error.busy", lang) : tSim("sim.error.generic", lang),
        description: isAIError 
          ? tSim("sim.error.busy.desc", lang)
          : tSim("sim.error.generic.desc", lang),
        variant: "destructive",
      });
    },
    onSettled: (_, __, ___, context) => {
      if (context?.interval) {
        clearInterval(context.interval);
      }
      setProcessing(false);
      setThinkingSteps([]);
      setQueueStatus(null);
    },
  });

  const handleSubmit = async (input: string) => {
    setValidationError(null);
    setLastTurnStatus(null);
    setHintText(null);
    setHintMaxReached(false);
    const hintMax = session?.scenario?.initialState?.maxHintsPerTurn ?? 2;
    setHintsRemaining(hintMax);
    return submitMutation.mutateAsync(input);
  };

  const handleHint = useCallback(async () => {
    if (!sessionId || isHintLoading || hintMaxReached) return;
    setIsHintLoading(true);
    try {
      const res = await apiRequest("POST", `/api/simulations/${sessionId}/hint`);
      const data = await res.json();
      if (data.maxReached) {
        setHintMaxReached(true);
        setHintsRemaining(0);
      } else if (data.hint) {
        setHintText(data.hint);
        setHintsRemaining(data.hintsRemaining ?? 0);
        if (data.hintsRemaining === 0) setHintMaxReached(true);
      }
    } catch {
      toast({ title: lang === "en" ? "Could not load hint" : "No se pudo cargar la pista", variant: "destructive" });
    } finally {
      setIsHintLoading(false);
    }
  }, [sessionId, isHintLoading, hintMaxReached, toast, lang]);


  if (authLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{tSim("sim.loading", lang)}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">{tSim("sim.notfound", lang)}</h2>
          <p className="text-muted-foreground mb-6">
            {tSim("sim.notfound.desc", lang)}
          </p>
          <Button onClick={() => navigate("/")}>{tSim("sim.back", lang)}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold hidden sm:inline">Academium</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium" data-testid="text-simulation-title">
            {session.scenario?.title || t("common.simulation")}
          </p>
          <p className="text-xs text-muted-foreground">
            {isReflectionStep
              ? `${tSim("sim.step", lang)} ${totalDecisions + 1}: ${tSim("sim.reflection", lang)}`
              : totalDecisions > 0
              ? `${tSim("sim.decision", lang)} ${currentDecision} ${tSim("sim.of", lang)} ${totalDecisions}`
              : `${tSim("sim.turn", lang)} ${session.currentState.turnCount + 1}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMobileCasePanel(true)}
            className="lg:hidden"
            data-testid="button-show-case-mobile"
          >
            <FileText className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {showMobileCasePanel && session.scenario && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMobileCasePanel(false)}
        >
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 20 }}
            className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-card border-r shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileCasePanel(false)}
                data-testid="button-close-case-mobile"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CaseContextPanel
              scenario={session.scenario}
              currentDecision={currentDecision}
              totalDecisions={totalDecisions}
              language={lang}
            />
          </motion.div>
        </motion.div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {isBriefingCollapsed ? (
          <div className="hidden lg:flex flex-col border-r bg-card shrink-0">
            <button
              onClick={() => setIsBriefingCollapsed(false)}
              className="h-full w-12 flex flex-col items-center justify-center gap-2 hover-elevate transition-colors"
              data-testid="button-expand-briefing"
            >
              <PanelLeftOpen className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground writing-mode-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                {t("simulation.briefing")}
              </span>
            </button>
          </div>
        ) : (
          <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-80 border-r bg-card hidden lg:flex flex-col shrink-0"
          >
            {session.scenario && (
              <CaseContextPanel
                scenario={session.scenario}
                currentDecision={currentDecision}
                totalDecisions={totalDecisions}
                onCollapse={() => setIsBriefingCollapsed(true)}
                language={lang}
              />
            )}
          </motion.aside>
        )}

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden">
            <SimulationFeed
              history={history}
              isTyping={isProcessing}
              thinkingSteps={thinkingSteps}
              queueStatus={queueStatus}
              language={lang}
            />
          </div>

          {!isGameOver && !isReflectionStep && !isProcessing && lastTurnStatus !== "block" && (session?.scenario?.initialState?.hintButtonEnabled ?? true) && (
            <div className="flex items-center gap-2 px-4 py-2 border-t">
              {!hintMaxReached ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHint}
                  disabled={isHintLoading}
                  data-testid="button-hint"
                >
                  {isHintLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Brain className="w-3 h-3 mr-1" />
                  )}
                  {lang === "en" ? `Hint (${hintsRemaining})` : `Pista (${hintsRemaining})`}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground" data-testid="text-hint-max-reached">
                  {lang === "en" ? "No more hints available for this decision" : "No hay más pistas disponibles para esta decisión"}
                </span>
              )}
            </div>
          )}

          {hintText && (
            <div className="mx-4 mb-2 p-3 rounded-md bg-muted border text-sm text-muted-foreground" data-testid="text-hint">
              <div className="flex items-center gap-1 mb-1 font-medium text-foreground">
                <Brain className="w-3 h-3" />
                {lang === "en" ? "Hint" : "Pista"}
              </div>
              {hintText}
            </div>
          )}

          <InputConsole
            onSubmit={handleSubmit}
            mode={mode}
            isProcessing={isProcessing}
            isGameOver={isGameOver}
            onViewResults={() => navigate(`/simulation/${sessionId}/results`)}
            currentDecisionPoint={decisionPoints[currentDecision - 1]}
            decisionNumber={currentDecision}
            totalDecisions={totalDecisions}
            pendingRevision={pendingRevision}
            revisionPrompt={revisionPrompt}
            revisionAttempts={revisionAttempts}
            maxRevisions={maxRevisions}
            validationError={validationError}
            turnStatus={lastTurnStatus}
            isReflectionStep={isReflectionStep}
            reflectionPrompt={session.scenario?.initialState?.reflectionPrompt}
            language={lang}
          />
        </main>

        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-96 border-l bg-card hidden xl:flex flex-col overflow-y-auto"
        >
          {/* POC: KPI Dashboard with "Why?" explainability */}
          <div className="border-b">
            <KPIDashboard
              kpis={kpis}
              previousKpis={previousKpis}
              indicators={indicators}
              previousIndicators={previousIndicators}
              currentDecision={currentDecision}
              totalDecisions={totalDecisions}
              metricExplanations={metricExplanations}
              sessionId={sessionId}
              language={lang}
            />
          </div>
          <FeedbackPanel
            feedback={currentFeedback}
            competencyScores={competencyScores}
            isGameOver={isGameOver}
            pendingRevision={pendingRevision}
            revisionPrompt={revisionPrompt}
            revisionAttempts={revisionAttempts}
            maxRevisions={maxRevisions}
            language={lang}
          />
        </motion.aside>
      </div>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {tSim("sim.exit.title", lang)}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {tSim("sim.exit.desc", lang)}
              <br /><br />
              {tSim("sim.exit.desc2", lang)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-exit">
              {tSim("sim.exit.cancel", lang)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmExit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-exit"
            >
              {tSim("sim.exit.confirm", lang)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
