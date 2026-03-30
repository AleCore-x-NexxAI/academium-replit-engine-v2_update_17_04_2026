import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Play,
  Plus,
  Clock,
  Brain,
  Target,
  Users,
  Star,
  BookOpen,
  ChevronRight,
  Pencil,
  BarChart3,
  CheckCircle2,
  Calendar,
  Sparkles,
  Lock,
  AlertTriangle,
  UserPlus,
  Loader2,
  X,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/contexts/LanguageContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Scenario, SimulationSession } from "@shared/schema";
import { t, type SimulationLanguage } from "@/lib/i18n";

const domainIcons: Record<string, React.ReactNode> = {
  Marketing: <Target className="w-5 h-5" />,
  Ethics: <Star className="w-5 h-5" />,
  HR: <Users className="w-5 h-5" />,
  Strategy: <Brain className="w-5 h-5" />,
  Crisis: <Clock className="w-5 h-5" />,
};

interface ScenarioCardProps {
  scenario: Scenario;
  userId?: string;
  userRole?: string;
}

function ScenarioCard({ scenario, userId, userRole }: ScenarioCardProps) {
  const { t } = useTranslation();
  const isAdmin = userRole === "admin";
  const isProfessor = userRole === "professor";
  const isProfessorAndAuthor = isProfessor && scenario.authorId === userId;
  const canEditScenario = isAdmin || isProfessorAndAuthor;
  const canViewAnalytics = isAdmin || isProfessor;
  
  if (canEditScenario || canViewAnalytics) {
    return (
      <Card
        className="p-6 h-full"
        data-testid={`card-scenario-${scenario.id}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            {domainIcons[scenario.domain] || <BookOpen className="w-5 h-5" />}
          </div>
          <Badge variant="secondary">{scenario.domain}</Badge>
        </div>

        <h3 className="text-lg font-semibold mb-2">{scenario.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {scenario.description}
        </p>

        <div className="flex flex-col gap-2">
          <Link href={`/simulation/start/${scenario.id}`}>
            <Button variant="default" className="w-full" data-testid={`button-start-${scenario.id}`}>
              <Play className="w-4 h-4 mr-2" />
              {t("home.startSimulation")}
            </Button>
          </Link>
          <div className="flex gap-2">
            {canEditScenario && (
              <Link href={`/scenarios/${scenario.id}/edit`} className="flex-1">
                <Button variant="outline" className="w-full" data-testid={`button-edit-${scenario.id}`}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {t("common.edit")}
                </Button>
              </Link>
            )}
            {canViewAnalytics && (
              <Link href={`/scenarios/${scenario.id}/analytics`} className={canEditScenario ? "flex-1" : "w-full"}>
                <Button variant="outline" className="w-full" data-testid={`button-analytics-${scenario.id}`}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {t("common.analytics")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-6 h-full flex flex-col"
      data-testid={`card-scenario-${scenario.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {domainIcons[scenario.domain] || <BookOpen className="w-5 h-5" />}
        </div>
        <Badge variant="outline" className="text-xs">
          {scenario.domain}
        </Badge>
      </div>

      <h3 className="text-lg font-semibold mb-2">{scenario.title}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
        {scenario.description}
      </p>

      <Link href={`/simulation/start/${scenario.id}`}>
        <Button className="w-full" data-testid={`button-comenzar-${scenario.id}`}>
          <Play className="w-4 h-4 mr-2" />
          {t("common.start")}
        </Button>
      </Link>
    </Card>
  );
}

function ProfessorWelcome({ userName }: { userName: string }) {
  const { t } = useTranslation();

  return (
    <div className="mb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <p className="text-sm text-muted-foreground mb-2" data-testid="text-hero-tagline">
          {t("home.experientialLearning")}
        </p>
        <h1 className="text-3xl font-bold mb-3" data-testid="text-hero-welcome">
          {t("home.hello")} {userName}
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-lg" data-testid="text-hero-subtitle">{t("home.turnDecisions")}</p>
      </motion.div>

      <div className="max-w-2xl mx-auto mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/studio">
            <Card className="p-8 hover-elevate cursor-pointer" data-testid="card-create-simulation">
              <div className="flex items-center gap-6">
                <div className="bg-primary/10 rounded-xl p-4 shrink-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs text-primary/80">IA</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Manual</span>
                    </div>
                  </div>
                  <Plus className="w-8 h-8 mx-auto text-primary/50" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2" data-testid="text-create-title">{t("home.createSimulation")}</h3>
                  <p className="text-muted-foreground" data-testid="text-create-description">
                    {t("home.createSimulationDesc")}
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0" />
              </div>
            </Card>
          </Link>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/demo-simulation">
            <Card className="p-5 h-full hover-elevate cursor-pointer" data-testid="card-explore-demo">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-chart-1/10 flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 text-chart-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold mb-0.5" data-testid="text-explore-title">{t("home.exploreDemo")}</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-explore-description">
                    {t("home.exploreDemoDesc")}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </div>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/professor">
            <Card className="p-5 h-full hover-elevate cursor-pointer" data-testid="card-my-simulations">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5 text-chart-2" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold mb-0.5" data-testid="text-my-simulations-title">{t("home.mySimulations")}</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-my-simulations-description">
                    {t("home.mySimulationsDesc")}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </div>
            </Card>
          </Link>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-sm text-muted-foreground/60"
        data-testid="text-safety-message"
      >
        {t("home.safetyMessage")}
      </motion.p>
    </div>
  );
}

function SessionCard({ session }: { session: SimulationSession & { scenario?: Scenario } }) {
  const { t, language } = useTranslation();
  const locale = language === "en" ? "en-US" : "es-ES";
  const completedDate = session.updatedAt 
    ? new Date(session.updatedAt).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Link href={`/simulation/${session.id}/results`}>
      <Card
        className="p-4 hover-elevate cursor-pointer"
        data-testid={`card-session-${session.id}`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-1/10 flex items-center justify-center shrink-0">
              {session.scenario
                ? domainIcons[session.scenario.domain] || <BookOpen className="w-5 h-5 text-chart-1" />
                : <BookOpen className="w-5 h-5 text-chart-1" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate mb-1">
                {session.scenario?.title || t("common.simulation")}
              </h4>
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {t("common.completed")}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {session.currentState.turnCount} {t("common.decisions")}
              </span>
              {completedDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {completedDate}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-primary font-medium">
              {t("common.viewResults")}
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  const {
    data: scenarios,
    isLoading: scenariosLoading,
    error: scenariosError,
  } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios"],
    enabled: !!user,
  });

  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery<(SimulationSession & { scenario?: Scenario })[]>({
    queryKey: ["/api/simulations/sessions"],
    enabled: !!user,
  });

  const joinMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/scenarios/join", { code });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("home.joinedSuccess"),
        description: `${t("home.joinedDesc")} "${data.scenario.title}"`,
      });
      setShowJoinModal(false);
      setJoinCode("");
      setJoinError("");
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
    },
    onError: (error: any) => {
      const message = error?.message || t("home.invalidCode");
      setJoinError(message);
    },
  });

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setJoinError(t("home.enterCode"));
      return;
    }
    setJoinError("");
    joinMutation.mutate(joinCode.trim().toUpperCase());
  };

  useEffect(() => {
    if (scenariosError && isUnauthorizedError(scenariosError as Error)) {
      toast({
        title: t("home.sessionExpired"),
        description: t("home.pleaseLoginAgain"),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [scenariosError, toast, t]);

  const effectiveRole = user?.viewingAs || user?.role || "student";
  const isProfessorOrAdmin = effectiveRole === "professor" || effectiveRole === "admin";
  
  const completedSessions = sessions?.filter((s) => s.status === "completed") || [];
  const isProfessor = effectiveRole === "professor" || effectiveRole === "admin";
  const showRoleSwitcher = user?.isSuperAdmin || user?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-[1000]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Academium</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            {showRoleSwitcher && user && <RoleSwitcher user={user} />}

            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {user?.firstName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground"
                data-testid="button-logout"
              >
                <a href="/api/logout">{t("common.logout")}</a>
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isProfessor ? (
          (<ProfessorWelcome userName={user?.firstName || ""} />)
        ) : (
          (<>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10 text-center"
            >
              <h1 className="text-3xl font-bold mb-4" data-testid="text-student-welcome">
                {t("home.welcomeStudent")} {user?.firstName || ""}
              </h1>
              <div className="max-w-xl mx-auto space-y-1">
                <p className="text-lg text-foreground">
                  {t("home.chooseScenario")}
                </p>
                <p className="text-muted-foreground">
                  {t("home.noCorrectAnswers")}
                </p>
              </div>
              <div className="mt-6">
                <Button
                  onClick={() => setShowJoinModal(true)}
                  variant="outline"
                  data-testid="button-join-simulation"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t("home.joinWithCode")}
                </Button>
              </div>
            </motion.div>
            {showJoinModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-md"
                >
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{t("home.joinSimulation")}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowJoinModal(false);
                          setJoinCode("");
                          setJoinError("");
                        }}
                        data-testid="button-close-join-modal"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("home.joinSimulationDesc")}
                    </p>
                    <form onSubmit={handleJoinSubmit}>
                      <Input
                        value={joinCode}
                        onChange={(e) => {
                          setJoinCode(e.target.value.toUpperCase());
                          setJoinError("");
                        }}
                        placeholder={t("home.joinPlaceholder")}
                        className="text-center text-lg tracking-widest uppercase mb-2"
                        maxLength={10}
                        autoFocus
                        data-testid="input-join-code"
                      />
                      {joinError && (
                        <p className="text-sm text-destructive mb-3" data-testid="text-join-error">
                          {joinError}
                        </p>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setShowJoinModal(false);
                            setJoinCode("");
                            setJoinError("");
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={joinMutation.isPending}
                          data-testid="button-submit-join-code"
                        >
                          {joinMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("home.joining")}
                            </>
                          ) : (
                            t("home.join")
                          )}
                        </Button>
                      </div>
                    </form>
                  </Card>
                </motion.div>
              </div>
            )}
            {completedSessions.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <h2 className="text-xl font-semibold">{t("home.completedSimulations")}</h2>
                  <Badge variant="secondary">{completedSessions.length} {t("home.completedCount")}</Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sessionsLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 rounded-lg" />
                    ))
                  ) : (
                    completedSessions.map((session) => (
                      <SessionCard key={session.id} session={session} />
                    ))
                  )}
                </div>
              </section>
            )}
            <section className="mb-12">
              <Card className="p-6 md:p-8 bg-muted/20">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">{t("home.availableScenarios")}</h2>
                  <p className="text-muted-foreground">
                    {t("home.selectScenario")}
                  </p>
                </div>

                {scenariosLoading ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-56 rounded-lg" />
                    ))}
                  </div>
                ) : scenarios && scenarios.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {scenarios.map((scenario, index) => (
                      <motion.div
                        key={scenario.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <ScenarioCard 
                          scenario={scenario} 
                          userId={user?.id}
                          userRole={effectiveRole}
                        />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">{t("home.noScenarios")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("home.noScenariosDesc")}
                    </p>
                  </div>
                )}
              </Card>
            </section>
            <section>
              <Card className="p-6 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/10 border-primary/20">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1 text-foreground">{t("home.createOwnExperiences")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("home.comingSoonDesc")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    <Lock className="w-3 h-3 mr-1.5" />
                    {t("home.comingSoon")}
                  </Badge>
                </div>
              </Card>
            </section>
          </>)
        )}
      </main>
    </div>
  );
}
