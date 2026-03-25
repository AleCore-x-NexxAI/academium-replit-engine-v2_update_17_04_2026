import { useState, useImperativeHandle, forwardRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Check,
  Edit2,
  Save,
  X,
  BookOpen,
  Target,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HelpIcon } from "@/components/HelpIcon";
import type { GeneratedScenarioData, DecisionPoint, Indicator } from "@shared/schema";

interface CanonicalCaseCreatorProps {
  onScenarioPublished: () => void;
  onClose: () => void;
}

export interface CanonicalCaseCreatorRef {
  handleBack: () => boolean; // Returns true if handled internally, false if should close
}

interface CanonicalCaseData {
  title: string;
  description: string;
  domain: string;
  caseContext: string;
  coreChallenge: string;
  decisionPoints: DecisionPoint[];
  reflectionPrompt: string;
  indicators: Indicator[];
  role: string;
  objective: string;
  companyName: string;
  industry: string;
  timelineContext: string;
  keyConstraints: string[];
  learningObjectives: string[];
  confidence: number;
}

interface GenerateResponse {
  draft: { id: string };
  canonicalCase: CanonicalCaseData;
  scenarioData: GeneratedScenarioData;
}

function EditableSection({
  title,
  icon: Icon,
  children,
  defaultExpanded = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover-elevate"
        data-testid={`section-toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-semibold">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

const CanonicalCaseCreator = forwardRef<CanonicalCaseCreatorRef, CanonicalCaseCreatorProps>(({
  onScenarioPublished,
  onClose,
}, ref) => {
  const [topic, setTopic] = useState("");
  const [discipline, setDiscipline] = useState("Negocios");
  const [targetLevel, setTargetLevel] = useState("Pregrado");
  const [scenarioObjective, setScenarioObjective] = useState("");
  const [tradeoffFocus, setTradeoffFocus] = useState<string[]>([]);
  const [customTradeoff, setCustomTradeoff] = useState("");
  const [stepCount, setStepCount] = useState(3);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [canonicalCase, setCanonicalCase] = useState<CanonicalCaseData | null>(null);
  const [scenarioData, setScenarioData] = useState<GeneratedScenarioData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [conceptTags, setConceptTags] = useState<string[]>([]);
  const [conceptTagInput, setConceptTagInput] = useState("");
  const { toast } = useToast();

  // Expose handleBack method to parent
  useImperativeHandle(ref, () => ({
    handleBack: () => {
      // If we have a draft, go back to input form (preserve state)
      if (canonicalCase) {
        setCanonicalCase(null);
        setScenarioData(null);
        setDraftId(null);
        return true; // Handled internally
      }
      // Otherwise, tell parent to close
      return false;
    }
  }));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/canonical-case/generate", {
        topic,
        discipline,
        targetLevel,
        scenarioObjective,
        tradeoffFocus,
        customTradeoff: customTradeoff.trim() || undefined,
        stepCount,
      });
      return response.json() as Promise<GenerateResponse>;
    },
    onSuccess: (data) => {
      setIsEditing(false);
      setDraftId(data.draft.id);
      setCanonicalCase(data.canonicalCase);
      setScenarioData(data.scenarioData);
      if (data.scenarioData?.courseConcepts?.length) {
        setConceptTags(data.scenarioData.courseConcepts);
      } else if (data.canonicalCase?.learningObjectives?.length) {
        setConceptTags(data.canonicalCase.learningObjectives.slice(0, 5));
      }
      toast({
        title: "Caso generado",
        description: "Revisa y edita el caso antes de publicar.",
      });
    },
    onError: (error) => {
      console.error("Generation error:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el caso. Intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draftId || !scenarioData) throw new Error("No draft to save");
      const dataWithConcepts = { ...scenarioData, courseConcepts: conceptTags.length > 0 ? conceptTags : undefined };
      const response = await apiRequest("PUT", `/api/canonical-case/${draftId}`, {
        scenarioData: dataWithConcepts,
      });
      return response.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      toast({
        title: "Cambios guardados",
        description: "Los cambios han sido guardados.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios.",
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!draftId || !scenarioData) throw new Error("No draft to publish");
      const dataWithConcepts = { ...scenarioData, courseConcepts: conceptTags.length > 0 ? conceptTags : undefined };
      await apiRequest("PUT", `/api/canonical-case/${draftId}`, { scenarioData: dataWithConcepts });
      const response = await apiRequest("POST", `/api/drafts/${draftId}/publish`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Caso publicado",
        description: "El caso está disponible para estudiantes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onScenarioPublished();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo publicar el caso.",
        variant: "destructive",
      });
    },
  });

  const updateDecisionPoint = (index: number, field: keyof DecisionPoint, value: any) => {
    if (!canonicalCase || !scenarioData) return;
    
    const updatedDecisionPoints = [...canonicalCase.decisionPoints];
    updatedDecisionPoints[index] = { ...updatedDecisionPoints[index], [field]: value };
    
    setCanonicalCase({ ...canonicalCase, decisionPoints: updatedDecisionPoints });
    setScenarioData({
      ...scenarioData,
      initialState: {
        ...scenarioData.initialState,
        decisionPoints: updatedDecisionPoints,
      },
    });
  };

  const updateOption = (dpIndex: number, optIndex: number, value: string) => {
    if (!canonicalCase) return;
    
    const updatedDecisionPoints = [...canonicalCase.decisionPoints];
    const dp = updatedDecisionPoints[dpIndex];
    if (dp.options) {
      const newOptions = [...dp.options];
      newOptions[optIndex] = value;
      updatedDecisionPoints[dpIndex] = { ...dp, options: newOptions };
      
      setCanonicalCase({ ...canonicalCase, decisionPoints: updatedDecisionPoints });
      if (scenarioData) {
        setScenarioData({
          ...scenarioData,
          initialState: {
            ...scenarioData.initialState,
            decisionPoints: updatedDecisionPoints,
          },
        });
      }
    }
  };

  const updateField = (field: keyof CanonicalCaseData, value: any) => {
    if (!canonicalCase || !scenarioData) return;
    
    setCanonicalCase({ ...canonicalCase, [field]: value });
    
    if (field === "title" || field === "description" || field === "domain") {
      setScenarioData({ ...scenarioData, [field]: value });
    } else if (field === "caseContext" || field === "coreChallenge") {
      // Update both the introText (legacy) and the new structured fields
      const newCaseContext = field === "caseContext" ? value : canonicalCase.caseContext;
      const newCoreChallenge = field === "coreChallenge" ? value : canonicalCase.coreChallenge;
      const introText = `${newCaseContext}\n\n**Desafío Central:**\n${newCoreChallenge}`;
      setScenarioData({
        ...scenarioData,
        initialState: { 
          ...scenarioData.initialState, 
          introText,
          caseContext: newCaseContext,
          coreChallenge: newCoreChallenge,
        },
      });
    } else if (field === "reflectionPrompt") {
      setScenarioData({
        ...scenarioData,
        initialState: { ...scenarioData.initialState, reflectionPrompt: value },
      });
    } else if (field === "role" || field === "objective") {
      setScenarioData({
        ...scenarioData,
        initialState: { ...scenarioData.initialState, [field]: value },
      });
    }
  };

  const SCENARIO_OBJECTIVES = [
    { id: "decision_making", label: "Toma de decisiones" },
    { id: "crisis_management", label: "Gestión de crisis" },
    { id: "strategic_thinking", label: "Pensamiento estratégico" },
    { id: "leadership", label: "Liderazgo" },
    { id: "negotiation", label: "Negociación" },
    { id: "ethical_dilemmas", label: "Dilemas éticos" },
  ];

  const TRADEOFF_OPTIONS = [
    { id: "cost_quality", label: "Costo vs. Calidad" },
    { id: "speed_accuracy", label: "Velocidad vs. Precisión" },
    { id: "short_long_term", label: "Corto vs. Largo plazo" },
    { id: "risk_reward", label: "Riesgo vs. Recompensa" },
    { id: "individual_team", label: "Individual vs. Equipo" },
    { id: "innovation_stability", label: "Innovación vs. Estabilidad" },
  ];

  const toggleTradeoff = (id: string) => {
    if (tradeoffFocus.includes(id)) {
      setTradeoffFocus(tradeoffFocus.filter((t) => t !== id));
    } else {
      setTradeoffFocus([...tradeoffFocus, id]);
    }
  };

  if (!canonicalCase) {
    // Loading state - show full-screen loading UI
    if (generateMutation.isPending) {
      return (
        <Card className="flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Generando borrador…</h2>
                <p className="text-muted-foreground">
                  Esto puede tardar unos segundos. Podrás editar todo antes de publicar.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Creando contexto, decisiones e indicadores</span>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <Card className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Crear con IA</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-creator">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-8 max-w-xl mx-auto space-y-8">
            {/* Topic - larger, more prominent */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="topic" className="text-base font-semibold">Tema del Caso</Label>
                <HelpIcon content="Describe brevemente el tema central. Por ejemplo: dilema de expansión, crisis de liderazgo, decisión de inversión." />
              </div>
              <Textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Describe el tema central de tu simulación. Ejemplo: Una empresa de tecnología debe decidir si lanzar un producto con vulnerabilidades conocidas ante la presión del mercado..."
                className="min-h-[100px] text-base"
                data-testid="input-case-topic"
              />
            </div>

            {/* Two columns for discipline and level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="discipline" className="text-base font-semibold">Disciplina</Label>
                  <HelpIcon content="Selecciona el área académica principal." />
                </div>
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger className="h-11" data-testid="select-discipline">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Negocios">Negocios</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Finanzas">Finanzas</SelectItem>
                    <SelectItem value="Operaciones">Operaciones</SelectItem>
                    <SelectItem value="Recursos Humanos">Recursos Humanos</SelectItem>
                    <SelectItem value="Estrategia">Estrategia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="targetLevel" className="text-base font-semibold">Nivel</Label>
                  <HelpIcon content="Define el nivel de complejidad según tu audiencia." />
                </div>
                <Select value={targetLevel} onValueChange={setTargetLevel}>
                  <SelectTrigger className="h-11" data-testid="select-target-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pregrado">Pregrado</SelectItem>
                    <SelectItem value="Posgrado">Posgrado</SelectItem>
                    <SelectItem value="Ejecutivo">Ejecutivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* NEW: Objetivo del escenario */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Objetivo del escenario</Label>
                <HelpIcon content="¿Qué competencia principal quieres que desarrollen los estudiantes?" />
              </div>
              <Select value={scenarioObjective} onValueChange={setScenarioObjective}>
                <SelectTrigger className="h-11" data-testid="select-scenario-objective">
                  <SelectValue placeholder="Selecciona un objetivo..." />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_OBJECTIVES.map((obj) => (
                    <SelectItem key={obj.id} value={obj.id}>{obj.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* NEW: Enfoque de tradeoff */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Número de Decisiones</Label>
                <HelpIcon content="Cuántos puntos de decisión tendrá la simulación. Mínimo 3, máximo 10. Más decisiones implican una simulación más larga." />
              </div>
              <Select value={String(stepCount)} onValueChange={(v) => setStepCount(Number(v))}>
                <SelectTrigger className="w-[200px]" data-testid="select-step-count">
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

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Enfoque de trade-off</Label>
                <HelpIcon content="Opcional: selecciona tensiones predefinidas, escribe la tuya, o combínalas. El caso se puede generar sin trade-offs." />
              </div>
              <p className="text-sm text-muted-foreground">Opcional — selecciona, escribe, o combina</p>
              <div className="flex flex-wrap gap-2">
                {TRADEOFF_OPTIONS.map((option) => {
                  const isSelected = tradeoffFocus.includes(option.id);
                  return (
                    <Badge
                      key={option.id}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer px-4 py-2 text-sm transition-all ${
                        isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-primary/10"
                      }`}
                      onClick={() => toggleTradeoff(option.id)}
                      data-testid={`chip-tradeoff-${option.id}`}
                    >
                      {isSelected && <Check className="w-3 h-3 mr-1" />}
                      {option.label}
                    </Badge>
                  );
                })}
              </div>
              <Input
                value={customTradeoff}
                onChange={(e) => setCustomTradeoff(e.target.value)}
                placeholder="O escribe tu propio trade-off. Ej: Transparencia vs. Confidencialidad"
                className="mt-2"
                data-testid="input-custom-tradeoff"
              />
            </div>

            {/* Generate button */}
            <div className="pt-4">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!topic.trim()}
                className="w-full h-12 text-base"
                data-testid="button-generate-draft"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generar Borrador
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-3">
                Nada se publica sin tu revisión.
              </p>
            </div>
          </div>
        </ScrollArea>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Revisar Caso: {canonicalCase.title}</h3>
          <Badge variant="secondary">{canonicalCase.domain}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCanonicalCase(null);
              setScenarioData(null);
              setDraftId(null);
              setTopic("");
              setScenarioObjective("");
              setTradeoffFocus([]);
              setCustomTradeoff("");
              setIsEditing(false);
            }}
            data-testid="button-regenerate"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Nuevo Caso
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setCanonicalCase(null);
              setScenarioData(null);
              setDraftId(null);
              setIsEditing(false);
            }} 
            data-testid="button-back-to-input"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {!isEditing && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-sm text-muted-foreground">
              <Edit2 className="w-4 h-4 shrink-0" />
              <span>Modo vista. Haz clic en "Modo Edición" para modificar.</span>
            </div>
          )}

          <EditableSection title="Información General" icon={BookOpen}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Título del Caso</Label>
                <Input
                  id="edit-title"
                  value={canonicalCase.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  readOnly={!isEditing}
                  className={`mt-1 ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={canonicalCase.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  readOnly={!isEditing}
                  className={`mt-1 ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                  data-testid="input-edit-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-role">Rol del Estudiante</Label>
                  <Input
                    id="edit-role"
                    value={canonicalCase.role}
                    onChange={(e) => updateField("role", e.target.value)}
                    readOnly={!isEditing}
                    className={`mt-1 ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                    data-testid="input-edit-role"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-company">Empresa</Label>
                  <Input
                    id="edit-company"
                    value={canonicalCase.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    readOnly={!isEditing}
                    className={`mt-1 ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                    data-testid="input-edit-company"
                  />
                </div>
              </div>
            </div>
          </EditableSection>

          <EditableSection title="Contexto del Caso" icon={BookOpen}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="edit-context">Contexto (120-180 palabras)</Label>
                  <span className="text-xs text-muted-foreground">
                    {canonicalCase.caseContext.split(/\s+/).filter(Boolean).length} palabras
                  </span>
                </div>
                <Textarea
                  id="edit-context"
                  value={canonicalCase.caseContext}
                  onChange={(e) => updateField("caseContext", e.target.value)}
                  readOnly={!isEditing}
                  className={`mt-1 min-h-[150px] ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                  data-testid="input-edit-context"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este es el contexto estilo Harvard que los estudiantes leerán antes de comenzar.
                </p>
              </div>
              <div>
                <Label htmlFor="edit-challenge">Desafío Central</Label>
                <Textarea
                  id="edit-challenge"
                  value={canonicalCase.coreChallenge}
                  onChange={(e) => updateField("coreChallenge", e.target.value)}
                  readOnly={!isEditing}
                  className={`mt-1 min-h-[80px] ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                  data-testid="input-edit-challenge"
                />
              </div>
            </div>
          </EditableSection>

          {canonicalCase.decisionPoints.map((dp, dpIndex) => (
            <EditableSection
              key={dp.number}
              title={`Decisión ${dp.number}: ${dp.number === 1 ? "Orientación" : dp.number === canonicalCase.decisionPoints.length ? "Integrativa" : "Analítica"}`}
              icon={Target}
              defaultExpanded={dpIndex === 0}
            >
              <div className="space-y-4">
                <div>
                  <Label>Pregunta de la Decisión</Label>
                  <Textarea
                    value={dp.prompt}
                    onChange={(e) => updateDecisionPoint(dpIndex, "prompt", e.target.value)}
                    readOnly={!isEditing}
                    className={`mt-1 min-h-[80px] ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                    data-testid={`input-decision-${dp.number}-prompt`}
                  />
                </div>

                {dp.format === "multiple_choice" && dp.options && (
                  <div className="space-y-2">
                    <Label>Opciones (cada una debe ser igualmente defendible)</Label>
                    {dp.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {String.fromCharCode(65 + optIndex)}
                        </Badge>
                        <Input
                          value={option}
                          onChange={(e) => updateOption(dpIndex, optIndex, e.target.value)}
                          readOnly={!isEditing}
                          className={!isEditing ? "opacity-70 cursor-default" : ""}
                          data-testid={`input-decision-${dp.number}-option-${optIndex}`}
                        />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Recuerda: No hay respuesta correcta. Cada opción debe ser defendible.
                    </p>
                  </div>
                )}

                {dp.format === "written" && (
                  <p className="text-sm text-muted-foreground">
                    Los estudiantes proporcionarán una justificación escrita (5-7 líneas).
                  </p>
                )}
              </div>
            </EditableSection>
          ))}

          <EditableSection title="Reflexión Final" icon={MessageSquare} defaultExpanded={false}>
            <div>
              <Label htmlFor="edit-reflection">Pregunta de Reflexión</Label>
              <Input
                id="edit-reflection"
                value={canonicalCase.reflectionPrompt}
                onChange={(e) => updateField("reflectionPrompt", e.target.value)}
                readOnly={!isEditing}
                className={`mt-1 ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                data-testid="input-edit-reflection"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Una pregunta ligera para fomentar la metacognición.
              </p>
            </div>
          </EditableSection>

          <EditableSection title="Objetivos de Aprendizaje" icon={Target} defaultExpanded={false}>
            <div className="space-y-2">
              {canonicalCase.learningObjectives.map((obj, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">{index + 1}</Badge>
                  <span className="text-sm">{obj}</span>
                </div>
              ))}
            </div>
          </EditableSection>

          <EditableSection title="Conceptos del Curso" icon={Tag} defaultExpanded={true}>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Etiqueta con conceptos del curso (3–8) para habilitar analíticas por concepto.
              </p>
              <div className="flex gap-2">
                <Input
                  value={conceptTagInput}
                  onChange={(e) => setConceptTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = conceptTagInput.trim();
                      if (val && !conceptTags.includes(val) && conceptTags.length < 8) {
                        setConceptTags(prev => [...prev, val]);
                        setConceptTagInput("");
                      }
                    }
                  }}
                  placeholder="Escribe un concepto y presiona Enter..."
                  disabled={conceptTags.length >= 8}
                  data-testid="input-concept-tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!conceptTagInput.trim() || conceptTags.includes(conceptTagInput.trim()) || conceptTags.length >= 8}
                  onClick={() => {
                    const val = conceptTagInput.trim();
                    if (val && !conceptTags.includes(val) && conceptTags.length < 8) {
                      setConceptTags(prev => [...prev, val]);
                      setConceptTagInput("");
                    }
                  }}
                  data-testid="button-add-concept-tag"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {conceptTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {conceptTags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="gap-1 pr-1"
                      data-testid={`badge-concept-tag-${index}`}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setConceptTags(prev => prev.filter((_, i) => i !== index))}
                        className="ml-1 rounded-full p-0.5"
                        data-testid={`button-remove-concept-tag-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {conceptTags.length > 0 && conceptTags.length < 3 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Se recomiendan al menos 3 conceptos para analíticas significativas.
                </p>
              )}
              <p className="text-xs text-muted-foreground">{conceptTags.length}/8 conceptos</p>
            </div>
          </EditableSection>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="font-medium">Indicadores POC</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {canonicalCase.indicators.map((ind) => (
                <div key={ind.id} className="flex justify-between">
                  <span className="text-muted-foreground">{ind.label}:</span>
                  <span>{ind.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t flex items-center gap-2">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-changes"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar Cambios
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-mode"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Modo Edición
            </Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="ml-auto"
              data-testid="button-publish-case"
            >
              {publishMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Publicar Caso
            </Button>
          </>
        )}
      </div>
    </Card>
  );
});

export default CanonicalCaseCreator;
