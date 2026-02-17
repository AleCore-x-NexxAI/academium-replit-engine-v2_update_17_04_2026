import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Zap, Database, AlertTriangle, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";

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

const PERIOD_LABELS: Record<string, string> = {
  "24h": "24 horas",
  "7d": "7 dias",
  "30d": "30 dias",
  "all": "Todo",
};

export default function AiCostDashboard() {
  const [period, setPeriod] = useState("7d");
  const [, navigate] = useLocation();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data, isLoading } = useQuery<CostData>({
    queryKey: [`/api/admin/ai-costs?period=${period}`],
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Acceso denegado. Solo super administradores.</p>
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
          <h1 className="text-2xl font-bold">Panel de Costos de IA</h1>
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
            <p className="text-muted-foreground">Cargando datos de costos...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Costo Total</CardTitle>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Llamadas Totales</CardTitle>
                  <Zap className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-total-calls">
                    {formatNumber(data.summary.totalCalls)}
                  </p>
                  <p className="text-xs text-muted-foreground">solicitudes a LLM</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tokens Totales</CardTitle>
                  <Database className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-total-tokens">
                    {formatNumber(data.summary.totalTokens)}
                  </p>
                  <p className="text-xs text-muted-foreground">input + output</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tasa de Error</CardTitle>
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-error-rate">
                    {data.summary.totalCalls > 0
                      ? ((data.summary.totalErrors / data.summary.totalCalls) * 100).toFixed(1)
                      : "0"}%
                  </p>
                  <p className="text-xs text-muted-foreground">{formatNumber(data.summary.totalErrors)} errores</p>
                </CardContent>
              </Card>
            </div>

            {data.byDay.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Costo Diario</CardTitle>
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
                        formatter={(value: number) => [formatCost(value), "Costo"]}
                        labelFormatter={(label) => `Fecha: ${label}`}
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
                  <CardTitle className="text-base">Por Proveedor</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.byProvider.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin datos</p>
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
                              <span>{formatNumber(p.calls)} calls</span>
                              <span>{formatNumber(p.totalTokens)} tok</span>
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
                  <CardTitle className="text-base">Por Agente</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.byAgent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin datos</p>
                  ) : (
                    <div className="space-y-3">
                      {data.byAgent
                        .sort((a, b) => b.costUsd - a.costUsd)
                        .map((a) => (
                          <div key={a.name} className="flex items-center justify-between gap-2 flex-wrap" data-testid={`row-agent-${a.name}`}>
                            <span className="text-sm font-medium">{a.name}</span>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{formatNumber(a.calls)} calls</span>
                              <span>{formatNumber(a.totalTokens)} tok</span>
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
                  <CardTitle className="text-base">Sesiones Mas Costosas (Top 50)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Session ID</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Llamadas</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Tokens</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Costo</th>
                          <th className="pb-2 font-medium text-muted-foreground">Usuario</th>
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
                <CardTitle className="text-base">Llamadas Recientes (Ultimas 100)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin llamadas registradas</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">Hora</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">Proveedor</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">Modelo</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">Agente</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">Tokens</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">Costo</th>
                          <th className="pb-2 pr-3 font-medium text-muted-foreground">Latencia</th>
                          <th className="pb-2 font-medium text-muted-foreground">Estado</th>
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
            <p className="text-muted-foreground">No se pudieron cargar los datos</p>
          </div>
        )}
      </div>
    </div>
  );
}
