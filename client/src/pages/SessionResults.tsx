import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain,
  ArrowLeft,
  Award,
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Heart,
  Star,
  MessageSquare,
  Clock,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { SimulationSession, Scenario, Turn } from "@shared/schema";

const KPI_ICONS: Record<string, React.ElementType> = {
  revenue: DollarSign,
  morale: Heart,
  reputation: Star,
  efficiency: TrendingUp,
  trust: Users,
};

const KPI_LABELS: Record<string, string> = {
  revenue: "Revenue",
  morale: "Morale",
  reputation: "Reputation",
  efficiency: "Efficiency",
  trust: "Trust",
};

const COMPETENCY_LABELS: Record<string, string> = {
  strategicThinking: "Strategic Thinking",
  ethicalReasoning: "Ethical Reasoning",
  decisionDecisiveness: "Decisiveness",
  stakeholderEmpathy: "Empathy",
};

function getScoreGrade(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Outstanding", color: "text-green-600" };
  if (score >= 80) return { label: "Excellent", color: "text-green-500" };
  if (score >= 70) return { label: "Good", color: "text-chart-4" };
  if (score >= 60) return { label: "Satisfactory", color: "text-yellow-500" };
  if (score >= 50) return { label: "Needs Improvement", color: "text-orange-500" };
  return { label: "Unsatisfactory", color: "text-destructive" };
}

function formatKpiValue(key: string, value: number): string {
  if (key === "revenue") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return `${value}%`;
}

export default function SessionResults() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: session, isLoading: sessionLoading } = useQuery<
    SimulationSession & { scenario?: Scenario }
  >({
    queryKey: ["/api/simulations", sessionId],
    enabled: !!sessionId && isAuthenticated,
  });

  const { data: turns, isLoading: turnsLoading } = useQuery<Turn[]>({
    queryKey: ["/api/simulations", sessionId, "history"],
    enabled: !!sessionId && isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to view results.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  if (authLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This session may have been deleted.
          </p>
          <Button onClick={() => navigate("/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  const scoreSummary = session.scoreSummary;
  const scenario = session.scenario;
  const finalKpis = scoreSummary?.finalKpis || session.currentState.kpis;
  const initialKpis = scenario?.initialState?.kpis;
  const competencies = scoreSummary?.competencies || {};
  const overallScore = scoreSummary?.overallScore || 0;
  const grade = getScoreGrade(overallScore);

  const radarData = Object.entries(competencies).map(([key, value]) => ({
    subject: COMPETENCY_LABELS[key] || key,
    value: (value as number) * 20,
    fullMark: 100,
  }));

  const kpiComparison = Object.entries(finalKpis).map(([key, value]) => {
    const initial = initialKpis?.[key as keyof typeof initialKpis] || 0;
    const delta = value - initial;
    return {
      key,
      label: KPI_LABELS[key] || key,
      initial,
      final: value,
      delta,
      Icon: KPI_ICONS[key] || Target,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold hidden sm:inline">SIMULEARN</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Simulation Results</p>
        </div>
        <div className="w-20" />
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Badge className="mb-4" variant="outline">
            Simulation Complete
          </Badge>
          <h1
            className="text-3xl font-bold mb-2"
            data-testid="text-scenario-title"
          >
            {scenario?.title || "Business Simulation"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {scenario?.domain} Challenge
          </p>

          <Card className="inline-block p-8">
            <div className="flex items-center justify-center gap-4">
              <Trophy className={`w-12 h-12 ${grade.color}`} />
              <div className="text-left">
                <p className="text-4xl font-bold" data-testid="text-overall-score">
                  {overallScore}
                </p>
                <p className={`font-semibold ${grade.color}`}>{grade.label}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Award className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Competency Profile</h2>
              </div>
              {radarData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={radarData}
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                    >
                      <PolarGrid
                        stroke="hsl(var(--border))"
                        strokeDasharray="3 3"
                      />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <Radar
                        name="Score"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <p>No competency data available</p>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {Object.entries(competencies).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm"
                    data-testid={`competency-${key}`}
                  >
                    <span className="text-muted-foreground">
                      {COMPETENCY_LABELS[key] || key}
                    </span>
                    <span className="font-medium">
                      {((value as number) * 20).toFixed(0)}/100
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">KPI Summary</h2>
              </div>
              <div className="space-y-4">
                {kpiComparison.map(
                  ({ key, label, initial, final, delta, Icon }) => (
                    <div
                      key={key}
                      className="flex items-center gap-4"
                      data-testid={`kpi-${key}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {formatKpiValue(key, initial)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-sm font-semibold">
                              {formatKpiValue(key, final)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  key === "revenue"
                                    ? (final / (initial || 100000)) * 50
                                    : final
                                )}%`,
                              }}
                            />
                          </div>
                          <div
                            className={`flex items-center gap-1 text-xs font-medium ${
                              delta >= 0 ? "text-green-600" : "text-destructive"
                            }`}
                          >
                            {delta >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {delta >= 0 ? "+" : ""}
                            {key === "revenue"
                              ? `$${Math.abs(delta).toLocaleString()}`
                              : `${delta}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {scoreSummary?.feedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Final Feedback</h2>
              </div>
              <p
                className="text-muted-foreground leading-relaxed"
                data-testid="text-final-feedback"
              >
                {scoreSummary.feedback}
              </p>
            </Card>
          </motion.div>
        )}

        {turns && turns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Decision Timeline</h2>
              </div>
              <ScrollArea className="h-96">
                <div className="space-y-4 pr-4">
                  {turns.map((turn, index) => (
                    <div key={turn.id} className="relative pl-6">
                      <div className="absolute left-0 top-2 w-3 h-3 rounded-full bg-primary" />
                      {index < turns.length - 1 && (
                        <div className="absolute left-[5px] top-5 w-0.5 h-full bg-border" />
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">Turn {turn.turnNumber}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Score: {turn.agentResponse.feedback.score}
                          </span>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-1">
                            Your Decision:
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {turn.studentInput}
                          </p>
                        </div>
                        <div className="p-3 bg-card border rounded-lg">
                          <p className="text-sm font-medium mb-1">Feedback:</p>
                          <p className="text-sm text-muted-foreground">
                            {turn.agentResponse.feedback.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </motion.div>
        )}

        <div className="flex justify-center gap-4 pt-4">
          <Button variant="outline" onClick={() => navigate("/")}>
            Return Home
          </Button>
          {scenario && (
            <Button
              onClick={() => navigate(`/simulation/start/${scenario.id}`)}
              data-testid="button-try-again"
            >
              Try Again
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
