import { useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
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
  Loader2,
  Settings,
  BarChart3,
  LayoutDashboard,
  Pencil,
  Bug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import type { Scenario, SimulationSession } from "@shared/schema";

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
  const isAdmin = userRole === "admin";
  const isProfessorAndAuthor = userRole === "professor" && scenario.authorId === userId;
  const canManageScenario = isAdmin || isProfessorAndAuthor;
  
  if (canManageScenario) {
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
              Start Simulation
            </Button>
          </Link>
          <div className="flex gap-2">
            <Link href={`/scenarios/${scenario.id}/edit`} className="flex-1">
              <Button variant="outline" className="w-full" data-testid={`button-edit-${scenario.id}`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Link href={`/scenarios/${scenario.id}/analytics`} className="flex-1">
              <Button variant="outline" className="w-full" data-testid={`button-analytics-${scenario.id}`}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Link href={`/simulation/start/${scenario.id}`}>
      <Card
        className="p-6 h-full hover-elevate cursor-pointer"
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

        <div className="flex items-center text-sm text-primary font-medium">
          Start Simulation
          <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      </Card>
    </Link>
  );
}

function SessionCard({ session }: { session: SimulationSession & { scenario?: Scenario } }) {
  const statusColors = {
    active: "bg-chart-2",
    completed: "bg-chart-1",
    abandoned: "bg-muted",
  };

  return (
    <Link href={`/simulation/${session.id}`}>
      <Card
        className="p-4 hover-elevate cursor-pointer"
        data-testid={`card-session-${session.id}`}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {session.scenario
              ? domainIcons[session.scenario.domain] || <BookOpen className="w-5 h-5" />
              : <BookOpen className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">
                {session.scenario?.title || "Simulation"}
              </h4>
              <div
                className={`w-2 h-2 rounded-full ${statusColors[session.status]}`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {session.currentState.turnCount} turns
              {session.status === "active" && " - In Progress"}
            </p>
          </div>

          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </Card>
    </Link>
  );
}

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

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

  useEffect(() => {
    if (scenariosError && isUnauthorizedError(scenariosError as Error)) {
      toast({
        title: "Session Expired",
        description: "Please sign in again.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [scenariosError, toast]);

  const activeSessions = sessions?.filter((s) => s.status === "active") || [];
  
  const effectiveRole = user?.viewingAs || user?.role || "student";
  const isProfessor = effectiveRole === "professor" || effectiveRole === "admin";
  const showRoleSwitcher = user?.isSuperAdmin || user?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">SIMULEARN</span>
          </div>

          <div className="flex items-center gap-4">
            {isProfessor && (
              <>
                <Button variant="outline" asChild data-testid="link-professor-dashboard">
                  <Link href="/professor">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="outline" asChild data-testid="link-analytics">
                  <Link href="/analytics">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </Link>
                </Button>
                <Button variant="outline" asChild data-testid="link-studio">
                  <Link href="/studio">
                    <Settings className="w-4 h-4 mr-2" />
                    Authoring Studio
                  </Link>
                </Button>
              </>
            )}

            {showRoleSwitcher && user && <RoleSwitcher user={user} />}

            {user?.isSuperAdmin && (
              <Button variant="outline" size="icon" asChild data-testid="link-bug-reports">
                <Link href="/bug-reports">
                  <Bug className="w-4 h-4" />
                </Link>
              </Button>
            )}

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium" data-testid="text-user-name">
                  {user?.firstName || "User"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {effectiveRole}
                  {user?.isSuperAdmin && user?.viewingAs && (
                    <span className="ml-1 text-amber-500">(viewing)</span>
                  )}
                </p>
              </div>
              <Avatar className="w-9 h-9">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback>
                  {user?.firstName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="sm"
                asChild
                data-testid="button-logout"
              >
                <a href="/api/logout">Sign Out</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.firstName || "there"}
          </h1>
          <p className="text-muted-foreground">
            Continue your learning journey or start a new simulation.
          </p>
        </motion.div>

        {activeSessions.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Active Simulations</h2>
              <Badge variant="secondary">{activeSessions.length} in progress</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessionsLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))
              ) : (
                activeSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))
              )}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Available Scenarios</h2>
            {isProfessor && (
              <Button asChild data-testid="button-create-scenario">
                <Link href="/studio">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Scenario
                </Link>
              </Button>
            )}
          </div>

          {scenariosLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : scenarios && scenarios.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {scenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
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
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Scenarios Available</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {isProfessor
                  ? "Create your first scenario to get started."
                  : "Check back soon for new learning experiences."}
              </p>
              {isProfessor && (
                <Button asChild>
                  <Link href="/studio">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Scenario
                  </Link>
                </Button>
              )}
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
