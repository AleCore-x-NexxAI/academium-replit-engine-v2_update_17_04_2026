import { useEffect } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Play, Brain, Target, Users, ArrowLeft, Loader2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Scenario, User } from "@shared/schema";

interface StartResponse {
  sessionId: string;
}

export default function SimulationStart() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const isTestMode = new URLSearchParams(searchString).get("test") === "true";
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated,
  });

  const isProfessorOrAdmin = currentUser?.role === "professor" || currentUser?.role === "admin";

  const {
    data: scenario,
    isLoading: scenarioLoading,
    error: scenarioError,
  } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", scenarioId],
    enabled: !!scenarioId && isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: t("simulation.pleaseLogin"),
        description: t("simulationStart.needLoginStart"),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast, t]);

  useEffect(() => {
    if (scenarioError && isUnauthorizedError(scenarioError as Error)) {
      toast({
        title: t("home.sessionExpired"),
        description: t("home.pleaseLoginAgain"),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [scenarioError, toast, t]);

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/simulations/start", {
        scenarioId,
      });
      return (await response.json()) as StartResponse;
    },
    onSuccess: (data) => {
      navigate(`/simulation/${data.sessionId}`);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: t("home.sessionExpired"),
          description: t("home.pleaseLoginAgain"),
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t("common.error"),
        description: t("simulationStart.errorStarting"),
        variant: "destructive",
      });
    },
  });

  if (authLoading || scenarioLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t("simulationStart.loadingScenario")}</p>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">{t("simulationStart.scenarioNotFound")}</h2>
          <p className="text-muted-foreground mb-6">
            {t("simulationStart.scenarioNotFoundDesc")}
          </p>
          <Button onClick={() => navigate("/")}>{t("common.backToHome")}</Button>
        </div>
      </div>
    );
  }

  // Show waiting message for students if simulation hasn't started
  // Professors and admins can bypass this (test mode or actual testing)
  if (!scenario.isStarted && !isProfessorOrAdmin && !isTestMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md px-6"
        >
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-semibold mb-3" data-testid="text-waiting-title">
            {t("simulationStart.notStartedTitle")}
          </h2>
          <p className="text-muted-foreground mb-6" data-testid="text-waiting-description">
            {`"${scenario.title}" ${t("simulationStart.notStartedDesc")}`}
          </p>
          <Card className="p-4 bg-muted/50 mb-6">
            <div className="flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">{t("simulationStart.whatToDo")}</p>
                <ul className="space-y-1">
                  <li>• {t("simulationStart.reviewMaterial")}</li>
                  <li>• {t("simulationStart.prepareQuestions")}</li>
                  <li>• {t("simulationStart.waitForProfessor")}</li>
                </ul>
              </div>
            </div>
          </Card>
          <Button variant="outline" onClick={() => navigate("/")} data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("common.backToHome")}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <LanguageToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Hero Section */}
          <div className="text-center pb-6 border-b">
            <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20">
              {scenario.domain}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground" data-testid="text-scenario-title">
              {scenario.title}
            </h1>
            {scenario.initialState?.companyName && (
              <p className="text-base text-muted-foreground">
                {scenario.initialState.companyName}
                {scenario.initialState.industry && ` · ${scenario.initialState.industry}`}
              </p>
            )}
          </div>

          {/* Role & Tension - Baseline Panels */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6 border-l-4 border-l-chart-1">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-chart-1/10 text-chart-1 flex items-center justify-center shrink-0">
                  <Target className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs uppercase tracking-wide text-chart-1 font-medium mb-1">{t("simulationStart.yourRole")}</h3>
                  <p className="text-lg font-semibold text-foreground mb-1" data-testid="text-role">
                    {scenario.initialState?.role || t("simulationStart.defaultRole")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("simulationStart.decisionsImpact")}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-chart-2">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-chart-2/10 text-chart-2 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs uppercase tracking-wide text-chart-2 font-medium mb-1">{t("simulationStart.theTension")}</h3>
                  <p className="text-base text-foreground leading-relaxed" data-testid="text-objective">
                    {scenario.initialState?.objective ||
                      t("simulationStart.defaultObjective")}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Context Section - Professional Panel */}
          <Card className="p-6 bg-muted/30">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("simulationStart.caseContext")}</h3>
                <p className="text-xs text-muted-foreground">{t("simulationStart.currentSituation")}</p>
              </div>
            </div>
            <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {scenario.initialState?.caseContext || scenario.initialState?.introText || scenario.description}
            </div>

            {scenario.initialState?.coreChallenge && (
              <div className="mt-5 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-medium text-sm text-primary mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  {t("simulationStart.coreChallenge")}
                </h4>
                <p className="text-sm text-foreground/90">
                  {scenario.initialState.coreChallenge}
                </p>
              </div>
            )}
          </Card>

          {/* Baseline Conditions - Visual Experience Start */}
          {(scenario.initialState?.indicators && scenario.initialState.indicators.length > 0) ? (
            <Card className="p-6 mb-8 bg-gradient-to-br from-primary/5 to-chart-2/5 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("simulationStart.startingPoint")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("simulationStart.startingPointDesc")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {scenario.initialState.indicators.map((ind) => (
                  <div key={ind.id} className="text-center p-4 bg-background rounded-lg border shadow-sm">
                    <p className="text-xs text-muted-foreground mb-2">
                      {ind.label}
                    </p>
                    <p className="text-2xl font-bold text-primary">{ind.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : scenario.initialState?.kpis && (
            <Card className="p-6 mb-8 bg-gradient-to-br from-primary/5 to-chart-2/5 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("simulationStart.startingPoint")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("simulationStart.startingPointDesc")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: t("simulationStart.revenue"), value: `${scenario.initialState.kpis.revenue || 65}%` },
                  { label: t("simulationStart.morale"), value: `${scenario.initialState.kpis.morale || 70}%` },
                  { label: t("simulationStart.reputation"), value: `${scenario.initialState.kpis.reputation || 75}%` },
                  { label: t("simulationStart.efficiency"), value: `${scenario.initialState.kpis.efficiency || 60}%` },
                  { label: t("simulationStart.trust"), value: `${scenario.initialState.kpis.trust || 72}%` },
                ].map((kpi) => (
                  <div key={kpi.label} className="text-center p-4 bg-background rounded-lg border shadow-sm">
                    <p className="text-xs text-muted-foreground mb-2">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-bold text-primary">{kpi.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Simulation Structure - Professional Timeline */}
          <div className="bg-muted/20 rounded-lg p-6">
            <h3 className="font-semibold text-center mb-5 text-foreground">{t("simulationStart.yourJourney")}</h3>
            <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg border">
                <div className="w-7 h-7 rounded-full bg-chart-1/20 text-chart-1 flex items-center justify-center text-sm font-semibold">1</div>
                <span className="text-sm font-medium">{t("simulationStart.orientation")}</span>
              </div>
              <div className="text-muted-foreground hidden md:block">→</div>
              <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg border">
                <div className="w-7 h-7 rounded-full bg-chart-2/20 text-chart-2 flex items-center justify-center text-sm font-semibold">2</div>
                <span className="text-sm font-medium">{t("simulationStart.analysis")}</span>
              </div>
              <div className="text-muted-foreground hidden md:block">→</div>
              <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg border">
                <div className="w-7 h-7 rounded-full bg-chart-3/20 text-chart-3 flex items-center justify-center text-sm font-semibold">3</div>
                <span className="text-sm font-medium">{t("simulationStart.integration")}</span>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              {t("simulationStart.estimatedDuration")}
            </p>
          </div>

          {/* CTA Section */}
          <div className="text-center pt-4">
            <Button
              size="lg"
              className="px-8"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid="button-start-simulation"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t("simulationStart.starting")}
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  {t("simulationStart.startSimulation")}
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              {t("simulationStart.noCorrectAnswers")}
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
