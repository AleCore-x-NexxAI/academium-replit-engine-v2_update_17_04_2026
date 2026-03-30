import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, Users, Star, Gauge, Shield, Activity, Clock, Target, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/LanguageContext";
import type { KPIs, Indicator, MetricExplanation } from "@shared/schema";
import { t, type SimulationLanguage } from "@/lib/i18n";

interface KPIDashboardProps {
  kpis: KPIs;
  previousKpis?: KPIs;
  indicators?: Indicator[];
  previousIndicators?: Indicator[];
  scenarioTitle?: string;
  role?: string;
  objective?: string;
  currentDecision?: number;
  totalDecisions?: number;
  metricExplanations?: Record<string, MetricExplanation>;
  sessionId?: string;
  language?: SimulationLanguage;
}

interface IndicatorInfo {
  description: string;
  upMeaning: string;
  downMeaning: string;
}

function getIndicatorExplanations(t: (key: string, replacements?: Record<string, string | number>) => string): Record<string, IndicatorInfo> {
  return {
    revenue: {
      description: t("kpiDashboard.revenueDesc"),
      upMeaning: t("kpiDashboard.revenueUp"),
      downMeaning: t("kpiDashboard.revenueDown"),
    },
    morale: {
      description: t("kpiDashboard.moraleDesc"),
      upMeaning: t("kpiDashboard.moraleUp"),
      downMeaning: t("kpiDashboard.moraleDown"),
    },
    reputation: {
      description: t("kpiDashboard.reputationDesc"),
      upMeaning: t("kpiDashboard.reputationUp"),
      downMeaning: t("kpiDashboard.reputationDown"),
    },
    efficiency: {
      description: t("kpiDashboard.efficiencyDesc"),
      upMeaning: t("kpiDashboard.efficiencyUp"),
      downMeaning: t("kpiDashboard.efficiencyDown"),
    },
    trust: {
      description: t("kpiDashboard.trustDesc"),
      upMeaning: t("kpiDashboard.trustUp"),
      downMeaning: t("kpiDashboard.trustDown"),
    },
    budgetHealth: {
      description: t("kpiDashboard.budgetHealthDesc"),
      upMeaning: t("kpiDashboard.budgetHealthUp"),
      downMeaning: t("kpiDashboard.budgetHealthDown"),
    },
  };
}

const indicatorDirectionality: Record<string, "up_better" | "down_better"> = {
  revenue: "up_better",
  morale: "up_better",
  reputation: "up_better",
  efficiency: "up_better",
  trust: "up_better",
  teamMorale: "up_better",
  budgetHealth: "up_better",
  budgetImpact: "up_better",
  operationalRisk: "down_better",
  strategicFlexibility: "up_better",
};

interface IndicatorCardProps {
  indicatorId: string;
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ReactNode;
  color: string;
  explanation?: MetricExplanation;
  direction?: "up_better" | "down_better";
  indicatorDescription?: string;
  sessionId?: string;
  language: SimulationLanguage;
}

