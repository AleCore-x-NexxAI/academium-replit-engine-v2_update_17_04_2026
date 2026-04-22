import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  TrendingDown,
  BookOpen,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Settings,
  X,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { ScenarioStudentsTab } from "@/components/scenario-tabs/ScenarioStudentsTab";
import { ScenarioControlTab } from "@/components/scenario-tabs/ScenarioControlTab";
import type { Scenario } from "@shared/schema";

interface ClassStats {
  completed: number;
  inProgress: number;
  biggestDropPoint: { turn: number; delta: number } | null;
  appliedCourseTheory: { n: number; m: number } | null;
}

interface FrameworkHealth {
  id: string;
  name: string;
  status: string;
  description: string;
  deeperDescription: string;
  canonicalId?: string;
  detection_method_distribution?: Record<string, number>;
  rate?: number;
  weightedScore?: number;
  appliedCount_weighted_sum?: number;
  completed?: number;
}

interface FrameworkSection {
  frameworks: FrameworkHealth[];
  detection_method_distribution?: Record<string, number>;
}

interface ModuleHealth {
  frameworks: FrameworkHealth[];
  target?: FrameworkHealth[];
  suggested?: FrameworkHealth[];
  targetSection?: FrameworkSection;
  suggestedSection?: FrameworkSection;
  classDebriefOpener: string | null;
}

interface DepthPoint {
  turn: number;
  avg: number;
  color: string;
}

interface DepthAnnotation {
  turn: number;
  label: string;
  description: string;
}

interface DepthTrajectory {
  points: DepthPoint[];
  annotations: DepthAnnotation[];
}

interface ClassPattern {
  id: string;
  name: string;
  rate: number;
  status: string;
  description: string;
}

interface ClassPatterns {
  patterns: ClassPattern[];
}

interface ArcPoint {
  turn: number;
  band: string;
  color: string;
}

interface StudentSummaryEntry {
  sessionId: string;
  name: string;
  email: string;
  status: string;
  arc: ArcPoint[];
  arcLabel: string;
  keyPattern: string;
  canView: boolean;
}

interface StudentsSummary {
  students: StudentSummaryEntry[];
}

interface SessionSummaryData {
  studentName: string;
  scenarioTitle: string;
  status: string;
  isComplete: boolean;
  completedAt: string | null;
  dashboardSummary: { session_headline?: string } | null;
  arc: ArcPoint[];
}

interface ChatTurn {
  number: number;
  type: string;
  prompt: string;
  studentInput: string;
}

interface KpiMovement {
  kpiId: string;
  label: string;
  direction: string;
  tier: string;
  reasoningLink: string;
}

interface DebriefTurn {
  number: number;
  type: string;
  depth: string;
  studentInput: string;
  kpiMovements: KpiMovement[];
  debriefQuestion: string;
}

interface SignalEntry {
  key: string;
  quality: number;
  extracted_text: string;
  sessionLanguage: "es" | "en";
}

interface SignalTurn {
  number: number;
  signals: SignalEntry[];
}

interface ReasoningSignalsData {
  signalAverages: Record<string, number>;
  sessionLanguage: "es" | "en";
  turns: SignalTurn[];
}

interface FrameworkApplication {
  frameworkId: string;
  name: string;
  level: string;
  evidence: string;
}

interface KpiTurn {
  number: number;
  type: string;
  depth: string;
  kpiMovements: KpiMovement[];
  frameworkApplications: FrameworkApplication[];
}

interface KpiFrameworksData {
  turns: KpiTurn[];
  activeKpis: string[];
}

const DEPTH_COLORS: Record<string, string> = {
  integrated: "#1D9E75",
  engaged: "#378ADD",
  surface: "#BA7517",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  transferring: { bg: "bg-[#EAF3DE]", text: "text-[#27500A]", border: "border-[#C0DD97]" },
  developing: { bg: "bg-[#E6F1FB]", text: "text-[#0C447C]", border: "border-[#A3CCF0]" },
  not_yet_evidenced: { bg: "bg-[#FAEEDA]", text: "text-[#633806]", border: "border-[#E8C888]" },
  absent: { bg: "bg-[#FCEBEB]", text: "text-[#791F1F]", border: "border-[#F7C1C1]" },
};

function smartTruncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const window = text.substring(0, limit + 20);
  const sentenceMatch = window.match(/^[\s\S]*?[.!?¿¡](?:\s|$)/);
  if (sentenceMatch && sentenceMatch[0].length <= limit + 20 && sentenceMatch[0].length >= limit / 2) {
    return sentenceMatch[0].trim();
  }
  return text.substring(0, limit) + "...";
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.absent;
  const label = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`} data-testid={`badge-status-${status}`}>
      {label}
    </span>
  );
}

function DistributionStrip({
  dist,
  testid,
  className = "",
}: {
  dist?: Record<string, number>;
  testid?: string;
  className?: string;
}) {
  if (!dist) return null;
  const entries = Object.entries(dist).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0) return null;
  const labelOf = (k: string) => {
    switch (k) {
      case "keyword": return "kw";
      case "semantic": return "sem";
      case "signal_pattern": return "sig";
      case "consistency_promoted": return "cons";
      case "none": return "none";
      default: return k;
    }
  };
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground ${className}`}
      data-testid={testid}
    >
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-0.5" data-testid={`${testid}-${k}`}>
          <span className="font-medium">{labelOf(k)}</span>
          <span>{v}</span>
        </span>
      ))}
    </div>
  );
}

