import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, BarChart3, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { DecisionPoint } from "@shared/schema";
import { t, type SimulationLanguage } from "@/lib/i18n";

interface InputConsoleProps {
  onSubmit: (text: string) => Promise<any>;
  mode: "guided" | "assessment";
  isProcessing: boolean;
  isGameOver: boolean;
  onViewResults?: () => void;
  currentDecisionPoint?: DecisionPoint;
  decisionNumber?: number;
  totalDecisions?: number;
  pendingRevision?: boolean;
  revisionPrompt?: string | null;
  revisionAttempts?: number;
  maxRevisions?: number;
  validationError?: string | null;
  turnStatus?: "pass" | "nudge" | "block" | null;
  isReflectionStep?: boolean;
  reflectionPrompt?: string;
  language?: SimulationLanguage;
}

export function InputConsole({
  onSubmit,
  mode,
  isProcessing,
  isGameOver,
  onViewResults,
  currentDecisionPoint,
  decisionNumber,
  totalDecisions,
  pendingRevision = false,
  revisionPrompt,
  revisionAttempts = 0,
  maxRevisions = 1,
  validationError,
  turnStatus,
  isReflectionStep = false,
  reflectionPrompt,
  language = "es",
}: InputConsoleProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMultipleChoice = currentDecisionPoint?.format === "multiple_choice";
  const requiresJustification = currentDecisionPoint?.requiresJustification ?? false;
  const decisionOptions = currentDecisionPoint?.options || [];

  const justificationRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isProcessing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isProcessing]);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => { autoResize(textareaRef.current); }, [input, autoResize]);
  useEffect(() => { autoResize(justificationRef.current); }, [justification, autoResize]);

  const handleSubmit = async () => {
    let submissionText = "";

    if (isMultipleChoice) {
      if (!selectedOption) return;
      submissionText = selectedOption;
      if (requiresJustification && justification.trim()) {
        submissionText += `\n\n${language === "en" ? "Justification" : "Justificación"}: ${justification.trim()}`;
      }
    } else {
      if (!input.trim()) return;
      submissionText = input.trim();
    }

    if (isProcessing || isSubmitting || isGameOver) return;

    setIsSubmitting(true);
    try {
      const response = await onSubmit(submissionText);
      if (response?.requiresRevision || response?.turnStatus === "nudge" || response?.turnStatus === "block") {
      } else {
        setInput("");
        setSelectedOption("");
        setJustification("");
      }
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = isProcessing || isGameOver;
  const canSubmit = isMultipleChoice
    ? !!selectedOption && (!requiresJustification || justification.trim().length > 0)
    : !!input.trim();

  return (
    <div className="border-t-2 border-border bg-background p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] max-h-[50vh] overflow-y-auto">
      {pendingRevision && revisionPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-amber-500/5 border-amber-500/20 rounded-lg border"
          data-testid="revision-prompt-banner"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                {turnStatus === "nudge" ? t("inputConsole.nudgeMessage") : t("inputConsole.mentorInvite")}
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              {t("inputConsole.revisionOf", { current: revisionAttempts, max: maxRevisions })}
            </Badge>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {revisionPrompt}
          </p>
        </motion.div>
      )}

      {validationError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 p-4 rounded-lg border ${
            turnStatus === "block"
              ? "bg-muted/50 border-muted-foreground/20"
              : "bg-primary/5 border-primary/20"
          }`}
          data-testid="validation-error-banner"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
              turnStatus === "block" ? "text-muted-foreground" : "text-primary"
            }`} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {turnStatus === "block"
                  ? t("inputConsole.responseError")
                  : t("inputConsole.continueHelp")}
              </p>
              
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{t("inputConsole.quickTip")}</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>{t("inputConsole.mentionPriority")}</li>
                  <li>{t("inputConsole.giveReason")}</li>
                </ul>
              </div>
              
              <p className="text-sm text-muted-foreground italic bg-background/50 px-2 py-1.5 rounded border border-border/50">
                {t("inputConsole.usefulStructure")}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {isReflectionStep && !pendingRevision && !isGameOver && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Card className="p-5 bg-gradient-to-r from-chart-3/5 to-chart-3/10 border-chart-3/30 border-l-4 border-l-chart-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-chart-3/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-chart-3" />
                </div>
                <span className="text-sm font-semibold text-chart-3 uppercase tracking-wide">
                  {`${t("inputConsole.reflectionStep")} ${(totalDecisions || 0) + 1}`}
                </span>
              </div>
              <Badge variant="outline" className="bg-background text-xs">
                {t("inputConsole.final")}
              </Badge>
            </div>
            <p className="text-base font-medium text-foreground leading-relaxed" data-testid="text-reflection-prompt">
              {reflectionPrompt || t("inputConsole.defaultReflectionPrompt")}
            </p>
            <div className="mt-3 pt-3 border-t border-chart-3/10">
              <p className="text-sm text-muted-foreground italic" data-testid="text-reflection-nudge">
                {t("inputConsole.reflectionNudge")}
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {currentDecisionPoint?.prompt && !pendingRevision && !isReflectionStep && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Card className="p-3 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30 border-l-4 border-l-primary">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Send className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                  {t("inputConsole.yourDecision")}
                </span>
              </div>
                {decisionNumber && totalDecisions
                  ? t("simulation.decisionOf", { current: decisionNumber, total: totalDecisions })
                  : t("inputConsole.active")}
            </div>
            <p className="text-sm font-medium text-foreground leading-relaxed" data-testid="text-decision-prompt">
              {currentDecisionPoint.prompt}
            </p>
            
            {currentDecisionPoint.focusCue && (
              <div className="mt-2 pt-2 border-t border-primary/10">
                <p className="text-sm text-muted-foreground italic" data-testid="text-focus-cue">
                  {currentDecisionPoint.focusCue}
                </p>
              </div>
            )}
            
            {currentDecisionPoint.thinkingScaffold && currentDecisionPoint.thinkingScaffold.length > 0 && (
              <div className="mt-2 pt-2 border-t border-primary/10">
                <p className="text-sm font-medium text-muted-foreground mb-1" data-testid="text-thinking-scaffold-label">
                  {t("inputConsole.thinkAbout")}
                </p>
                <ul className="space-y-0.5" data-testid="list-thinking-scaffold">
                  {currentDecisionPoint.thinkingScaffold.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {currentDecisionPoint.includesReflection && (
              <Badge variant="secondary" className="text-xs mt-3">
                {t("inputConsole.includesReflection")}
              </Badge>
            )}
          </Card>
        </motion.div>
      )}

      {isMultipleChoice && decisionOptions.length > 0 && !isGameOver && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4"
        >
          <RadioGroup
            value={selectedOption}
            onValueChange={setSelectedOption}
            disabled={isDisabled}
            className="space-y-2"
          >
            {decisionOptions.map((option, index) => (
              <Card
                key={index}
                className={`p-3 cursor-pointer transition-all ${
                  selectedOption === option
                    ? "border-primary bg-primary/5"
                    : "hover-elevate"
                }`}
                onClick={() => !isDisabled && setSelectedOption(option)}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value={option}
                    id={`option-${index}`}
                    className="mt-0.5"
                    data-testid={`radio-option-${index}`}
                  />
                  <Label
                    htmlFor={`option-${index}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {option}
                  </Label>
                  {selectedOption === option && (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  )}
                </div>
              </Card>
            ))}
          </RadioGroup>

          {requiresJustification && selectedOption && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4"
            >
              <Label className="text-sm font-medium mb-2 block">
                {t("inputConsole.justifyDecision")}
              </Label>
              <Textarea
                ref={justificationRef}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder={t("inputConsole.justifyPlaceholder")}
                disabled={isDisabled}
                rows={2}
                className="max-h-[120px] overflow-y-auto resize-none text-sm"
                data-testid="input-justification"
              />
            </motion.div>
          )}
        </motion.div>
      )}

      {!isMultipleChoice && (
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isGameOver
                  ? t("inputConsole.simulationEnded")
                  : t("inputConsole.whatIsYourDecision")
              }
              disabled={isDisabled}
              rows={2}
              className="max-h-[120px] overflow-y-auto resize-none text-base"
              data-testid="input-decision"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isDisabled}
              className="h-10"
              data-testid="button-submit-decision"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t("common.send")}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {isMultipleChoice && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isDisabled}
            data-testid="button-submit-decision"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {t("inputConsole.submitDecision")}
              </>
            )}
          </Button>
        </div>
      )}

      {isGameOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center space-y-3"
        >
          <p className="text-sm text-muted-foreground">
            {t("inputConsole.simulationEndedMsg")}
          </p>
          {onViewResults && (
            <Button onClick={onViewResults} data-testid="button-view-results">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t("common.viewResults")}
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}
