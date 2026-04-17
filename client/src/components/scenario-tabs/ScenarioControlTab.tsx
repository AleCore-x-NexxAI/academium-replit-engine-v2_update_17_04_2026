import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, PlayCircle, StopCircle, Play, AlertTriangle, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import type { Scenario } from "@shared/schema";

interface ScenarioControlTabProps {
  scenarioId: string;
  showTestSection?: boolean;
  showBackfillSection?: boolean;
}

export function ScenarioControlTab({
  scenarioId,
  showTestSection = true,
  showBackfillSection = true,
}: ScenarioControlTabProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const { data: scenario } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", scenarioId],
    enabled: !!scenarioId,
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

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/scenarios/${scenarioId}/backfill-analysis`);
      return response.json();
    },
    onSuccess: (data: any) => {
      const segments = ["class-stats", "module-health", "depth-trajectory", "class-patterns", "students-summary"];
      for (const seg of segments) {
        queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenarioId, seg] });
      }
      toast({
        title: t("simulationManagement.backfillComplete"),
        description: t("simulationManagement.backfillSummary", {
          processed: data.processedSessions,
          total: data.totalCompleted,
          turns: data.processedTurns,
          skipped: data.skipped,
          errors: data.errors,
        }),
      });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  if (!scenario) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t("simulationManagement.simulationControl")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-md border gap-4">
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
            <div className="p-4 rounded-md bg-muted">
              <p className="text-sm text-center text-muted-foreground">
                {t("simulationManagement.studentsWillSee")}{" "}
                <strong>"{t("simulationManagement.professorNotStarted")}"</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {showTestSection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              {t("simulationManagement.testSimulation")}
            </CardTitle>
            <CardDescription>{t("simulationManagement.testSimulationDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-md bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {t("simulationManagement.testMode")}
                  </p>
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
      )}

      {showBackfillSection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              {t("simulationManagement.analysisBackfill")}
            </CardTitle>
            <CardDescription>
              {t("simulationManagement.analysisBackfillDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
              data-testid="button-backfill-analysis"
            >
              {backfillMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              {t("simulationManagement.runAnalysisBackfill")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
