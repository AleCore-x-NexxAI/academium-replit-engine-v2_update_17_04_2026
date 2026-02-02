import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { HelpIcon } from "@/components/HelpIcon";

interface ManualCaseCreatorProps {
  onSuccess: () => void;
  onClose: () => void;
}

const STANDARD_INDICATORS = [
  { id: "revenue", label: "Ingresos / Presupuesto" },
  { id: "morale", label: "Moral del Equipo" },
  { id: "reputation", label: "Reputación de Marca" },
  { id: "efficiency", label: "Eficiencia Operacional" },
  { id: "trust", label: "Confianza de Stakeholders" },
];

const TRADEOFF_OPTIONS = [
  { id: "cost_quality", label: "Costo vs. Calidad" },
  { id: "speed_safety", label: "Velocidad vs. Seguridad" },
  { id: "short_long", label: "Corto vs. Largo Plazo" },
  { id: "individual_collective", label: "Individual vs. Colectivo" },
  { id: "innovation_stability", label: "Innovación vs. Estabilidad" },
  { id: "profit_ethics", label: "Rentabilidad vs. Ética" },
];

interface FormData {
  title: string;
  caseContext: string;
  studentRole: string;
  tradeoffs: string[];
  restrictions: string;
  learningObjectives: string;
  stakeholders: string;
}

