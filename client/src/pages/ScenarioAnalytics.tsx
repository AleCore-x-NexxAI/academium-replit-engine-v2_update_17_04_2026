import { useEffect, useState } from "react";
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
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Bot,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Scenario, SimulationSession, Turn, User, TurnEvent } from "@shared/schema";

interface SessionWithUserInfo extends SimulationSession {
  user?: User;
  turnCount: number;
}

interface ConversationData {
  session: SessionWithUserInfo;
  turns: Turn[];
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

function getTextContent(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value.text) return String(value.text);
    if (value.message) return String(value.message);
    if (value.content) return String(value.content);
    try {
      const json = JSON.stringify(value);
      if (json !== "[object Object]" && json.length < 1000) {
        return "";
      }
    } catch {
    }
    return "";
  }
  return String(value);
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
          const narrativeText = getTextContent(agentResponse?.narrative);
          const reflectionText = getTextContent(agentResponse?.reflection);
          const feedbackText = getTextContent(agentResponse?.feedback);
          
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
                
                {narrativeText && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Narrativa de Simulación:</p>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{narrativeText}</p>
                    </div>
                  </div>
                )}

                {reflectionText && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reflexión Final:</p>
                    <div className="bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-500 rounded-r-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{reflectionText}</p>
                    </div>
                  </div>
                )}

                {feedbackText && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Retroalimentación:</p>
                    <div className="bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500 rounded-r-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{feedbackText}</p>
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

function EventLogViewer({ sessionId }: { sessionId: string }) {
  const { data: events, isLoading } = useQuery<TurnEvent[]>({
    queryKey: ["/api/professor/sessions", sessionId, "events"],
  });
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="p-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-muted-foreground">Sin eventos registrados</p>
        <p className="text-xs text-muted-foreground mt-1">Los eventos se registran a partir de ahora en nuevas sesiones.</p>
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "input_rejected": return <ShieldAlert className="w-4 h-4 text-destructive" />;
      case "input_accepted": return <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "agent_call": return <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "turn_completed": return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "turn_error": return <AlertCircle className="w-4 h-4 text-destructive" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getEventLabel = (type: string, data: any) => {
    switch (type) {
      case "input_rejected": return "Entrada Rechazada";
      case "input_accepted": return data?.validatedBy === "mcq_bypass" ? "MCQ Aceptada" : "Entrada Aceptada";
      case "agent_call": return `Agente: ${data?.agentName || "desconocido"}`;
      case "turn_completed": return "Turno Completado";
      case "turn_error": return "Error en Turno";
      default: return type;
    }
  };

  const getEventBadgeVariant = (type: string): "destructive" | "secondary" | "outline" | "default" => {
    switch (type) {
      case "input_rejected": return "destructive";
      case "turn_error": return "destructive";
      case "input_accepted": return "default";
      case "turn_completed": return "default";
      default: return "secondary";
    }
  };

  const rejectedCount = events.filter(e => e.eventType === "input_rejected").length;
  const acceptedCount = events.filter(e => e.eventType === "input_accepted").length;
  const agentCount = events.filter(e => e.eventType === "agent_call").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 px-4 pt-2">
        <Badge variant="destructive" data-testid="badge-rejected-count">
          {rejectedCount} rechazadas
        </Badge>
        <Badge data-testid="badge-accepted-count">
          {acceptedCount} aceptadas
        </Badge>
        <Badge variant="secondary" data-testid="badge-agent-count">
          {agentCount} llamadas a agentes
        </Badge>
      </div>

      <ScrollArea className="h-[450px]">
        <div className="space-y-2 p-4">
          {events.map((event) => {
            const data = event.eventData as any;
            const isExpanded = expandedEvents.has(event.id);
            
            return (
              <div
                key={event.id}
                className={`border rounded-lg overflow-visible ${
                  event.eventType === "input_rejected"
                    ? "border-destructive/30 bg-destructive/5"
                    : event.eventType === "turn_error"
                    ? "border-destructive/30 bg-destructive/5"
                    : ""
                }`}
                data-testid={`event-${event.eventType}-${event.id}`}
              >
                <button
                  className="w-full flex items-center gap-2 p-3 text-left"
                  onClick={() => toggleExpand(event.id)}
                  data-testid={`button-expand-event-${event.id}`}
                >
                  {getEventIcon(event.eventType)}
                  <Badge variant={getEventBadgeVariant(event.eventType)} className="text-xs">
                    {getEventLabel(event.eventType, data)}
                  </Badge>
                  {event.turnNumber && (
                    <span className="text-xs text-muted-foreground">
                      Decisión {event.turnNumber}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto mr-2">
                    {event.createdAt && new Date(event.createdAt).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  }
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t pt-2">
                    {event.rawStudentInput && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Texto del Estudiante (verbatim):</p>
                        <div className="bg-muted/50 rounded-md p-2">
                          <p className="text-sm whitespace-pre-wrap font-mono">{event.rawStudentInput}</p>
                        </div>
                      </div>
                    )}

                    {event.eventType === "input_rejected" && data?.reason && (
                      <div>
                        <p className="text-xs font-medium text-destructive mb-1">Razón del rechazo:</p>
                        <div className="bg-destructive/10 rounded-md p-2">
                          <p className="text-sm">{data.reason}</p>
                        </div>
                      </div>
                    )}

                    {event.eventType === "agent_call" && (
                      <div className="space-y-2">
                        {data?.interpretedAction && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Acción Interpretada:</p>
                            <p className="text-sm bg-muted/50 rounded-md p-2">{data.interpretedAction}</p>
                          </div>
                        )}
                        {data?.feedbackScore !== undefined && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">Puntuación:</p>
                            <Badge variant="outline">{data.feedbackScore}/100</Badge>
                          </div>
                        )}
                        {data?.feedbackMessage && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Retroalimentación:</p>
                            <p className="text-sm bg-muted/50 rounded-md p-2">{data.feedbackMessage}</p>
                          </div>
                        )}
                        {data?.kpiDeltas && Object.keys(data.kpiDeltas).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Deltas KPI:</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(data.kpiDeltas).map(([key, val]) => (
                                <Badge key={key} variant="outline" className="text-xs font-mono">
                                  {key}: {(val as number) > 0 ? "+" : ""}{val as number}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {data?.indicatorDeltas && Object.keys(data.indicatorDeltas).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Deltas Indicadores:</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(data.indicatorDeltas).map(([key, val]) => (
                                <Badge key={key} variant="outline" className="text-xs font-mono">
                                  {key}: {(val as number) > 0 ? "+" : ""}{val as number}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {data?.competencyScores && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Competencias:</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(data.competencyScores).map(([key, val]) => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {val as number}/5
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {data?.isDeepEnough !== undefined && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">Profundidad suficiente:</p>
                            <Badge variant={data.isDeepEnough ? "default" : "destructive"}>
                              {data.isDeepEnough ? "Si" : "No"}
                            </Badge>
                          </div>
                        )}
                        {data?.durationMs && (
                          <p className="text-xs text-muted-foreground">
                            Duración: {(data.durationMs / 1000).toFixed(1)}s
                          </p>
                        )}
                      </div>
                    )}

                    {event.eventType === "turn_completed" && (
                      <div className="space-y-2">
                        {data?.feedbackScore !== undefined && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">Puntuación:</p>
                            <Badge variant="outline">{data.feedbackScore}/100</Badge>
                          </div>
                        )}
                        {data?.feedbackMessage && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Retroalimentación:</p>
                            <p className="text-sm bg-muted/50 rounded-md p-2">{data.feedbackMessage}</p>
                          </div>
                        )}
                        {data?.narrativeText && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Narrativa:</p>
                            <p className="text-sm bg-muted/50 rounded-md p-2 max-h-32 overflow-y-auto">{data.narrativeText}</p>
                          </div>
                        )}
                        {data?.durationMs && (
                          <p className="text-xs text-muted-foreground">
                            Duración total: {(data.durationMs / 1000).toFixed(1)}s
                          </p>
                        )}
                      </div>
                    )}

                    {event.eventType === "turn_error" && data?.error && (
                      <div>
                        <p className="text-xs font-medium text-destructive mb-1">Error:</p>
                        <div className="bg-destructive/10 rounded-md p-2">
                          <p className="text-sm font-mono">{data.error}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function SessionDetailDialog({ session }: { session: SessionWithUserInfo }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`button-view-${session.id}`}>
          <Eye className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {session.user?.firstName} {session.user?.lastName} - Detalle de Sesión
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="conversation">
          <TabsList className="w-full">
            <TabsTrigger value="conversation" className="flex-1" data-testid="tab-conversation">
              Decisiones
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1" data-testid="tab-events">
              Registro de Eventos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="conversation">
            <ConversationViewer sessionId={session.id} />
          </TabsContent>
          <TabsContent value="events">
            <EventLogViewer sessionId={session.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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
                      <TableCell>
                        {(session.turnCount || currentState?.turnCount || 0) === 0 ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-no-interaction-${session.id}`}>
                            Sin interacción
                          </Badge>
                        ) : (
                          session.turnCount || currentState?.turnCount || 0
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {completedDate}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <SessionDetailDialog session={session} />

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
