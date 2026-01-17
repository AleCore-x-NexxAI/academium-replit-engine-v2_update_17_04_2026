import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Lightbulb, BookOpen, Loader2, BarChart3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import type { DecisionPoint } from "@shared/schema";

interface RubricCriterion {
  name: string;
  description: string;
  weight: number;
}

interface InputConsoleProps {
  onSubmit: (text: string) => void;
  mode: "guided" | "assessment";
  options?: string[];
  isProcessing: boolean;
  isGameOver: boolean;
  onViewResults?: () => void;
  rubric?: { criteria: RubricCriterion[] };
  currentFeedback?: {
    score: number;
    message: string;
    hint?: string;
  } | null;
  onRequestHint?: () => Promise<string>;
  currentDecisionPoint?: DecisionPoint;
  decisionNumber?: number;
  totalDecisions?: number;
}

export function InputConsole({
  onSubmit,
  mode,
  options = [],
  isProcessing,
  isGameOver,
  onViewResults,
  rubric,
  currentFeedback,
  onRequestHint,
  currentDecisionPoint,
  decisionNumber,
  totalDecisions,
}: InputConsoleProps) {
  const [input, setInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMultipleChoice = currentDecisionPoint?.format === "multiple_choice";
  const requiresJustification = currentDecisionPoint?.requiresJustification ?? false;
  const decisionOptions = currentDecisionPoint?.options || [];

  const handleRequestHint = async () => {
    if (!onRequestHint || isLoadingHint) return;
    setIsLoadingHint(true);
    try {
      const hint = await onRequestHint();
      setCurrentHint(hint);
    } catch (error) {
      console.error("Failed to get hint:", error);
    } finally {
      setIsLoadingHint(false);
    }
  };

  useEffect(() => {
    if (!isProcessing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isProcessing]);

  const handleSubmit = async () => {
    let submissionText = "";

    if (isMultipleChoice) {
      if (!selectedOption) return;
      submissionText = selectedOption;
      if (requiresJustification && justification.trim()) {
        submissionText += `\n\nJustificación: ${justification.trim()}`;
      }
    } else {
      if (!input.trim()) return;
      submissionText = input.trim();
    }

    if (isProcessing || isSubmitting || isGameOver) return;

    setIsSubmitting(true);
    try {
      await onSubmit(submissionText);
      setInput("");
      setSelectedOption("");
      setJustification("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (!isProcessing && !isGameOver) {
      setInput(option);
      textareaRef.current?.focus();
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
    <div className="border-t bg-background p-4">
      {currentDecisionPoint?.prompt && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-muted/30 rounded-lg border"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {decisionNumber && totalDecisions
                ? `Decisión ${decisionNumber} de ${totalDecisions}`
                : "Decisión"}
            </span>
            {currentDecisionPoint.includesReflection && (
              <Badge variant="secondary" className="text-xs">
                Incluye reflexión
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium" data-testid="text-decision-prompt">
            {currentDecisionPoint.prompt}
          </p>
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
                Justifica tu decisión
              </Label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explica por qué elegiste esta opción..."
                disabled={isDisabled}
                className="min-h-20 resize-none text-sm"
                data-testid="input-justification"
              />
            </motion.div>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {!isMultipleChoice && mode === "guided" && options.length > 0 && !isGameOver && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-chart-4" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Acciones Sugeridas
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {options.map((option, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover-elevate px-3 py-1.5 text-sm"
                  onClick={() => handleOptionClick(option)}
                  data-testid={`option-chip-${index}`}
                >
                  {option}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  ? "La simulación ha terminado"
                  : "¿Cuál es tu decisión?"
              }
              disabled={isDisabled}
              className="min-h-24 max-h-48 resize-none text-base"
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
                  Enviar
                </>
              )}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  data-testid="button-review-rubric"
                >
                  <BookOpen className="w-3 h-3 mr-1" />
                  Rúbrica
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Rúbrica de Evaluación</DialogTitle>
                  <DialogDescription>
                    Tus decisiones serán evaluadas según estos criterios
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  {rubric?.criteria?.length ? (
                    rubric.criteria.map((criterion, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{criterion.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {criterion.weight}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {criterion.description}
                        </p>
                        <Progress value={criterion.weight} className="h-1" />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay criterios de rúbrica disponibles para este escenario.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleRequestHint}
                  disabled={isLoadingHint || isGameOver}
                  data-testid="button-get-hint"
                >
                  {isLoadingHint ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Lightbulb className="w-3 h-3 mr-1" />
                  )}
                  Pista
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" data-testid="dialog-hint-content">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2" data-testid="text-hint-title">
                    <Lightbulb className="w-5 h-5 text-chart-4" />
                    Orientación
                  </DialogTitle>
                  <DialogDescription>
                    Aquí tienes orientación para ayudarte con tu decisión
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  {currentHint ? (
                    <p className="text-sm leading-relaxed" data-testid="text-current-hint">{currentHint}</p>
                  ) : currentFeedback?.hint ? (
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed" data-testid="text-feedback-hint-dialog">{currentFeedback.hint}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-default-hint">
                      Considera los stakeholders involucrados: empleados, clientes, inversionistas y la comunidad. 
                      Piensa en las consecuencias a corto y largo plazo de tus decisiones.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
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
                Enviar Decisión
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
            La simulación ha terminado.
          </p>
          {onViewResults && (
            <Button onClick={onViewResults} data-testid="button-view-results">
              <BarChart3 className="w-4 h-4 mr-2" />
              Ver Resultados
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}
