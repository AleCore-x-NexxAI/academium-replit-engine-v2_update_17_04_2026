import { useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Target,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  PanelLeftClose,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Scenario, DecisionPoint } from "@shared/schema";
import { t, type SimulationLanguage } from "@/lib/i18n";

interface CaseContextPanelProps {
  scenario: Scenario;
  currentDecision: number;
  totalDecisions: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  language?: SimulationLanguage;
}

export function CaseContextPanel({
  scenario,
  currentDecision,
  totalDecisions,
  isExpanded = true,
  onToggle,
  onCollapse,
  language,
}: CaseContextPanelProps) {
  const { t } = useTranslation();
  const [showFullContext, setShowFullContext] = useState(true);
  const initialState = scenario.initialState;
  const lang = language || (scenario.language as SimulationLanguage) || "es";

  const caseContext = initialState?.caseContext || initialState?.introText || "";
  const coreChallenge = initialState?.coreChallenge || "";
  const reflectionPrompt = initialState?.reflectionPrompt || "";
  const role = initialState?.role || t("caseContext.defaultRole");
  const objective = initialState?.objective || "";
  const companyName = initialState?.companyName || "";
  const industry = initialState?.industry || scenario.domain;
  const decisionPoints = initialState?.decisionPoints || [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">{t("caseContext.yourBriefing")}</span>
          </div>
          <div className="flex items-center gap-1">
            {onToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                data-testid="button-toggle-case-panel"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </Button>
            )}
            {onCollapse && (
              <Button
                variant="outline"
                size="icon"
                onClick={onCollapse}
                className="bg-background"
                data-testid="button-collapse-briefing"
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <div>
            <h2 className="text-lg font-bold mb-2 text-foreground" data-testid="text-case-title">
              {scenario.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {industry}
              </Badge>
              {companyName && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {companyName}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="p-4 rounded-lg bg-chart-1/5 border border-chart-1/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md bg-chart-1/20 flex items-center justify-center">
                <User className="w-4 h-4 text-chart-1" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wide text-chart-1">{t("caseContext.yourRole")}</span>
            </div>
            <p className="text-sm font-medium text-foreground">{role}</p>
          </div>

          {objective && (
            <div className="p-4 rounded-lg bg-chart-2/5 border border-chart-2/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-chart-2/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-chart-2" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wide text-chart-2">{t("caseContext.objective")}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{objective}</p>
            </div>
          )}

          <Separator />

          <div className="rounded-lg border bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFullContext(!showFullContext)}
              className="w-full flex items-center justify-between p-3 hover-elevate"
              data-testid="button-toggle-context"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wide text-primary">{t("caseContext.context")}</span>
              </div>
              {showFullContext ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            <AnimatePresence>
              {showFullContext && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="px-3 pb-3 space-y-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                      {caseContext}
                    </p>

                    {coreChallenge && (
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold text-xs text-primary uppercase tracking-wide">
                            {t("caseContext.coreChallenge")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{coreChallenge}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {decisionPoints.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  {t("caseContext.decisionStructure")}
                </h4>
                <div className="space-y-2">
                  {decisionPoints.map((dp: DecisionPoint, index: number) => {
                    const isCurrent = index + 1 === currentDecision;
                    const isCompleted = index + 1 < currentDecision;

                    return (
                      <div
                        key={dp.number}
                        className={`flex items-center gap-2 p-2 rounded text-sm ${
                          isCurrent
                            ? "bg-primary/10 text-primary font-medium"
                            : isCompleted
                            ? "text-muted-foreground line-through"
                            : "text-muted-foreground"
                        }`}
                        data-testid={`decision-point-${dp.number}`}
                      >
                        <Badge
                          variant={isCurrent ? "default" : isCompleted ? "secondary" : "outline"}
                          className="shrink-0"
                        >
                          {dp.number}
                        </Badge>
                        <span className="truncate">
                          {dp.number === 1
                            ? t("caseContext.orientation")
                            : dp.number === (decisionPoints?.length || 3)
                            ? t("caseContext.integrationStep")
                            : t("caseContext.analysis")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {reflectionPrompt && (
            <>
              <Separator />
              <Card className="p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">{t("caseContext.finalReflection")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {reflectionPrompt}
                </p>
              </Card>
            </>
          )}

          <div className="text-xs text-muted-foreground text-center pt-4">
            {t("caseContext.progress", { current: currentDecision, total: totalDecisions })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
