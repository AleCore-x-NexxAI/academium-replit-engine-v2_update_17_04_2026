import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Lightbulb, BookOpen, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface InputConsoleProps {
  onSubmit: (text: string) => void;
  mode: "guided" | "assessment";
  options?: string[];
  isProcessing: boolean;
  isGameOver: boolean;
  onViewResults?: () => void;
}

export function InputConsole({
  onSubmit,
  mode,
  options = [],
  isProcessing,
  isGameOver,
  onViewResults,
}: InputConsoleProps) {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isProcessing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isProcessing]);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing || isSubmitting || isGameOver) return;

    setIsSubmitting(true);
    try {
      await onSubmit(input.trim());
      setInput("");
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

  return (
    <div className="border-t bg-background p-4">
      <AnimatePresence>
        {mode === "guided" && options.length > 0 && !isGameOver && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-chart-4" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Suggested Actions
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

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isGameOver
                ? "Simulation has ended"
                : "What would you like to do?"
            }
            disabled={isDisabled}
            className="min-h-24 max-h-48 resize-none text-base"
            data-testid="input-decision"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isDisabled}
            className="h-10"
            data-testid="button-submit-decision"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isDisabled}
            className="text-xs"
            data-testid="button-review-rubric"
          >
            <BookOpen className="w-3 h-3 mr-1" />
            Rubric
          </Button>
        </div>
      </div>

      {isGameOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center space-y-3"
        >
          <p className="text-sm text-destructive">
            The simulation has ended.
          </p>
          {onViewResults && (
            <Button onClick={onViewResults} data-testid="button-view-results">
              <BarChart3 className="w-4 h-4 mr-2" />
              View Full Results
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}
