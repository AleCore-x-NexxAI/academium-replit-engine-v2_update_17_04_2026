import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, BarChart3, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { DecisionPoint } from "@shared/schema";

// POC: Simplified props - rubric and hints removed per POC spec
interface InputConsoleProps {
  onSubmit: (text: string) => void;
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
  maxRevisions = 2,
  validationError,
}: InputConsoleProps) {
  const [input, setInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMultipleChoice = currentDecisionPoint?.format === "multiple_choice";
  const requiresJustification = currentDecisionPoint?.requiresJustification ?? false;
  const decisionOptions = currentDecisionPoint?.options || [];

  // POC: Hints removed - handleRequestHint removed per spec

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

  // POC: handleOptionClick removed - "Suggested Actions" panel removed per spec

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
    <div className="border-t-2 border-border bg-background p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {pendingRevision && revisionPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-primary/5 border-primary/20 rounded-lg border"
          data-testid="revision-prompt-banner"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-primary uppercase tracking-wide">
              El mentor te invita a profundizar
            </span>
            <Badge variant="outline" className="text-xs">
              Revisión {revisionAttempts} de {maxRevisions}
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
          className="mb-4 p-4 bg-destructive/10 border-destructive/30 rounded-lg border"
          data-testid="validation-error-banner"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-medium text-destructive uppercase tracking-wide block mb-1">
                Respuesta no válida
              </span>
              <p className="text-sm text-foreground leading-relaxed">
                {validationError}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* S3.1: Decision Header Block - Visually unmistakable task */}
      {currentDecisionPoint?.prompt && !pendingRevision && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Card className="p-5 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30 border-l-4 border-l-primary">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Send className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Tu Decisión
                </span>
              </div>
              <Badge variant="outline" className="bg-background text-xs">
                {decisionNumber && totalDecisions
                  ? `${decisionNumber} de ${totalDecisions}`
                  : "Activa"}
              </Badge>
            </div>
            <p className="text-base font-medium text-foreground leading-relaxed" data-testid="text-decision-prompt">
              {currentDecisionPoint.prompt}
            </p>
            {currentDecisionPoint.includesReflection && (
              <Badge variant="secondary" className="text-xs mt-3">
                Incluye reflexión
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

{/* POC: "Suggested Actions" panel removed per spec - no action chips shown */}

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

{/* POC: Rubric button hidden per spec - no grading/scoring visible to students */}
            {/* POC: Hints OFF by default per spec - can be enabled by professor toggle (not implemented in POC) */}
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
