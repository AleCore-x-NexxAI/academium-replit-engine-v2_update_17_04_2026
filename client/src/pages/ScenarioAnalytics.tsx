import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  UserMinus,
  UserPlus,
  Loader2,
  BarChart3,
  Hash,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Scenario, SimulationSession, Turn, User } from "@shared/schema";

interface SessionWithUserInfo extends SimulationSession {
  user?: User;
  turnCount: number;
}

interface ConversationData {
  session: SessionWithUserInfo;
  turns: Turn[];
}

interface ThemesData {
  themes: { word: string; count: number }[];
  totalResponses: number;
  completedSessions: number;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function ConversationViewer({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery<ConversationData>({
    queryKey: ["/api/professor/sessions", sessionId, "conversation"],
  });

  if (isLoading) {
    return <div className="p-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (!data?.turns || data.turns.length === 0) {
    return <p className="text-muted-foreground text-center p-4">Sin historial de decisiones</p>;
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-6 p-4">
        {data.turns.map((turn, index) => {
          const agentResponse = turn.agentResponse as any;
          const decisionNumber = index + 1;
          
          return (
            <div key={turn.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  Decisión {decisionNumber}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {turn.createdAt && new Date(turn.createdAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Respuesta del Estudiante:</p>
                  <div className="bg-primary/5 border-l-2 border-primary rounded-r-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{turn.studentInput}</p>
                  </div>
                </div>
                
                {agentResponse?.narrative && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Narrativa de Simulación:</p>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{agentResponse.narrative}</p>
                    </div>
                  </div>
                )}

                {agentResponse?.reflection && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reflexión Final:</p>
                    <div className="bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-500 rounded-r-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{agentResponse.reflection}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default function ScenarioAnalytics() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: scenario, isLoading: scenarioLoading, error: scenarioError } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", scenarioId],
    enabled: !!scenarioId && !!user,
  });

  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<SessionWithUserInfo[]>({
    queryKey: ["/api/professor/scenarios", scenarioId, "sessions"],
    enabled: !!scenarioId && !!user,
  });

  const { data: themesData, isLoading: themesLoading } = useQuery<ThemesData>({
    queryKey: ["/api/professor/scenarios", scenarioId, "themes"],
    enabled: !!scenarioId && !!user,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/professor/sessions/${sessionId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      refetchSessions();
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios"] });
      toast({ title: "Estado de sesión actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar estado", description: error.message, variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest("DELETE", `/api/professor/sessions/${sessionId}`);
    },
    onSuccess: () => {
      refetchSessions();
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios"] });
      toast({ title: "Sesión eliminada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar sesión", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (scenarioError && isUnauthorizedError(scenarioError as Error)) {
      toast({ title: "Sesión expirada", description: "Por favor inicia sesión de nuevo.", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [scenarioError, toast]);

  if (authLoading || scenarioLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isProfessorOrAdmin = user.role === "professor" || user.role === "admin";
  if (!isProfessorOrAdmin) return null;

  const activeSessions = sessions?.filter(s => s.status === "active") || [];
  const completedSessions = sessions?.filter(s => s.status === "completed") || [];
  const abandonedSessions = sessions?.filter(s => s.status === "abandoned") || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500">En Progreso</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completada</Badge>;
      case "abandoned":
        return <Badge variant="secondary">Abandonada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{scenario?.title || "Análisis de Escenario"}</h1>
              <p className="text-sm text-muted-foreground">{scenario?.domain}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="font-medium">Analytics</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Estudiantes" value={sessions?.length || 0} icon={Users} color="bg-primary" />
          <StatCard label="En Progreso" value={activeSessions.length} icon={Clock} color="bg-blue-500" />
          <StatCard label="Completadas" value={completedSessions.length} icon={CheckCircle} color="bg-green-500" />
        </div>

        {/* Aggregated Themes Section */}
        {themesData && themesData.themes.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Temas Frecuentes en Respuestas</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Palabras más comunes en {themesData.totalResponses} respuestas de {themesData.completedSessions} sesiones completadas
            </p>
            <div className="flex flex-wrap gap-2">
              {themesData.themes.map((theme) => {
                const maxCount = themesData.themes[0]?.count || 1;
                const intensity = Math.max(0.3, theme.count / maxCount);
                return (
                  <Badge 
                    key={theme.word} 
                    variant="outline"
                    className="px-3 py-1"
                    style={{ opacity: 0.5 + intensity * 0.5 }}
                  >
                    <span className="font-medium">{theme.word}</span>
                    <span className="ml-2 text-muted-foreground text-xs">({theme.count})</span>
                  </Badge>
                );
              })}
            </div>
          </Card>
        )}

        {themesLoading && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-primary" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Estudiantes Participantes</h2>
          
          {sessionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : sessions && sessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Decisiones</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const currentState = session.currentState as any;
                  const completedDate = session.updatedAt 
                    ? new Date(session.updatedAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "-";
                  return (
                    <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {session.user?.firstName} {session.user?.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{session.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>{session.turnCount || currentState?.turnCount || 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {completedDate}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-view-${session.id}`}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh]">
                              <DialogHeader>
                                <DialogTitle>
                                  Recorrido de Decisiones - {session.user?.firstName} {session.user?.lastName}
                                </DialogTitle>
                              </DialogHeader>
                              <ConversationViewer sessionId={session.id} />
                            </DialogContent>
                          </Dialog>

                          {session.status === "active" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatusMutation.mutate({ sessionId: session.id, status: "abandoned" })}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-unenroll-${session.id}`}
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          ) : session.status === "abandoned" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatusMutation.mutate({ sessionId: session.id, status: "active" })}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-reenroll-${session.id}`}
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                          ) : null}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("¿Eliminar esta sesión permanentemente?")) {
                                deleteSessionMutation.mutate(session.id);
                              }
                            }}
                            disabled={deleteSessionMutation.isPending}
                            data-testid={`button-delete-${session.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">Sin Estudiantes Aún</h3>
              <p className="text-sm text-muted-foreground">
                Los estudiantes aparecerán aquí cuando inicien esta simulación.
              </p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
