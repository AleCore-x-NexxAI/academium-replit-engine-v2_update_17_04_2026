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
  Sparkles,
  Trophy,
  Compass,
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
  strategicFlexibility: Target,
  revenue: DollarSign,
  morale: Heart,
  reputation: Star,
  efficiency: TrendingUp,
  trust: Users,
};

const INDICATOR_LABELS: Record<string, string> = {
  teamMorale: "Moral del Equipo",
  budgetImpact: "Impacto Presupuestario",
  operationalRisk: "Riesgo Operacional",
  strategicFlexibility: "Flexibilidad Estratégica",
  revenue: "Ingresos",
  morale: "Moral del Equipo",
  reputation: "Reputación de Marca",
  efficiency: "Eficiencia Operacional",
  trust: "Confianza de Stakeholders",
};

const INDICATOR_COLORS: Record<string, string> = {
  revenue: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
  morale: "from-rose-500/20 to-rose-500/5 border-rose-500/40",
  reputation: "from-amber-500/20 to-amber-500/5 border-amber-500/40",
  efficiency: "from-blue-500/20 to-blue-500/5 border-blue-500/40",
  trust: "from-violet-500/20 to-violet-500/5 border-violet-500/40",
  teamMorale: "from-rose-500/20 to-rose-500/5 border-rose-500/40",
  budgetImpact: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
  operationalRisk: "from-orange-500/20 to-orange-500/5 border-orange-500/40",
  strategicFlexibility: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/40",
};