function IndicatorCard({ indicatorId, label, value, previousValue, icon, color, explanation, direction, indicatorDescription, sessionId, language }: IndicatorCardProps) {
  const { t } = useTranslation();
  const [causalChain, setCausalChain] = useState<string[] | null>(explanation?.causalChain || null);
  const [isLoadingChain, setIsLoadingChain] = useState(false);

  useEffect(() => {
    setCausalChain(explanation?.causalChain || null);
    setIsLoadingChain(false);
  }, [indicatorId, explanation?.shortReason, value]);

  const delta = previousValue !== undefined ? value - previousValue : 0;
  
  const effectiveDirection = direction || indicatorDirectionality[indicatorId] || "up_better";
  const isGoodChange = effectiveDirection === "up_better" ? delta > 0 : delta < 0;
  const isBadChange = effectiveDirection === "up_better" ? delta < 0 : delta > 0;
  
  const indicatorExplanations = getIndicatorExplanations(t);
  const info = indicatorExplanations[indicatorId];
  const hasExplanation = explanation && delta !== 0;

  const tooltipDescription = info?.description || indicatorDescription || label;
  const tooltipUpMeaning = info?.upMeaning
    || (effectiveDirection === "up_better"
      ? t("kpiDashboard.upIndicatesImprovement")
      : t("kpiDashboard.upIndicatesDeterioration"));
  const tooltipDownMeaning = info?.downMeaning
    || (effectiveDirection === "down_better"
      ? t("kpiDashboard.downIndicatesImprovement")
      : t("kpiDashboard.downIndicatesDeterioration"));

  return (
    <Card
      className="p-5 transition-all duration-300"
      data-testid={`indicator-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`${color} p-2 rounded-lg`}>{icon}</div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                {label}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/60 hover:text-muted-foreground transition-colors" data-testid={`tooltip-trigger-${indicatorId}`}>
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs p-3">
                  <div className="space-y-2 text-xs">
                    <p className="font-medium">{tooltipDescription}</p>
                    <div className="pt-1 border-t border-border/50">
                      <p className="text-chart-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>{tooltipUpMeaning}</span>
                      </p>
                      <p className="text-chart-4 flex items-center gap-1 mt-1">
                        <TrendingDown className="w-3 h-3" />
                        <span>{tooltipDownMeaning}</span>
                      </p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-xs text-muted-foreground" data-testid={`direction-${indicatorId}`}>
              {effectiveDirection === "up_better" ? t("kpiDashboard.upBetter") : t("kpiDashboard.downBetter")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-mono font-bold text-foreground"
        >
          {value}
        </motion.span>

        <AnimatePresence mode="wait">
          {delta !== 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`flex items-center gap-1 text-base font-semibold px-2 py-1 rounded-md ${
                isGoodChange ? "text-chart-2 bg-chart-2/10" : isBadChange ? "text-chart-4 bg-chart-4/10" : ""
              }`}
            >
              {delta > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{delta > 0 ? "+" : ""}{delta}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {hasExplanation && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <p className="text-xs text-foreground/90 mb-1">{explanation.shortReason}</p>
          {causalChain && causalChain.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden"
            >
              <ul className="text-xs text-muted-foreground space-y-1 ml-2 pt-1" data-testid={`causal-chain-${indicatorId}`}>
                {causalChain.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-primary/70 mt-0.5">&bull;</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : sessionId ? (
            <button
              onClick={async () => {
                setIsLoadingChain(true);
                try {
                  const response = await apiRequest("POST", `/api/simulations/${sessionId}/explain`, { metricId: indicatorId });
                  const data = await response.json();
                  if (data.causalChain && data.causalChain.length > 0) {
                    setCausalChain(data.causalChain);
                  }
                } catch (err) {
                  console.error("Failed to load explanation:", err);
                } finally {
                  setIsLoadingChain(false);
                }
              }}
              disabled={isLoadingChain}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`button-why-${indicatorId}`}
            >
              {isLoadingChain ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t("common.loading")}</span>
                </>
              ) : (
                <span className="font-medium">{t("kpiDashboard.why")}</span>
              )}
            </button>
          ) : null}
        </div>
      )}
    </Card>
  );
}

interface KPICardProps {
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ReactNode;
  format: "currency" | "percentage";
  color: string;
}

function KPICard({ label, value, previousValue, icon, format, color }: KPICardProps) {
  const delta = previousValue !== undefined ? value - previousValue : 0;
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  const formattedValue =
    format === "currency"
      ? `$${value.toLocaleString()}`
      : `${value}%`;

  return (
    <Card
      className="p-4 transition-all duration-300"
      data-testid={`kpi-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase text-xs tracking-wide font-medium text-muted-foreground">
          {label}
        </span>
        <div className={`${color} p-1.5 rounded-md`}>{icon}</div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-mono font-semibold"
        >
          {formattedValue}
        </motion.span>

        <AnimatePresence mode="wait">
          {delta !== 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? "text-chart-2" : isNegative ? "text-chart-4" : ""
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {isPositive ? "+" : ""}
                {format === "currency" ? `$${Math.abs(delta).toLocaleString()}` : `${delta}%`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {format === "percentage" && (
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary/70"
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}
    </Card>
  );
}

const indicatorIcons: Record<string, React.ReactNode> = {
  teamMorale: <Users className="w-4 h-4" />,
  budgetHealth: <DollarSign className="w-4 h-4" />,
  budgetImpact: <DollarSign className="w-4 h-4" />,
  operationalRisk: <AlertTriangle className="w-4 h-4" />,
  strategicFlexibility: <Target className="w-4 h-4" />,
};

const indicatorColors: Record<string, string> = {
  teamMorale: "bg-chart-2/10 text-chart-2",
  budgetHealth: "bg-chart-1/10 text-chart-1",
  budgetImpact: "bg-chart-1/10 text-chart-1",
  operationalRisk: "bg-chart-5/10 text-chart-5",
  strategicFlexibility: "bg-chart-3/10 text-chart-3",
};

export function KPIDashboard({
  kpis,
  previousKpis,
  indicators,
  previousIndicators,
  scenarioTitle,
  role,
  objective,
  currentDecision,
  totalDecisions,
  metricExplanations,
  sessionId,
  language = "es",
}: KPIDashboardProps) {
  const { t } = useTranslation();

  const kpiConfig = [
    {
      key: "revenue",
      label: t("kpiDashboard.revenueBudget"),
      icon: <DollarSign className="w-4 h-4" />,
      format: "currency" as const,
      color: "bg-chart-1/10 text-chart-1",
    },
    {
      key: "morale",
      label: t("kpiDashboard.teamMorale"),
      icon: <Users className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      key: "reputation",
      label: t("kpiDashboard.brandReputation"),
      icon: <Star className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-3/10 text-chart-3",
    },
    {
      key: "efficiency",
      label: t("kpiDashboard.operationalEfficiency"),
      icon: <Gauge className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-4/10 text-chart-4",
    },
    {
      key: "trust",
      label: t("kpiDashboard.stakeholderTrust"),
      icon: <Shield className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-5/10 text-chart-5",
    },
  ];

  const useIndicators = indicators && indicators.length > 0;

  return (
    <div className="h-full flex flex-col">
      {(scenarioTitle || role || objective) && (
        <div className="p-6 border-b">
          {scenarioTitle && (
            <h2
              className="text-xl font-semibold mb-2"
              data-testid="text-scenario-title"
            >
              {scenarioTitle}
            </h2>
          )}
          {role && (
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-medium">{t("kpiDashboard.role")}</span> {role}
            </p>
          )}
          {objective && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{t("kpiDashboard.objective")}</span> {objective}
            </p>
          )}
          {currentDecision && totalDecisions && (
            <div className="mt-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {t("kpiDashboard.decisionOf", { current: currentDecision, total: totalDecisions })}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              {useIndicators ? t("kpiDashboard.indicators") : t("kpiDashboard.keyIndicators")}
            </h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{t("kpiDashboard.howToRead")}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs p-3">
              <div className="space-y-2 text-xs">
                <p className="font-medium">{t("kpiDashboard.howToReadTitle")}</p>
                <div className="space-y-1.5 pt-1 border-t border-border/50">
                  <p className="flex items-center gap-2">
                    <span className="text-chart-2 font-medium">{t("kpiDashboard.upBetter")}</span>
                    <span className="text-muted-foreground">{t("kpiDashboard.higherBetter")}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-chart-4 font-medium">{t("kpiDashboard.downBetter")}</span>
                    <span className="text-muted-foreground">{t("kpiDashboard.lowerBetter")}</span>
                  </p>
                  <p className="pt-1 text-muted-foreground">
                    {t("kpiDashboard.colorExplanation")}
                  </p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-4">
          {useIndicators ? (
            indicators.map((indicator) => {
              const prevIndicator = previousIndicators?.find(
                (p) => p.id === indicator.id
              );
              return (
                <IndicatorCard
                  key={indicator.id}
                  indicatorId={indicator.id}
                  label={indicator.label}
                  value={indicator.value}
                  previousValue={prevIndicator?.value}
                  icon={indicatorIcons[indicator.id] || <Gauge className="w-4 h-4" />}
                  color={indicatorColors[indicator.id] || "bg-muted text-muted-foreground"}
                  explanation={metricExplanations?.[indicator.id]}
                  direction={indicator.direction}
                  indicatorDescription={indicator.description}
                  sessionId={sessionId}
                  language={language}
                />
              );
            })
          ) : (
            kpiConfig.map((config) => (
              <KPICard
                key={config.key}
                label={config.label}
                value={kpis[config.key as keyof KPIs]}
                previousValue={previousKpis?.[config.key as keyof KPIs]}
                icon={config.icon}
                format={config.format}
                color={config.color}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
