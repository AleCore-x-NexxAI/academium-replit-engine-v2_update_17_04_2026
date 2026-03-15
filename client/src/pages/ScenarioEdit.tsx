import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Save,
  Loader2,
  Building2,
  Users,
  Target,
  BookOpen,
  Brain,
  Settings2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Scenario, AgentPrompts, DecisionPoint } from "@shared/schema";

interface ScenarioConfig {
  llmModel: string;
  agentPrompts: AgentPrompts;
  supportedModels: string[];
  defaultPrompts?: {
    director: string;
    narrator: string;
    evaluator: string;
    domainExpert: string;
  };
}

const LLM_MODEL_LABELS: Record<string, string> = {
  "gpt-4o": "GPT-4o (Most capable)",
  "gpt-4o-mini": "GPT-4o-mini (Faster, cheaper)",
  "gpt-3.5-turbo": "GPT-3.5 Turbo (Budget)",
};

const scenarioFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  domain: z.string().min(1, "Please select a domain"),
  difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  role: z.string().min(3, "Role must be at least 3 characters"),
  objective: z.string().min(10, "Objective must be at least 10 characters"),
  introText: z.string().min(20, "Introduction must be at least 20 characters"),
  companyName: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  situationBackground: z.string().optional(),
  timelineContext: z.string().optional(),
  industryContext: z.string().optional(),
  competitiveEnvironment: z.string().optional(),
  regulatoryEnvironment: z.string().optional(),
  culturalContext: z.string().optional(),
  resourceConstraints: z.string().optional(),
  keyConstraintsText: z.string().optional(),
  learningObjectivesText: z.string().optional(),
});

type ScenarioFormData = z.infer<typeof scenarioFormSchema>;

const DOMAINS = [
  "Marketing", "Ethics", "HR", "Strategy", "Crisis", "Finance",
  "Operations", "Leadership", "Sustainability", "Innovation",
  "Mergers & Acquisitions", "Supply Chain",
];

const INDUSTRIES = [
  "Technology", "Healthcare", "Finance", "Manufacturing", "Retail",
  "Education", "Non-profit", "Energy", "Media & Entertainment",
  "Real Estate", "Transportation",
];

