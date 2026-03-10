import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  Heart,
  Star,
  Target,
  AlertTriangle,
  Lightbulb,
  Gauge,
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
import type { Scenario, SimulationSession, Turn, User, TurnEvent, Indicator, MetricExplanation } from "@shared/schema";

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

const RESULT_INDICATOR_ICONS: Record<string, React.ElementType> = {
  teamMorale: Users, budgetImpact: DollarSign, operationalRisk: AlertTriangle,
  strategicFlexibility: Target, revenue: DollarSign, morale: Heart,
  reputation: Star, efficiency: TrendingUp, trust: Users,
};

const RESULT_INDICATOR_LABELS: Record<string, string> = {
  teamMorale: "Moral del Equipo", budgetImpact: "Impacto Presupuestario",
  operationalRisk: "Riesgo Operacional", strategicFlexibility: "Flexibilidad Estratégica",
  revenue: "Ingresos", morale: "Moral del Equipo", reputation: "Reputación de Marca",
  efficiency: "Eficiencia Operacional", trust: "Confianza de Stakeholders",
};

function ResultsViewer({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery<ConversationData>({
    queryKey: ["/api/professor/sessions", sessionId, "conversation"],
  });
  const [expandedIndicators, setExpandedIndicators] = useState<Set<string>>(new Set());

  if (isLoading) {
    return <div className="p-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (!data?.turns || data.turns.length === 0) {
    return (
      <div className="p-8 text-center space-y-2">
        <Gauge className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Sin resultados disponibles</p>
        <p className="text-xs text-muted-foreground">El estudiante no completó ninguna decisión.</p>
      </div>
    );
  }

  const session = data.session;
  const scenario = (session as any).scenario as Scenario | undefined;
  const currentState = session.currentState as any;
  const initialState = scenario?.initialState as any;

  const finalIndicators: Indicator[] = currentState?.indicators || [];
  const initialIndicators: Indicator[] = initialState?.indicators || [];

  const indicatorExplanations: Record<string, Array<{ turnNumber: number; shortReason: string; causalChain: string[] }>> = {};
  for (const turn of data.turns) {
    const explanations = (turn.agentResponse as any)?.metricExplanations;
    if (explanations) {
      for (const [indicatorId, explanation] of Object.entries(explanations)) {
        if (!indicatorExplanations[indicatorId]) {
          indicatorExplanations[indicatorId] = [];
        }
        const exp = explanation as MetricExplanation;
        indicatorExplanations[indicatorId].push({
          turnNumber: turn.turnNumber,
          shortReason: exp.shortReason || "",
          causalChain: exp.causalChain || [],
        });
      }
    }
  }

  const comparison = finalIndicators.length > 0
    ? finalIndicators.map((indicator) => {
        const initial = initialIndicators.find((i) => i.id === indicator.id);
        return {
          key: indicator.id,
          label: RESULT_INDICATOR_LABELS[indicator.id] || indicator.label,
          initial: initial?.value ?? indicator.value,
          final: indicator.value,
          delta: initial ? indicator.value - initial.value : 0,
          direction: indicator.direction || "up_better",
          Icon: RESULT_INDICATOR_ICONS[indicator.id] || Gauge,
        };
      })
    : Object.entries(currentState?.kpis || {}).map(([key, val]) => ({
        key,
        label: RESULT_INDICATOR_LABELS[key] || key,
        initial: (initialState?.kpis as any)?.[key] ?? 50,
        final: val as number,
        delta: ((val as number) - ((initialState?.kpis as any)?.[key] ?? 50)),
        direction: "up_better" as const,
        Icon: RESULT_INDICATOR_ICONS[key] || Gauge,
      }));

  const toggleIndicator = (key: string) => {
    setExpandedIndicators(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getDeltaColor = (delta: number, direction: string) => {
    const rounded = Math.round(delta);
    if (rounded === 0) return "text-muted-foreground";
    const isGood = direction === "down_better" ? rounded < 0 : rounded > 0;
    return isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  };

  if (comparison.length === 0) {
    return (
      <div className="p-8 text-center space-y-2">
        <Gauge className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Sin datos de indicadores</p>
        <p className="text-xs text-muted-foreground">Esta sesión no tiene información de indicadores registrada.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Indicadores: Inicio vs. Final</h3>
        </div>

        <div className="space-y-3">
          {comparison.map((item) => {
            const exps = indicatorExplanations[item.key];
            const hasExps = exps && exps.length > 0;
            const isExpanded = expandedIndicators.has(item.key);
            const IconComponent = item.Icon;

            return (
              <Card key={item.key} className="p-4" data-testid={`result-indicator-${item.key}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <IconComponent className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.direction === "down_better" ? "Menor es mejor" : "Mayor es mejor"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground block">Inicio</span>
                      <span className="text-sm font-semibold">{Math.round(item.initial)}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground block">Final</span>
                      <span className="text-lg font-bold">{Math.round(item.final)}</span>
                    </div>
                    <Badge variant="outline" className={`font-mono text-xs ${getDeltaColor(item.delta, item.direction)}`}>
                      {item.delta > 0 ? "+" : ""}{Math.round(item.delta)}
                    </Badge>
                  </div>
                </div>

                {hasExps ? (
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 justify-start text-xs"
                      onClick={() => toggleIndicator(item.key)}
                      data-testid={`button-why-result-${item.key}`}
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      {isExpanded ? "Ocultar detalles" : "Ver por qué cambió"}
                      <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </Button>

                    {isExpanded && (
                      <div className="mt-2 pl-4 border-l-2 border-amber-500/30 space-y-3">
                        {exps.map((exp, i) => (
                          <div key={i} className="text-xs space-y-1">
                            <p className="font-medium text-foreground/80">
                              Decisión {exp.turnNumber}: {exp.shortReason}
                            </p>
                            {exp.causalChain.length > 0 && (
                              <ul className="pl-3 space-y-0.5">
                                {exp.causalChain.map((chain, ci) => (
                                  <li key={ci} className="text-muted-foreground leading-relaxed">{chain}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : item.delta !== 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground italic">
                    Detalles de explicación no disponibles para esta sesión.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>

        {data.turns.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Basado en {data.turns.length} decisión{data.turns.length !== 1 ? "es" : ""} del estudiante.
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
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
        <Tabs defaultValue="results">
          <TabsList className="w-full">
            <TabsTrigger value="results" className="flex-1" data-testid="tab-results">
              Resultados
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex-1" data-testid="tab-conversation">
              Decisiones
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1" data-testid="tab-events">
              Registro de Eventos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="results">
            <ResultsViewer sessionId={session.id} />
          </TabsContent>
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
