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
import { useTranslation } from "@/contexts/LanguageContext";
import type { GeneratedScenarioData, DecisionPoint, Indicator } from "@shared/schema";

interface CanonicalCaseCreatorProps {
  onScenarioPublished: () => void;
  onClose: () => void;
}

export interface CanonicalCaseCreatorRef {
  handleBack: () => boolean;
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
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [canonicalCase, setCanonicalCase] = useState<CanonicalCaseData | null>(null);
  const [scenarioData, setScenarioData] = useState<GeneratedScenarioData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [conceptTags, setConceptTags] = useState<string[]>([]);
  const [conceptTagInput, setConceptTagInput] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      if (canonicalCase) {
        setCanonicalCase(null);
        setScenarioData(null);
        setDraftId(null);
        return true;
      }
      return false;
    }
  }));

  const SCENARIO_OBJECTIVES = [
    { id: "decision_making", labelKey: "scenarioObjectives.decisionMaking" },
    { id: "crisis_management", labelKey: "scenarioObjectives.crisisManagement" },
    { id: "strategic_thinking", labelKey: "scenarioObjectives.strategicThinking" },
    { id: "leadership", labelKey: "scenarioObjectives.leadership" },
    { id: "negotiation", labelKey: "scenarioObjectives.negotiation" },
    { id: "ethical_dilemmas", labelKey: "scenarioObjectives.ethicalDilemmas" },
  ];

  const TRADEOFF_OPTIONS = [
    { id: "cost_quality", labelKey: "tradeoffs.costVsQuality" },
    { id: "speed_accuracy", labelKey: "tradeoffs.speedVsPrecision" },
    { id: "short_long_term", labelKey: "tradeoffs.shortVsLong" },
    { id: "risk_reward", labelKey: "tradeoffs.riskVsReward" },
    { id: "individual_team", labelKey: "tradeoffs.individualVsTeam" },
    { id: "innovation_stability", labelKey: "tradeoffs.innovationVsStability" },
  ];

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
        language,
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
        title: t("canonicalCase.caseGenerated"),
        description: t("canonicalCase.caseGeneratedDesc"),
      });
    },
    onError: (error) => {
      console.error("Generation error:", error);
      toast({
        title: t("common.error"),
        description: t("canonicalCase.couldNotGenerate"),
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
        title: t("canonicalCase.changesSaved"),
        description: t("canonicalCase.changesSavedDesc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("canonicalCase.couldNotSave"),
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!draftId || !scenarioData) throw new Error("No draft to publish");
      const dataWithConcepts = { ...scenarioData, courseConcepts: conceptTags.length > 0 ? conceptTags : undefined };
      await apiRequest("PUT", `/api/canonical-case/${draftId}`, { scenarioData: dataWithConcepts });
      const response = await apiRequest("POST", `/api/drafts/${draftId}/publish`, { language });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("canonicalCase.casePublished"),
        description: t("canonicalCase.casePublishedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onScenarioPublished();
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("canonicalCase.couldNotPublish"),
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

  const toggleTradeoff = (id: string) => {
    if (tradeoffFocus.includes(id)) {
      setTradeoffFocus(tradeoffFocus.filter((t) => t !== id));
    } else {
      setTradeoffFocus([...tradeoffFocus, id]);
    }
  };

  if (!canonicalCase) {
    if (generateMutation.isPending) {
      return (
        <Card className="flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">{t("canonicalCase.generating")}</h2>
                <p className="text-muted-foreground">
                  {t("canonicalCase.generatingDesc")}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>{t("canonicalCase.creatingContext")}</span>
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
            <h3 className="font-semibold">{t("canonicalCase.createWithAI")}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-creator">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-8 max-w-xl mx-auto space-y-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="topic" className="text-base font-semibold">{t("canonicalCase.caseTopic")}</Label>
                <HelpIcon content={t("canonicalCase.caseTopicHelp")} />
              </div>
              <Textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t("canonicalCase.caseTopicPlaceholder")}
                className="min-h-[100px] text-base"
                data-testid="input-case-topic"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="discipline" className="text-base font-semibold">{t("canonicalCase.discipline")}</Label>
                  <HelpIcon content={t("canonicalCase.disciplineHelp")} />
                </div>
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger className="h-11" data-testid="select-discipline">
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

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="targetLevel" className="text-base font-semibold">{t("canonicalCase.level")}</Label>
                  <HelpIcon content={t("canonicalCase.levelHelp")} />
                </div>
                <Select value={targetLevel} onValueChange={setTargetLevel}>
                  <SelectTrigger className="h-11" data-testid="select-target-level">
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

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t("canonicalCase.scenarioObjective")}</Label>
                <HelpIcon content={t("canonicalCase.objectiveHelp")} />
              </div>
              <Select value={scenarioObjective} onValueChange={setScenarioObjective}>
                <SelectTrigger className="h-11" data-testid="select-scenario-objective">
                  <SelectValue placeholder={t("canonicalCase.selectObjective")} />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_OBJECTIVES.map((obj) => (
                    <SelectItem key={obj.id} value={obj.id}>{t(obj.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t("canonicalCase.simulationLanguage")}</Label>
                <HelpIcon content={t("canonicalCase.simulationLanguageHelp")} />
              </div>
              <Select value={language} onValueChange={(v) => setLanguage(v as "es" | "en")}>
                <SelectTrigger className="w-[200px]" data-testid="select-language-canonical">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">{t("common.spanish")}</SelectItem>
                  <SelectItem value="en">{t("common.english")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t("canonicalCase.numberOfDecisions")}</Label>
                <HelpIcon content={t("canonicalCase.decisionsHelp")} />
              </div>
              <Select value={String(stepCount)} onValueChange={(v) => setStepCount(Number(v))}>
                <SelectTrigger className="w-[200px]" data-testid="select-step-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, i) => i + 3).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {t("common.decisions")}{n === 3 ? ` (${t("canonicalCase.standardDecisions").replace(/decisiones? /, "").replace(/decisions? /, "")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t("canonicalCase.tradeoffFocus")}</Label>
                <HelpIcon content={t("canonicalCase.tradeoffHelp")} />
              </div>
              <p className="text-sm text-muted-foreground">{t("canonicalCase.tradeoffDesc")}</p>
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
                      {t(option.labelKey)}
                    </Badge>
                  );
                })}
              </div>
              <Input
                value={customTradeoff}
                onChange={(e) => setCustomTradeoff(e.target.value)}
                placeholder={t("canonicalCase.customTradeoff")}
                className="mt-2"
                data-testid="input-custom-tradeoff"
              />
            </div>

            <div className="pt-4">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!topic.trim()}
                className="w-full h-12 text-base"
                data-testid="button-generate-draft"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {t("canonicalCase.generateDraft")}
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-3">
                {t("canonicalCase.nothingPublished")}
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
          <h3 className="font-semibold">{t("canonicalCase.reviewCase")} {canonicalCase.title}</h3>
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
            {t("canonicalCase.newCase")}
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
              <span>{t("canonicalCase.viewMode")}</span>
            </div>
          )}

          <EditableSection title={t("canonicalCase.generalInfo")} icon={BookOpen}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">{t("canonicalCase.caseTitle")}</Label>
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
                <Label htmlFor="edit-description">{t("canonicalCase.description")}</Label>
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
                  <Label htmlFor="edit-role">{t("canonicalCase.studentRole")}</Label>
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
                  <Label htmlFor="edit-company">{t("canonicalCase.company")}</Label>
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

          <EditableSection title={t("canonicalCase.caseContext")} icon={BookOpen}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="edit-context">{t("canonicalCase.contextWordCount")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {canonicalCase.caseContext.split(/\s+/).filter(Boolean).length} {t("canonicalCase.words")}
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
                  {t("canonicalCase.harvardContextHint")}
                </p>
              </div>
              <div>
                <Label htmlFor="edit-challenge">{t("canonicalCase.coreChallenge")}</Label>
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
              title={`${t("canonicalCase.decisionLabel")} ${dp.number}: ${dp.number === 1 ? t("canonicalCase.orientation") : dp.number === canonicalCase.decisionPoints.length ? t("canonicalCase.integrative") : t("canonicalCase.analytical")}`}
              icon={Target}
              defaultExpanded={dpIndex === 0}
            >
              <div className="space-y-4">
                <div>
                  <Label>{t("canonicalCase.decisionQuestion")}</Label>
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
                    <Label>{t("canonicalCase.optionsDefensible")}</Label>
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
                      {t("canonicalCase.noCorrectAnswer")}
                    </p>
                  </div>
                )}

                {dp.format === "written" && (
                  <p className="text-sm text-muted-foreground">
                    {t("canonicalCase.writtenJustification")}
                  </p>
                )}
              </div>
            </EditableSection>
          ))}

          <EditableSection title={t("canonicalCase.finalReflection")} icon={MessageSquare} defaultExpanded={false}>
            <div>
              <Label htmlFor="edit-reflection">{t("canonicalCase.reflectionQuestion")}</Label>
              <Input
                id="edit-reflection"
                value={canonicalCase.reflectionPrompt}
                onChange={(e) => updateField("reflectionPrompt", e.target.value)}
                readOnly={!isEditing}
                className={`mt-1 ${!isEditing ? "opacity-70 cursor-default" : ""}`}
                data-testid="input-edit-reflection"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("canonicalCase.metacognitionPrompt")}
              </p>
            </div>
          </EditableSection>

          <EditableSection title={t("canonicalCase.learningObjectivesTitle")} icon={Target} defaultExpanded={false}>
            <div className="space-y-2">
              {canonicalCase.learningObjectives.map((obj, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">{index + 1}</Badge>
                  <span className="text-sm">{obj}</span>
                </div>
              ))}
            </div>
          </EditableSection>

          <EditableSection title={t("canonicalCase.courseConcepts")} icon={Tag} defaultExpanded={true}>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("canonicalCase.courseConceptsDesc")}
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
                  placeholder={t("canonicalCase.conceptPlaceholder")}
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
                  {t("canonicalCase.minConceptsWarning")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{conceptTags.length}/8 {t("canonicalCase.concepts")}</p>
            </div>
          </EditableSection>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="font-medium">{t("canonicalCase.pocIndicators")}</span>
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
              {t("common.cancel")}
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
              {t("canonicalCase.saveChanges")}
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
              {t("canonicalCase.editMode")}
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
              {t("canonicalCase.publishCase")}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
});

export default CanonicalCaseCreator;