export default function ManualCaseCreator({
  onSuccess,
  onClose,
}: ManualCaseCreatorProps) {
  const { toast } = useToast();
  const [optionalOpen, setOptionalOpen] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    title: "",
    caseContext: "",
    studentRole: "",
    tradeoffs: [],
    restrictions: "",
    learningObjectives: "",
    stakeholders: "",
  });

  const toggleTradeoff = (id: string) => {
    setFormData(prev => {
      const current = prev.tradeoffs;
      if (current.includes(id)) {
        return { ...prev, tradeoffs: current.filter(t => t !== id) };
      } else if (current.length < 2) {
        return { ...prev, tradeoffs: [...current, id] };
      }
      return prev;
    });
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scenarios", {
        title: formData.title || "Borrador sin título",
        description: formData.caseContext.slice(0, 200) || "Caso en desarrollo",
        domain: "Negocios",
        initialState: {
          role: formData.studentRole || "Profesional",
          objective: "Tomar decisiones estratégicas",
          introText: formData.caseContext,
          kpis: {
            revenue: 65,
            morale: 70,
            reputation: 75,
            efficiency: 60,
            trust: 72,
          },
        },
        tradeoffs: formData.tradeoffs,
        restrictions: formData.restrictions || undefined,
        learningObjectives: formData.learningObjectives || undefined,
        stakeholders: formData.stakeholders || undefined,
        isPublished: false,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Borrador guardado", description: "Tu caso ha sido guardado como borrador." });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Sesión expirada", description: "Por favor inicia sesión de nuevo.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "No se pudo guardar el borrador.", variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scenarios", {
        title: formData.title,
        description: formData.caseContext.slice(0, 200),
        domain: "Negocios",
        initialState: {
          role: formData.studentRole || "Profesional",
          objective: "Tomar decisiones estratégicas",
          introText: formData.caseContext,
          kpis: {
            revenue: 65,
            morale: 70,
            reputation: 75,
            efficiency: 60,
            trust: 72,
          },
        },
        tradeoffs: formData.tradeoffs,
        restrictions: formData.restrictions || undefined,
        learningObjectives: formData.learningObjectives || undefined,
        stakeholders: formData.stakeholders || undefined,
        isPublished: true,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Caso publicado", description: "Tu simulación está lista para estudiantes." });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Sesión expirada", description: "Por favor inicia sesión de nuevo.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "No se pudo publicar el caso.", variant: "destructive" });
    },
  });

  const isFormValid = () => {
    return (
      formData.title.trim().length >= 3 &&
      formData.caseContext.trim().length >= 20 &&
      formData.studentRole.trim().length >= 2 &&
      formData.tradeoffs.length >= 1
    );
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden" data-testid="manual-case-creator">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h2 className="font-semibold">Crear Caso Manualmente</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-manual-creator"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Case Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="title">Título del Caso</Label>
            <HelpIcon content="Un nombre corto y descriptivo que los estudiantes verán al iniciar la simulación." />
          </div>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Ej: Crisis de Lanzamiento de Producto"
            data-testid="input-case-title"
          />
        </div>

        {/* Case Context */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="context">Contexto del Caso</Label>
            <HelpIcon content="Establece la situación. Incluye la empresa, el mercado, y el desafío que enfrentan los estudiantes." />
            <Badge variant="secondary" className="text-xs">Requerido</Badge>
          </div>
          <Textarea
            id="context"
            value={formData.caseContext}
            onChange={(e) => setFormData(prev => ({ ...prev, caseContext: e.target.value }))}
            placeholder="Describe el contexto empresarial, la empresa, el mercado y la situación que enfrentan los estudiantes..."
            className="min-h-[120px]"
            data-testid="input-case-context"
          />
        </div>

        {/* Student Role */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="role">Rol del Estudiante</Label>
            <HelpIcon content="El papel que asumirá el estudiante durante la simulación." />
            <Badge variant="secondary" className="text-xs">Requerido</Badge>
          </div>
          <Input
            id="role"
            value={formData.studentRole}
            onChange={(e) => setFormData(prev => ({ ...prev, studentRole: e.target.value }))}
            placeholder="Ej: Gerente de Marketing, Director de Operaciones, CEO"
            data-testid="input-student-role"
          />
        </div>

        {/* Tradeoff Focus */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Desafío Central / Enfoque de Tradeoff</Label>
            <HelpIcon content="Selecciona 1 o 2 tensiones que los estudiantes deberán balancear durante la simulación." />
            <Badge variant="secondary" className="text-xs">Elige 1–2</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRADEOFF_OPTIONS.map((option) => (
              <Badge
                key={option.id}
                variant={formData.tradeoffs.includes(option.id) ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${
                  formData.tradeoffs.includes(option.id) 
                    ? "bg-primary text-primary-foreground" 
                    : "hover-elevate"
                } ${formData.tradeoffs.length >= 2 && !formData.tradeoffs.includes(option.id) ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => toggleTradeoff(option.id)}
                data-testid={`chip-tradeoff-${option.id}`}
              >
                {option.label}
              </Badge>
            ))}
          </div>
          {formData.tradeoffs.length === 0 && (
            <p className="text-xs text-muted-foreground">Selecciona al menos un enfoque de tradeoff.</p>
          )}
        </div>

        {/* Standard Indicators (Read-only) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            <Label>Indicadores de Simulación</Label>
            <HelpIcon content="Indicadores estándar que se mostrarán durante la simulación para medir el impacto de las decisiones." />
          </div>
          <div className="flex flex-wrap gap-2">
            {STANDARD_INDICATORS.map((indicator) => (
              <Badge
                key={indicator.id}
                variant="secondary"
                className="cursor-default"
                data-testid={`chip-indicator-${indicator.id}`}
              >
                {indicator.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Los 5 indicadores estándar se incluirán automáticamente en la simulación.
          </p>
        </div>

        {/* Optional Fields (Collapsed) */}
        <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-testid="button-toggle-optional"
            >
              <span className="font-medium text-muted-foreground">Campos opcionales</span>
              {optionalOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Restrictions */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="restrictions">Restricciones</Label>
                <HelpIcon content="Limitaciones o reglas que los estudiantes deben respetar durante la simulación." />
                <Badge variant="outline" className="text-xs">Opcional</Badge>
              </div>
              <Textarea
                id="restrictions"
                value={formData.restrictions}
                onChange={(e) => setFormData(prev => ({ ...prev, restrictions: e.target.value }))}
                placeholder="Ej: Presupuesto limitado, plazo de 3 meses, no despedir personal..."
                className="min-h-[80px]"
                data-testid="input-restrictions"
              />
            </div>

            {/* Learning Objectives */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="objectives">Objetivos de Aprendizaje</Label>
                <HelpIcon content="Lo que esperas que los estudiantes aprendan o desarrollen con esta simulación." />
                <Badge variant="outline" className="text-xs">Opcional</Badge>
              </div>
              <Textarea
                id="objectives"
                value={formData.learningObjectives}
                onChange={(e) => setFormData(prev => ({ ...prev, learningObjectives: e.target.value }))}
                placeholder="Ej: Desarrollar pensamiento crítico, evaluar tradeoffs, gestionar stakeholders..."
                className="min-h-[80px]"
                data-testid="input-learning-objectives"
              />
            </div>

            {/* Stakeholders */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="stakeholders">Stakeholders Clave</Label>
                <HelpIcon content="Actores importantes en el escenario que los estudiantes deben considerar." />
                <Badge variant="outline" className="text-xs">Recomendado</Badge>
              </div>
              <Textarea
                id="stakeholders"
                value={formData.stakeholders}
                onChange={(e) => setFormData(prev => ({ ...prev, stakeholders: e.target.value }))}
                placeholder="Ej: Junta directiva, empleados, clientes, proveedores, comunidad local..."
                className="min-h-[80px]"
                data-testid="input-stakeholders"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/30">
        <Button
          variant="outline"
          onClick={() => saveDraftMutation.mutate()}
          disabled={saveDraftMutation.isPending || publishMutation.isPending}
          data-testid="button-save-draft"
        >
          {saveDraftMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Guardar Borrador
            </>
          )}
        </Button>
        <Button
          onClick={() => publishMutation.mutate()}
          disabled={!isFormValid() || saveDraftMutation.isPending || publishMutation.isPending}
          data-testid="button-publish-case"
        >
          {publishMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Publicar
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
