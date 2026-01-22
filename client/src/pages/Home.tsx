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
  Wrench,
  BarChart3,
  LayoutDashboard,
  Pencil,
  Bug,
  Settings2,
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
              Iniciar Simulación
            </Button>
          </Link>
          <div className="flex gap-2">
            {canEditScenario && (
              <Link href={`/scenarios/${scenario.id}/edit`} className="flex-1">
                <Button variant="outline" className="w-full" data-testid={`button-edit-${scenario.id}`}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </Link>
            )}
            {canViewAnalytics && (
              <Link href={`/scenarios/${scenario.id}/analytics`} className={canEditScenario ? "flex-1" : "w-full"}>
                <Button variant="outline" className="w-full" data-testid={`button-analytics-${scenario.id}`}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analíticas
                </Button>
              </Link>
            )}
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
          Iniciar Simulación
          <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      </Card>
    </Link>
  );
}

function SessionCard({ session }: { session: SimulationSession & { scenario?: Scenario } }) {
  // Only completed sessions are shown to students
  return (
    <Link href={`/simulation/${session.id}/results`}>
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
              <Badge variant="secondary" className="text-xs shrink-0">
                <div className="w-2 h-2 rounded-full bg-chart-1 mr-1" />
                Completada
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {session.currentState.turnCount} decisiones tomadas
            </p>
          </div>

          <div className="flex items-center gap-1 text-sm text-primary font-medium shrink-0">
            Ver Resultados
            <ChevronRight className="w-4 h-4" />
          </div>
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
        title: "Sesión Expirada",
        description: "Por favor inicia sesión nuevamente.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [scenariosError, toast]);

  const effectiveRole = user?.viewingAs || user?.role || "student";
  const isProfessorOrAdmin = effectiveRole === "professor" || effectiveRole === "admin";
  
  // For students: only show completed sessions (they can review results)
  // For professors: show all sessions (for analytics)
  const completedSessions = sessions?.filter((s) => s.status === "completed") || [];
  // Professors also see abandoned sessions in analytics, but students don't see them
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
                    Panel
                  </Link>
                </Button>
                <Button variant="outline" asChild data-testid="link-analytics">
                  <Link href="/analytics">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analíticas
                  </Link>
                </Button>
                <Button variant="outline" asChild data-testid="link-studio">
                  <Link href="/studio">
                    <Wrench className="w-4 h-4 mr-2" />
                    Estudio de Autoría
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

            <Button variant="outline" size="icon" asChild data-testid="link-settings">
              <Link href="/settings">
                <Settings2 className="w-4 h-4" />
              </Link>
            </Button>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium" data-testid="text-user-name">
                  {user?.firstName || "Usuario"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {effectiveRole}
                  {user?.isSuperAdmin && user?.viewingAs && (
                    <span className="ml-1 text-amber-500">(viendo como)</span>
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
                <a href="/api/logout">Cerrar Sesión</a>
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
            Bienvenido/a, {user?.firstName || ""}
          </h1>
          <p className="text-muted-foreground">
            Inicia una nueva simulación o revisa tus resultados anteriores.
          </p>
        </motion.div>

        {completedSessions.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Mis Simulaciones Completadas</h2>
              <Badge variant="secondary">{completedSessions.length} completadas</Badge>
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

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Escenarios Disponibles</h2>
            {isProfessor && (
              <Button asChild data-testid="button-create-scenario">
                <Link href="/studio">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Escenario
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
              <h3 className="text-lg font-medium mb-2">No Hay Escenarios Disponibles</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {isProfessor
                  ? "Crea tu primer escenario para comenzar."
                  : "Vuelve pronto para nuevas experiencias de aprendizaje."}
              </p>
              {isProfessor && (
                <Button asChild>
                  <Link href="/studio">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Escenario
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
