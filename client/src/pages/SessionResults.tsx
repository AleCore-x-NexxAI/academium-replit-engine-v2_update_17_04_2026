import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { SimulationSession, Scenario, Turn, Indicator, MetricExplanation } from "@shared/schema";
import { t as tSim, type SimulationLanguage } from "@/lib/i18n";

const KPI_ICONS: Record<string, React.ElementType> = {
  revenue: DollarSign,
  morale: Heart,
  reputation: Star,
  efficiency: TrendingUp,
  trust: Users,
};

function getKpiLabels(lang: SimulationLanguage): Record<string, string> {
  return {
    revenue: tSim("kpi.revenue", lang),
    morale: tSim("kpi.morale", lang),
    reputation: tSim("kpi.reputation", lang),
    efficiency: tSim("kpi.efficiency", lang),
    trust: tSim("kpi.trust", lang),
  };
}

const INDICATOR_ICONS: Record<string, React.ElementType> = {
  teamMorale: Users,
  budgetHealth: DollarSign,
  budgetImpact: DollarSign,
  operationalRisk: AlertTriangle,
  strategicFlexibility: Target,
  revenue: DollarSign,
  morale: Heart,
  reputation: Star,
  efficiency: TrendingUp,
  trust: Users,
};

function getIndicatorLabels(lang: SimulationLanguage): Record<string, string> {
  return {
    teamMorale: tSim("kpi.teamMorale", lang),
    budgetHealth: tSim("kpi.budgetHealth", lang),
    budgetImpact: tSim("kpi.budgetImpact", lang),
    operationalRisk: tSim("kpi.operationalRisk", lang),
    strategicFlexibility: tSim("kpi.strategicFlexibility", lang),
    revenue: tSim("kpi.revenue", lang),
    morale: tSim("kpi.morale.full", lang),
    reputation: tSim("kpi.reputation.full", lang),
    efficiency: tSim("kpi.efficiency.full", lang),
    trust: tSim("kpi.trust.full", lang),
  };
}

const INDICATOR_COLORS: Record<string, string> = {
  revenue: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
  morale: "from-rose-500/20 to-rose-500/5 border-rose-500/40",
  reputation: "from-amber-500/20 to-amber-500/5 border-amber-500/40",
  efficiency: "from-blue-500/20 to-blue-500/5 border-blue-500/40",
  trust: "from-violet-500/20 to-violet-500/5 border-violet-500/40",
  teamMorale: "from-rose-500/20 to-rose-500/5 border-rose-500/40",
  budgetHealth: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
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
  budgetHealth: "text-emerald-600 dark:text-emerald-400",
  budgetImpact: "text-emerald-600 dark:text-emerald-400",
  operationalRisk: "text-orange-600 dark:text-orange-400",
  strategicFlexibility: "text-cyan-600 dark:text-cyan-400",
};

