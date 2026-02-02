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
  Bug,
  BarChart3,
  CheckCircle2,
  Calendar,
  Sparkles,
  Lock,
  AlertTriangle,
  UserPlus,
  Loader2,
  X,
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
import { queryClient, apiRequest } from "@/lib/queryClient";
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

  // Student view: Simple card focused on the experience
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
          <Badge variant="outline" className="text-xs">
            {scenario.domain}
          </Badge>
        </div>

        <h3 className="text-lg font-semibold mb-2">{scenario.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {scenario.description}
        </p>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            20-25 min
          </span>
          <span className="text-primary font-medium flex items-center">
            Comenzar
            <ChevronRight className="w-4 h-4 ml-1" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

function ProfessorWelcome({ userName }: { userName: string }) {
  return (
    <div className="mb-12">
      {/* Calm Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <p className="text-sm text-muted-foreground mb-2" data-testid="text-hero-tagline">
          Aprendizaje experiencial para tus estudiantes
        </p>
        <h1 className="text-3xl font-bold mb-3" data-testid="text-hero-welcome">
          Hola, {userName}
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-lg" data-testid="text-hero-subtitle">Convierte decisiones en aprendizaje observable.</p>
      </motion.div>
      {/* Three Calm Actions */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
        {/* Explore Example Card - with visual preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/explore">
            <Card className="p-6 h-full hover-elevate cursor-pointer" data-testid="card-explore-example">
              {/* Visual simulation preview hint */}
              <div className="bg-muted/50 rounded-lg p-3 mb-4 border border-dashed border-muted-foreground/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary/60" />
                  <div className="h-2 w-16 bg-muted-foreground/20 rounded" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-muted-foreground/15 rounded" />
                  <div className="h-2 w-3/4 bg-muted-foreground/15 rounded" />
                </div>
                <div className="flex gap-2 mt-3">
                  <div className="h-6 w-16 bg-primary/20 rounded text-[10px] flex items-center justify-center text-primary/70">Opción A</div>
                  <div className="h-6 w-16 bg-muted-foreground/10 rounded text-[10px] flex items-center justify-center text-muted-foreground/50">Opción B</div>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1" data-testid="text-explore-title">Explorar un Ejemplo</h3>
                <p className="text-sm text-muted-foreground" data-testid="text-explore-description">
                  Ve lo que experimentan tus estudiantes
                </p>
              </div>
            </Card>
          </Link>
        </motion.div>

        {/* Create Simulation Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/studio">
            <Card className="p-6 h-full hover-elevate cursor-pointer" data-testid="card-create-simulation">
              {/* Visual creation hint */}
              <div className="bg-muted/50 rounded-lg p-3 mb-4 border border-dashed border-muted-foreground/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary/60" />
                    <span className="text-[10px] text-muted-foreground/60">IA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pencil className="w-3 h-3 text-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground/60">Manual</span>
                  </div>
                </div>
                <div className="text-center py-2">
                  <Plus className="w-6 h-6 mx-auto text-muted-foreground/30" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1" data-testid="text-create-title">Crear Simulación</h3>
                <p className="text-sm text-muted-foreground" data-testid="text-create-description">
                  Tú decides cómo hacerlo
                </p>
              </div>
            </Card>
          </Link>
        </motion.div>

        {/* My Simulations Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/professor">
            <Card className="p-6 h-full hover-elevate cursor-pointer" data-testid="card-my-simulations">
              {/* Visual list hint */}
              <div className="bg-muted/50 rounded-lg p-3 mb-4 border border-dashed border-muted-foreground/20">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded bg-primary/40" />
                    <div className="h-2 w-20 bg-muted-foreground/20 rounded" />
                    <div className="ml-auto h-4 w-12 bg-muted-foreground/10 rounded text-[8px] flex items-center justify-center text-muted-foreground/50">Listo</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded bg-muted-foreground/30" />
                    <div className="h-2 w-16 bg-muted-foreground/15 rounded" />
                    <div className="ml-auto h-4 w-14 bg-muted-foreground/10 rounded text-[8px] flex items-center justify-center text-muted-foreground/50">Borrador</div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1" data-testid="text-my-simulations-title">Mis Simulaciones</h3>
                <p className="text-sm text-muted-foreground" data-testid="text-my-simulations-description">
                  Ver o editar tus casos existentes
                </p>
              </div>
            </Card>
          </Link>
        </motion.div>
      </div>
      {/* Safety messaging */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-sm text-muted-foreground/60"
        data-testid="text-safety-message"
      >
        Explora libremente. Nada aquí es permanente.
      </motion.p>
    </div>
  );
}

function SessionCard({ session }: { session: SimulationSession & { scenario?: Scenario } }) {
  // Only completed sessions are shown to students
  const completedDate = session.updatedAt 
    ? new Date(session.updatedAt).toLocaleDateString("es-ES", {
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
                {session.scenario?.title || "Simulación"}
              </h4>
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Completada
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {session.currentState.turnCount} decisiones
              </span>
              {completedDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {completedDate}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-primary font-medium">
              Ver Resultados
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
  
  // Join simulation state
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
        title: "Unido exitosamente",
        description: `Te has unido a "${data.scenario.title}"`,
      });
      setShowJoinModal(false);
      setJoinCode("");
      setJoinError("");
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
    },
    onError: (error: any) => {
      const message = error?.message || "Código inválido o expirado";
      setJoinError(message);
    },
  });

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setJoinError("Ingresa un código");
      return;
    }
    setJoinError("");
    joinMutation.mutate(joinCode.trim().toUpperCase());
  };

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
      <header className="border-b sticky top-0 bg-background z-[1000]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ScenarioX</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Minimal header for first-time flow */}
            {showRoleSwitcher && user && <RoleSwitcher user={user} />}

            {user?.isSuperAdmin && (
              <Button variant="ghost" size="icon" asChild data-testid="link-bug-reports">
                <Link href="/bug-reports">
                  <Bug className="w-4 h-4" />
                </Link>
              </Button>
            )}

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
                <a href="/api/logout">Salir</a>
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isProfessor ? (
          /* Professor first-time flow: ONLY show calm hero + 3 actions + safety message
             No dashboards, metrics, scenario lists, or completed sessions here.
             Those are accessible via "Mis Simulaciones" link to /professor */
          (<ProfessorWelcome userName={user?.firstName || ""} />)
        ) : (
          /* Student view: show welcome + their content */
          (<>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <p className="text-sm text-muted-foreground mb-2">
                Simulaciones de decisiones empresariales
              </p>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-bold mb-2" data-testid="text-student-welcome">
                    Bienvenido/a, {user?.firstName || ""}
                  </h1>
                  <p className="text-muted-foreground max-w-lg">
                    Cada escenario es un mundo donde tomas decisiones reales. No hay respuestas correctas — lo importante es tu razonamiento.
                  </p>
                </div>
                <Button
                  onClick={() => setShowJoinModal(true)}
                  variant="outline"
                  className="shrink-0"
                  data-testid="button-join-simulation"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Unirse a Simulación
                </Button>
              </div>
            </motion.div>
            {/* Join Simulation Modal */}
            {showJoinModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-md"
                >
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Unirse a Simulación</h3>
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
                      Ingresa el código que te proporcionó tu profesor para unirte a una simulación.
                    </p>
                    <form onSubmit={handleJoinSubmit}>
                      <Input
                        value={joinCode}
                        onChange={(e) => {
                          setJoinCode(e.target.value.toUpperCase());
                          setJoinError("");
                        }}
                        placeholder="Ej: ABC123"
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
                          Cancelar
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
                              Uniendo...
                            </>
                          ) : (
                            "Unirse"
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
              <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <h2 className="text-xl font-semibold">Escenarios Disponibles</h2>
                <p className="text-sm text-muted-foreground">
                  Selecciona un escenario para comenzar tu experiencia
                </p>
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
                    Vuelve pronto para nuevas experiencias de aprendizaje.
                  </p>
                </Card>
              )}
            </section>
            {/* Coming Soon: Student Sandbox */}
            <section className="mt-12 pt-8 border-t">
              <Card className="p-6 bg-muted/30 border-dashed">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Crea tus propias experiencias</h3>
                      <p className="text-sm text-muted-foreground">
                        Pronto podrás diseñar tus propias simulaciones y compartirlas.
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    disabled 
                    className="opacity-60"
                    data-testid="button-create-scenario-disabled"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Próximamente
                  </Button>
                </div>
              </Card>
            </section>
          </>)
        )}
      </main>
    </div>
  );
}
