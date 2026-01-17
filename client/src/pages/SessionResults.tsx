import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain,
  ArrowLeft,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Heart,
  Star,
  MessageSquare,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { SimulationSession, Scenario, Turn, Indicator } from "@shared/schema";

const KPI_ICONS: Record<string, React.ElementType> = {
  revenue: DollarSign,
  morale: Heart,
  reputation: Star,
  efficiency: TrendingUp,
  trust: Users,
};

const KPI_LABELS: Record<string, string> = {
  revenue: "Ingresos",
  morale: "Moral",
  reputation: "Reputación",
  efficiency: "Eficiencia",
  trust: "Confianza",
};

const INDICATOR_ICONS: Record<string, React.ElementType> = {
  teamMorale: Users,
  budgetImpact: DollarSign,
  operationalRisk: AlertTriangle,
  strategicAlignment: Target,
  timePressure: Clock,
};

const INDICATOR_LABELS: Record<string, string> = {
  teamMorale: "Moral del Equipo",
  budgetImpact: "Impacto Presupuestario",
  operationalRisk: "Riesgo Operacional",
  strategicAlignment: "Alineación Estratégica",
  timePressure: "Presión de Tiempo",
};

function formatKpiValue(key: string, value: number): string {
  if (key === "revenue") {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return `${value}%`;
}

export default function SessionResults() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: session, isLoading: sessionLoading } = useQuery<
    SimulationSession & { scenario?: Scenario }
  >({
    queryKey: ["/api/simulations", sessionId],
    enabled: !!sessionId && isAuthenticated,
  });

  const { data: turns, isLoading: turnsLoading } = useQuery<Turn[]>({
    queryKey: ["/api/simulations", sessionId, "history"],
    enabled: !!sessionId && isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Iniciar sesión requerido",
        description: "Necesitas iniciar sesión para ver los resultados.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  if (authLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Sesión No Encontrada</h2>
          <p className="text-muted-foreground mb-6">
            Esta sesión puede haber sido eliminada.
          </p>
          <Button onClick={() => navigate("/")}>Volver al Inicio</Button>
        </div>
      </div>
    );
  }

  const scoreSummary = session.scoreSummary;
  const scenario = session.scenario;
  const finalKpis = scoreSummary?.finalKpis || session.currentState.kpis;
  const initialKpis = scenario?.initialState?.kpis;
  const finalIndicators = session.currentState.indicators as Indicator[] | undefined;
  const initialIndicators = scenario?.initialState?.indicators as Indicator[] | undefined;
  const useIndicators = finalIndicators && finalIndicators.length > 0;

  const kpiComparison = Object.entries(finalKpis).map(([key, value]) => {
    const initial = initialKpis?.[key as keyof typeof initialKpis] || 0;
    const delta = value - initial;
    return {
      key,
      label: KPI_LABELS[key] || key,
      initial,
      final: value,
      delta,
      Icon: KPI_ICONS[key] || Target,
    };
  });

  const indicatorComparison = finalIndicators?.map((indicator) => {
    const initial = initialIndicators?.find((i) => i.id === indicator.id);
    const delta = initial ? indicator.value - initial.value : 0;
    return {
      key: indicator.id,
      label: INDICATOR_LABELS[indicator.id] || indicator.label,
      initial: initial?.value || indicator.value,
      final: indicator.value,
      delta,
      Icon: INDICATOR_ICONS[indicator.id] || Gauge,
    };
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4">
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
          <p className="text-sm font-medium">Resumen de Simulación</p>
        </div>
        <div className="w-20" />
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Badge className="mb-4" variant="outline">
            Simulación Completada
          </Badge>
          <h1
            className="text-3xl font-bold mb-2"
            data-testid="text-scenario-title"
          >
            {scenario?.title || "Simulación de Negocios"}
          </h1>
          <p className="text-muted-foreground mb-6">
            Has completado todas las decisiones de este escenario
          </p>

          <Card className="inline-block p-6">
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-primary" />
              <div className="text-left">
                <p className="text-lg font-semibold">Experiencia Completada</p>
                <p className="text-sm text-muted-foreground">
                  {turns?.length || 0} decisiones tomadas
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {useIndicators ? "Evolución de Indicadores" : "Evolución de la Situación"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Estos son los cambios que resultaron de tus decisiones durante la simulación:
            </p>
            <div className="space-y-4">
              {(useIndicators ? indicatorComparison : kpiComparison).map(
                ({ key, label, initial, final, delta, Icon }) => (
                  <div
                    key={key}
                    className="flex items-center gap-4"
                    data-testid={`indicator-${key}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {useIndicators ? initial : formatKpiValue(key, initial)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-sm font-semibold">
                            {useIndicators ? final : formatKpiValue(key, final)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, useIndicators ? final : (key === "revenue" ? (final / (initial || 100000)) * 50 : final))}%`,
                            }}
                          />
                        </div>
                        <div
                          className={`flex items-center gap-1 text-xs font-medium ${
                            delta >= 0 ? "text-chart-2" : "text-chart-4"
                          }`}
                        >
                          {delta >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {delta >= 0 ? "+" : ""}
                          {useIndicators
                            ? delta
                            : key === "revenue"
                            ? `$${Math.abs(delta).toLocaleString()}`
                            : `${delta}%`}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        </motion.div>

        {scoreSummary?.feedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Observaciones Finales</h2>
              </div>
              <p
                className="text-muted-foreground leading-relaxed"
                data-testid="text-final-feedback"
              >
                {scoreSummary.feedback}
              </p>
            </Card>
          </motion.div>
        )}

        {turns && turns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Línea de Decisiones</h2>
              </div>
              <ScrollArea className="h-96">
                <div className="space-y-4 pr-4">
                  {turns.map((turn, index) => (
                    <div key={turn.id} className="relative pl-6">
                      <div className="absolute left-0 top-2 w-3 h-3 rounded-full bg-primary" />
                      {index < turns.length - 1 && (
                        <div className="absolute left-[5px] top-5 w-0.5 h-full bg-border" />
                      )}
                      <div className="space-y-2">
                        <Badge variant="outline">Decisión {turn.turnNumber}</Badge>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-1">
                            Tu Decisión:
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {turn.studentInput}
                          </p>
                        </div>
                        <div className="p-3 bg-card border rounded-lg">
                          <p className="text-sm font-medium mb-1">Consecuencia:</p>
                          <p className="text-sm text-muted-foreground">
                            {turn.agentResponse.narrative?.text || turn.agentResponse.feedback?.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </motion.div>
        )}

        <div className="flex justify-center gap-4 pt-4">
          <Button variant="outline" onClick={() => navigate("/")}>
            Volver al Inicio
          </Button>
          {scenario && (
            <Button
              onClick={() => navigate(`/simulation/start/${scenario.id}`)}
              data-testid="button-try-again"
            >
              Intentar de Nuevo
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
