import { useState } from "react";
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
import type { GeneratedScenarioData, DecisionPoint, Indicator } from "@shared/schema";

interface CanonicalCaseCreatorProps {
  onScenarioPublished: () => void;
  onClose: () => void;
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

export default function CanonicalCaseCreator({
  onScenarioPublished,
  onClose,
}: CanonicalCaseCreatorProps) {
  const [topic, setTopic] = useState("");
  const [discipline, setDiscipline] = useState("Negocios");
  const [targetLevel, setTargetLevel] = useState("Pregrado");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [canonicalCase, setCanonicalCase] = useState<CanonicalCaseData | null>(null);
  const [scenarioData, setScenarioData] = useState<GeneratedScenarioData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/canonical-case/generate", {
        topic,
        discipline,
        targetLevel,
      });
      return response.json() as Promise<GenerateResponse>;
    },
    onSuccess: (data) => {
      setDraftId(data.draft.id);
      setCanonicalCase(data.canonicalCase);
      setScenarioData(data.scenarioData);
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
      const response = await apiRequest("PUT", `/api/canonical-case/${draftId}`, {
        scenarioData,
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
      if (!draftId) throw new Error("No draft to publish");
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

  if (!canonicalCase) {
    return (
      <Card className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Creador de Casos Canónicos</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-creator">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 p-6 flex flex-col justify-center">
          <div className="max-w-md mx-auto space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="topic">Tema del Caso</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Decisión de expansión de mercado para una empresa mediana"
                  className="mt-1"
                  data-testid="input-case-topic"
                />
              </div>

              <div>
                <Label htmlFor="discipline">Disciplina / Contexto del Curso</Label>
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger className="mt-1" data-testid="select-discipline">
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

              <div>
                <Label htmlFor="targetLevel">Nivel Objetivo</Label>
                <Select value={targetLevel} onValueChange={setTargetLevel}>
                  <SelectTrigger className="mt-1" data-testid="select-target-level">
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

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!topic.trim() || generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-draft"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generando borrador...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generar Borrador
                </>
              )}
            </Button>
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
            }}
            data-testid="button-regenerate"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Nuevo Caso
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-editor">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <EditableSection title="Información General" icon={BookOpen}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Título del Caso</Label>
                <Input
                  id="edit-title"
                  value={canonicalCase.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className="mt-1"
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={canonicalCase.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="mt-1"
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
                    className="mt-1"
                    data-testid="input-edit-role"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-company">Empresa</Label>
                  <Input
                    id="edit-company"
                    value={canonicalCase.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    className="mt-1"
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
                  className="mt-1 min-h-[150px]"
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
                  className="mt-1 min-h-[80px]"
                  data-testid="input-edit-challenge"
                />
              </div>
            </div>
          </EditableSection>

          {canonicalCase.decisionPoints.map((dp, dpIndex) => (
            <EditableSection
              key={dp.number}
              title={`Decisión ${dp.number}: ${dp.format === "multiple_choice" ? "Orientación" : dp.number === 2 ? "Analítica" : "Integrativa"}`}
              icon={Target}
              defaultExpanded={dpIndex === 0}
            >
              <div className="space-y-4">
                <div>
                  <Label>Pregunta de la Decisión</Label>
                  <Textarea
                    value={dp.prompt}
                    onChange={(e) => updateDecisionPoint(dpIndex, "prompt", e.target.value)}
                    className="mt-1 min-h-[80px]"
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
                className="mt-1"
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
}
