import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, Users, Star, Gauge, Shield, Activity, Clock, Target, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { KPIs, Indicator } from "@shared/schema";

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
}

interface IndicatorCardProps {
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ReactNode;
  color: string;
  description?: string;
}

function IndicatorCard({ label, value, previousValue, icon, color, description }: IndicatorCardProps) {
  const delta = previousValue !== undefined ? value - previousValue : 0;
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <Card
      className="p-4 transition-all duration-300"
      data-testid={`indicator-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
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
          className="text-2xl font-mono font-semibold"
        >
          {value}
        </motion.span>

        <AnimatePresence mode="wait">
          {delta !== 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? "text-chart-2" : isNegative ? "text-destructive" : ""
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{isPositive ? "+" : ""}{delta}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            value < 30
              ? "bg-destructive"
              : value < 50
              ? "bg-chart-4"
              : "bg-chart-2"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {description && (
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
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
  const isCritical = format === "percentage" && value < 30;

  const formattedValue =
    format === "currency"
      ? `$${value.toLocaleString()}`
      : `${value}%`;

  return (
    <Card
      className={`p-4 transition-all duration-300 ${
        isCritical ? "border-destructive bg-destructive/5" : ""
      }`}
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
          className={`text-3xl font-mono font-semibold ${
            isCritical ? "text-destructive" : ""
          }`}
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
                isPositive ? "text-chart-2" : isNegative ? "text-destructive" : ""
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
            className={`h-full rounded-full ${
              isCritical
                ? "bg-destructive"
                : value < 50
                ? "bg-chart-4"
                : "bg-chart-2"
            }`}
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
  budgetImpact: <DollarSign className="w-4 h-4" />,
  operationalRisk: <AlertTriangle className="w-4 h-4" />,
  strategicAlignment: <Target className="w-4 h-4" />,
  timePressure: <Clock className="w-4 h-4" />,
};

const indicatorColors: Record<string, string> = {
  teamMorale: "bg-chart-2/10 text-chart-2",
  budgetImpact: "bg-chart-1/10 text-chart-1",
  operationalRisk: "bg-chart-5/10 text-chart-5",
  strategicAlignment: "bg-chart-3/10 text-chart-3",
  timePressure: "bg-chart-4/10 text-chart-4",
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
}: KPIDashboardProps) {
  const kpiConfig = [
    {
      key: "revenue",
      label: "Revenue",
      icon: <DollarSign className="w-4 h-4" />,
      format: "currency" as const,
      color: "bg-chart-1/10 text-chart-1",
    },
    {
      key: "morale",
      label: "Team Morale",
      icon: <Users className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      key: "reputation",
      label: "Brand Reputation",
      icon: <Star className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-3/10 text-chart-3",
    },
    {
      key: "efficiency",
      label: "Operational Efficiency",
      icon: <Gauge className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-4/10 text-chart-4",
    },
    {
      key: "trust",
      label: "Stakeholder Trust",
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
              <span className="font-medium">Rol:</span> {role}
            </p>
          )}
          {objective && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Objetivo:</span> {objective}
            </p>
          )}
          {currentDecision && totalDecisions && (
            <div className="mt-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                Decisión {currentDecision} de {totalDecisions}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-6 flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          {useIndicators ? "Indicadores" : "Indicadores Clave"}
        </h3>
        <div className="space-y-4">
          {useIndicators ? (
            indicators.map((indicator) => {
              const prevIndicator = previousIndicators?.find(
                (p) => p.id === indicator.id
              );
              return (
                <IndicatorCard
                  key={indicator.id}
                  label={indicator.label}
                  value={indicator.value}
                  previousValue={prevIndicator?.value}
                  icon={indicatorIcons[indicator.id] || <Gauge className="w-4 h-4" />}
                  color={indicatorColors[indicator.id] || "bg-muted text-muted-foreground"}
                  description={indicator.description}
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
