import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Edit,
  Eye,
  Play,
  Users,
  Settings,
  Copy,
  Check,
  Mail,
  Plus,
  Trash2,
  UserPlus,
  AlertTriangle,
  Clock,
  PlayCircle,
  StopCircle,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Scenario, SimulationSession, User } from "@shared/schema";

interface SessionWithUser extends SimulationSession {
  user?: User;
  turnCount?: number;
}

interface ScenarioWithEnrollments extends Scenario {
  enrolledStudents?: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    status: "enrolled" | "started" | "completed";
  }>;
}

const STANDARD_INDICATORS = [
  { id: "revenue", label: "Ingresos / Presupuesto" },
  { id: "morale", label: "Moral del Equipo" },
  { id: "reputation", label: "Reputación de Marca" },
  { id: "efficiency", label: "Eficiencia Operacional" },
  { id: "trust", label: "Confianza de Stakeholders" },
];

export default function SimulationManagement() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [emailInput, setEmailInput] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  const { data: scenario, isLoading, error } = useQuery<ScenarioWithEnrollments>({
    queryKey: ["/api/scenarios", scenarioId],
    enabled: !!scenarioId,
  });

  const { data: sessions } = useQuery<SessionWithUser[]>({
    queryKey: ["/api/professor/scenarios", scenarioId, "sessions"],
    enabled: !!scenarioId,
  });

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/scenarios/${scenarioId}/generate-code`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenarioId] });
      toast({ title: "Código generado", description: "El código de acceso ha sido generado." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo generar el código.", variant: "destructive" });
    },
  });

  const toggleStartMutation = useMutation({
    mutationFn: async (started: boolean) => {
      const response = await apiRequest("PATCH", `/api/scenarios/${scenarioId}/start`, { isStarted: started });
      return response.json();
    },
    onSuccess: (_, started) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenarioId] });
      toast({ 
        title: started ? "Simulación iniciada" : "Simulación pausada",
        description: started 
          ? "Los estudiantes ya pueden acceder a la simulación."
          : "Los estudiantes no pueden acceder hasta que la inicies.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo cambiar el estado.", variant: "destructive" });
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", `/api/scenarios/${scenarioId}/students`, { email });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenarioId] });
      setEmailInput("");
      toast({ title: "Estudiante agregado", description: "Se ha enviado un correo de invitación." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "No se pudo agregar al estudiante.", 
        variant: "destructive" 
      });
    },
  });

  const addBulkStudentsMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const response = await apiRequest("POST", `/api/scenarios/${scenarioId}/students/bulk`, { emails });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenarioId] });
      setBulkEmails("");
      toast({ 
        title: "Estudiantes agregados", 
        description: `Se han agregado ${data.added || 0} estudiantes y enviado invitaciones.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudieron agregar los estudiantes.", variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest("DELETE", `/api/professor/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios", scenarioId, "sessions"] });
      toast({ title: "Estudiante eliminado", description: "La sesión del estudiante ha sido eliminada." });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const handleCopyCode = () => {
    if (scenario?.joinCode) {
      navigator.clipboard.writeText(scenario.joinCode);
      setJoinCodeCopied(true);
      setTimeout(() => setJoinCodeCopied(false), 2000);
    }
  };

  const handleAddStudent = () => {
    if (emailInput.trim()) {
      addStudentMutation.mutate(emailInput.trim());
    }
  };

  const handleAddBulkStudents = () => {
    const emails = bulkEmails
      .split(/[\n,;]/)
      .map(e => e.trim())
      .filter(e => e && e.includes("@"));
    if (emails.length > 0) {
      addBulkStudentsMutation.mutate(emails);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-[1000]">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <Skeleton className="h-64" />
        </main>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-[1000]">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/professor")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold">Error</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <p>No se encontró la simulación o no tienes acceso.</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const enrolledCount = scenario.enrolledStudents?.length || sessions?.length || 0;
  const startedCount = sessions?.filter(s => s.currentState?.history?.length > 0).length || 0;
  const completedCount = sessions?.filter(s => s.status === "completed").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-[1000]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/professor")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold" data-testid="text-scenario-title">
                {scenario.title}
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant={scenario.isPublished ? "default" : "secondary"}>
                  {scenario.isPublished ? "Publicado" : "Borrador"}
                </Badge>
                {scenario.isStarted && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <PlayCircle className="w-3 h-3 mr-1" />
                    En curso
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/scenarios/${scenarioId}/analytics`)}
              data-testid="button-analytics"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analíticas
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/studio?edit=${scenarioId}`)}
              data-testid="button-edit"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Eye className="w-4 h-4 mr-2" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="students" data-testid="tab-students">
              <Users className="w-4 h-4 mr-2" />
              Estudiantes
            </TabsTrigger>
            <TabsTrigger value="test" data-testid="tab-test">
              <Play className="w-4 h-4 mr-2" />
              Probar
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              Control
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{enrolledCount}</p>
                      <p className="text-sm text-muted-foreground">Inscritos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{startedCount}</p>
                      <p className="text-sm text-muted-foreground">En progreso</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{completedCount}</p>
                      <p className="text-sm text-muted-foreground">Completados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Detalles del Escenario</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Descripción</Label>
                  <p className="mt-1">{scenario.description || "Sin descripción"}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Indicadores</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {STANDARD_INDICATORS.map(ind => (
                      <Badge key={ind.id} variant="outline">{ind.label}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Agregar Estudiantes
                  </CardTitle>
                  <CardDescription>
                    Agrega estudiantes por correo electrónico o genera un código de acceso
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Agregar por correo individual</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="estudiante@universidad.edu"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddStudent()}
                        data-testid="input-student-email"
                      />
                      <Button 
                        onClick={handleAddStudent}
                        disabled={!emailInput.trim() || addStudentMutation.isPending}
                        data-testid="button-add-student"
                      >
                        {addStudentMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Enviar Invitación
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Agregar varios estudiantes</Label>
                    <Textarea
                      placeholder="Pega múltiples correos separados por comas, líneas o punto y coma..."
                      value={bulkEmails}
                      onChange={(e) => setBulkEmails(e.target.value)}
                      rows={4}
                      data-testid="input-bulk-emails"
                    />
                    <Button 
                      onClick={handleAddBulkStudents}
                      disabled={!bulkEmails.trim() || addBulkStudentsMutation.isPending}
                      variant="outline"
                      className="w-full"
                      data-testid="button-add-bulk"
                    >
                      {addBulkStudentsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Agregar Todos
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Código de Acceso (estilo Kahoot)</Label>
                    <p className="text-sm text-muted-foreground">
                      Los estudiantes pueden unirse ingresando este código en su panel
                    </p>
                    {scenario.joinCode ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 p-4 bg-muted rounded-lg text-center">
                          <span className="text-2xl font-mono font-bold tracking-widest" data-testid="text-join-code">
                            {scenario.joinCode}
                          </span>
                        </div>
                        <Button variant="outline" size="icon" onClick={handleCopyCode}>
                          {joinCodeCopied ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => generateCodeMutation.mutate()}
                        disabled={generateCodeMutation.isPending}
                        variant="outline"
                        data-testid="button-generate-code"
                      >
                        {generateCodeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Generar Código de Acceso
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Estudiantes Inscritos ({enrolledCount})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sessions && sessions.length > 0 ? (
                    <div className="space-y-2">
                      {sessions.map((session) => {
                        const studentName = [session.user?.firstName, session.user?.lastName].filter(Boolean).join(" ");
                        const displayName = studentName || session.user?.email || session.userId;
                        return (
                          <div 
                            key={session.id} 
                            className="flex items-center justify-between p-3 rounded-lg border"
                            data-testid={`student-row-${session.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Users className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium text-sm" data-testid={`text-student-name-${session.id}`}>
                                  {displayName}
                                </p>
                                {studentName && session.user?.email && (
                                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                session.status === "completed" ? "default" :
                                session.status === "active" ? "secondary" : "outline"
                              }>
                                {session.status === "completed" ? "Completado" :
                                 session.status === "active" ? "En progreso" : "Inscrito"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("¿Eliminar este estudiante de la simulación?")) {
                                    deleteSessionMutation.mutate(session.id);
                                  }
                                }}
                                disabled={deleteSessionMutation.isPending}
                                data-testid={`button-delete-student-${session.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aún no hay estudiantes inscritos</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="test">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Probar Simulación
                </CardTitle>
                <CardDescription>
                  Experimenta la simulación como lo haría un estudiante. No se guardan datos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Modo de Prueba</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Esta es una vista previa. Las decisiones que tomes no afectarán a los estudiantes ni se guardarán.
                      </p>
                    </div>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => navigate(`/simulation/start/${scenarioId}?test=true`)}
                  data-testid="button-start-test"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Iniciar Prueba
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Control de Simulación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {scenario.isStarted ? (
                        <PlayCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <StopCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">Estado de la Simulación</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {scenario.isStarted 
                        ? "Los estudiantes pueden acceder y participar en la simulación."
                        : "Los estudiantes ven un mensaje de espera hasta que inicies la simulación."}
                    </p>
                  </div>
                  <Switch
                    checked={scenario.isStarted || false}
                    onCheckedChange={(checked) => toggleStartMutation.mutate(checked)}
                    disabled={toggleStartMutation.isPending}
                    data-testid="switch-simulation-started"
                  />
                </div>

                {!scenario.isStarted && (
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-center text-muted-foreground">
                      Los estudiantes verán: <strong>"El profesor aún no ha iniciado la simulación"</strong>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
