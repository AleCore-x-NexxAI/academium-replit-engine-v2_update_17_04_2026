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
        title: "Por favor inicia sesión",
        description: "Necesitas iniciar sesión para comenzar una simulación.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  useEffect(() => {
    if (scenarioError && isUnauthorizedError(scenarioError as Error)) {
      toast({
        title: "Sesión Expirada",
        description: "Por favor inicia sesión nuevamente.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [scenarioError, toast]);

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
          title: "Sesión Expirada",
          description: "Por favor inicia sesión nuevamente.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "No se pudo iniciar la simulación. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || scenarioLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando escenario...</p>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Escenario No Encontrado</h2>
          <p className="text-muted-foreground mb-6">
            Este escenario puede haber sido eliminado o no está disponible.
          </p>
          <Button onClick={() => navigate("/")}>Volver al Inicio</Button>
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
            El profesor aún no ha iniciado la simulación
          </h2>
          <p className="text-muted-foreground mb-6" data-testid="text-waiting-description">
            La simulación "{scenario.title}" estará disponible cuando tu profesor la inicie. 
            Por favor, espera las instrucciones de tu profesor.
          </p>
          <Card className="p-4 bg-muted/50 mb-6">
            <div className="flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">¿Qué puedes hacer mientras tanto?</p>
                <ul className="space-y-1">
                  <li>• Revisar el material del curso</li>
                  <li>• Preparar preguntas sobre el caso</li>
                  <li>• Esperar el aviso de tu profesor</li>
                </ul>
              </div>
            </div>
          </Card>
          <Button variant="outline" onClick={() => navigate("/")} data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              {scenario.domain}
            </Badge>
            <h1 className="text-4xl font-bold mb-4" data-testid="text-scenario-title">
              {scenario.title}
            </h1>
            {scenario.initialState?.companyName && (
              <p className="text-lg text-muted-foreground">
                {scenario.initialState.companyName}
                {scenario.initialState.industry && ` · ${scenario.initialState.industry}`}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-chart-1/10 text-chart-1 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="font-semibold">Tu Responsabilidad</h3>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-role">
                {scenario.initialState?.role || "Líder de Negocios"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                Tus decisiones impactan a múltiples partes interesadas
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-chart-2/10 text-chart-2 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-semibold">La Tensión</h3>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-objective">
                {scenario.initialState?.objective ||
                  "Navega las tensiones entre diferentes prioridades empresariales."}
              </p>
            </Card>
          </div>

          <Card className="p-6 mb-8">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Contexto del Caso
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {scenario.initialState?.caseContext || scenario.initialState?.introText || scenario.description}
              </p>
            </div>

            {scenario.initialState?.coreChallenge && (
              <Card className="mt-4 p-4 bg-primary/5 border-primary/20">
                <h4 className="font-medium text-sm text-primary mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Desafío Central
                </h4>
                <p className="text-sm">
                  {scenario.initialState.coreChallenge}
                </p>
              </Card>
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
                  <h3 className="font-semibold">Punto de Partida</h3>
                  <p className="text-xs text-muted-foreground">
                    Condiciones iniciales — tus decisiones las modificarán
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
                  <h3 className="font-semibold">Punto de Partida</h3>
                  <p className="text-xs text-muted-foreground">
                    Condiciones iniciales — tus decisiones las modificarán
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Ingresos", value: `${scenario.initialState.kpis.revenue || 65}%` },
                  { label: "Moral", value: `${scenario.initialState.kpis.morale || 70}%` },
                  { label: "Reputación", value: `${scenario.initialState.kpis.reputation || 75}%` },
                  { label: "Eficiencia", value: `${scenario.initialState.kpis.efficiency || 60}%` },
                  { label: "Confianza", value: `${scenario.initialState.kpis.trust || 72}%` },
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

          <Card className="p-6 mb-8 border-dashed">
            <h3 className="font-semibold mb-3">Estructura de la Simulación</h3>
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">1</Badge>
                <span className="text-muted-foreground">Decisión de Orientación</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">2</Badge>
                <span className="text-muted-foreground">Análisis</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">3</Badge>
                <span className="text-muted-foreground">Integración</span>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Duración estimada: 20-25 minutos
            </p>
          </Card>

          <div className="text-center">
            <Button
              size="lg"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid="button-start-simulation"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Comenzar Simulación
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              No hay respuestas "correctas". Lo importante es tu razonamiento.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
