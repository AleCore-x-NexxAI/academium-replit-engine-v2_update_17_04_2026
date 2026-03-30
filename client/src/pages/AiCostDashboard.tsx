import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Zap, Database, AlertTriangle, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

interface CostSummary {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  totalErrors: number;
  period: string;
}

interface ProviderData {
  name: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  errors: number;
}

interface AgentData {
  name: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

interface SessionData {
  sessionId: number;
  calls: number;
  totalTokens: number;
  costUsd: number;
  userId: string | null;
}

interface DayData {
  date: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}

interface RecentLog {
  id: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: string;
  agentName: string | null;
  sessionId: number | null;
  durationMs: number | null;
  success: boolean;
  createdAt: string;
}

interface CostData {
  summary: CostSummary;
  byProvider: ProviderData[];
  byAgent: AgentData[];
  bySession: SessionData[];
  byDay: DayData[];
  recentLogs: RecentLog[];
}

function formatCost(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export default function AiCostDashboard() {
  const [period, setPeriod] = useState("7d");
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const PERIOD_LABELS: Record<string, string> = {
    "24h": t("aiCostDashboard.period24h"),
    "7d": t("aiCostDashboard.period7d"),
    "30d": t("aiCostDashboard.period30d"),
    "all": t("aiCostDashboard.periodAll"),
  };

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data, isLoading } = useQuery<CostData>({
    queryKey: [`/api/admin/ai-costs?period=${period}`],
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("aiCostDashboard.accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            data-testid="button-back-settings"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <DollarSign className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("aiCostDashboard.title")}</h1>
          <div className="ml-auto">
            <LanguageToggle />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <Button
              key={key}
              variant={period === key ? "default" : "outline"}
              onClick={() => setPeriod(key)}
              data-testid={`button-period-${key}`}
            >
              {label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("aiCostDashboard.loadingCosts")}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("aiCostDashboard.totalCost")}</CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-total-cost">
                    {formatCost(data.summary.totalCostUsd)}
                  </p>
                  <p className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("aiCostDashboard.totalCalls")}</CardTitle>
                  <Zap className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-total-calls">
                    {formatNumber(data.summary.totalCalls)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("aiCostDashboard.llmRequests")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("aiCostDashboard.totalTokens")}</CardTitle>
                  <Database className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-total-tokens">
                    {formatNumber(data.summary.totalTokens)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("aiCostDashboard.inputOutput")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("aiCostDashboard.errorRate")}</CardTitle>
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-error-rate">
                    {data.summary.totalCalls > 0
                      ? ((data.summary.totalErrors / data.summary.totalCalls) * 100).toFixed(1)
                      : "0"}%
                  </p>
                  <p className="text-xs text-muted-foreground">{formatNumber(data.summary.totalErrors)} {t("aiCostDashboard.errors")}</p>
                </CardContent>
              </Card>
            </div>

            {data.byDay.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("aiCostDashboard.dailyCost")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.byDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis
                        className="text-xs"
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCost(value), t("aiCostDashboard.cost")]}
                        labelFormatter={(label) => `${t("aiCostDashboard.date")}: ${label}`}
                      />
                      <Bar dataKey="costUsd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("aiCostDashboard.byProvider")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.byProvider.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("aiCostDashboard.noData")}</p>
                  ) : (
                    <div className="space-y-3">
                      {data.byProvider
                        .sort((a, b) => b.costUsd - a.costUsd)
                        .map((p) => (
                          <div key={p.name} className="flex items-center justify-between gap-2 flex-wrap" data-testid={`row-provider-${p.name}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{p.name}</span>
                              {p.errors > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {p.errors} err
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{formatNumber(p.calls)} {t("aiCostDashboard.calls")}</span>
                              <span>{formatNumber(p.totalTokens)} {t("aiCostDashboard.tok")}</span>
                              <span className="font-medium text-foreground">{formatCost(p.costUsd)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("aiCostDashboard.byAgent")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.byAgent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("aiCostDashboard.noData")}</p>
                  ) : (
                    <div className="space-y-3">
                      {data.byAgent
                        .sort((a, b) => b.costUsd - a.costUsd)
                        .map((a) => (
                          <div key={a.name} className="flex items-center justify-between gap-2 flex-wrap" data-testid={`row-agent-${a.name}`}>
                            <span className="text-sm font-medium">{a.name}</span>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{formatNumber(a.calls)} {t("aiCostDashboard.calls")}</span>
                              <span>{formatNumber(a.totalTokens)} {t("aiCostDashboard.tok")}</span>
                              <span className="font-medium text-foreground">{formatCost(a.costUsd)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {data.bySession.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("aiCostDashboard.costlySessions")} {t("aiCostDashboard.top50")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("aiCostDashboard.sessionIdHeader")}</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("aiCostDashboard.callsHeader")}</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("aiCostDashboard.tokensHeader")}</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("aiCostDashboard.costHeader")}</th>
                          <th className="pb-2 font-medium text-muted-foreground">{t("aiCostDashboard.userHeader")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bySession.map((s) => (
                          <tr key={s.sessionId} className="border-b last:border-0" data-testid={`row-session-${s.sessionId}`}>
                            <td className="py-2 pr-4">#{s.sessionId}</td>
                            <td className="py-2 pr-4">{formatNumber(s.calls)}</td>
                            <td className="py-2 pr-4">{formatNumber(s.totalTokens)}</td>
                            <td className="py-2 pr-4 font-medium">{formatCost(s.costUsd)}</td>
                            <td className="py-2 text-muted-foreground">{s.userId || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("aiCostDashboard.recentCalls")} {t("aiCostDashboard.last100")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("aiCostDashboard.noCallsRegistered")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("aiCostDashboard.timeHeader")}</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("aiCostDashboard.providerHeader")}</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("aiCostDashboard.modelHeader")}</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("aiCostDashboard.agentHeader")}</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("aiCostDashboard.tokensHeader")}</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("aiCostDashboard.costHeader")}</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("aiCostDashboard.latencyHeader")}</th>
                          <th className="pb-2 font-medium text-muted-foreground">{t("aiCostDashboard.statusHeader")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentLogs.map((log) => (
                          <tr key={log.id} className="border-b last:border-0" data-testid={`row-log-${log.id}`}>
                            <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">{log.provider}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              <Badge variant="secondary">{log.model}</Badge>
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">{log.agentName || "-"}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {formatNumber(log.inputTokens)} / {formatNumber(log.outputTokens)}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap font-medium">
                              {formatCost(parseFloat(log.costUsd))}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                              {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : "-"}
                            </td>
                            <td className="py-2 whitespace-nowrap">
                              {log.success ? (
                                <Badge variant="secondary">OK</Badge>
                              ) : (
                                <Badge variant="destructive">Error</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("aiCostDashboard.couldNotLoad")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
