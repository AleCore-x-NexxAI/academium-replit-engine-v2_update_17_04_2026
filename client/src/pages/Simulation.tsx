import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Brain, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
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
    pendingRevision,
    revisionPrompt,
    revisionAttempts,
    maxRevisions,
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

  const submitMutation = useMutation({
    mutationFn: async (input: string) => {
      const response = await apiRequest("POST", `/api/simulations/${sessionId}/turn`, {
        input,
        revisionAttempts: pendingRevision ? revisionAttempts : 0,
      });
      return (await response.json()) as TurnResponse;
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
      // Check if revision is required
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
      
      const errorMessage = error?.data?.message || error?.message || "";
      if (errorMessage.includes("not active") || errorMessage.includes("Session is not active")) {
        toast({
          title: "Simulación Completada",
          description: "Esta simulación ha terminado. ¡Revisa tus resultados para ver cómo te fue!",
        });
        return;
      }
      
      toast({
        title: "Error",
        description: "No se pudo procesar tu decisión. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, ___, context) => {
      if (context?.interval) {
        clearInterval(context.interval);
      }
      setProcessing(false);
      setThinkingSteps([]);
    },
  });

  const handleSubmit = (input: string) => {
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
            <span className="font-semibold hidden sm:inline">SIMULEARN</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium" data-testid="text-simulation-title">
            {session.scenario?.title || "Simulación"}
          </p>
          <p className="text-xs text-muted-foreground">
            {totalDecisions > 0
              ? `Decisión ${currentDecision} de ${totalDecisions}`
              : `Turno ${session.currentState.turnCount + 1}`}
          </p>
        </div>

        <div className="w-20" />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-80 border-r bg-card hidden lg:flex flex-col"
        >
          <KPIDashboard
            kpis={kpis}
            previousKpis={previousKpis}
            indicators={indicators}
            previousIndicators={previousIndicators}
            scenarioTitle={session.scenario?.title}
            role={session.scenario?.initialState?.role}
            objective={session.scenario?.initialState?.objective}
            currentDecision={currentDecision}
            totalDecisions={totalDecisions}
          />
        </motion.aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden">
            <SimulationFeed
              history={history}
              isTyping={isProcessing}
              thinkingSteps={thinkingSteps}
            />
          </div>

          <InputConsole
            onSubmit={handleSubmit}
            mode={mode}
            options={options}
            isProcessing={isProcessing}
            isGameOver={isGameOver}
            onViewResults={() => navigate(`/simulation/${sessionId}/results`)}
            rubric={session.scenario?.rubric || undefined}
            currentFeedback={currentFeedback}
            onRequestHint={async () => {
              const response = await apiRequest("POST", `/api/simulations/${sessionId}/hint`);
              const data = await response.json();
              return data.hint;
            }}
            currentDecisionPoint={decisionPoints[currentDecision - 1]}
            decisionNumber={currentDecision}
            totalDecisions={totalDecisions}
            pendingRevision={pendingRevision}
            revisionPrompt={revisionPrompt}
            revisionAttempts={revisionAttempts}
            maxRevisions={maxRevisions}
          />
        </main>

        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-96 border-l bg-card hidden xl:flex flex-col"
        >
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
