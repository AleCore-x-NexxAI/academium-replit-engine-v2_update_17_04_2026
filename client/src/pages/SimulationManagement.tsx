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
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
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

export default function SimulationManagement() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [emailInput, setEmailInput] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  const STANDARD_INDICATORS = [
    { id: "revenue", label: t("simulationManagement.revenueBudget") },
    { id: "morale", label: t("simulationManagement.teamMorale") },
    { id: "reputation", label: t("simulationManagement.brandReputation") },
    { id: "efficiency", label: t("simulationManagement.operationalEfficiency") },
    { id: "trust", label: t("simulationManagement.stakeholderTrust") },
  ];

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
      toast({ title: t("simulationManagement.codeGenerated"), description: t("simulationManagement.codeGeneratedDesc") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("simulationManagement.couldNotGenerateCode"), variant: "destructive" });
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
        title: started ? t("simulationManagement.simulationStarted") : t("simulationManagement.simulationPaused"),
        description: started 
          ? t("simulationManagement.studentsCanAccess")
          : t("simulationManagement.studentsCannotAccess"),
      });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("simulationManagement.couldNotChangeStatus"), variant: "destructive" });
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
      toast({ title: t("simulationManagement.studentAdded"), description: t("simulationManagement.invitationSent") });
    },
    onError: (error: any) => {
      toast({ 
        title: t("common.error"), 
        description: error.message || t("simulationManagement.couldNotAddStudent"), 
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
        title: t("simulationManagement.studentsAdded"), 
        description: t("simulationManagement.studentsAddedDesc", { count: data.added || 0 })
      });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("simulationManagement.couldNotAddStudents"), variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest("DELETE", `/api/professor/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professor/scenarios", scenarioId, "sessions"] });
      toast({ title: t("simulationManagement.studentRemoved"), description: t("simulationManagement.studentRemovedDesc") });
    },
    onError: (error: Error) => {
      toast({ title: t("simulationManagement.errorDeleting"), description: error.message, variant: "destructive" });
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
            <span className="font-semibold">{t("common.error")}</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <p>{t("simulationManagement.notFound")}</p>
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
                  {scenario.isPublished ? t("simulationManagement.published") : t("simulationManagement.draft")}
                </Badge>
                {scenario.isStarted && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <PlayCircle className="w-3 h-3 mr-1" />
                    {t("simulationManagement.inProgress")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/scenarios/${scenarioId}/analytics`)}
              data-testid="button-analytics"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {t("simulationManagement.analytics")}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/studio?edit=${scenarioId}`)}
              data-testid="button-edit"
            >
              <Edit className="w-4 h-4 mr-2" />
              {t("simulationManagement.edit")}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Eye className="w-4 h-4 mr-2" />
              {t("simulationManagement.summary")}
            </TabsTrigger>
            <TabsTrigger value="students" data-testid="tab-students">
              <Users className="w-4 h-4 mr-2" />
              {t("simulationManagement.students")}
            </TabsTrigger>
            <TabsTrigger value="test" data-testid="tab-test">
              <Play className="w-4 h-4 mr-2" />
              {t("simulationManagement.test")}
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              {t("simulationManagement.control")}
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
                      <p className="text-sm text-muted-foreground">{t("simulationManagement.enrolled")}</p>
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
                      <p className="text-sm text-muted-foreground">{t("simulationManagement.inProgressCount")}</p>
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
                      <p className="text-sm text-muted-foreground">{t("simulationManagement.completedCount")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{t("simulationManagement.scenarioDetails")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">{t("simulationManagement.description")}</Label>
                  <p className="mt-1">{scenario.description || t("simulationManagement.noDescription")}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">{t("simulationManagement.indicatorsLabel")}</Label>
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
                    {t("simulationManagement.addStudents")}
                  </CardTitle>
                  <CardDescription>
                    {t("simulationManagement.addStudentsDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>{t("simulationManagement.addByEmail")}</Label>
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
                            {t("simulationManagement.sendInvitation")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>{t("simulationManagement.addMultipleStudents")}</Label>
                    <Textarea
                      placeholder={t("simulationManagement.bulkEmailPlaceholder")}
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
                      {t("simulationManagement.addAll")}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>{t("simulationManagement.accessCode")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("simulationManagement.accessCodeDesc")}
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
                        {t("simulationManagement.generateCode")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {t("simulationManagement.enrolledStudents")} ({enrolledCount})
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
                                {session.status === "completed" ? t("simulationManagement.completed") :
                                 session.status === "active" ? t("simulationManagement.inProgressStatus") : t("simulationManagement.enrolledStatus")}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm(t("simulationManagement.deleteStudentConfirm"))) {
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
                      <p>{t("simulationManagement.noStudents")}</p>
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
                  {t("simulationManagement.testSimulation")}
                </CardTitle>
                <CardDescription>
                  {t("simulationManagement.testSimulationDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">{t("simulationManagement.testMode")}</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {t("simulationManagement.testModeDesc")}
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
                  {t("simulationManagement.startTest")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t("simulationManagement.simulationControl")}
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
                      <span className="font-medium">{t("simulationManagement.simulationStatus")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {scenario.isStarted 
                        ? t("simulationManagement.simulationActiveDesc")
                        : t("simulationManagement.simulationInactiveDesc")}
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
                      {t("simulationManagement.studentsWillSee")} <strong>"{t("simulationManagement.professorNotStarted")}"</strong>
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
