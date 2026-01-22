import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  BookOpen, 
  Users, 
  Clock, 
  CheckCircle2, 
  MoreVertical,
  Eye,
  Trash2,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Scenario } from "@shared/schema";

interface ScenarioWithStats extends Scenario {
  enrollmentCount: number;
  activeCount: number;
  completedCount: number;
}

export default function ProfessorDashboard() {
  const { toast } = useToast();
  const [deleteScenarioId, setDeleteScenarioId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const { data: scenarios, isLoading, error } = useQuery<ScenarioWithStats[]>({
    queryKey: ["/api/professor/scenarios"],
  });

  const deleteScenarioMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      await apiRequest("DELETE", `/api/professor/scenarios/${scenarioId}`);
    },
    onSuccess: () => {
      toast({ title: "Escenario eliminado", description: "El escenario y todas las sesiones han sido removidos." });
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios"] });
      setDeleteScenarioId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <p>Error al cargar escenarios. Por favor intenta de nuevo.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalEnrollments = scenarios?.reduce((sum, s) => sum + s.enrollmentCount, 0) || 0;
  const totalActive = scenarios?.reduce((sum, s) => sum + s.activeCount, 0) || 0;
  const totalCompleted = scenarios?.reduce((sum, s) => sum + s.completedCount, 0) || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Panel del Profesor</h1>
          <p className="text-muted-foreground">Gestiona tus simulaciones y visualiza el progreso de estudiantes</p>
        </div>
        <Link href="/studio">
          <Button data-testid="button-go-to-studio">
            <BookOpen className="w-4 h-4 mr-2" />
            Estudio de Autoría
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-scenarios">{scenarios?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Escenarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-enrollments">{totalEnrollments}</p>
                <p className="text-sm text-muted-foreground">Total Estudiantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-sessions">{totalActive}</p>
                <p className="text-sm text-muted-foreground">En Progreso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-completed-sessions">{totalCompleted}</p>
                <p className="text-sm text-muted-foreground">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenarios List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tus Escenarios</h2>
        
        {!scenarios || scenarios.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Aún no has creado ningún escenario.</p>
              <Link href="/studio">
                <Button>Crear Tu Primer Escenario</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((scenario) => (
              <Card 
                key={scenario.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedScenarioId(scenario.id)}
                data-testid={`card-scenario-${scenario.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{scenario.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {scenario.description || "Sin descripción"}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" data-testid={`button-scenario-menu-${scenario.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScenarioId(scenario.id);
                        }}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Sesiones
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteScenarioId(scenario.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar Escenario
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant="secondary">{scenario.domain}</Badge>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{scenario.enrollmentCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{scenario.activeCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{scenario.completedCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-4">
                    <Button variant="ghost" size="sm" className="text-primary">
                      Ver Detalles
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteScenarioId} onOpenChange={() => setDeleteScenarioId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the scenario and all student sessions associated with it. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteScenarioId && deleteScenarioMutation.mutate(deleteScenarioId)}
              disabled={deleteScenarioMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteScenarioMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session Management Panel */}
      {selectedScenarioId && (
        <SessionManagementPanel 
          scenarioId={selectedScenarioId} 
          onClose={() => setSelectedScenarioId(null)} 
        />
      )}
    </div>
  );
}

// Session Management Panel Component
function SessionManagementPanel({ scenarioId, onClose }: { scenarioId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  interface SessionWithUserInfo {
    id: string;
    userId: string;
    scenarioId: string;
    status: "active" | "completed" | "abandoned";
    currentState: {
      kpis: { revenue: number; morale: number; reputation: number; efficiency: number; trust: number };
      turnCount: number;
    };
    user?: { id: string; firstName?: string; lastName?: string; email?: string };
    turnCount: number;
    createdAt: string;
    updatedAt: string;
  }

  const { data: sessions, isLoading } = useQuery<SessionWithUserInfo[]>({
    queryKey: ["/api/professor/scenarios", scenarioId, "sessions"],
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest("DELETE", `/api/professor/sessions/${sessionId}`);
    },
    onSuccess: () => {
      toast({ title: "Sesión eliminada", description: "El estudiante ha sido removido de esta simulación." });
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios", scenarioId, "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios"] });
      setDeleteSessionId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: string }) => {
      await apiRequest("PATCH", `/api/professor/sessions/${sessionId}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios", scenarioId, "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Active</Badge>;
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">Completed</Badge>;
      case "abandoned":
        return <Badge variant="secondary">Unenrolled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="font-semibold">Student Sessions</h2>
              <p className="text-sm text-muted-foreground">
                {sessions?.length || 0} student{sessions?.length !== 1 ? "s" : ""} enrolled
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No students have started this simulation yet.</p>
              </CardContent>
            </Card>
          ) : (
            sessions.map((session) => (
              <Card key={session.id} data-testid={`card-session-${session.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">
                          {session.user?.firstName && session.user?.lastName 
                            ? `${session.user.firstName} ${session.user.lastName}`
                            : session.user?.email || "Unknown User"}
                        </p>
                        {getStatusBadge(session.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{session.user?.email}</p>
                      
                      {/* Progress & KPIs */}
                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Turns</p>
                          <p className="font-medium">{session.turnCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Morale</p>
                          <p className="font-medium">{session.currentState?.kpis?.morale || 0}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Reputation</p>
                          <p className="font-medium">{session.currentState?.kpis?.reputation || 0}%</p>
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-session-menu-${session.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingSessionId(session.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Conversation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {session.status === "active" && (
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate({ sessionId: session.id, status: "abandoned" })}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Unenroll Student
                          </DropdownMenuItem>
                        )}
                        {session.status === "abandoned" && (
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate({ sessionId: session.id, status: "active" })}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Re-enroll Student
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteSessionId(session.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Session
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Delete Session Confirmation */}
        <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Student Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this student's simulation data and conversation history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteSessionId && deleteSessionMutation.mutate(deleteSessionId)}
                disabled={deleteSessionMutation.isPending}
              >
                {deleteSessionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Conversation Viewer */}
        {viewingSessionId && (
          <ConversationViewer 
            sessionId={viewingSessionId} 
            onClose={() => setViewingSessionId(null)} 
          />
        )}
      </div>
    </div>
  );
}

// Conversation Viewer Component
function ConversationViewer({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  interface Turn {
    id: string;
    turnNumber: number;
    studentInput: string;
    agentResponse: {
      narrative: { text: string; mood?: string; speaker?: string };
      feedback: { message: string; score: number };
      kpiUpdates: Record<string, number>;
    };
    createdAt: string;
  }

  interface ConversationData {
    session: {
      id: string;
      user?: { firstName?: string; lastName?: string; email?: string };
      currentState: {
        history: { role: string; content: string; speaker?: string }[];
        kpis: Record<string, number>;
      };
    };
    turns: Turn[];
  }

  const { data, isLoading } = useQuery<ConversationData>({
    queryKey: ["/api/professor/sessions", sessionId, "conversation"],
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]">
      <div className="fixed inset-4 md:inset-10 bg-background rounded-lg border shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b p-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Historial de Conversación</h2>
            <p className="text-sm text-muted-foreground">
              {data?.session?.user?.firstName && data?.session?.user?.lastName 
                ? `${data.session.user.firstName} ${data.session.user.lastName}`
                : data?.session?.user?.email || "Estudiante"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-conversation">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <>
              {/* Show initial history */}
              {data?.session?.currentState?.history?.map((entry, idx) => (
                <div 
                  key={`history-${idx}`}
                  className={`p-4 rounded-lg ${
                    entry.role === "user" 
                      ? "bg-primary/10 ml-12" 
                      : entry.role === "npc"
                      ? "bg-muted mr-12"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {entry.role === "user" ? "Estudiante" : entry.role === "npc" ? entry.speaker || "NPC" : "Sistema"}
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                </div>
              ))}

              {/* Show turns */}
              {data?.turns?.map((turn) => (
                <div key={turn.id} className="space-y-3">
                  {/* Student input */}
                  <div className="p-4 rounded-lg bg-primary/10 ml-12">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">Student (Turn {turn.turnNumber})</Badge>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{turn.studentInput}</p>
                  </div>

                  {/* AI Response */}
                  <div className="p-4 rounded-lg bg-muted mr-12">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {turn.agentResponse?.narrative?.speaker || "Narrator"}
                      </Badge>
                      {turn.agentResponse?.narrative?.mood && (
                        <Badge variant="secondary" className="text-xs">
                          {turn.agentResponse.narrative.mood}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap mb-3">
                      {turn.agentResponse?.narrative?.text}
                    </p>
                    
                    {/* Feedback */}
                    {turn.agentResponse?.feedback && (
                      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                        <p><strong>Feedback:</strong> {turn.agentResponse.feedback.message}</p>
                        <p><strong>Score:</strong> {turn.agentResponse.feedback.score}/100</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(!data?.turns || data.turns.length === 0) && (!data?.session?.currentState?.history || data.session.currentState.history.length === 0) && (
                <div className="text-center text-muted-foreground py-8">
                  No conversation history yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
