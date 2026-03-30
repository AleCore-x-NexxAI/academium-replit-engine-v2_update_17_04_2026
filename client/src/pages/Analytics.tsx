import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain,
  ArrowLeft,
  Users,
  TrendingUp,
  Award,
  BarChart3,
  Activity,
  Target,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { SimulationSession, Scenario, User } from "@shared/schema";

const COMPETENCY_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

interface AnalyticsData {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  competencyAverages: Record<string, number>;
  scenarioBreakdown: { name: string; count: number }[];
  recentSessions: (SimulationSession & { scenario?: Scenario; user?: User })[];
}

export default function Analytics() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useTranslation();

  const COMPETENCY_LABELS: Record<string, string> = {
    strategicThinking: t("analytics.strategicThinking"),
    ethicalReasoning: t("analytics.ethicalReasoning"),
    decisionDecisiveness: t("analytics.decisiveness"),
    stakeholderEmpathy: t("analytics.empathy"),
  };

  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    enabled: isAuthenticated && (user?.role === "professor" || user?.role === "admin"),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: t("analytics.pleaseSignIn"),
        description: t("analytics.pleaseSignInDesc"),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast, t]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "professor" && user.role !== "admin") {
      toast({
        title: t("analytics.accessDenied"),
        description: t("analytics.accessDeniedDesc"),
        variant: "destructive",
      });
      navigate("/");
    }
  }, [authLoading, user, navigate, toast, t]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  const stats = analyticsData || {
    totalSessions: 0,
    completedSessions: 0,
    averageScore: 0,
    competencyAverages: {},
    scenarioBreakdown: [],
    recentSessions: [],
  };

  const radarData = Object.entries(stats.competencyAverages).map(
    ([key, value]) => ({
      subject: COMPETENCY_LABELS[key] || key,
      value: (value as number) * 20,
      fullMark: 100,
    })
  );

  const scenarioData = stats.scenarioBreakdown.map((item, index) => ({
    ...item,
    fill: COMPETENCY_COLORS[index % COMPETENCY_COLORS.length],
  }));

  const completionRate = stats.totalSessions > 0
    ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold">{t("analytics.dashboardTitle")}</span>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("analytics.totalSessions")}</p>
                  <p
                    className="text-2xl font-bold"
                    data-testid="text-total-sessions"
                  >
                    {stats.totalSessions}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-chart-2" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("analytics.completionRate")}</p>
                  <p
                    className="text-2xl font-bold"
                    data-testid="text-completion-rate"
                  >
                    {completionRate}%
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-chart-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("analytics.averageScore")}</p>
                  <p
                    className="text-2xl font-bold"
                    data-testid="text-average-score"
                  >
                    {stats.averageScore.toFixed(1)}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-chart-3" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("analytics.completedLabel")}</p>
                  <p
                    className="text-2xl font-bold"
                    data-testid="text-completed-sessions"
                  >
                    {stats.completedSessions}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  {t("analytics.avgCompetencyProfile")}
                </h2>
              </div>
              {radarData.length > 0 ? (
                <div className="h-72">
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
                        name="Average"
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
                <div className="h-72 flex items-center justify-center text-muted-foreground">
                  <p>{t("analytics.noCompetencyData")}</p>
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t("analytics.sessionsByScenario")}</h2>
              </div>
              {scenarioData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scenarioData} layout="vertical">
                      <XAxis type="number" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {scenarioData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-muted-foreground">
                  <p>{t("analytics.noSessionData")}</p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("analytics.recentSessions")}</h2>
            </div>
            {stats.recentSessions.length > 0 ? (
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {stats.recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      data-testid={`session-row-${session.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {session.scenario?.title || t("analytics.unknownScenario")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.currentState.turnCount} {t("analytics.turns")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            session.status === "completed"
                              ? "default"
                              : session.status === "active"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {session.status}
                        </Badge>
                        {session.scoreSummary && (
                          <span className="text-sm font-medium">
                            {t("analytics.scoreLabel", { score: session.scoreSummary.overallScore })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{t("analytics.noSessionsYet")}</p>
                  <p className="text-sm mt-1">
                    {t("analytics.sessionsWillAppear")}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
