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
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SimulationSession, Scenario, TurnResponse, KPIs, Indicator, DecisionPoint } from "@shared/schema";

const THINKING_STEPS = [
  { message: "Analizando tu decisión...", completed: false },
  { message: "Consultando stakeholders...", completed: false },
  { message: "Calculando impacto empresarial...", completed: false },
  { message: "Generando resultado...", completed: false },
];

export default function Simulation() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [previousKpis, setPreviousKpis] = useState<KPIs | undefined>();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showMobileCasePanel, setShowMobileCasePanel] = useState(false);
  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Por favor inicia sesión",
        description: "Necesitas iniciar sesión para acceder a las simulaciones.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  useEffect(() => {
    if (sessionError && isUnauthorizedError(sessionError as Error)) {
      toast({
        title: "Sesión Expirada",
        description: "Por favor inicia sesión nuevamente.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [sessionError, toast]);

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
        initialState?.totalDecisions || 0,
        initialState?.decisionPoints || []
      );
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
      e.returnValue = "Si sales ahora, perderás todo el progreso de esta simulación. ¿Estás seguro?";
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
            throw new Error("El trabajo expiró. Por favor intenta de nuevo.");
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
          throw new Error(job.error || "Error al procesar tu decisión.");
        }
      } catch (error: any) {
        if (error.message?.includes("expiró") || error.message?.includes("Error al procesar")) {
          setQueueStatus(null);
          throw error;
        }
      }
    }

    setQueueStatus(null);
    throw new Error("El procesamiento tardó demasiado. Por favor intenta de nuevo.");
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
      setThinkingSteps(THINKING_STEPS.map((s) => ({ ...s })));

      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex < THINKING_STEPS.length) {
          updateThinkingStep(stepIndex, true);
          stepIndex++;
        } else {
          clearInterval(interval);
        }
      }, 800);

      return { interval };
    },
    onSuccess: (response, input) => {
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
          title: "Sesión Expirada",
          description: "Por favor inicia sesión nuevamente.",
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
        const userMessage = errorData.userMessage || 
          "Tu respuesta no pudo procesarse. Asegúrate de que:\n• La respuesta esté relacionada con el caso\n• Explique tu razonamiento o decisión\n• Mantenga un tono profesional";
        setValidationError(userMessage);
        return;
      }
      
      if (errorMessage.includes("not active") || errorMessage.includes("Session is not active")) {
        toast({
          title: "Simulación Completada",
          description: "Esta simulación ha terminado. ¡Revisa tus resultados para ver cómo te fue!",
        });
        return;
      }
      
      const isAIError = errorData.retryable === true || 
        errorMessage.includes("503") || 
        errorMessage.includes("ai_service_unavailable");
      
      toast({
        title: isAIError ? "Servicio Temporalmente Ocupado" : "Error",
        description: isAIError 
          ? "El servicio de IA no está disponible en este momento. Por favor espera unos segundos e intenta de nuevo."
          : "No se pudo procesar tu decisión. Por favor intenta de nuevo.",
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

  const handleSubmit = (input: string) => {
    // Clear any previous validation error when submitting new input
    setValidationError(null);
    submitMutation.mutate(input);
  };

  if (authLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando simulación...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Simulación No Encontrada</h2>
          <p className="text-muted-foreground mb-6">
            Esta simulación puede haber sido eliminada o no tienes acceso.
          </p>
          <Button onClick={() => navigate("/")}>Volver al Inicio</Button>
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
            <span className="font-semibold hidden sm:inline">Scenario+</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium" data-testid="text-simulation-title">
            {session.scenario?.title || "Simulación"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isReflectionStep
              ? "Paso 4: Reflexión"
              : totalDecisions > 0
              ? `Decisión ${currentDecision} de ${totalDecisions}`
              : `Turno ${session.currentState.turnCount + 1}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            />
          </motion.div>
        </motion.div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Briefing Panel */}
        {isBriefingCollapsed ? (
          <div className="hidden lg:flex flex-col border-r bg-card shrink-0">
            <button
              onClick={() => setIsBriefingCollapsed(false)}
              className="h-full w-12 flex flex-col items-center justify-center gap-2 hover-elevate transition-colors"
              data-testid="button-expand-briefing"
            >
              <PanelLeftOpen className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground writing-mode-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                Briefing
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
            />
          </div>

          {/* POC: Simplified InputConsole - no rubric, hints, or suggested actions */}
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
            // S9.1: Reflection as separate Step 4
            isReflectionStep={isReflectionStep}
            reflectionPrompt={session.scenario?.initialState?.reflectionPrompt}
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
          />
        </motion.aside>
      </div>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              ¿Salir de la simulación?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Si sales ahora, <strong>perderás todo el progreso</strong> de esta simulación. 
              En el mundo empresarial real, las decisiones no pueden deshacerse una vez tomadas.
              <br /><br />
              Esta simulación quedará marcada como abandonada y no podrás continuarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-exit">
              Continuar simulación
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmExit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-exit"
            >
              Salir y perder progreso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