function formatKpiValue(key: string, value: number, lang: SimulationLanguage = "es"): string {
  if (key === "revenue") {
    return new Intl.NumberFormat(lang === "en" ? "en-US" : "es-MX", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return `${value}%`;
}

interface IndicatorCardProps {
  item: { key: string; label: string; initial: number; final: number; delta: number; Icon: React.ElementType };
  index: number;
  useIndicators: boolean;
  explanations?: Array<{ turnNumber: number; shortReason: string; causalChain: string[] }>;
  direction?: string;
  defaultExpanded?: boolean;
}

function IndicatorResultCard({ item, index, useIndicators, explanations, direction, defaultExpanded = false }: IndicatorCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { key, label, initial, final: finalVal, Icon } = item;
  const hasExplanations = explanations && explanations.length > 0;
  const { t, language } = useTranslation();
  const locale = language === "en" ? "en-US" : "es-MX";

  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  return (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 + index * 0.05 }}
    >
      <Card
        className={`p-4 border-2 bg-gradient-to-br ${INDICATOR_COLORS[key] || 'from-primary/20 to-primary/5 border-primary/40'} rounded-xl transition-all`}
        data-testid={`indicator-${key}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg bg-background/80 flex items-center justify-center ${INDICATOR_ICON_COLORS[key] || 'text-primary'}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        
        <h3 className="font-semibold text-sm mb-1">{label}</h3>
        {direction && (
          <p className="text-xs text-muted-foreground mb-2">
            {direction === "down_better" ? tSim("kpi.direction.down", language) : tSim("kpi.direction.up", language)}
          </p>
        )}
        
        <div className="flex items-center gap-3 mt-2">
          <div className="text-center" data-testid={`indicator-${key}-start`}>
            <span className="text-xs text-muted-foreground block">{tSim("results.start", language)}</span>
            <span className="text-lg font-semibold">
              {useIndicators ? initial : formatKpiValue(key, initial, language)}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="text-center" data-testid={`indicator-${key}-end`}>
            <span className="text-xs text-muted-foreground block">{tSim("results.end", language)}</span>
            <span className="text-2xl font-bold">
              {useIndicators ? finalVal : formatKpiValue(key, finalVal, language)}
            </span>
          </div>
        </div>

        <div className="mt-3 h-1.5 bg-background/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ 
              width: `${Math.min(100, useIndicators ? finalVal : (key === "revenue" ? (finalVal / (initial || 100000)) * 50 : finalVal))}%` 
            }}
            transition={{ delay: 0.5 + index * 0.05, duration: 0.8 }}
            className="h-full bg-foreground/30 rounded-full"
          />
        </div>

        {hasExplanations && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 bg-background/60 border-foreground/15"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-why-${key}`}
            >
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium">
                {expanded ? tSim("results.hide", language) : tSim("results.why", language)}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ml-auto ${expanded ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        )}

        <AnimatePresence>
          {expanded && hasExplanations && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-foreground/10 space-y-3">
                {explanations!.map((exp, i) => (
                  <div key={i} className="text-xs space-y-1">
                    <p className="font-medium text-foreground/80">
                      {tSim("results.decision.label", language)} {exp.turnNumber}: {exp.shortReason}
                    </p>
                    {exp.causalChain.length > 0 && (
                      <ul className="pl-3 space-y-0.5">
                        {exp.causalChain.map((chain, ci) => (
                          <li key={ci} className="text-muted-foreground text-xs leading-relaxed">
                            {chain}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function SessionResults() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const locale = language === "en" ? "en-US" : "es-MX";

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

  const lang: SimulationLanguage = (session?.scenario?.language as SimulationLanguage) || "es";
  const KPI_LABELS = getKpiLabels(lang);
  const INDICATOR_LABELS = getIndicatorLabels(lang);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: tSim("results.auth.required", lang),
        description: tSim("results.auth.required.desc", lang),
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
          <h2 className="text-xl font-semibold mb-2">{tSim("results.session.notfound", lang)}</h2>
          <p className="text-muted-foreground mb-6">
            {tSim("results.session.notfound.desc", lang)}
          </p>
          <Button onClick={() => navigate("/")}>{tSim("results.back", lang)}</Button>
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
      direction: indicator.direction || "up_better",
    };
  }) || [];

  const indicatorExplanations: Record<string, Array<{ turnNumber: number; shortReason: string; causalChain: string[] }>> = {};
  if (turns) {
    for (const turn of turns) {
      const explanations = turn.agentResponse?.metricExplanations;
      if (explanations) {
        for (const [indicatorId, explanation] of Object.entries(explanations)) {
          if (!indicatorExplanations[indicatorId]) {
            indicatorExplanations[indicatorId] = [];
          }
          indicatorExplanations[indicatorId].push({
            turnNumber: turn.turnNumber,
            shortReason: (explanation as MetricExplanation).shortReason || "",
            causalChain: (explanation as MetricExplanation).causalChain || [],
          });
        }
      }
    }
  }

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
            <span className="font-semibold hidden sm:inline">Academium</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{tSim("results.experience", lang)}</p>
        </div>
        <div className="w-20 flex justify-end">
          <LanguageToggle />
        </div>
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
                <span className="text-sm font-semibold text-chart-2">{tSim("results.completed", lang)}</span>
              </motion.div>

              <h1
                className="text-4xl font-bold mb-3 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text"
                data-testid="text-scenario-title"
              >
                {scenario?.title || tSim("results.fallback.title", lang)}
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8">
                {tSim("results.navigated", lang)}
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
                    <p className="text-2xl font-bold text-primary">{Math.min(turns?.length || 0, session.scenario?.initialState?.totalDecisions || 3)}</p>
                    <p className="text-xs text-muted-foreground">{tSim("results.decisions", lang)}</p>
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
                    <p className="text-xs text-muted-foreground">{tSim("results.percent.complete", lang)}</p>
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
                  {tSim("results.closure.title", lang)}
                </span>
                <span className="text-muted-foreground">
                  {tSim("results.closure.body", lang)}
                </span>
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Overall Status Summary */}
        {(() => {
          const items = useIndicators ? indicatorComparison : kpiComparison;
          if (items.length === 0) return null;

          const improved: typeof items = [];
          const declined: typeof items = [];
          const neutral: typeof items = [];
          let anyCritical = false;

          for (const item of items) {
            const dir = (item as any).direction || "up_better";
            const isGood = dir === "down_better" ? item.delta < 0 : item.delta > 0;
            const isBad = dir === "down_better" ? item.delta > 0 : item.delta < 0;
            const finalVal = item.final;
            const isCriticalValue = dir === "down_better" ? finalVal >= 80 : finalVal <= 20;
            if (isCriticalValue) anyCritical = true;
            if (Math.abs(item.delta) < 2) neutral.push(item);
            else if (isGood) improved.push(item);
            else if (isBad) declined.push(item);
            else neutral.push(item);
          }

          improved.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
          declined.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

          let status: "estable" | "en_riesgo" | "critico";
          let StatusIcon: React.ElementType;
          let statusColor: string;
          let statusBg: string;

          if (anyCritical || (declined.length > improved.length && declined.length >= 3)) {
            status = "critico";
            StatusIcon = ShieldAlert;
            statusColor = "text-red-600 dark:text-red-400";
            statusBg = "from-red-500/10 to-red-500/5 border-red-500/30";
          } else if (declined.length > 0 && declined.length >= improved.length || declined.some(d => Math.abs(d.delta) >= 15)) {
            status = "en_riesgo";
            StatusIcon = Shield;
            statusColor = "text-amber-600 dark:text-amber-400";
            statusBg = "from-amber-500/10 to-amber-500/5 border-amber-500/30";
          } else {
            status = "estable";
            StatusIcon = ShieldCheck;
            statusColor = "text-emerald-600 dark:text-emerald-400";
            statusBg = "from-emerald-500/10 to-emerald-500/5 border-emerald-500/30";
          }

          const statusLabels = {
            estable: tSim("results.status.stable", lang),
            en_riesgo: tSim("results.status.atrisk", lang),
            critico: tSim("results.status.critical", lang),
          };

          const topStrengths = improved.slice(0, 3);
          const topConcerns = declined.slice(0, 3);

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className={`p-6 border-2 bg-gradient-to-br ${statusBg} rounded-xl`} data-testid="card-overall-status">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center ${statusColor}`}>
                    <StatusIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{tSim("results.summary", lang)}</h2>
                    <Badge variant="outline" className={`text-xs font-semibold ${statusColor}`} data-testid="badge-overall-status">
                      {tSim("results.status", lang)} {statusLabels[status]}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-foreground/80 leading-relaxed" data-testid="text-overall-summary">
                    {status === "estable" && (
                      <>
                        {tSim("results.stable.msg", lang)}
                        {topStrengths.length > 0 && (
                          <> {tSim("results.stable.strength", lang)} <strong>{topStrengths.map(s => s.label).join(", ")}</strong>.</>
                        )}
                        {topConcerns.length > 0 && (
                          <> {tSim("results.stable.concern", lang)} <strong>{topConcerns.map(c => c.label).join(", ")}</strong>.</>
                        )}
                      </>
                    )}
                    {status === "en_riesgo" && (
                      <>
                        {tSim("results.atrisk.msg", lang)}
                        {topStrengths.length > 0 && (
                          <> {tSim("results.stable.strength", lang)} <strong>{topStrengths.map(s => s.label).join(", ")}</strong>.</>
                        )}
                        {topConcerns.length > 0 && (
                          <> <strong>{topConcerns.map(c => c.label).join(", ")}</strong>.</>
                        )}
                      </>
                    )}
                    {status === "critico" && (
                      <>
                        {tSim("results.critical.msg", lang)}
                        {topConcerns.length > 0 && (
                          <> <strong>{topConcerns.map(c => c.label).join(", ")}</strong>.</>
                        )}
                        {topStrengths.length > 0 && (
                          <> <strong>{topStrengths.map(s => s.label).join(", ")}</strong>.</>
                        )}
                      </>
                    )}
                  </p>

                  {topStrengths.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{tSim("results.strengths", lang)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {topStrengths.map(s => (
                          <Badge key={s.key} variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" data-testid={`badge-strength-${s.key}`}>
                            {s.label} ({tSim("results.improved", lang)} {Math.abs(Math.round(s.delta))} {tSim("results.pts", lang)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {topConcerns.length > 0 && (
                    <div className="pt-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{tSim("results.concerns", lang)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {topConcerns.map(c => (
                          <Badge key={c.key} variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300" data-testid={`badge-concern-${c.key}`}>
                            {c.label} ({tSim("results.declined", lang)} {Math.abs(Math.round(c.delta))} {tSim("results.pts", lang)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })()}

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
                {useIndicators ? tSim("results.evolution.indicators", lang) : tSim("results.evolution.situation", lang)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tSim("results.evolution.desc", lang)}
              </p>
            </div>
          </div>
          
          {Object.keys(indicatorExplanations).length > 0 && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <p className="text-sm text-muted-foreground" data-testid="text-why-hint">
                {tSim("results.why.hint.pre", lang)} <span className="font-medium text-foreground">"{tSim("results.why.hint.action", lang)}"</span> {tSim("results.why.hint.post", lang)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const items = useIndicators ? indicatorComparison : kpiComparison;
              let firstWithExplanations = true;
              return items.map((item, index) => {
                const hasExp = indicatorExplanations[item.key] && indicatorExplanations[item.key].length > 0;
                const shouldAutoExpand = hasExp && firstWithExplanations;
                if (shouldAutoExpand) firstWithExplanations = false;
                return (
                  <IndicatorResultCard
                    key={item.key}
                    item={item}
                    index={index}
                    useIndicators={!!useIndicators}
                    explanations={indicatorExplanations[item.key]}
                    direction={(item as any).direction}
                    defaultExpanded={shouldAutoExpand}
                  />
                );
              });
            })()}
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
                    {tSim("results.final.observations", lang)}
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

        {/* S11: Decision Timeline */}
        {turns && turns.length > 0 && (() => {
          const totalDecisions = session.scenario?.initialState?.totalDecisions || 3;
          const isReflectionTurn = (turn: Turn) => {
            const state = turn.agentResponse?.updatedState;
            if (state?.reflectionCompleted) return true;
            if (state?.isReflectionStep && turn.turnNumber > totalDecisions) return true;
            return turn.turnNumber > totalDecisions;
          };

          const decisionTurns = turns.filter(t => !isReflectionTurn(t));
          const reflectionTurns = turns.filter(t => isReflectionTurn(t));

          const getIndicatorDirection = (indicatorId: string): string => {
            const ind = finalIndicators?.find(i => i.id === indicatorId);
            if (ind?.direction) return ind.direction;
            const initial = initialIndicators?.find(i => i.id === indicatorId);
            if (initial?.direction) return initial.direction;
            if (indicatorId === "operationalRisk") return "down_better";
            return "up_better";
          };

          const getIndicatorLabel = (indicatorId: string): string => {
            return INDICATOR_LABELS[indicatorId] ||
              finalIndicators?.find(i => i.id === indicatorId)?.label ||
              initialIndicators?.find(i => i.id === indicatorId)?.label ||
              indicatorId;
          };

          return (
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
                  <h2 className="text-xl font-bold" data-testid="heading-decision-timeline">{tSim("results.timeline.title", lang)}</h2>
                  <p className="text-sm text-muted-foreground">
                    {tSim("results.timeline.desc", lang)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {decisionTurns.map((turn, index) => {
                  const deltas = turn.agentResponse?.indicatorDeltas || {};
                  const deltaEntries = Object.entries(deltas).filter(([, v]) => v !== 0);

                  return (
                    <motion.div
                      key={turn.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.08 }}
                      data-testid={`card-decision-${turn.turnNumber}`}
                    >
                      <Card className="relative overflow-hidden border-2 border-muted rounded-xl">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-chart-2" />
                        <div className="p-5 pl-6 space-y-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center text-sm font-bold text-primary-foreground shadow-sm">
                              {turn.turnNumber}
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-primary/5 border-primary/30 text-primary font-semibold"
                            >
                              {tSim("results.decision.label", lang)} {turn.turnNumber}
                            </Badge>
                          </div>

                          <div className="p-4 bg-gradient-to-r from-muted/80 to-muted/40 rounded-xl border border-muted">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                <Users className="w-3 h-3 text-primary" />
                              </div>
                              <p className="text-sm font-semibold text-primary">{tSim("results.your.decision", lang)}</p>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed italic" data-testid={`text-decision-input-${turn.turnNumber}`}>
                              "{turn.studentInput}"
                            </p>
                          </div>

                          <div className="p-4 bg-card border-2 border-chart-2/20 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-5 h-5 rounded-full bg-chart-2/20 flex items-center justify-center">
                                <Sparkles className="w-3 h-3 text-chart-2" />
                              </div>
                              <p className="text-sm font-semibold text-chart-2">{tSim("results.outcome", lang)}</p>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-decision-narrative-${turn.turnNumber}`}>
                              {turn.agentResponse.narrative?.text || turn.agentResponse.feedback?.message}
                            </p>
                          </div>

                          {deltaEntries.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tSim("results.impacts", lang)}</p>
                              <div className="flex flex-wrap gap-2" data-testid={`chips-deltas-${turn.turnNumber}`}>
                                {deltaEntries.map(([indicatorId, delta]) => {
                                  const direction = getIndicatorDirection(indicatorId);
                                  const isPositive = direction === "down_better" ? delta < 0 : delta > 0;
                                  const chipColor = isPositive
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                    : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300";
                                  const DeltaIcon = delta > 0 ? TrendingUp : TrendingDown;

                                  return (
                                    <Badge
                                      key={indicatorId}
                                      variant="outline"
                                      className={`text-xs gap-1 ${chipColor}`}
                                      data-testid={`chip-delta-${indicatorId}-${turn.turnNumber}`}
                                    >
                                      <DeltaIcon className="w-3 h-3" />
                                      {getIndicatorLabel(indicatorId)}
                                      <span className="font-bold">
                                        {delta > 0 ? "+" : ""}{Math.round(delta)}
                                      </span>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}

                {reflectionTurns.length > 0 && (() => {
                  const lastReflection = reflectionTurns[reflectionTurns.length - 1];
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + decisionTurns.length * 0.08 }}
                      data-testid="card-reflection"
                    >
                      <Card className="relative overflow-hidden border-2 border-chart-3/30 bg-gradient-to-r from-chart-3/5 via-card to-chart-3/5 rounded-xl">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-chart-3 to-chart-2" />
                        <div className="p-5 pl-6 space-y-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-chart-3 to-chart-2 flex items-center justify-center shadow-sm">
                              <Brain className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-chart-3/10 border-chart-3/30 text-chart-3 font-semibold"
                            >
                              {tSim("results.reflection.badge", lang)}
                            </Badge>
                          </div>

                          <div className="p-4 bg-gradient-to-r from-chart-3/10 to-chart-3/5 rounded-xl border border-chart-3/20">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-5 h-5 rounded-full bg-chart-3/20 flex items-center justify-center">
                                <Lightbulb className="w-3 h-3 text-chart-3" />
                              </div>
                              <p className="text-sm font-semibold text-chart-3">{tSim("results.reflection.label", lang)}</p>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed italic" data-testid="text-reflection-input">
                              "{lastReflection.studentInput}"
                            </p>
                          </div>

                          {lastReflection.agentResponse?.narrative?.text && (
                            <div className="p-4 bg-card border-2 border-chart-3/20 rounded-xl">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded-full bg-chart-3/20 flex items-center justify-center">
                                  <MessageSquare className="w-3 h-3 text-chart-3" />
                                </div>
                                <p className="text-sm font-semibold text-chart-3">{tSim("results.mentor.closure", lang)}</p>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-reflection-narrative">
                                {lastReflection.agentResponse.narrative.text}
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })()}
              </div>
            </motion.div>
          );
        })()}

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
            {tSim("results.back.home", lang)}
          </Button>
          {scenario && (
            <Button
              size="lg"
              onClick={() => navigate(`/simulation/start/${scenario.id}`)}
              data-testid="button-try-again"
              className="px-8 bg-gradient-to-r from-primary to-chart-2 hover:from-primary/90 hover:to-chart-2/90"
            >
              <Trophy className="w-4 h-4 mr-2" />
              {tSim("results.try.again", lang)}
            </Button>
          )}
        </motion.div>
      </main>
    </div>
  );
}
