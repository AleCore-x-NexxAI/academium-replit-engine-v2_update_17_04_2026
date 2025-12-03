import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Award, AlertTriangle } from "lucide-react";

interface FeedbackPanelProps {
  feedback: {
    score: number;
    message: string;
    hint?: string;
  } | null;
  competencyScores: Record<string, number>;
  isGameOver: boolean;
}

const competencyLabels: Record<string, string> = {
  strategicThinking: "Strategic Thinking",
  ethicalReasoning: "Ethical Reasoning",
  decisionDecisiveness: "Decisiveness",
  stakeholderEmpathy: "Empathy",
};

export function FeedbackPanel({
  feedback,
  competencyScores,
  isGameOver,
}: FeedbackPanelProps) {
  const radarData = Object.entries(competencyScores).map(([key, value]) => ({
    subject: competencyLabels[key] || key,
    value: value * 20,
    fullMark: 100,
  }));

  const hasCompetencyData = radarData.length > 0;

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: "Excellent", variant: "default" as const };
    if (score >= 60) return { label: "Good", variant: "secondary" as const };
    if (score >= 40) return { label: "Fair", variant: "outline" as const };
    return { label: "Needs Improvement", variant: "destructive" as const };
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-6">
        Performance Analysis
      </h3>

      {hasCompetencyData && (
        <Card className="p-4 mb-6">
          <h4 className="text-sm font-medium mb-4 text-center">
            Competency Profile
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
                <Radar
                  name="Competency"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-chart-4" />
                  <span className="font-medium">Decision Feedback</span>
                </div>
                <Badge variant={getScoreBadge(feedback.score).variant}>
                  {getScoreBadge(feedback.score).label}
                </Badge>
              </div>

              <p className="text-sm leading-relaxed text-foreground mb-4">
                {feedback.message}
              </p>

              {feedback.hint && (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                  <Lightbulb className="w-4 h-4 text-chart-4 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground italic">
                    {feedback.hint}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6"
          >
            <Card className="p-6 border-destructive bg-destructive/5">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <h4 className="text-lg font-semibold text-destructive">
                  Simulation Ended
                </h4>
              </div>
              <p className="text-sm text-muted-foreground">
                A critical threshold was reached. Review your decisions to
                understand what led to this outcome.
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!feedback && !isGameOver && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="p-6">
            <Award className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Make a decision to receive feedback
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