export default function ScenarioEdit() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // AI Configuration state
  const [llmModel, setLlmModel] = useState("gpt-4o");
  const [agentPrompts, setAgentPrompts] = useState<AgentPrompts>({});
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
  const [decisionPoints, setDecisionPoints] = useState<DecisionPoint[]>([]);

  const { data: scenario, isLoading: scenarioLoading, error: scenarioError } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", scenarioId],
    enabled: !!scenarioId && !!user,
  });
  
  // Fetch scenario AI config (for authorized users)
  const { data: configData, isLoading: configLoading } = useQuery<ScenarioConfig>({
    queryKey: ["/api/scenarios", scenarioId, "config"],
    enabled: !!scenarioId && !!user,
  });
  
  // Update config state when data loads
  useEffect(() => {
    if (configData) {
      setLlmModel(configData.llmModel);
      setAgentPrompts(configData.agentPrompts || {});
    }
  }, [configData]);

  const form = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: {
      title: "",
      description: "",
      domain: "",
      difficultyLevel: "intermediate",
      role: "",
      objective: "",
      introText: "",
      companyName: "",
      industry: "",
      companySize: "",
      situationBackground: "",
      timelineContext: "",
      industryContext: "",
      competitiveEnvironment: "",
      regulatoryEnvironment: "",
      culturalContext: "",
      resourceConstraints: "",
      keyConstraintsText: "",
      learningObjectivesText: "",
    },
  });

  useEffect(() => {
    if (scenario) {
      const initialState = scenario.initialState as any;
      form.reset({
        title: scenario.title,
        description: scenario.description || "",
        domain: scenario.domain,
        difficultyLevel: initialState?.difficultyLevel || "intermediate",
        role: initialState?.playerRole || "",
        objective: initialState?.objective || "",
        introText: initialState?.introText || "",
        companyName: initialState?.companyName || "",
        industry: initialState?.industry || "",
        companySize: initialState?.companySize || "",
        situationBackground: initialState?.situationBackground || "",
        timelineContext: initialState?.timelineContext || "",
        industryContext: initialState?.industryContext || "",
        competitiveEnvironment: initialState?.competitiveEnvironment || "",
        regulatoryEnvironment: initialState?.regulatoryEnvironment || "",
        culturalContext: initialState?.culturalContext || "",
        resourceConstraints: initialState?.resourceConstraints || "",
        keyConstraintsText: Array.isArray(initialState?.keyConstraints) 
          ? initialState.keyConstraints.join("\n") 
          : "",
        learningObjectivesText: Array.isArray(initialState?.learningObjectives)
          ? initialState.learningObjectives.join("\n")
          : "",
      });
      if (Array.isArray(initialState?.decisionPoints)) {
        setDecisionPoints(initialState.decisionPoints);
      }
    }
  }, [scenario, form]);

  const handleDepthStrictnessChange = (dpIndex: number, value: string) => {
    setDecisionPoints(prev => {
      const updated = [...prev];
      updated[dpIndex] = { ...updated[dpIndex], depthStrictness: value as "lenient" | "standard" | "strict" };
      return updated;
    });
  };

  const handleDecisionCountChange = (newCount: number) => {
    setDecisionPoints(prev => {
      if (newCount <= prev.length) {
        return prev.slice(0, newCount);
      }
      const additions: DecisionPoint[] = [];
      for (let i = prev.length; i < newCount; i++) {
        additions.push({
          number: i + 1,
          format: "written",
          prompt: `Decisión ${i + 1} — pendiente de configurar`,
          requiresJustification: true,
          includesReflection: false,
          focusCue: "Considera los factores clave antes de decidir.",
          thinkingScaffold: ["Stakeholders clave", "Trade-offs principales", "Consecuencias futuras"],
          depthStrictness: "standard",
        });
      }
      return [...prev, ...additions];
    });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: ScenarioFormData) => {
      const currentState = scenario?.initialState as any || {};
      const updatedScenario = {
        title: data.title,
        description: data.description,
        domain: data.domain,
        initialState: {
          ...currentState,
          playerRole: data.role,
          objective: data.objective,
          introText: data.introText,
          companyName: data.companyName,
          industry: data.industry,
          companySize: data.companySize,
          situationBackground: data.situationBackground,
          timelineContext: data.timelineContext,
          industryContext: data.industryContext,
          competitiveEnvironment: data.competitiveEnvironment,
          regulatoryEnvironment: data.regulatoryEnvironment,
          culturalContext: data.culturalContext,
          resourceConstraints: data.resourceConstraints,
          difficultyLevel: data.difficultyLevel,
          keyConstraints: data.keyConstraintsText?.split("\n").filter(Boolean) || [],
          learningObjectives: data.learningObjectivesText?.split("\n").filter(Boolean) || [],
          decisionPoints: decisionPoints.length > 0 ? decisionPoints : currentState.decisionPoints,
          totalDecisions: decisionPoints.length > 0 ? decisionPoints.length : (currentState.totalDecisions || currentState.decisionPoints?.length || 3),
        },
      };
      const response = await apiRequest("PUT", `/api/scenarios/${scenarioId}`, updatedScenario);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      toast({ title: "Scenario updated successfully" });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update scenario", description: error.message, variant: "destructive" });
    },
  });
  
  // Mutation for updating AI configuration
  const configMutation = useMutation({
    mutationFn: async (config: { llmModel?: string; agentPrompts?: AgentPrompts }) => {
      const response = await apiRequest("PUT", `/api/scenarios/${scenarioId}/config`, config);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenarioId, "config"] });
      toast({ title: "AI configuration updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update AI configuration", description: error.message, variant: "destructive" });
    },
  });
  
  const handleLlmModelChange = (model: string) => {
    setLlmModel(model);
    configMutation.mutate({ llmModel: model });
  };
  
  const handleAgentPromptChange = (agent: keyof AgentPrompts, prompt: string) => {
    const updatedPrompts = { ...agentPrompts, [agent]: prompt };
    setAgentPrompts(updatedPrompts);
  };
  
  const handleSaveAgentPrompts = () => {
    configMutation.mutate({ agentPrompts });
  };
  
  const handleResetAgentPrompt = (agent: keyof AgentPrompts) => {
    const updatedPrompts = { ...agentPrompts };
    delete updatedPrompts[agent];
    setAgentPrompts(updatedPrompts);
    configMutation.mutate({ agentPrompts: updatedPrompts });
  };

  useEffect(() => {
    if (scenarioError && isUnauthorizedError(scenarioError as Error)) {
      toast({ title: "Session Expired", description: "Please sign in again.", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [scenarioError, toast]);

  if (authLoading || scenarioLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isProfessorOrAdmin = user.role === "professor" || user.role === "admin";
  if (!isProfessorOrAdmin) {
    navigate("/");
    return null;
  }

  const onSubmit = (data: ScenarioFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">Edit Scenario</h1>
          </div>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={updateMutation.isPending}
            data-testid="button-save"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <BookOpen className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Basic Information</h2>
              </div>
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Scenario title" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description" rows={3} {...field} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="domain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Domain</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-domain">
                              <SelectValue placeholder="Select domain" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DOMAINS.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="difficultyLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-difficulty">
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Company Context</h2>
              </div>
              <div className="grid gap-6">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name" {...field} data-testid="input-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-industry">
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDUSTRIES.map((i) => (
                              <SelectItem key={i} value={i}>{i}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-size">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="startup">Startup (1-50)</SelectItem>
                            <SelectItem value="small">Small (51-200)</SelectItem>
                            <SelectItem value="medium">Medium (201-1000)</SelectItem>
                            <SelectItem value="large">Large (1001-5000)</SelectItem>
                            <SelectItem value="enterprise">Enterprise (5000+)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="situationBackground"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situation Background</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the situation..." rows={4} {...field} data-testid="input-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Player Role</h2>
              </div>
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., CEO, Marketing Director" {...field} data-testid="input-role" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Objective</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What must the player achieve?" rows={2} {...field} data-testid="input-objective" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="introText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Introduction Text</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Opening narrative shown to the player..." rows={4} {...field} data-testid="input-intro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Learning Objectives</h2>
              </div>
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="learningObjectivesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Learning Objectives (one per line)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter each objective on a new line..." rows={4} {...field} data-testid="input-objectives" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="keyConstraintsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Constraints (one per line)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter each constraint on a new line..." rows={3} {...field} data-testid="input-constraints" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>
            
            {decisionPoints.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Puntos de Decisión</h2>
                    <Badge variant="outline" className="text-xs">{decisionPoints.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      Total:
                    </label>
                    <Select
                      value={String(decisionPoints.length)}
                      onValueChange={(v) => handleDecisionCountChange(Number(v))}
                    >
                      <SelectTrigger className="w-[160px]" data-testid="select-decision-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => i + 3).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} decisiones{n === 3 ? " (estándar)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  {decisionPoints.map((dp, idx) => (
                    <div key={idx} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" data-testid={`text-decision-prompt-${idx}`}>
                            Decisión {dp.number}: {dp.prompt}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {dp.format === "multiple_choice" ? "Opción múltiple" : "Respuesta escrita"}
                            {dp.requiresJustification ? " · Requiere justificación" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          Exigencia de Profundidad:
                        </label>
                        <Select
                          value={dp.depthStrictness || "standard"}
                          onValueChange={(value) => handleDepthStrictnessChange(idx, value)}
                        >
                          <SelectTrigger className="w-[180px]" data-testid={`select-depth-strictness-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lenient">Flexible</SelectItem>
                            <SelectItem value="standard">Estándar</SelectItem>
                            <SelectItem value="strict">Rigurosa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Flexible: acepta casi cualquier respuesta relevante. Estándar: requiere al menos un criterio de profundidad. Rigurosa: requiere al menos dos dimensiones de razonamiento.
                </p>
              </Card>
            )}

            {/* AI Configuration Section */}
            {configData && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Brain className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">AI Configuration</h2>
                  {configMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                
                <div className="grid gap-6">
                  {/* LLM Model Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">AI Model</label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose the AI model used for generating narratives and evaluations
                    </p>
                    <Select value={llmModel} onValueChange={handleLlmModelChange}>
                      <SelectTrigger className="w-full max-w-md" data-testid="select-llm-model">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent>
                        {(configData.supportedModels || ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]).map((model) => (
                          <SelectItem key={model} value={model}>
                            {LLM_MODEL_LABELS[model] || model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Agent Prompts Section - Superadmin Only */}
                  {user?.isSuperAdmin && configData.defaultPrompts && (
                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Agent Prompts</span>
                          <Badge variant="outline" className="text-xs">Superadmin</Badge>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleSaveAgentPrompts}
                          disabled={configMutation.isPending}
                          data-testid="button-save-prompts"
                        >
                          <Save className="w-3 h-3 mr-1" />
                          Save Prompts
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Customize the system prompts for each AI agent. Leave empty to use defaults.
                      </p>
                      
                      <div className="space-y-3">
                        {(["narrator", "evaluator", "domainExpert", "director"] as const).map((agent) => {
                          const agentLabels: Record<string, string> = {
                            narrator: "Narrator Agent",
                            evaluator: "Evaluator Agent", 
                            domainExpert: "Domain Expert Agent",
                            director: "Director Agent",
                          };
                          const agentDescriptions: Record<string, string> = {
                            narrator: "Generates immersive business narratives and NPC dialogue",
                            evaluator: "Scores decisions against rubric criteria",
                            domainExpert: "Calculates KPI impacts based on business logic",
                            director: "Orchestrates all agents and validates student input",
                          };
                          const isExpanded = expandedAgents[agent] || false;
                          const hasCustomPrompt = !!agentPrompts[agent];
                          
                          return (
                            <Collapsible
                              key={agent}
                              open={isExpanded}
                              onOpenChange={(open) => setExpandedAgents({ ...expandedAgents, [agent]: open })}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-3 border rounded-lg hover-elevate transition-colors">
                                  <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">{agentLabels[agent]}</span>
                                    {hasCustomPrompt && (
                                      <Badge variant="secondary" className="text-xs">Custom</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground hidden sm:inline">
                                      {agentDescriptions[agent]}
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 border border-t-0 rounded-b-lg space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      {hasCustomPrompt ? "Using custom prompt" : "Using default prompt"}
                                    </span>
                                    {hasCustomPrompt && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleResetAgentPrompt(agent)}
                                        data-testid={`button-reset-${agent}`}
                                      >
                                        <RefreshCw className="w-3 h-3 mr-1" />
                                        Reset to Default
                                      </Button>
                                    )}
                                  </div>
                                  <Textarea
                                    placeholder={configData.defaultPrompts?.[agent] || "Enter custom prompt..."}
                                    value={agentPrompts[agent] || ""}
                                    onChange={(e) => handleAgentPromptChange(agent, e.target.value)}
                                    rows={8}
                                    className="font-mono text-xs"
                                    data-testid={`textarea-prompt-${agent}`}
                                  />
                                  {!hasCustomPrompt && (
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                        View default prompt
                                      </summary>
                                      <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-48 overflow-auto">
                                        {configData.defaultPrompts?.[agent]}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </form>
        </Form>
      </main>
    </div>
  );
}