const INDICATOR_ICON_COLORS: Record<string, string> = {
  revenue: "text-emerald-600 dark:text-emerald-400",
  morale: "text-rose-600 dark:text-rose-400",
  reputation: "text-amber-600 dark:text-amber-400",
  efficiency: "text-blue-600 dark:text-blue-400",
  trust: "text-violet-600 dark:text-violet-400",
  teamMorale: "text-rose-600 dark:text-rose-400",
  budgetImpact: "text-emerald-600 dark:text-emerald-400",
  operationalRisk: "text-orange-600 dark:text-orange-400",
  strategicFlexibility: "text-cyan-600 dark:text-cyan-400",
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="h-14 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-4">
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
            <span className="font-semibold hidden sm:inline">ScenarioX</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Tu Experiencia</p>
        </div>
        <div className="w-20" />
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* S10.1: Celebratory Hero Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {/* Decorative background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-chart-2/10 to-chart-3/10 rounded-3xl blur-xl opacity-60" />
          
          <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-8 rounded-2xl">
            {/* Sparkle decorations */}
            <div className="absolute top-4 right-4">
              <Sparkles className="w-6 h-6 text-primary/40 animate-pulse" />
            </div>
            <div className="absolute bottom-4 left-4">
              <Sparkles className="w-4 h-4 text-chart-2/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            <div className="text-center relative z-10">
              {/* Completion badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-chart-2/20 to-chart-3/20 border border-chart-2/30 mb-6"
              >
                <Trophy className="w-4 h-4 text-chart-2" />
                <span className="text-sm font-semibold text-chart-2">Experiencia Completada</span>
              </motion.div>

              <h1
                className="text-4xl font-bold mb-3 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text"
                data-testid="text-scenario-title"
              >
                {scenario?.title || "Simulación de Negocios"}
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8">
                Has navegado con éxito este escenario de negocios
              </p>

              {/* Stats cards */}
              <div className="flex justify-center gap-4 flex-wrap">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Compass className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-primary">{turns?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Decisiones</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-chart-2/10 to-chart-2/5 border border-chart-2/20"
                >
                  <div className="w-10 h-10 rounded-full bg-chart-2/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-chart-2" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-chart-2">100%</p>
                    <p className="text-xs text-muted-foreground">Completado</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* S10.1: Inspirational Message Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="relative overflow-hidden border-2 border-chart-3/30 bg-gradient-to-r from-chart-3/5 via-card to-chart-3/5 p-6 rounded-xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-chart-3 to-chart-2" />
            <div className="pl-4">
              <p className="text-base leading-relaxed" data-testid="text-closure-message">
                <span className="font-semibold text-lg text-foreground block mb-2">
                  Has navegado decisiones complejas con trade-offs reales.
                </span>
                <span className="text-muted-foreground">
                  Como en el mundo empresarial, no había respuestas perfectas — solo caminos diferentes con consecuencias distintas. 
                  Los dilemas que enfrentaste aquí reflejan situaciones que continúan evolucionando en la vida real. 
                  Lo que llevas contigo es la experiencia de haber reflexionado, decidido y observado el impacto de tus elecciones.
                </span>
              </p>
            </div>
          </Card>
        </motion.div>

        {/* S10.1: Indicator Evolution - Colorful Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {useIndicators ? "Evolución de Indicadores" : "Evolución de la Situación"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Los cambios que resultaron de tus decisiones
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(useIndicators ? indicatorComparison : kpiComparison).map(
              ({ key, label, initial, final, delta, Icon }, index) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + index * 0.05 }}
                >
                  <Card
                    className={`p-4 border-2 bg-gradient-to-br ${INDICATOR_COLORS[key] || 'from-primary/20 to-primary/5 border-primary/40'} rounded-xl hover-elevate transition-all`}
                    data-testid={`indicator-${key}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg bg-background/80 flex items-center justify-center ${INDICATOR_ICON_COLORS[key] || 'text-primary'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                          delta >= 0 
                            ? "bg-chart-2/20 text-chart-2" 
                            : "bg-chart-4/20 text-chart-4"
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
                    
                    <h3 className="font-semibold text-sm mb-2">{label}</h3>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {useIndicators ? final : formatKpiValue(key, final)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        desde {useIndicators ? initial : formatKpiValue(key, initial)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-background/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${Math.min(100, useIndicators ? final : (key === "revenue" ? (final / (initial || 100000)) * 50 : final))}%` 
                        }}
                        transition={{ delay: 0.5 + index * 0.05, duration: 0.8 }}
                        className="h-full bg-foreground/30 rounded-full"
                      />
                    </div>
                  </Card>
                </motion.div>
              )
            )}
          </div>
        </motion.div>

        {/* S10.1: Final Feedback - Highlighted Card */}
        {scoreSummary?.feedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="relative overflow-hidden border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-card to-amber-500/5 p-6 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-2 text-amber-700 dark:text-amber-300">
                    Observaciones Finales
                  </h2>
                  <p
                    className="text-muted-foreground leading-relaxed"
                    data-testid="text-final-feedback"
                  >
                    {scoreSummary.feedback}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* S10.1: Decision Timeline - Enhanced Visual */}
        {turns && turns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-chart-1/20 to-chart-1/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-chart-1" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Tu Recorrido</h2>
                <p className="text-sm text-muted-foreground">
                  Las decisiones que tomaste durante la experiencia
                </p>
              </div>
            </div>

            <Card className="p-6 border-2 border-muted rounded-xl">
              <ScrollArea className="h-96">
                <div className="space-y-6 pr-4">
                  {turns.map((turn, index) => (
                    <motion.div 
                      key={turn.id} 
                      className="relative pl-8"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      {/* Timeline connector */}
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-chart-2 to-chart-3" />
                      
                      {/* Decision number bubble */}
                      <div className="absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center text-xs font-bold text-primary-foreground shadow-lg">
                        {turn.turnNumber}
                      </div>

                      <div className="space-y-3 pb-2">
                        <Badge 
                          variant="outline" 
                          className="bg-primary/5 border-primary/30 text-primary font-semibold"
                        >
                          Decisión {turn.turnNumber}
                        </Badge>
                        
                        {/* Student decision */}
                        <div className="p-4 bg-gradient-to-r from-muted/80 to-muted/40 rounded-xl border border-muted">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                              <Users className="w-3 h-3 text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-primary">Tu Decisión</p>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">
                            {turn.studentInput}
                          </p>
                        </div>
                        
                        {/* Consequence */}
                        <div className="p-4 bg-card border-2 border-chart-2/20 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded-full bg-chart-2/20 flex items-center justify-center">
                              <Sparkles className="w-3 h-3 text-chart-2" />
                            </div>
                            <p className="text-sm font-semibold text-chart-2">Consecuencia</p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {turn.agentResponse.narrative?.text || turn.agentResponse.feedback?.message}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </motion.div>
        )}

        {/* S10.1: Action Buttons - More Prominent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-4 pt-6 pb-8"
        >
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => navigate("/")}
            className="px-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
          {scenario && (
            <Button
              size="lg"
              onClick={() => navigate(`/simulation/start/${scenario.id}`)}
              data-testid="button-try-again"
              className="px-8 bg-gradient-to-r from-primary to-chart-2 hover:from-primary/90 hover:to-chart-2/90"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Intentar de Nuevo
            </Button>
          )}
        </motion.div>
      </main>
    </div>
  );
}
