import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Mail,
  Plus,
  Loader2,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/LanguageContext";
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

interface ScenarioStudentsTabProps {
  scenarioId: string;
}

export function ScenarioStudentsTab({ scenarioId }: ScenarioStudentsTabProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [emailInput, setEmailInput] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  const { data: scenario } = useQuery<ScenarioWithEnrollments>({
    queryKey: ["/api/scenarios", scenarioId],
    enabled: !!scenarioId,
  });

  const { data: sessions } = useQuery<SessionWithUser[]>({
    queryKey: ["/api/professor/scenarios", scenarioId, "sessions"],
    enabled: !!scenarioId,
  });

  const enrolledCount = scenario?.enrolledStudents?.length || sessions?.length || 0;

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
        variant: "destructive",
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
        description: t("simulationManagement.studentsAddedDesc", { count: data.added || 0 }),
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
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));
    if (emails.length > 0) {
      addBulkStudentsMutation.mutate(emails);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {t("simulationManagement.addStudents")}
          </CardTitle>
          <CardDescription>{t("simulationManagement.addStudentsDesc")}</CardDescription>
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
            <p className="text-sm text-muted-foreground">{t("simulationManagement.accessCodeDesc")}</p>
            {scenario?.joinCode ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 p-4 bg-muted rounded-md text-center">
                  <span className="text-2xl font-mono font-bold tracking-widest" data-testid="text-join-code">
                    {scenario.joinCode}
                  </span>
                </div>
                <Button variant="outline" size="icon" onClick={handleCopyCode} data-testid="button-copy-code">
                  {joinCodeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
                    className="flex items-center justify-between p-3 rounded-md border"
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
                      <Badge
                        variant={
                          session.status === "completed"
                            ? "default"
                            : session.status === "active"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {session.status === "completed"
                          ? t("simulationManagement.completed")
                          : session.status === "active"
                          ? t("simulationManagement.inProgressStatus")
                          : t("simulationManagement.enrolledStatus")}
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
  );
}