function DetectionBreakdownRow({ fw }: { fw: FrameworkHealth }) {
  const { t } = useTranslation();
  const dist = fw.detection_method_distribution;
  if (!dist) return null;
  const sem = dist.semantic || 0;
  const kw = dist.keyword || 0;
  const sig = dist.signal_pattern || 0;
  const cons = dist.consistency_promoted || 0;
  return (
    <div className="text-[10px] text-muted-foreground/70 mt-1.5" data-testid={`breakdown-${fw.id}`}>
      <span>{t("scenarioDashboard.detectionBreakdown")} </span>
      <span>{sem} {t("scenarioDashboard.detectionSemantic")}</span>
      <span> · {kw} {t("scenarioDashboard.detectionKeyword")}</span>
      <span> · {sig} {t("scenarioDashboard.detectionSignal")}</span>
      <span> · {cons} {t("scenarioDashboard.detectionConsistency")}</span>
    </div>
  );
}

function DepthDot({ band, size = 10 }: { band: string; size?: number }) {
  const color = DEPTH_COLORS[band] || "#ddd";
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function ReasoningArc({ arc, label }: { arc: { turn: number; band: string; color: string }[]; label?: string }) {
  if (!arc || arc.length === 0) return <span className="text-[11px] text-muted-foreground italic">--</span>;
  return (
    <div>
      <div className="flex items-center gap-1">
        {arc.map((a, i) => (
          <span key={i} className="flex items-center gap-1">
            <DepthDot band={a.band} />
            {i < arc.length - 1 && <span className="text-[10px] text-muted-foreground">→</span>}
          </span>
        ))}
      </div>
      {label && <div className="text-[10px] text-muted-foreground mt-0.5 italic">{label}</div>}
    </div>
  );
}

export default function ScenarioDashboard() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const isEn = language === "en";

  const [activeTab, setActiveTab] = useState<"analytics" | "students" | "control">("analytics");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: scenario, isLoading: scenarioLoading } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", scenarioId],
  });

  const { data: classStats, isLoading: statsLoading } = useQuery<ClassStats>({
    queryKey: ["/api/scenarios", scenarioId, "class-stats"],
    queryFn: () => apiRequest("POST", `/api/scenarios/${scenarioId}/class-stats`).then(r => r.json()),
    enabled: activeTab === "analytics" && !!scenarioId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: moduleHealth, isLoading: mhLoading } = useQuery<ModuleHealth>({
    queryKey: ["/api/scenarios", scenarioId, "module-health"],
    queryFn: () => apiRequest("POST", `/api/scenarios/${scenarioId}/module-health`).then(r => r.json()),
    enabled: activeTab === "analytics" && !!scenarioId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: depthTrajectory, isLoading: dtLoading } = useQuery<DepthTrajectory>({
    queryKey: ["/api/scenarios", scenarioId, "depth-trajectory"],
    queryFn: () => apiRequest("POST", `/api/scenarios/${scenarioId}/depth-trajectory`).then(r => r.json()),
    enabled: activeTab === "analytics" && !!scenarioId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: classPatterns, isLoading: cpLoading } = useQuery<ClassPatterns>({
    queryKey: ["/api/scenarios", scenarioId, "class-patterns"],
    queryFn: () => apiRequest("POST", `/api/scenarios/${scenarioId}/class-patterns`).then(r => r.json()),
    enabled: activeTab === "analytics" && !!scenarioId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: studentsSummary, isLoading: ssLoading } = useQuery<StudentsSummary>({
    queryKey: ["/api/scenarios", scenarioId, "students-summary"],
    enabled: activeTab === "analytics" && !!scenarioId,
    staleTime: 5 * 60 * 1000,
  });

  const scenarioTitle = scenario?.title || "...";
  const enrolledCount = studentsSummary?.students?.length || 0;

  const tabs = [
    { key: "analytics" as const, label: t("simulationManagement.analytics"), icon: BarChart3 },
    { key: "students" as const, label: t("simulationManagement.students"), icon: Users },
    { key: "control" as const, label: t("simulationManagement.control"), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-5 py-3 border-b bg-card" data-testid="dashboard-nav">
        <div className="flex items-center gap-3">
          <Link href="/professor" data-testid="link-back-professor">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="text-[15px] font-medium text-muted-foreground italic" data-testid="text-scenario-title">{scenarioTitle}</div>
            {/* Phase 3: surface the professor's pedagogical intent here. */}
            {scenario?.pedagogicalIntent?.teachingGoal && (
              <div className="text-[12px] text-muted-foreground mt-0.5 max-w-xl truncate" data-testid="text-teaching-goal">
                <span className="font-medium">{t("simulationManagement.teachingGoal") || "Goal"}:</span>{" "}
                {scenario.pedagogicalIntent.teachingGoal}
              </div>
            )}
            {scenario?.pedagogicalIntent?.targetFrameworks && scenario.pedagogicalIntent.targetFrameworks.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1" data-testid="badges-target-frameworks">
                {scenario.pedagogicalIntent.targetFrameworks.map((fw, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px]" data-testid={`badge-target-fw-${idx}`}>
                    {fw.name}
                  </Badge>
                ))}
              </div>
            )}
            <div className="text-[12px] text-muted-foreground/70 mt-0.5" data-testid="text-scenario-meta">
              {enrolledCount} {t("professorDashboard.studentsEnrolled")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] border transition-colors ${
                activeTab === tab.key
                  ? "bg-muted border-border font-medium text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-3">
            <LanguageToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-5 py-5">
        {activeTab === "analytics" && (
          <AnalyticsTab
            classStats={classStats}
            statsLoading={statsLoading}
            moduleHealth={moduleHealth}
            mhLoading={mhLoading}
            depthTrajectory={depthTrajectory}
            dtLoading={dtLoading}
            classPatterns={classPatterns}
            cpLoading={cpLoading}
            studentsSummary={studentsSummary}
            ssLoading={ssLoading}
            isEn={isEn}
            onViewSession={setSelectedSessionId}
          />
        )}
        {activeTab === "students" && scenarioId && (
          <ScenarioStudentsTab scenarioId={scenarioId} />
        )}
        {activeTab === "control" && scenarioId && (
          <ScenarioControlTab scenarioId={scenarioId} />
        )}
      </div>

      {selectedSessionId && (
        <StudentSessionModal
          sessionId={selectedSessionId}
          isEn={isEn}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}

interface AnalyticsTabProps {
  classStats: ClassStats | undefined;
  statsLoading: boolean;
  moduleHealth: ModuleHealth | undefined;
  mhLoading: boolean;
  depthTrajectory: DepthTrajectory | undefined;
  dtLoading: boolean;
  classPatterns: ClassPatterns | undefined;
  cpLoading: boolean;
  studentsSummary: StudentsSummary | undefined;
  ssLoading: boolean;
  isEn: boolean;
  onViewSession: (sessionId: string) => void;
}

function AnalyticsTab({
  classStats,
  statsLoading,
  moduleHealth,
  mhLoading,
  depthTrajectory,
  dtLoading,
  classPatterns,
  cpLoading,
  studentsSummary,
  ssLoading,
  isEn,
  onViewSession,
}: AnalyticsTabProps) {
  const { t } = useTranslation();
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2.5" data-testid="stats-row">
        <StatCard
          value={statsLoading ? "..." : classStats?.completed ?? "—"}
          label={t("scenarioDashboard.completed")}
          description={t("scenarioDashboard.studentsWhoFinishedAllTurns")}
          loading={statsLoading}
        />
        <StatCard
          value={statsLoading ? "..." : classStats?.inProgress ?? "—"}
          label={t("scenarioDashboard.inProgress")}
          description={t("scenarioDashboard.studentsWhoStartedButHave")}
          loading={statsLoading}
        />
        <StatCard
          value={statsLoading ? "..." : classStats?.biggestDropPoint ? `T${classStats.biggestDropPoint.turn}` : "—"}
          label={t("scenarioDashboard.biggestDropPoint")}
          description={t("scenarioDashboard.turnWhereAverageReasoningDepth")}
          loading={statsLoading}
        />
        <StatCard
          value={statsLoading ? "..." : classStats?.appliedCourseTheory ? `${classStats.appliedCourseTheory.n}/${classStats.appliedCourseTheory.m}` : "—"}
          label={t("scenarioDashboard.appliedCourseTheory")}
          description={t("scenarioDashboard.studentsShowingEvidenceOfApplying")}
          loading={statsLoading}
        />
      </div>

      <Card className="p-5" data-testid="module-health-card">
        <div className="text-[13px] font-medium mb-0.5">{t("scenarioDashboard.moduleHealth")}</div>
        <div className="text-[11px] text-muted-foreground mb-3.5 leading-relaxed italic">
          {t("scenarioDashboard.moduleHealthExplainer")}
        </div>

        {mhLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : (moduleHealth?.frameworks?.length ?? 0) > 0 ? (
          <>
            {((moduleHealth!.target?.length ?? 0) + (moduleHealth!.suggested?.length ?? 0)) > 0 ? (
              <div className="space-y-3 mb-4" data-testid="framework-grid">
                {(moduleHealth!.target?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide" data-testid="label-target-frameworks">
                        {t("scenarioDashboard.targetFrameworks")}
                      </div>
                      <DistributionStrip
                        dist={moduleHealth!.targetSection?.detection_method_distribution}
                        testid="dist-target-section"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {moduleHealth!.target!.map((fw) => (
                        <div key={fw.id} className="p-3 rounded-lg border border-dashed border-border bg-muted/30" data-testid={`framework-${fw.id}`}>
                          <div className="text-[11px] font-medium text-muted-foreground mb-1.5">{fw.name}</div>
                          <StatusBadge status={fw.status} />
                          <div className="text-[11px] text-muted-foreground/80 mt-1.5 leading-snug italic">{fw.description}</div>
                          <DetectionBreakdownRow fw={fw} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(moduleHealth!.suggested?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide" data-testid="label-suggested-frameworks">
                        {t("scenarioDashboard.suggestedFrameworks")}
                      </div>
                      <DistributionStrip
                        dist={moduleHealth!.suggestedSection?.detection_method_distribution}
                        testid="dist-suggested-section"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {moduleHealth!.suggested!.map((fw) => (
                        <div key={fw.id} className="p-3 rounded-lg border border-dashed border-border bg-muted/30" data-testid={`framework-${fw.id}`}>
                          <div className="text-[11px] font-medium text-muted-foreground mb-1.5">{fw.name}</div>
                          <StatusBadge status={fw.status} />
                          <div className="text-[11px] text-muted-foreground/80 mt-1.5 leading-snug italic">{fw.description}</div>
                          <DetectionBreakdownRow fw={fw} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 mb-4" data-testid="framework-grid">
                {moduleHealth!.frameworks!.map((fw) => (
                  <div key={fw.id} className="p-3 rounded-lg border border-dashed border-border bg-muted/30" data-testid={`framework-${fw.id}`}>
                    <div className="text-[11px] font-medium text-muted-foreground mb-1.5">{fw.name}</div>
                    <StatusBadge status={fw.status} />
                    <div className="text-[11px] text-muted-foreground/80 mt-1.5 leading-snug italic">{fw.description}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="h-px bg-border my-3.5" />
            <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-border">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("scenarioDashboard.classDebriefOpener")}</div>
              <div className="text-[12px] text-muted-foreground/80 leading-relaxed italic" data-testid="text-debrief-opener">{moduleHealth!.classDebriefOpener}</div>
            </div>
            <button
              className="text-[12px] text-muted-foreground underline underline-offset-2 mt-2.5 block bg-transparent border-none p-0 cursor-pointer"
              onClick={() => setShowFullBreakdown(!showFullBreakdown)}
              data-testid="button-toggle-breakdown"
            >
              {showFullBreakdown
                ? (t("scenarioDashboard.hideFullFrameworkBreakdown"))
                : (t("scenarioDashboard.showFullFrameworkBreakdown"))}
              {showFullBreakdown ? " ↑" : " ↓"}
            </button>
            {showFullBreakdown && (
              <div className="grid grid-cols-3 gap-2.5 mt-3 pt-3 border-t">
                {moduleHealth!.frameworks!.map((fw) => (
                  <div key={fw.id} className="p-2.5 bg-muted/30 rounded-lg border border-dashed border-border">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{fw.name} — {t("scenarioDashboard.deeperView")}</div>
                    <div className="text-[11px] text-muted-foreground/70 leading-snug italic">{fw.deeperDescription}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-border">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("scenarioDashboard.noFrameworksConfigured")}</div>
            <div className="text-[11px] text-muted-foreground/80 italic">{t("scenarioDashboard.addFrameworksInTheScenario")}</div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3.5">
        <Card className="p-4" data-testid="depth-trajectory-card">
          <div className="text-[13px] font-medium mb-0.5">{t("scenarioDashboard.reasoningDepthAcrossTurns")}</div>
          <div className="text-[11px] text-muted-foreground mb-3 italic">
            {t("scenarioDashboard.classAverageReasoningDepthAt")}
          </div>
          {dtLoading ? (
            <Skeleton className="h-[115px] mb-2.5" />
          ) : (depthTrajectory?.points?.length ?? 0) > 0 ? (
            <>
              <div className="h-[115px] mb-2.5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={depthTrajectory!.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="turn" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `T${v}`} />
                    <YAxis domain={[0, 3]} ticks={[1, 2, 3]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => v === 1 ? t("scenarioDashboard.depthSurface") : v === 2 ? t("scenarioDashboard.depthEngaged") : t("scenarioDashboard.depthIntegrated")} width={65} />
                    <RechartsTooltip formatter={(v: number) => [v.toFixed(1), t("scenarioDashboard.avgDepth")]} />
                    <Line type="monotone" dataKey="avg" stroke="#378ADD" strokeWidth={2} dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      const colorMap: Record<string, string> = { green: "#1D9E75", blue: "#378ADD", amber: "#BA7517" };
                      const fillColor = colorMap[payload?.color] || "#378ADD";
                      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={fillColor} stroke={fillColor} />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-1.5" data-testid="depth-annotations">
                {depthTrajectory!.annotations?.map((anno) => (
                  <div key={anno.turn} className="flex-1 text-center p-2 bg-muted/30 rounded-lg border border-dashed border-border/50">
                    <div className="text-[11px] font-medium text-muted-foreground mb-0.5">{t("scenarioDashboard.turnLabel")} {anno.turn}</div>
                    <div className="text-[10px] text-muted-foreground/70 italic leading-snug">{anno.description}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[115px] flex items-center justify-center bg-muted/30 rounded-lg border border-dashed border-border">
              <span className="text-[11px] text-muted-foreground italic">{t("scenarioDashboard.noCompletedSessionsYet")}</span>
            </div>
          )}
        </Card>

        <Card className="p-4" data-testid="class-patterns-card">
          <div className="text-[13px] font-medium mb-0.5">{t("scenarioDashboard.whereTheClassIsAnd")}</div>
          <div className="text-[11px] text-muted-foreground mb-3 italic">
            {t("scenarioDashboard.mostSignificantReasoningPatternsDetected")}
          </div>
          {cpLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (classPatterns?.patterns?.length ?? 0) > 0 ? (
            <div>
              {classPatterns!.patterns!.map((p, i) => (
                <div key={p.id} className={`py-2.5 ${i < classPatterns!.patterns!.length - 1 ? "border-b" : ""}`}>
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[12px] font-medium text-muted-foreground">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="h-[5px] bg-muted rounded-full overflow-hidden mb-1 border border-dashed border-border/50">
                    <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: `${Math.round(p.rate * 100)}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground/70 italic leading-snug">{p.description}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 bg-muted/30 rounded-lg border border-dashed border-border">
              <span className="text-[11px] text-muted-foreground italic">{t("scenarioDashboard.noCompletedSessionsYet")}</span>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4" data-testid="students-table-card">
        <div className="text-[13px] font-medium mb-0.5">{t("scenarioDashboard.students")}</div>
        <div className="text-[11px] text-muted-foreground mb-3 italic">
          {t("scenarioDashboard.eachDotRepresentsOneTurn")}
        </div>
        {ssLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : studentsSummary?.students?.length ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">{t("scenarioDashboard.student")}</TableHead>
                  <TableHead className="text-[11px]">{t("scenarioDashboard.status")}</TableHead>
                  <TableHead className="text-[11px]">{t("scenarioDashboard.reasoningArc")}</TableHead>
                  <TableHead className="text-[11px]">{t("scenarioDashboard.keyPattern")}</TableHead>
                  <TableHead className="text-[11px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsSummary.students.map((s) => (
                  <TableRow key={s.sessionId} data-testid={`row-student-${s.sessionId}`}>
                    <TableCell>
                      <div className="font-medium text-[13px]">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground">{s.email}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] ${
                        s.status === "completed"
                          ? "bg-[#EAF3DE] text-[#27500A] border border-[#C0DD97]"
                          : "bg-[#E6F1FB] text-[#0C447C] border border-[#A3CCF0]"
                      }`}>
                        {s.status === "completed" ? (t("scenarioDashboard.completed2")) : (t("scenarioDashboard.inProgress"))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ReasoningArc arc={s.arc} label={s.arcLabel} />
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] text-muted-foreground italic">{s.keyPattern}</span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[12px]"
                        disabled={!s.canView}
                        style={!s.canView ? { opacity: 0.35, cursor: "default" } : {}}
                        onClick={() => s.canView && onViewSession(s.sessionId)}
                        data-testid={`button-view-session-${s.sessionId}`}
                      >
                        {t("scenarioDashboard.viewSession")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t flex-wrap">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <div className="w-[9px] h-[9px] rounded-full" style={{ background: "#1D9E75" }} />
                {t("scenarioDashboard.integratedReasoning")}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <div className="w-[9px] h-[9px] rounded-full" style={{ background: "#378ADD" }} />
                {t("scenarioDashboard.engagedReasoning")}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <div className="w-[9px] h-[9px] rounded-full" style={{ background: "#BA7517" }} />
                {t("scenarioDashboard.surfaceReasoning")}
              </div>
              <span className="text-[11px] text-muted-foreground/50 italic ml-auto">{t("scenarioDashboard.dotsRepresentTurnsLeftTo")}</span>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-[13px]">
            {t("scenarioDashboard.noStudentsHaveStartedThis")}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ value, label, description, loading }: { value: string | number; label: string; description: string; loading?: boolean }) {
  return (
    <Card className="p-3.5">
      <div className="text-[22px] font-medium text-muted-foreground mb-1" data-testid={`stat-value-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {loading ? <Skeleton className="h-7 w-12" /> : value}
      </div>
      <div className="text-[11px] font-medium text-muted-foreground mb-0.5">{label}</div>
      <div className="text-[11px] text-muted-foreground/60 italic leading-snug">{description}</div>
    </Card>
  );
}

function StudentSessionModal({ sessionId, isEn, onClose }: { sessionId: string; isEn: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [modalTab, setModalTab] = useState<"chat" | "debrief" | "signals" | "kpi">("chat");
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/sessions", sessionId, "summary"],
    enabled: !!sessionId,
  });

  const regenerateSummary = useMutation({
    mutationFn: () => apiRequest("POST", `/api/sessions/${sessionId}/regenerate-summary`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "summary"] });
      toast({
        title: t("scenarioDashboard.summaryRegenerated"),
        description: t("scenarioDashboard.theSessionSummaryHasBeen"),
      });
    },
    onError: (err: any) => {
      toast({
        title: t("scenarioDashboard.couldNotRegenerateSummary"),
        description: err?.message || (t("scenarioDashboard.tryAgainInAMoment")),
        variant: "destructive",
      });
    },
  });

  const { data: chatHistory, isLoading: chatLoading } = useQuery<{ turns: ChatTurn[] }>({
    queryKey: ["/api/sessions", sessionId, "chat-history"],
    enabled: !!sessionId && modalTab === "chat",
  });

  const { data: debriefPrep, isLoading: debriefLoading } = useQuery<{ turns: DebriefTurn[] }>({
    queryKey: ["/api/sessions", sessionId, "debrief-prep"],
    enabled: !!sessionId && modalTab === "debrief",
  });

  const { data: reasoningSignals, isLoading: signalsLoading } = useQuery<ReasoningSignalsData>({
    queryKey: ["/api/sessions", sessionId, "reasoning-signals"],
    enabled: !!sessionId && modalTab === "signals",
  });

  const { data: kpiFrameworks, isLoading: kpiLoading } = useQuery<KpiFrameworksData>({
    queryKey: ["/api/sessions", sessionId, "kpi-frameworks"],
    enabled: !!sessionId && modalTab === "kpi",
  });

  const modalTabs = [
    { key: "chat" as const, label: t("scenarioDashboard.chatHistory") },
    { key: "debrief" as const, label: t("scenarioDashboard.debriefPrep") },
    { key: "signals" as const, label: t("scenarioDashboard.reasoningSignals") },
    { key: "kpi" as const, label: t("scenarioDashboard.kpiCourseFrameworks") },
  ];

  const summaryData = summary as SessionSummaryData | undefined;
  const arc = summaryData?.arc || [];

  return (
    <div
      className="fixed inset-0 bg-black/25 z-50 flex items-start justify-center py-8 px-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="modal-overlay"
    >
      <div className="bg-card border rounded-xl w-full max-w-[700px] flex flex-col max-h-[90vh]" data-testid="modal-student-session">
        <div className="p-4 border-b shrink-0">
          <div className="flex items-start justify-between mb-2.5">
            <div>
              <div className="text-[15px] font-medium" data-testid="text-modal-student-name">
                {summaryLoading ? <Skeleton className="h-5 w-32" /> : summaryData?.studentName || "..."}
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                {summaryLoading ? <Skeleton className="h-4 w-48" /> : `${summaryData?.scenarioTitle || ""} · ${summaryData?.completedAt ? new Date(summaryData.completedAt).toLocaleDateString() : ""}`}
              </div>
            </div>
            <button className="text-[22px] text-muted-foreground bg-transparent border-none cursor-pointer p-0 leading-none" onClick={onClose} data-testid="button-close-modal">×</button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 p-2.5 bg-muted/30 rounded-lg border border-dashed border-border">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{t("scenarioDashboard.sessionSummary")}</div>
                {!summaryLoading && summaryData && summaryData.isComplete && (
                  (!summaryData.dashboardSummary?.session_headline ||
                   (summaryData.dashboardSummary as any)?.generation_status === "fallback") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => regenerateSummary.mutate()}
                      disabled={regenerateSummary.isPending}
                      data-testid="button-regenerate-summary"
                    >
                      {regenerateSummary.isPending
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />}
                      <span className="ml-1.5 text-[11px]">
                        {t("scenarioDashboard.regenerate")}
                      </span>
                    </Button>
                  )
                )}
              </div>
              <div className="text-[11px] text-muted-foreground/80 leading-relaxed italic" data-testid="text-session-summary">
                {summaryLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : summaryData?.dashboardSummary?.session_headline ? (
                  <>
                    {summaryData.dashboardSummary.session_headline}
                    {(summaryData.dashboardSummary as any)?.generation_status === "fallback" && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground/70 not-italic" data-testid="badge-summary-fallback">
                        {t("scenarioDashboard.fallback")}
                      </span>
                    )}
                  </>
                ) : summaryData?.isComplete ? (
                  t("scenarioDashboard.summaryGenerationDidNotComplete")
                ) : (
                  t("scenarioDashboard.summaryAvailableWhenSessionIs")
                )}
              </div>
            </div>
            <div className="p-2.5 bg-muted/30 rounded-lg border border-dashed border-border min-w-[130px]">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{t("scenarioDashboard.reasoningArc")}</div>
              <div className="flex items-start gap-1.5">
                {arc.map((a, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <div className="flex flex-col items-center gap-0.5">
                      <DepthDot band={a.band} />
                      <span className="text-[10px] text-muted-foreground/50">T{a.turn}</span>
                    </div>
                    {i < arc.length - 1 && <span className="text-[10px] text-muted-foreground/40 mt-1">→</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex px-4 border-b overflow-x-auto shrink-0">
          {modalTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setModalTab(tab.key)}
              className={`px-3 py-2 text-[12px] border-b-2 bg-transparent border-l-0 border-r-0 border-t-0 cursor-pointer whitespace-nowrap ${
                modalTab === tab.key
                  ? "text-foreground border-b-[#378ADD] font-medium"
                  : "text-muted-foreground border-b-transparent"
              }`}
              data-testid={`modal-tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4">
            {modalTab === "chat" && <ChatHistoryTab data={chatHistory} loading={chatLoading} isEn={isEn} />}
            {modalTab === "debrief" && <DebriefPrepTab data={debriefPrep} loading={debriefLoading} isEn={isEn} />}
            {modalTab === "signals" && <ReasoningSignalsTab data={reasoningSignals} loading={signalsLoading} isEn={isEn} />}
            {modalTab === "kpi" && <KpiFrameworksTab data={kpiFrameworks} loading={kpiLoading} isEn={isEn} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatHistoryTab({ data, loading, isEn }: { data: { turns: ChatTurn[] } | undefined; loading: boolean; isEn: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  const turns = data?.turns || [];
  return (
    <div>
      <div className="text-[12px] text-muted-foreground/70 leading-relaxed mb-4 p-2.5 bg-muted/30 rounded-lg border border-dashed border-border/50 italic">
        {t("scenarioDashboard.chatHistoryExplainer")}
      </div>
      {turns.map((turn) => (
        <div key={turn.number} className="mb-3 border border-dashed border-border rounded-xl overflow-hidden" data-testid={`turn-card-chat-${turn.number}`}>
          <div className="px-3.5 py-2.5 bg-muted/30 border-b border-dashed border-border/50 flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("scenarioDashboard.turnLabel")} {turn.number} · {turn.type === "mcq" ? "MCQ" : (t("scenarioDashboard.freeResponse"))}
            </span>
          </div>
          <div className="p-3.5">
            {turn.prompt && (
              <div className="mb-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-1">{t("scenarioDashboard.decisionPrompt")}</div>
                <div className="p-2 bg-muted/20 rounded-lg border border-dashed border-border/40 text-[11px] text-muted-foreground/80 leading-snug italic">{turn.prompt}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-1">{t("scenarioDashboard.studentResponse")}</div>
              <div className="p-2 bg-muted/20 rounded-lg border border-dashed border-border/40 text-[11px] text-muted-foreground/80 leading-snug whitespace-pre-wrap">
                {turn.studentInput}
              </div>
            </div>
          </div>
        </div>
      ))}
      {turns.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-[13px] italic">{t("scenarioDashboard.noTurnsRecorded")}</div>
      )}
    </div>
  );
}

function DebriefPrepTab({ data, loading, isEn }: { data: { turns: DebriefTurn[] } | undefined; loading: boolean; isEn: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  const turns = data?.turns || [];
  return (
    <div>
      <div className="text-[12px] text-muted-foreground/70 leading-relaxed mb-4 p-2.5 bg-muted/30 rounded-lg border border-dashed border-border/50 italic">
        {t("scenarioDashboard.debriefPrepExplainer")}
      </div>
      {turns.map((turn) => (
        <div key={turn.number} className="mb-3 border border-dashed border-border rounded-xl overflow-hidden" data-testid={`turn-card-debrief-${turn.number}`}>
          <div className="px-3.5 py-2.5 bg-muted/30 border-b border-dashed border-border/50 flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("scenarioDashboard.turnLabel")} {turn.number} · {turn.type === "mcq" ? "MCQ" : (t("scenarioDashboard.freeResponse"))}
            </span>
            {turn.depth && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded`} style={{ background: DEPTH_COLORS[turn.depth] + "20", color: DEPTH_COLORS[turn.depth] }}>
                {turn.depth.charAt(0).toUpperCase() + turn.depth.slice(1)}
              </span>
            )}
          </div>
          <div className="p-3.5">
            <div className="mb-2.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-1">{t("scenarioDashboard.studentResponse")}</div>
              <div className="p-2 bg-muted/20 rounded-lg border border-dashed border-border/40 text-[11px] text-muted-foreground/80 leading-snug">
                {turn.studentInput.length > 100 && !expanded[turn.number]
                  ? <>
                      {smartTruncate(turn.studentInput, 100)}
                      <button className="text-[10px] text-muted-foreground underline ml-1 bg-transparent border-none cursor-pointer p-0" onClick={() => setExpanded(e => ({ ...e, [turn.number]: true }))}>{t("scenarioDashboard.showFullResponse")}</button>
                    </>
                  : turn.studentInput}
              </div>
            </div>

            {turn.kpiMovements?.length > 0 && (
              <div className="mb-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-1">{t("scenarioDashboard.kpiMovements")}</div>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {turn.kpiMovements.map((kpi, i) => {
                    const isUp = kpi.direction === "up";
                    const bg = isUp ? "#EAF3DE" : "#FCEBEB";
                    const color = isUp ? "#27500A" : "#791F1F";
                    const border = isUp ? "#C0DD97" : "#F7C1C1";
                    return (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded" style={{ background: bg, color, border: `0.5px solid ${border}` }}>
                        {kpi.label} {isUp ? "↑" : "↓"} {kpi.tier}{kpi.reasoningLink ? ` · ${kpi.reasoningLink}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {turn.debriefQuestion && (
              <div className="p-3 bg-muted/30 border-l-2 border-l-[#378ADD]/30 rounded-r-lg mt-0.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("scenarioDashboard.askInDebrief")}</div>
                <div className="text-[11px] text-muted-foreground/80 leading-relaxed italic">{turn.debriefQuestion}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReasoningSignalsTab({ data, loading, isEn }: { data: ReasoningSignalsData | undefined; loading: boolean; isEn: boolean }) {
  const { t, language } = useTranslation();
  if (loading) return <div className="space-y-3"><Skeleton className="h-[230px]" /><Skeleton className="h-32" /></div>;

  const signalAverages = data?.signalAverages || {};
  const turns = data?.turns || [];

  const radarData = [
    { signal: t("scenarioDashboard.analytical"), value: signalAverages.analytical || 0, fullMark: 3 },
    { signal: t("scenarioDashboard.strategic"), value: signalAverages.strategic || 0, fullMark: 3 },
    { signal: t("scenarioDashboard.tradeoff"), value: signalAverages.tradeoff || 0, fullMark: 3 },
    { signal: t("scenarioDashboard.stakeholder"), value: signalAverages.stakeholder || 0, fullMark: 3 },
    { signal: t("scenarioDashboard.ethical"), value: signalAverages.ethical || 0, fullMark: 3 },
  ];

  function getSignalName(key: string): string {
    const k = `scenarioDashboard.signalName_${key}` as Parameters<typeof t>[0];
    const result = t(k);
    return result !== k ? result : key;
  }

  function getSignalLevel(quality: number): string {
    if (quality >= 2) return t("scenarioDashboard.levelDemonstrated");
    if (quality >= 1) return t("scenarioDashboard.levelEmerging");
    return t("scenarioDashboard.levelNotEvidenced");
  }

  return (
    <div>
      <div className="text-[12px] text-muted-foreground/70 leading-relaxed mb-4 p-2.5 bg-muted/30 rounded-lg border border-dashed border-border/50 italic">
        {t("scenarioDashboard.radarChartExplainer")}
      </div>

      <div className="text-[12px] font-medium text-muted-foreground mb-2 mt-4 pt-4 border-t">{t("scenarioDashboard.signalStrengthSessionOverview")}</div>
      <div className="h-[230px] bg-muted/30 rounded-lg border border-dashed border-border mb-3" data-testid="radar-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="rgba(0,0,0,0.08)" />
            <PolarAngleAxis dataKey="signal" tick={{ fontSize: 10 }} />
            <PolarRadiusAxis angle={90} domain={[0, 3]} tick={{ fontSize: 9 }} tickCount={4} />
            <Radar dataKey="value" stroke="#378ADD" fill="#378ADD" fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[12px] font-medium text-muted-foreground mb-2 mt-4 pt-4 border-t">{t("scenarioDashboard.allSignalsTurnByTurn")}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">{t("scenarioDashboard.turn")}</TableHead>
            <TableHead className="text-[11px]">{t("scenarioDashboard.signal")}</TableHead>
            <TableHead className="text-[11px]">{t("scenarioDashboard.level")}</TableHead>
            <TableHead className="text-[11px]">{t("scenarioDashboard.whatTheDataShows")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {turns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                {t("scenarioDashboard.noSignalsYet")}
              </TableCell>
            </TableRow>
          ) : turns.flatMap((turn) =>
            turn.signals.map((sig, si) => {
              const quoteLangDiffers = sig.sessionLanguage !== language;
              return (
                <TableRow key={`${turn.number}-${si}`}>
                  {si === 0 && <TableCell rowSpan={turn.signals.length} className="text-[11px] font-medium text-muted-foreground align-top">T{turn.number}</TableCell>}
                  <TableCell className="text-[11px] text-muted-foreground">{getSignalName(sig.key)}</TableCell>
                  <TableCell>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {getSignalLevel(sig.quality)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground/70 italic">
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <span>{sig.extracted_text}</span>
                      {quoteLangDiffers && (
                        <span
                          className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border not-italic font-medium shrink-0"
                          title={t("scenarioDashboard.quoteLanguageIndicatorTooltip")}
                          data-testid="badge-quote-language"
                        >
                          {sig.sessionLanguage.toUpperCase()}
                        </span>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function KpiFrameworksTab({ data, loading, isEn }: { data: KpiFrameworksData | undefined; loading: boolean; isEn: boolean }) {
  const { t } = useTranslation();
  if (loading) return <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;

  const turns = data?.turns || [];
  const activeKpis = data?.activeKpis || [];

  const kpiNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const turn of turns) {
      for (const kpi of turn.kpiMovements || []) {
        if (!names.has(kpi.kpiId)) names.set(kpi.kpiId, kpi.label);
      }
    }
    return names;
  }, [turns]);

  const frameworkCounts = useMemo(() => {
    const counts = new Map<string, { name: string; explicit: number; implicit: number }>();
    for (const turn of turns) {
      for (const fw of turn.frameworkApplications || []) {
        const entry = counts.get(fw.frameworkId) || { name: fw.name, explicit: 0, implicit: 0 };
        if (fw.level === "explicit") entry.explicit++;
        else if (fw.level === "implicit") entry.implicit++;
        counts.set(fw.frameworkId, entry);
      }
    }
    return Array.from(counts.entries()).map(([id, v]) => ({ id, ...v }));
  }, [turns]);

  const totalTurns = turns.length;

  return (
    <div>
      <div className="text-[12px] text-muted-foreground/70 leading-relaxed mb-4 p-2.5 bg-muted/30 rounded-lg border border-dashed border-border/50 italic">
        {t("scenarioDashboard.kpiTrajectoryExplainer")}
      </div>

      {frameworkCounts.length > 0 && totalTurns > 0 && (
        <div className="mb-4" data-testid="framework-counts-summary">
          <div className="text-[12px] font-medium text-muted-foreground mb-2">
            {t("scenarioDashboard.frameworksAppliedTotalsAcrossThis")}
          </div>
          <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
            {frameworkCounts.map((fw) => {
              const total = fw.explicit + fw.implicit;
              const pct = totalTurns > 0 ? Math.min(100, Math.round((total / totalTurns) * 100)) : 0;
              const explicitPct = totalTurns > 0 ? Math.min(100, Math.round((fw.explicit / totalTurns) * 100)) : 0;
              return (
                <div key={fw.id} data-testid={`framework-count-${fw.id}`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground truncate">{fw.name}</span>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0">
                      {fw.explicit} {t("scenarioDashboard.explicit")} · {fw.implicit} {t("scenarioDashboard.implicit")} · {total}/{totalTurns} {t("scenarioDashboard.turns")}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted/40 rounded overflow-hidden flex">
                    <div className="h-full bg-[#1D9E75]" style={{ width: `${explicitPct}%` }} />
                    <div className="h-full bg-[#378ADD]" style={{ width: `${Math.max(0, pct - explicitPct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-[12px] font-medium text-muted-foreground mb-2">{t("scenarioDashboard.kpiTrajectoryDecisionsAndTheir")}</div>
      {activeKpis.length > 0 ? (
        <div className="border border-dashed border-border rounded-lg overflow-hidden mb-4" data-testid="kpi-trajectory-table">
          <div className="grid bg-muted/30 border-b border-dashed border-border" style={{ gridTemplateColumns: `90px repeat(${turns.length}, 1fr)` }}>
            <div className="p-2 border-r border-dashed border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("scenarioDashboard.kpiHeader")}</div>
            {turns.map((turn) => (
              <div key={turn.number} className="p-2 border-r border-dashed border-border last:border-r-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {t("scenarioDashboard.turnLabel")} {turn.number} · {
                  turn.depth === "surface" ? t("scenarioDashboard.depthSurface") :
                  turn.depth === "engaged" ? t("scenarioDashboard.depthEngaged") :
                  turn.depth === "integrated" ? t("scenarioDashboard.depthIntegrated") :
                  turn.depth ?? ""
                }
              </div>
            ))}
          </div>
          {Array.from(kpiNames.entries()).map(([kpiId, label]) => (
            <div key={kpiId} className="grid border-b border-dashed border-border/50 last:border-b-0" style={{ gridTemplateColumns: `90px repeat(${turns.length}, 1fr)` }}>
              <div className="p-2 border-r border-dashed border-border text-[11px] font-medium text-muted-foreground">{label}</div>
              {turns.map((turn) => {
                const movement = turn.kpiMovements?.find((k) => k.kpiId === kpiId);
                let cellStyle: React.CSSProperties = {};
                let borderClass = "";
                if (movement) {
                  if (movement.direction === "up") {
                    cellStyle = { backgroundColor: "#EAF3DE" };
                    borderClass = "border-l-2 border-l-[#1D9E75]";
                  } else {
                    cellStyle = { backgroundColor: "#FCEBEB" };
                    borderClass = "border-l-2 border-l-[#D85A30]";
                  }
                }
                const textColor = movement ? (movement.direction === "up" ? "#27500A" : "#791F1F") : undefined;
                return (
                  <div
                    key={turn.number}
                    className={`p-2 border-r border-dashed border-border/50 last:border-r-0 text-[11px] ${borderClass}`}
                    style={cellStyle}
                  >
                    {movement ? (
                      <>
                        <div className="font-medium" style={{ color: textColor }}>
                          {movement.direction === "up" ? "↑" : "↓"} {movement.tier}
                        </div>
                        {movement.reasoningLink && (
                          <div className="text-[10px] italic mt-0.5" style={{ color: textColor, opacity: 0.75 }}>
                            {movement.reasoningLink}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-[13px] italic mb-4">{t("scenarioDashboard.noKpiMovementsRecorded")}</div>
      )}

      <div className="text-[12px] font-medium text-muted-foreground mb-2 mt-4 pt-4 border-t">{t("scenarioDashboard.courseFrameworkApplicationTurnBy")}</div>
      <div className="border border-dashed border-border rounded-lg p-3" data-testid="framework-application">
        {turns.map((turn) => (
          <div key={turn.number}>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 mt-2.5 first:mt-0">
              {t("scenarioDashboard.turnLabel")} {turn.number} · {turn.type === "mcq" ? "MCQ" : (t("scenarioDashboard.freeResponse"))}
            </div>
            {turn.frameworkApplications?.length > 0 ? (
              turn.frameworkApplications.map((fw, i) => (
                <div key={i} className="flex gap-2 items-start mb-1.5">
                  <span className="text-[11px] text-muted-foreground/70 italic min-w-[130px] shrink-0">{fw.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                    {fw.level === "explicit" ? t("scenarioDashboard.levelExplicit") :
                     fw.level === "implicit" ? t("scenarioDashboard.levelImplicit") :
                     fw.level ?? ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground/50 italic leading-snug">{fw.evidence}</span>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-muted-foreground/40 italic mb-1.5">{t("scenarioDashboard.noFrameworkDetectionsThisTurn")}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
