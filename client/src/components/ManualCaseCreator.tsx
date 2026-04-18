import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Send,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { HelpIcon } from "@/components/HelpIcon";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CaseFramework } from "@shared/schema";

interface ManualCaseCreatorProps {
  onSuccess: () => void;
  onClose: () => void;
}

const STANDARD_INDICATORS = [
  { id: "revenue", labelKey: "indicators.revenue" },
  { id: "morale", labelKey: "indicators.teamMorale" },
  { id: "reputation", labelKey: "indicators.brandReputation" },
  { id: "efficiency", labelKey: "indicators.operationalEfficiency" },
  { id: "trust", labelKey: "indicators.stakeholderTrust" },
];

const TRADEOFF_OPTIONS = [
  { id: "cost_quality", labelKey: "tradeoffs.costVsQuality" },
  { id: "speed_safety", labelKey: "tradeoffs.speedVsSafety" },
  { id: "short_long", labelKey: "tradeoffs.shortVsLong" },
  { id: "individual_collective", labelKey: "tradeoffs.individualVsCollective" },
  { id: "innovation_stability", labelKey: "tradeoffs.innovationVsStability" },
  { id: "profit_ethics", labelKey: "tradeoffs.profitVsEthics" },
];

const SCENARIO_OBJECTIVES = [
  { id: "decision_making", labelKey: "scenarioObjectives.decisionMaking" },
  { id: "crisis_management", labelKey: "scenarioObjectives.crisisManagement" },
  { id: "strategic_thinking", labelKey: "scenarioObjectives.strategicThinking" },
  { id: "leadership", labelKey: "scenarioObjectives.leadership" },
  { id: "negotiation", labelKey: "scenarioObjectives.negotiation" },
  { id: "ethical_dilemmas", labelKey: "scenarioObjectives.ethicalDilemmas" },
];

function disciplineToDomain(d: string): string {
  return d;
}

function levelToDifficulty(l: string): "beginner" | "intermediate" | "advanced" {
  if (l === "Pregrado") return "beginner";
  if (l === "Ejecutivo") return "advanced";
  return "intermediate";
}

interface FormData {
  title: string;
  caseContext: string;
  studentRole: string;
  tradeoffs: string[];
  customTradeoff: string;
  restrictions: string;
  learningObjectives: string;
  stakeholders: string;
  discipline: string;
  targetLevel: string;
  scenarioObjective: string;
  stepCount: number;
  reflectionPrompt: string;
  hintButtonEnabled: boolean;
  maxHintsPerTurn: 1 | 2 | 3 | 4 | 5;
  conceptTags: string[];
  frameworks: CaseFramework[];
}

