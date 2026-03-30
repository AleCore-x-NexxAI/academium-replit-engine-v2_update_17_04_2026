import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, RefreshCw } from "lucide-react";
import { t, type SimulationLanguage } from "@/lib/i18n";

interface FeedbackPanelProps {
  feedback: {
    score: number;
    message: string;
    hint?: string;
  } | null;
  competencyScores: Record<string, number>;
  isGameOver: boolean;
  pendingRevision?: boolean;
  revisionPrompt?: string | null;
  revisionAttempts?: number;
  maxRevisions?: number;
  language?: SimulationLanguage;
}

export function FeedbackPanel({
  feedback,
  isGameOver,
  pendingRevision = false,
  revisionPrompt,
  revisionAttempts = 0,
  maxRevisions = 2,
  language = "es",
}: FeedbackPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-6">
        {t("feedbackPanel.observations")}
      </h3>

      <AnimatePresence mode="wait">
        {pendingRevision && revisionPrompt && (
          <motion.div
            key="revision"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-testid="revision-feedback-card"
          >
            <Card className="p-6 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  <span className="font-medium">{t("feedbackPanel.deepenResponse")}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {revisionAttempts}/{maxRevisions}
                </Badge>
              </div>

              <p className="text-sm leading-relaxed text-foreground mb-4">
                {revisionPrompt}
              </p>

              <p className="text-xs text-muted-foreground">
                {t("feedbackPanel.reflectAndExpand")}
              </p>
            </Card>
          </motion.div>
        )}

        {!pendingRevision && feedback && (
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
                <span className="font-medium">{t("feedbackPanel.mentorNote")}</span>
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
              {t("feedbackPanel.simulationCompleted")}
            </p>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
