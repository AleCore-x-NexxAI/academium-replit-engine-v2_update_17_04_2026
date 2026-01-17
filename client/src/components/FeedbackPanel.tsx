import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface FeedbackPanelProps {
  feedback: {
    score: number;
    message: string;
    hint?: string;
  } | null;
  competencyScores: Record<string, number>;
  isGameOver: boolean;
}

export function FeedbackPanel({
  feedback,
  isGameOver,
}: FeedbackPanelProps) {
  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-6">
        Observaciones
      </h3>

      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            key={feedback.message}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-testid="feedback-card"
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="font-medium">Nota del Mentor</span>
              </div>

              <p className="text-sm leading-relaxed text-foreground">
                {feedback.message}
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isGameOver && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <Card className="p-6 bg-muted/30">
            <p className="text-sm text-center text-muted-foreground">
              Has completado esta simulación. Revisa tu línea de decisiones para reflexionar sobre tu experiencia.
            </p>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