export default function ManualCaseCreator({
  onSuccess,
  onClose,
}: ManualCaseCreatorProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [conceptInput, setConceptInput] = useState("");
  const [frameworkNameInput, setFrameworkNameInput] = useState("");

  const [formData, setFormData] = useState<FormData>({
    title: "",
    caseContext: "",
    studentRole: "",
    tradeoffs: [],
    customTradeoff: "",
    restrictions: "",
    learningObjectives: "",
    stakeholders: "",
    discipline: "Negocios",
    targetLevel: "Pregrado",
    scenarioObjective: "",
    stepCount: 3,
    reflectionPrompt: "",
    hintButtonEnabled: true,
    maxHintsPerTurn: 2,
    conceptTags: [],
    frameworks: [],
  });

  const toggleTradeoff = (id: string) => {
    setFormData((prev) => {
      const current = prev.tradeoffs;
      if (current.includes(id)) {
        return { ...prev, tradeoffs: current.filter((t) => t !== id) };
      } else if (current.length < 2) {
        return { ...prev, tradeoffs: [...current, id] };
      }
      return prev;
    });
  };

  const addConceptTag = () => {
    const val = conceptInput.trim();
    if (val && !formData.conceptTags.includes(val) && formData.conceptTags.length < 8) {
      setFormData((prev) => ({ ...prev, conceptTags: [...prev.conceptTags, val] }));
      setConceptInput("");
    }
  };

  const removeConceptTag = (i: number) => {
    setFormData((prev) => ({
      ...prev,
      conceptTags: prev.conceptTags.filter((_, idx) => idx !== i),
    }));
  };

  const addFramework = () => {
    const name = frameworkNameInput.trim();
    if (
      name &&
      formData.frameworks.length < 8 &&
      !formData.frameworks.some((f) => f.name.toLowerCase() === name.toLowerCase())
    ) {
      const newFw: CaseFramework = {
        id: `fw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        domainKeywords: [],
      };
      setFormData((prev) => ({ ...prev, frameworks: [...prev.frameworks, newFw] }));
      setFrameworkNameInput("");
    }
  };

  const removeFramework = (i: number) => {
    setFormData((prev) => ({
      ...prev,
      frameworks: prev.frameworks.filter((_, idx) => idx !== i),
    }));
  };

  const addKeywordToFramework = (fwIdx: number, keyword: string) => {
    const val = keyword.trim().toLowerCase();
    if (!val) return;
    setFormData((prev) => {
      const updated = [...prev.frameworks];
      const fw = updated[fwIdx];
      if (fw.domainKeywords.includes(val)) return prev;
      updated[fwIdx] = { ...fw, domainKeywords: [...fw.domainKeywords, val] };
      return { ...prev, frameworks: updated };
    });
  };

  const removeKeywordFromFramework = (fwIdx: number, kwIdx: number) => {
    setFormData((prev) => {
      const updated = [...prev.frameworks];
      const fw = updated[fwIdx];
      updated[fwIdx] = {
        ...fw,
        domainKeywords: fw.domainKeywords.filter((_, i) => i !== kwIdx),
      };
      return { ...prev, frameworks: updated };
    });
  };

  const buildPayload = (isPublished: boolean) => {
    const isEn = language === "en";
    const tradeoffParts: string[] = [];
    if (formData.customTradeoff.trim()) {
      tradeoffParts.push(formData.customTradeoff.trim());
    }
    const challengeLabel = isEn ? "Core Challenge" : "Desafío Central";
    const introText = formData.caseContext +
      (tradeoffParts.length > 0
        ? `\n\n**${challengeLabel}:**\n${tradeoffParts.join("\n")}`
        : "");

    const SCENARIO_OBJECTIVE_LABELS: Record<string, { es: string; en: string }> = {
      decision_making: { es: "Toma de decisiones", en: "Decision making" },
      crisis_management: { es: "Gestión de crisis", en: "Crisis management" },
      strategic_thinking: { es: "Pensamiento estratégico", en: "Strategic thinking" },
      leadership: { es: "Liderazgo", en: "Leadership" },
      negotiation: { es: "Negociación", en: "Negotiation" },
      ethical_dilemmas: { es: "Dilemas éticos", en: "Ethical dilemmas" },
    };
    const defaultObjective = isEn ? "Make strategic decisions" : "Tomar decisiones estratégicas";
    const objective = formData.scenarioObjective && SCENARIO_OBJECTIVE_LABELS[formData.scenarioObjective]
      ? SCENARIO_OBJECTIVE_LABELS[formData.scenarioObjective][language]
      : defaultObjective;

    const stakeholders = formData.stakeholders
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        role: "",
        interests: "",
        influence: "medium" as const,
      }));

    const defaultRole = isEn ? "Professional" : "Profesional";
    const untitledDraft = isEn ? "Untitled draft" : "Borrador sin título";
    const draftDescription = isEn ? "Case in development" : "Caso en desarrollo";

    return {
      title: isPublished ? formData.title : (formData.title || untitledDraft),
      description: formData.caseContext.slice(0, 200) || (isPublished ? "" : draftDescription),
      domain: disciplineToDomain(formData.discipline),
      courseConcepts: formData.conceptTags.length > 0 ? formData.conceptTags : undefined,
      initialState: {
        role: formData.studentRole || defaultRole,
        objective,
        introText,
        kpis: {
          revenue: 65,
          morale: 70,
          reputation: 75,
          efficiency: 60,
          trust: 72,
        },
        caseContext: formData.caseContext || undefined,
        coreChallenge: formData.customTradeoff.trim() || undefined,
        reflectionPrompt: formData.reflectionPrompt.trim() || undefined,
        totalDecisions: formData.stepCount,
        difficultyLevel: levelToDifficulty(formData.targetLevel),
        keyConstraints: formData.restrictions
          ? [formData.restrictions]
          : undefined,
        learningObjectives: formData.learningObjectives
          ? formData.learningObjectives.split("\n").map((s) => s.trim()).filter(Boolean)
          : undefined,
        stakeholders: stakeholders.length > 0 ? stakeholders : undefined,
        hintButtonEnabled: formData.hintButtonEnabled,
        maxHintsPerTurn: formData.maxHintsPerTurn,
        frameworks: formData.frameworks.length > 0 ? formData.frameworks : undefined,
      },
      isPublished,
      language,
    };
  };

  const handleError = (error: unknown, isPublished: boolean) => {
    if (isUnauthorizedError(error as Error)) {
      toast({
        title: t("manualCase.sessionExpired"),
        description: t("manualCase.pleaseLoginAgain"),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
    toast({
      title: t("common.error"),
      description: isPublished
        ? t("manualCase.couldNotPublish")
        : t("manualCase.couldNotSave"),
      variant: "destructive",
    });
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scenarios", buildPayload(false));
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t("manualCase.draftSaved"), description: t("manualCase.draftSavedDesc") });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onSuccess();
    },
    onError: (error) => handleError(error, false),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scenarios", buildPayload(true));
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t("manualCase.casePublished"), description: t("manualCase.casePublishedDesc") });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onSuccess();
    },
    onError: (error) => handleError(error, true),
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
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h2 className="font-semibold">{t("manualCase.createManually")}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-manual-creator"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Case Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="title">{t("manualCase.caseTitle")}</Label>
            <HelpIcon content={t("manualCase.caseTitleHelp")} />
          </div>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t("manualCase.caseTitlePlaceholder")}
            data-testid="input-case-title"
          />
        </div>

        {/* Simulation Language */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>{t("common.simulationLanguage")}</Label>
            <HelpIcon content={t("common.simulationLanguageHelp")} />
          </div>
          <Select value={language} onValueChange={(v) => setLanguage(v as "es" | "en")}>
            <SelectTrigger className="w-[200px]" data-testid="select-language-manual">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">{t("common.spanish")}</SelectItem>
              <SelectItem value="en">{t("common.english")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Discipline + Level */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t("manualCase.discipline")}</Label>
              <HelpIcon content={t("canonicalCase.disciplineHelp")} />
            </div>
            <Select
              value={formData.discipline}
              onValueChange={(v) => setFormData((p) => ({ ...p, discipline: v }))}
            >
              <SelectTrigger data-testid="select-manual-discipline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Negocios">{t("canonicalCase.business")}</SelectItem>
                <SelectItem value="Marketing">{t("canonicalCase.marketing")}</SelectItem>
                <SelectItem value="Finanzas">{t("canonicalCase.finance")}</SelectItem>
                <SelectItem value="Operaciones">{t("canonicalCase.operations")}</SelectItem>
                <SelectItem value="Recursos Humanos">{t("canonicalCase.humanResources")}</SelectItem>
                <SelectItem value="Estrategia">{t("canonicalCase.strategy")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t("manualCase.level")}</Label>
              <HelpIcon content={t("canonicalCase.levelHelp")} />
            </div>
            <Select
              value={formData.targetLevel}
              onValueChange={(v) => setFormData((p) => ({ ...p, targetLevel: v }))}
            >
              <SelectTrigger data-testid="select-manual-target-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pregrado">{t("canonicalCase.undergraduate")}</SelectItem>
                <SelectItem value="Posgrado">{t("canonicalCase.graduate")}</SelectItem>
                <SelectItem value="Ejecutivo">{t("canonicalCase.executive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scenario Objective */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>{t("manualCase.scenarioObjective")}</Label>
            <HelpIcon content={t("canonicalCase.objectiveHelp")} />
          </div>
          <Select
            value={formData.scenarioObjective}
            onValueChange={(v) => setFormData((p) => ({ ...p, scenarioObjective: v }))}
          >
            <SelectTrigger data-testid="select-manual-scenario-objective">
              <SelectValue placeholder={t("manualCase.selectObjective")} />
            </SelectTrigger>
            <SelectContent>
              {SCENARIO_OBJECTIVES.map((obj) => (
                <SelectItem key={obj.id} value={obj.id}>
                  {t(obj.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Case Context */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="context">{t("manualCase.caseContext")}</Label>
            <HelpIcon content={t("manualCase.caseContextHelp")} />
            <Badge variant="secondary" className="text-xs">{t("common.required")}</Badge>
          </div>
          <Textarea
            id="context"
            value={formData.caseContext}
            onChange={(e) => setFormData((prev) => ({ ...prev, caseContext: e.target.value }))}
            placeholder={t("manualCase.caseContextFullPlaceholder")}
            className="min-h-[120px]"
            data-testid="input-case-context"
          />
        </div>

        {/* Student Role */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="role">{t("manualCase.studentRole")}</Label>
            <HelpIcon content={t("manualCase.studentRoleHelp")} />
            <Badge variant="secondary" className="text-xs">{t("common.required")}</Badge>
          </div>
          <Input
            id="role"
            value={formData.studentRole}
            onChange={(e) => setFormData((prev) => ({ ...prev, studentRole: e.target.value }))}
            placeholder={t("manualCase.studentRolePlaceholder")}
            data-testid="input-student-role"
          />
        </div>

        {/* Tradeoff Focus */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>{t("manualCase.tradeoffFocus")}</Label>
            <HelpIcon content={t("manualCase.tradeoffHelp")} />
            <Badge variant="secondary" className="text-xs">{t("manualCase.choose1or2")}</Badge>
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
                } ${
                  formData.tradeoffs.length >= 2 && !formData.tradeoffs.includes(option.id)
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                onClick={() => toggleTradeoff(option.id)}
                data-testid={`chip-tradeoff-${option.id}`}
              >
                {t(option.labelKey)}
              </Badge>
            ))}
          </div>
          <Input
            value={formData.customTradeoff}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, customTradeoff: e.target.value }))
            }
            placeholder={t("manualCase.customTradeoff")}
            data-testid="input-custom-tradeoff"
          />
          {formData.tradeoffs.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("manualCase.selectTradeoff")}</p>
          )}
        </div>

        {/* Standard Indicators (Read-only) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            <Label>{t("manualCase.simulationIndicators")}</Label>
            <HelpIcon content={t("manualCase.indicatorsHelp")} />
          </div>
          <div className="flex flex-wrap gap-2">
            {STANDARD_INDICATORS.map((indicator) => (
              <Badge
                key={indicator.id}
                variant="secondary"
                className="cursor-default"
                data-testid={`chip-indicator-${indicator.id}`}
              >
                {t(indicator.labelKey)}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("manualCase.standardIndicators")}</p>
        </div>

        {/* Simulation Settings (Collapsed) */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-testid="button-toggle-settings"
            >
              <span className="font-medium text-muted-foreground">
                {t("manualCase.settingsSection")}
              </span>
              {settingsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-4">
            {/* Number of Decisions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t("manualCase.numberOfDecisions")}</Label>
                <HelpIcon content={t("manualCase.decisionsHelp")} />
              </div>
              <Select
                value={String(formData.stepCount)}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, stepCount: Number(v) }))
                }
              >
                <SelectTrigger className="w-[200px]" data-testid="select-manual-step-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, i) => i + 3).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {t("common.decisions")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reflection Prompt */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="reflection">{t("manualCase.reflectionPrompt")}</Label>
                <HelpIcon content={t("manualCase.reflectionHelp")} />
                <Badge variant="outline" className="text-xs">{t("common.optional")}</Badge>
              </div>
              <Textarea
                id="reflection"
                value={formData.reflectionPrompt}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, reflectionPrompt: e.target.value }))
                }
                placeholder={t("manualCase.reflectionPlaceholder")}
                className="min-h-[60px]"
                data-testid="input-reflection-prompt"
              />
            </div>

            {/* Hint Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>{t("manualCase.hintSettings")}</Label>
                <HelpIcon content={t("manualCase.hintHelp")} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hint-toggle">{t("manualCase.hintButton")}</Label>
                <Switch
                  id="hint-toggle"
                  checked={formData.hintButtonEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, hintButtonEnabled: checked }))
                  }
                  data-testid="switch-manual-hint-enabled"
                />
              </div>
              {formData.hintButtonEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="max-hints">{t("manualCase.maxHints")}</Label>
                  <Select
                    value={String(formData.maxHintsPerTurn)}
                    onValueChange={(v) =>
                      setFormData((p) => ({
                        ...p,
                        maxHintsPerTurn: Number(v) as 1 | 2 | 3 | 4 | 5,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="max-hints"
                      className="w-[120px]"
                      data-testid="select-manual-max-hints"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Course Concepts */}
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <Label>{t("manualCase.courseConcepts")}</Label>
                <HelpIcon content={t("manualCase.courseConceptsDesc")} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("manualCase.courseConceptsDesc")}
              </p>
              <div className="flex gap-2">
                <Input
                  value={conceptInput}
                  onChange={(e) => setConceptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addConceptTag();
                    }
                  }}
                  placeholder={t("manualCase.conceptPlaceholder")}
                  disabled={formData.conceptTags.length >= 8}
                  data-testid="input-manual-concept-tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={
                    !conceptInput.trim() ||
                    formData.conceptTags.includes(conceptInput.trim()) ||
                    formData.conceptTags.length >= 8
                  }
                  onClick={addConceptTag}
                  data-testid="button-manual-add-concept-tag"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.conceptTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.conceptTags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="gap-1 pr-1"
                      data-testid={`badge-manual-concept-${index}`}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeConceptTag(index)}
                        className="ml-1 rounded-full p-0.5"
                        data-testid={`button-manual-remove-concept-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {formData.conceptTags.length > 0 && formData.conceptTags.length < 3 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("manualCase.minConceptsWarning")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.conceptTags.length}/8 {t("manualCase.concepts")}
              </p>
            </div>

            {/* Frameworks */}
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <Label>{t("manualCase.frameworks")}</Label>
                <HelpIcon content={t("manualCase.frameworksDesc")} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("manualCase.frameworksDesc")}
              </p>
              <div className="flex gap-2">
                <Input
                  value={frameworkNameInput}
                  onChange={(e) => setFrameworkNameInput(e.target.value)}
                  placeholder={t("manualCase.frameworkNamePlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFramework();
                    }
                  }}
                  disabled={formData.frameworks.length >= 8}
                  data-testid="input-manual-framework-name"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={
                    !frameworkNameInput.trim() ||
                    formData.frameworks.length >= 8 ||
                    formData.frameworks.some(
                      (f) =>
                        f.name.toLowerCase() === frameworkNameInput.trim().toLowerCase()
                    )
                  }
                  onClick={addFramework}
                  data-testid="button-manual-add-framework"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.frameworks.length > 0 && (
                <div className="space-y-2">
                  {formData.frameworks.map((fw, idx) => (
                    <div
                      key={fw.id}
                      className="border rounded-md p-3 space-y-2"
                      data-testid={`manual-framework-card-${idx}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{fw.name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFramework(idx)}
                          data-testid={`button-manual-remove-framework-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">{t("manualCase.keywords")}</Label>
                        <div className="flex flex-wrap gap-1 mt-1 items-center">
                          {fw.domainKeywords.map((kw, kwIdx) => (
                            <Badge
                              key={kwIdx}
                              variant="secondary"
                              data-testid={`badge-manual-keyword-${idx}-${kwIdx}`}
                            >
                              {kw}
                              <button
                                type="button"
                                className="ml-1"
                                onClick={() => removeKeywordFromFramework(idx, kwIdx)}
                                data-testid={`button-manual-remove-keyword-${idx}-${kwIdx}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                          <Input
                            className="w-32 h-7 text-xs"
                            placeholder={t("manualCase.addKeyword")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const target = e.target as HTMLInputElement;
                                addKeywordToFramework(idx, target.value);
                                target.value = "";
                              }
                            }}
                            data-testid={`input-manual-keyword-${idx}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.frameworks.length}/8
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Optional Fields (Collapsed) */}
        <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-testid="button-toggle-optional"
            >
              <span className="font-medium text-muted-foreground">
                {t("manualCase.optionalFields")}
              </span>
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
                <Label htmlFor="restrictions">{t("manualCase.constraints")}</Label>
                <HelpIcon content={t("manualCase.constraintsHelp")} />
                <Badge variant="outline" className="text-xs">{t("common.optional")}</Badge>
              </div>
              <Textarea
                id="restrictions"
                value={formData.restrictions}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, restrictions: e.target.value }))
                }
                placeholder={t("manualCase.constraintsPlaceholder")}
                className="min-h-[80px]"
                data-testid="input-restrictions"
              />
            </div>

            {/* Learning Objectives */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="objectives">{t("manualCase.learningObjectives")}</Label>
                <HelpIcon content={t("manualCase.objectivesHelp")} />
                <Badge variant="outline" className="text-xs">{t("common.optional")}</Badge>
              </div>
              <Textarea
                id="objectives"
                value={formData.learningObjectives}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, learningObjectives: e.target.value }))
                }
                placeholder={t("manualCase.learningObjectivesPlaceholder")}
                className="min-h-[80px]"
                data-testid="input-learning-objectives"
              />
            </div>

            {/* Stakeholders */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="stakeholders">{t("manualCase.keyStakeholders")}</Label>
                <HelpIcon content={t("manualCase.stakeholdersHelp")} />
                <Badge variant="outline" className="text-xs">{t("common.recommended")}</Badge>
              </div>
              <Textarea
                id="stakeholders"
                value={formData.stakeholders}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, stakeholders: e.target.value }))
                }
                placeholder={t("manualCase.keyStakeholdersPlaceholder")}
                className="min-h-[80px]"
                data-testid="input-stakeholders"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

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
              {t("common.saving")}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t("common.saveDraft")}
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
              {t("common.publishing")}
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {t("common.publish")}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
