import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, Users, Star, Gauge, Shield, Activity, Clock, Target, AlertTriangle, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { KPIs, Indicator, MetricExplanation } from "@shared/schema";

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
  // POC "Why?" Explainability
  metricExplanations?: Record<string, MetricExplanation>;
}

interface IndicatorInfo {
  description: string;
  upMeaning: string;
  downMeaning: string;
}

const indicatorExplanations: Record<string, IndicatorInfo> = {
  revenue: {
    description: "Refleja la salud financiera del proyecto y los recursos disponibles para la operación.",
    upMeaning: "Las decisiones han optimizado recursos o generado ahorros/ingresos adicionales.",
    downMeaning: "Las decisiones han generado costos adicionales o consumido más recursos de lo planeado.",
  },
  morale: {
    description: "Mide el nivel de motivación, compromiso y bienestar emocional del equipo de trabajo.",
    upMeaning: "El equipo se siente más motivado, valorado y comprometido con el proyecto.",
    downMeaning: "El equipo experimenta estrés, frustración o desmotivación ante las decisiones tomadas.",
  },
  reputation: {
    description: "Mide la percepción pública y credibilidad de la organización en el mercado.",
    upMeaning: "Las decisiones han mejorado la imagen pública y la credibilidad de la marca.",
    downMeaning: "Las decisiones han afectado negativamente la percepción de la marca.",
  },
  efficiency: {
    description: "Indica la optimización de procesos y el uso efectivo de recursos operativos.",
    upMeaning: "Las operaciones son más ágiles y los procesos más eficientes.",
    downMeaning: "Hay ineficiencias operativas o desperdicio de recursos.",
  },
  trust: {
    description: "Mide el nivel de confianza que las partes interesadas tienen en la organización.",
    upMeaning: "Los stakeholders confían más en las decisiones y dirección de la organización.",
    downMeaning: "La confianza de los stakeholders ha disminuido debido a las decisiones tomadas.",
  },
};

interface IndicatorCardProps {
  indicatorId: string;
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ReactNode;
  color: string;
  // POC "Why?" Explainability
  explanation?: MetricExplanation;
}

function IndicatorCard({ indicatorId, label, value, previousValue, icon, color, explanation }: IndicatorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const delta = previousValue !== undefined ? value - previousValue : 0;
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const info = indicatorExplanations[indicatorId];
  const hasExplanation = explanation && delta !== 0;

  return (
    <Card
      className="p-5 transition-all duration-300"
      data-testid={`indicator-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* S3.3: Larger indicator header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`${color} p-2 rounded-lg`}>{icon}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {label}
            </span>
            {info && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs p-3">
                  <div className="space-y-2 text-xs">
                    <p className="font-medium">{info.description}</p>
                    <div className="pt-1 border-t border-border/50">
                      <p className="text-chart-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>{info.upMeaning}</span>
                      </p>
                      <p className="text-chart-4 flex items-center gap-1 mt-1">
                        <TrendingDown className="w-3 h-3" />
                        <span>{info.downMeaning}</span>
                      </p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* S3.3: Larger value display */}
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
                isPositive ? "text-chart-2 bg-chart-2/10" : isNegative ? "text-chart-4 bg-chart-4/10" : ""
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

      {/* S3.3: Larger progress bar */}
      <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* POC "Why?" Explainability - expandable explanation */}
      {hasExplanation && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            data-testid={`button-why-${indicatorId}`}
          >
            <span className="font-medium">¿Por qué?</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 ml-auto" />
            ) : (
              <ChevronDown className="w-3 h-3 ml-auto" />
            )}
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-2">
                  <p className="text-xs text-foreground/90">{explanation.shortReason}</p>
                  {explanation.causalChain && explanation.causalChain.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1 ml-2">
                      {explanation.causalChain.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-primary/70 mt-0.5">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
  budgetImpact: <DollarSign className="w-4 h-4" />,
  operationalRisk: <AlertTriangle className="w-4 h-4" />,
  strategicFlexibility: <Target className="w-4 h-4" />,
};

const indicatorColors: Record<string, string> = {
  teamMorale: "bg-chart-2/10 text-chart-2",
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
}: KPIDashboardProps) {
  const kpiConfig = [
    {
      key: "revenue",
      label: "Ingresos / Presupuesto",
      icon: <DollarSign className="w-4 h-4" />,
      format: "currency" as const,
      color: "bg-chart-1/10 text-chart-1",
    },
    {
      key: "morale",
      label: "Moral del Equipo",
      icon: <Users className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      key: "reputation",
      label: "Reputación de Marca",
      icon: <Star className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-3/10 text-chart-3",
    },
    {
      key: "efficiency",
      label: "Eficiencia Operacional",
      icon: <Gauge className="w-4 h-4" />,
      format: "percentage" as const,
      color: "bg-chart-4/10 text-chart-4",
    },
    {
      key: "trust",
      label: "Confianza de Stakeholders",
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

      {/* S3.3: Larger indicators with better spacing */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {useIndicators ? "Indicadores" : "Indicadores Clave"}
          </h3>
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
