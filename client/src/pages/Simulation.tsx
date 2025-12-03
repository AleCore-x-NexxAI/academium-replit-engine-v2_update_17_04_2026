import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Brain, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KPIDashboard } from "@/components/KPIDashboard";
import { SimulationFeed } from "@/components/SimulationFeed";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { InputConsole } from "@/components/InputConsole";
import { useSimulationStore } from "@/stores/simulationStore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SimulationSession, Scenario, TurnResponse, KPIs } from "@shared/schema";

const THINKING_STEPS = [
  { message: "Analyzing your decision...", completed: false },
  { message: "Consulting stakeholders...", completed: false },
  { message: "Calculating business impact...", completed: false },
  { message: "Generating outcome...", completed: false },
];

export default function Simulation() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [previousKpis, setPreviousKpis] = useState<KPIs | undefined>();

  const {
    history,
    kpis,
    isProcessing,
    thinkingSteps,
    competencyScores,
    currentFeedback,
    isGameOver,
    mode,
    options,
    setProcessing,
    setThinkingSteps,
    updateThinkingStep,
    addTurn,
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
        title: "Please sign in",
        description: "You need to be signed in to access simulations.",
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
        title: "Session Expired",
        description: "Please sign in again.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [sessionError, toast]);

  useEffect(() => {
    if (session) {
      initializeSession(
        session.id,
        session.currentState.kpis,
        session.currentState.history,
        "guided"
      );
    }
    return () => resetStore();
  }, [session, initializeSession, resetStore]);

  const submitMutation = useMutation({
    mutationFn: async (input: string) => {
      const response = await apiRequest("POST", `/api/simulations/${sessionId}/turn`, {
        input,
      });
      return response as TurnResponse;
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
      addTurn(input, response);
      queryClient.invalidateQueries({ queryKey: ["/api/simulations", sessionId] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to process your decision. Please try again.",
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
          <p className="text-muted-foreground">Loading simulation...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Simulation Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This simulation may have been deleted or you don't have access.
          </p>
          <Button onClick={() => navigate("/")}>Return Home</Button>
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
            onClick={() => navigate("/")}
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
            {session.scenario?.title || "Simulation"}
          </p>
          <p className="text-xs text-muted-foreground">
            Turn {session.currentState.turnCount + 1}
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
            scenarioTitle={session.scenario?.title}
            role={session.scenario?.initialState?.role}
            objective={session.scenario?.initialState?.objective}
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
          />
        </motion.aside>
      </div>
    </div>
  );
}
