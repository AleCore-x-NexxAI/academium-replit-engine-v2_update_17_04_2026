import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  Lightbulb,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HelpIcon } from "@/components/HelpIcon";
import { DecisionDimensionsEditor } from "@/components/DecisionDimensionsEditor";
import { useTranslation } from "@/contexts/LanguageContext";
import type { GeneratedScenarioData, DecisionPoint, Indicator, CaseFramework, AcademicDimension } from "@shared/schema";
import { Trash2, BookMarked } from "lucide-react";
import { customCanonicalId } from "@/lib/customCanonicalId";

interface RegistryFramework {
  canonicalId: string;
  canonicalName: string;
  aliases: string[];
  disciplines: string[];
  primaryDimension: string;
  conceptualDescription: string;
  coreConcepts: string[];
  disciplineDescriptions?: Record<string, string>;
}

interface SelectedFramework {
  canonicalId: string;
  name: string;
  discipline: string;
  isCustom?: boolean;
}

const DISCIPLINE_ORDER = ["business", "marketing", "finance", "operations", "human_resources", "strategy"] as const;

const DISCIPLINE_LABELS_MAP: Record<string, { en: string; es: string }> = {
  business: { en: "Business", es: "Negocios" },
  marketing: { en: "Marketing", es: "Marketing" },
  finance: { en: "Finance", es: "Finanzas" },
  operations: { en: "Operations", es: "Operaciones" },
  human_resources: { en: "Human Resources", es: "Recursos Humanos" },
  strategy: { en: "Strategy", es: "Estrategia" },
};

const MAX_DISCIPLINES = 2;
const MAX_FRAMEWORKS = 3;

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
  hintButtonEnabled: boolean;
  maxHintsPerTurn: 1 | 2 | 3 | 4 | 5;
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
  const [teachingGoal, setTeachingGoal] = useState("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<SelectedFramework[]>([]);
  const [customFrameworkActive, setCustomFrameworkActive] = useState<Record<string, boolean>>({});
  const [customFrameworkInputs, setCustomFrameworkInputs] = useState<Record<string, string>>({});
  const [professorNotes, setProfessorNotes] = useState("");
  const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
  const [intentCompetencies, setIntentCompetencies] = useState<Array<"C1" | "C2" | "C3" | "C4" | "C5">>([]);
  const [intentDimensions, setIntentDimensions] = useState<
    Array<{ decisionNumber: number; primaryDimension: AcademicDimension; secondaryDimension?: AcademicDimension }>
  >([]);
  const [courseContext, setCourseContext] = useState("");
  const [reasoningConstraint, setReasoningConstraint] = useState("");
  const [targetLevel, setTargetLevel] = useState("Pregrado");
  const [stepCount, setStepCount] = useState(3);
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [canonicalCase, setCanonicalCase] = useState<CanonicalCaseData | null>(null);
  const [scenarioData, setScenarioData] = useState<GeneratedScenarioData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [conceptTags, setConceptTags] = useState<string[]>([]);
  const [conceptTagInput, setConceptTagInput] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [frameworks, setFrameworks] = useState<CaseFramework[]>([]);
  const [frameworkNameInput, setFrameworkNameInput] = useState("");
  const [keywordSuggestions, setKeywordSuggestions] = useState<Record<string, string[]>>({});
  const [suggestingKeywords, setSuggestingKeywords] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const { data: registryData } = useQuery<RegistryFramework[]>({
    queryKey: ["/api/frameworks/registry", language],
    queryFn: async () => {
      const res = await fetch(`/api/frameworks/registry?language=${language}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  const registryByDiscipline = useCallback(() => {
    if (!registryData) return {};
    const groups: Record<string, RegistryFramework[]> = {};
    for (const d of DISCIPLINE_ORDER) groups[d] = [];
    for (const fw of registryData) {
      for (const d of fw.disciplines) {
        if (groups[d]) groups[d].push(fw);
      }
    }
    return groups;
  }, [registryData]);

  const fetchKeywordSuggestions = useCallback(async (fw: CaseFramework) => {
    setSuggestingKeywords(prev => ({ ...prev, [fw.id]: true }));
    try {
      const caseContext = scenarioData ? `${scenarioData.title || ""} ${scenarioData.description || ""}`.trim() : "";
      const res = await apiRequest("POST", "/api/scenarios/suggest-framework-keywords", {
        frameworkName: fw.name,
        caseContext: caseContext || undefined,
        language,
      });
      const data = await res.json();
      setKeywordSuggestions(prev => ({ ...prev, [fw.id]: data.keywords || [] }));
      if (data.signalPattern) {
        setFrameworks(prev => prev.map(f =>
          f.id === fw.id ? { ...f, signalPattern: f.signalPattern || data.signalPattern } : f
        ));
      }
    } catch {
      toast({ title: language === "en" ? "Could not fetch keyword suggestions" : "No se pudieron obtener sugerencias", variant: "destructive" });
    } finally {
      setSuggestingKeywords(prev => ({ ...prev, [fw.id]: false }));
    }
  }, [language, scenarioData, toast]);
  const { t, language: appLanguage } = useTranslation();

  useEffect(() => {
    setLanguage(appLanguage as "es" | "en");
  }, [appLanguage]);

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

  const toggleDiscipline = useCallback((disc: string) => {
    setSelectedDisciplines(prev => {
      const exists = prev.includes(disc);
      if (exists) {
        // Remove frameworks tied only to this discipline.
        setSelectedFrameworks(fwPrev => fwPrev.filter(f => f.discipline !== disc));
        setCustomFrameworkActive(c => ({ ...c, [disc]: false }));
        setCustomFrameworkInputs(c => ({ ...c, [disc]: "" }));
        return prev.filter(d => d !== disc);
      }
      if (prev.length >= MAX_DISCIPLINES) return prev;
      return [...prev, disc];
    });
  }, []);

  const toggleFramework = useCallback((fw: { canonicalId: string; canonicalName: string }, discipline: string) => {
    setSelectedFrameworks(prev => {
      const exists = prev.some(f => f.canonicalId === fw.canonicalId);
      if (exists) return prev.filter(f => f.canonicalId !== fw.canonicalId);
      if (prev.length >= MAX_FRAMEWORKS) return prev;
      return [...prev, { canonicalId: fw.canonicalId, name: fw.canonicalName, discipline }];
    });
  }, []);

  const removeFramework = useCallback((canonicalId: string) => {
    setSelectedFrameworks(prev => {
      const removed = prev.find(f => f.canonicalId === canonicalId);
      if (removed?.isCustom) {
        setCustomFrameworkInputs(c => ({ ...c, [removed.discipline]: "" }));
        setCustomFrameworkActive(c => ({ ...c, [removed.discipline]: false }));
      }
      return prev.filter(f => f.canonicalId !== canonicalId);
    });
  }, []);

  const commitCustomFramework = useCallback(async (discipline: string) => {
    const name = (customFrameworkInputs[discipline] ?? "").trim();
    if (!name) return;
    if (selectedFrameworks.some(f => f.discipline === discipline && f.isCustom)) return;
    if (selectedFrameworks.length >= MAX_FRAMEWORKS) return;
    const id = await customCanonicalId(name);
    setSelectedFrameworks(prev => {
      if (prev.some(f => f.canonicalId === id)) return prev;
      if (prev.length >= MAX_FRAMEWORKS) return prev;
      return [...prev, { canonicalId: id, name, discipline, isCustom: true }];
    });
  }, [customFrameworkInputs, selectedFrameworks]);

  const COMPETENCY_LABELS: Record<"C1" | "C2" | "C3" | "C4" | "C5", string> = {
    C1: language === "en" ? "C1 Analytical" : "C1 Analítica",
    C2: language === "en" ? "C2 Strategic" : "C2 Estratégica",
    C3: language === "en" ? "C3 Stakeholder" : "C3 Stakeholder",
    C4: language === "en" ? "C4 Ethical" : "C4 Ética",
    C5: language === "en" ? "C5 Trade-off" : "C5 Trade-off",
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/canonical-case/generate", {
        topic,
        targetLevel,
        stepCount,
        language,
        pedagogicalIntent: {
          teachingGoal: teachingGoal.trim(),
          targetFrameworks: selectedFrameworks.map(f => ({ canonicalId: f.canonicalId, name: f.name })),
          targetCompetencies: intentCompetencies,
          decisionDimensions: intentDimensions.length > 0 ? intentDimensions : undefined,
          targetDisciplines: selectedDisciplines,
          courseContext: courseContext.trim() || undefined,
          reasoningConstraint: reasoningConstraint.trim() || undefined,
          professorNotes: professorNotes.trim() || undefined,
        },
      });
      return response.json() as Promise<GenerateResponse>;
    },
    onSuccess: (data) => {
      setIsEditing(false);
      setDraftId(data.draft.id);
      setCanonicalCase({ ...data.canonicalCase, hintButtonEnabled: data.canonicalCase.hintButtonEnabled ?? true, maxHintsPerTurn: data.canonicalCase.maxHintsPerTurn ?? 2 });
      setScenarioData(data.scenarioData);
      if (data.scenarioData?.courseConcepts?.length) {
        setConceptTags(data.scenarioData.courseConcepts);
      } else if (data.canonicalCase?.learningObjectives?.length) {
        setConceptTags(data.canonicalCase.learningObjectives.slice(0, 5));
      }
      const aiFrameworks = data.scenarioData?.initialState?.frameworks ?? [];
      if (aiFrameworks.length > 0) {
        setFrameworks(aiFrameworks.slice(0, 8));
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
      const dataWithConcepts = {
        ...scenarioData,
        courseConcepts: conceptTags.length > 0 ? conceptTags : undefined,
        initialState: {
          ...scenarioData.initialState,
          frameworks: frameworks.length > 0 ? frameworks : undefined,
        },
      };
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

  const [unreviewedDecisions, setUnreviewedDecisions] = useState<number[]>([]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!draftId || !scenarioData) throw new Error("No draft to publish");
      const dataWithConcepts = {
        ...scenarioData,
        courseConcepts: conceptTags.length > 0 ? conceptTags : undefined,
        initialState: {
          ...scenarioData.initialState,
          frameworks: frameworks.length > 0 ? frameworks : undefined,
        },
      };
      await apiRequest("PUT", `/api/canonical-case/${draftId}`, { scenarioData: dataWithConcepts });
      const response = await apiRequest("POST", `/api/drafts/${draftId}/publish`, { language });
      return response.json();
    },
    onSuccess: () => {
      setUnreviewedDecisions([]);
      toast({
        title: t("canonicalCase.casePublished"),
        description: t("canonicalCase.casePublishedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onScenarioPublished();
    },
    onError: (error: Error) => {
      const match = error.message.match(/^409:\s*(.+)$/);
      if (match) {
        try {
          const body = JSON.parse(match[1]);
          if (Array.isArray(body.unreviewedDecisionNumbers) && body.unreviewedDecisionNumbers.length > 0) {
            setUnreviewedDecisions(body.unreviewedDecisionNumbers);
            const nums = body.unreviewedDecisionNumbers.join(", ");
            toast({
              title: t("common.error"),
              description: t("canonicalCase.unreviewedDecisions").replace("{numbers}", nums),
              variant: "destructive",
            });
            return;
          }
        } catch { /* fall through to generic */ }
      }
      toast({
        title: t("common.error"),
        description: t("canonicalCase.couldNotPublish"),
        variant: "destructive",
      });
    },
  });

  const markAllReviewedMutation = useMutation({
    mutationFn: async () => {
      if (!draftId) throw new Error("No draft");
      const decisions = unreviewedDecisions.length > 0
        ? unreviewedDecisions
        : (scenarioData?.initialState?.decisionPoints || [])
            .filter((d) => !d.reviewCompleted)
            .map((d) => d.number);
      for (const num of decisions) {
        await apiRequest("PATCH", `/api/drafts/${draftId}/decisions/${num}/review`, { reviewCompleted: true });
      }
    },
    onSuccess: () => {
      setUnreviewedDecisions([]);
      if (scenarioData?.initialState?.decisionPoints) {
        const updatedPoints = scenarioData.initialState.decisionPoints.map((d) => ({
          ...d,
          reviewCompleted: true,
        }));
        setScenarioData({
          ...scenarioData,
          initialState: {
            ...scenarioData.initialState,
            decisionPoints: updatedPoints,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/canonical-case", draftId] });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("canonicalCase.couldNotMarkReviewed"),
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
      const challengeLabel = language === "en" ? "Core Challenge" : "Desafío Central";
      const introText = `${newCaseContext}\n\n**${challengeLabel}:**\n${newCoreChallenge}`;
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
    } else if (field === "role" || field === "objective" || field === "hintButtonEnabled" || field === "maxHintsPerTurn") {
      setScenarioData({
        ...scenarioData,
        initialState: { ...scenarioData.initialState, [field]: value },
      });
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
            <Card className="p-5 border-primary/40 space-y-4" data-testid="panel-pedagogical-intent">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold">
                  {language === "en" ? "Teaching intent" : "Intención pedagógica"}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {language === "en"
                  ? "Tell us what students should learn. This anchors case generation, framework inference, and runtime feedback."
                  : "Cuéntanos qué deben aprender los estudiantes. Esto ancla la generación del caso, la inferencia de frameworks y la retroalimentación en tiempo real."}
              </p>

              <div className="space-y-2">
                <Label htmlFor="teaching-goal" className="text-sm font-semibold">
                  {language === "en" ? "Teaching goal *" : "Objetivo de enseñanza *"}
                </Label>
                <Textarea
                  id="teaching-goal"
                  value={teachingGoal}
                  onChange={(e) => setTeachingGoal(e.target.value)}
                  placeholder={language === "en"
                    ? "e.g., Students should learn to apply Porter's Five Forces to evaluate market entry."
                    : "ej.: Los estudiantes deben aprender a aplicar las 5 Fuerzas de Porter para evaluar la entrada a un mercado."}
                  className="min-h-[80px]"
                  data-testid="input-teaching-goal"
                />
                {showValidation && teachingGoal.trim().length < 20 && (
                  <p className="text-xs text-destructive mt-1" data-testid="error-teaching-goal">
                    {t("canonicalCase.validationTeachingGoalRequired")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">
                      {language === "en" ? "Target frameworks (optional)" : "Frameworks objetivo (opcional)"}
                    </Label>
                    <HelpIcon content={t("canonicalCase.pickerHelp")} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid="counter-disciplines">
                      {t("canonicalCase.disciplineCounter")}: {selectedDisciplines.length} / {MAX_DISCIPLINES}
                    </Badge>
                    <Badge variant="secondary" data-testid="counter-frameworks">
                      {t("canonicalCase.frameworkCounter")}: {selectedFrameworks.length} / {MAX_FRAMEWORKS}
                    </Badge>
                  </div>
                </div>

                <div className="border rounded-md divide-y">
                  {DISCIPLINE_ORDER.map((disc) => {
                    const groups = registryByDiscipline();
                    const fws = groups[disc] ?? [];
                    const isExpanded = !!expandedDisciplines[disc];
                    const discLabel = DISCIPLINE_LABELS_MAP[disc]?.[language] ?? disc;
                    const discSelected = selectedDisciplines.includes(disc);
                    const discAtCap = selectedDisciplines.length >= MAX_DISCIPLINES;
                    const fwAtCap = selectedFrameworks.length >= MAX_FRAMEWORKS;
                    const selectedInGroup = selectedFrameworks.filter(f => f.discipline === disc).length;
                    const customActive = !!customFrameworkActive[disc];
                    const hasCustomSelected = selectedFrameworks.some(f => f.discipline === disc && f.isCustom);

                    return (
                      <div key={disc} data-testid={`picker-group-${disc}`}>
                        <div className="flex items-center gap-2 p-3">
                          <Checkbox
                            checked={discSelected}
                            disabled={!discSelected && discAtCap}
                            onCheckedChange={() => toggleDiscipline(disc)}
                            data-testid={`checkbox-discipline-${disc}`}
                          />
                          <button
                            type="button"
                            className="flex-1 flex items-center justify-between text-left"
                            onClick={() => setExpandedDisciplines(prev => ({ ...prev, [disc]: !prev[disc] }))}
                            data-testid={`button-expand-${disc}`}
                          >
                            <span className="text-sm font-medium">{discLabel}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {fws.length} {language === "en" ? "frameworks" : "marcos"}
                                {selectedInGroup > 0 && ` · ${selectedInGroup} ${language === "en" ? "selected" : "sel."}`}
                              </span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="pl-8 pr-3 pb-3 space-y-1">
                            {!discSelected && (
                              <p className="text-xs text-muted-foreground italic py-1">
                                {t("canonicalCase.selectDisciplineFirst")}
                              </p>
                            )}
                            {fws.map((fw) => {
                              const selectedInThisDiscipline = selectedFrameworks.some(f => f.canonicalId === fw.canonicalId && f.discipline === disc);
                              const selectedElsewhere = selectedFrameworks.some(f => f.canonicalId === fw.canonicalId && f.discipline !== disc);
                              const fwSelected = selectedInThisDiscipline || selectedElsewhere;
                              const disabled = !discSelected || selectedElsewhere || (!fwSelected && fwAtCap);
                              const rawDesc = fw.disciplineDescriptions?.[disc] ?? fw.conceptualDescription;
                              const truncDesc = rawDesc.length > 140
                                ? rawDesc.slice(0, 137) + "..."
                                : rawDesc;
                              const otherDisc = selectedElsewhere
                                ? selectedFrameworks.find(f => f.canonicalId === fw.canonicalId && f.discipline !== disc)?.discipline ?? ""
                                : "";
                              const otherDiscLabel = selectedElsewhere
                                ? (DISCIPLINE_LABELS_MAP[otherDisc]?.[language] ?? otherDisc)
                                : "";
                              const nameSpanClass = `text-sm flex-1 ${disabled && !selectedInThisDiscipline ? "opacity-50" : ""}`;
                              return (
                                <div
                                  key={fw.canonicalId}
                                  className={`flex items-center gap-2 py-1 ${selectedElsewhere ? "opacity-40" : ""}`}
                                  data-testid={`picker-fw-${fw.canonicalId}`}
                                >
                                  <Checkbox
                                    checked={selectedInThisDiscipline}
                                    disabled={disabled}
                                    onCheckedChange={() => toggleFramework(fw, disc)}
                                    data-testid={`checkbox-fw-${fw.canonicalId}`}
                                  />
                                  {selectedElsewhere ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`${nameSpanClass} cursor-help`}>
                                          {fw.canonicalName}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs text-xs">
                                        {t("canonicalCase.frameworkAlreadySelectedElsewhere", { discipline: otherDiscLabel })}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className={nameSpanClass}>
                                      {fw.canonicalName}
                                    </span>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0 cursor-help" data-testid={`tooltip-fw-info-${fw.canonicalId}`} />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs text-xs">
                                      <p>{truncDesc}</p>
                                      <p className="mt-1 text-muted-foreground">
                                        {fw.coreConcepts.slice(0, 4).join(", ")}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              );
                            })}

                            {/* Other / Otro row */}
                            <div className="flex items-center gap-2 py-1" data-testid={`picker-fw-other-${disc}`}>
                              <Checkbox
                                checked={customActive || hasCustomSelected}
                                disabled={!discSelected || (!customActive && !hasCustomSelected && fwAtCap)}
                                onCheckedChange={(checked) => {
                                  const next = !!checked;
                                  setCustomFrameworkActive(prev => ({ ...prev, [disc]: next }));
                                  if (!next && hasCustomSelected) {
                                    setSelectedFrameworks(prev => prev.filter(f => !(f.discipline === disc && f.isCustom)));
                                    setCustomFrameworkInputs(prev => ({ ...prev, [disc]: "" }));
                                  }
                                }}
                                data-testid={`checkbox-fw-other-${disc}`}
                              />
                              <span className={`text-sm font-medium ${!discSelected ? "opacity-50" : ""}`}>
                                {t("canonicalCase.otherFramework")}
                              </span>
                            </div>
                            {discSelected && (customActive || hasCustomSelected) && !hasCustomSelected && (
                              <div className="pl-8 pb-1">
                                <Input
                                  value={customFrameworkInputs[disc] ?? ""}
                                  onChange={(e) => setCustomFrameworkInputs(prev => ({ ...prev, [disc]: e.target.value }))}
                                  onBlur={() => commitCustomFramework(disc)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitCustomFramework(disc);
                                    }
                                  }}
                                  placeholder={t("canonicalCase.otherFrameworkPlaceholder")}
                                  disabled={selectedFrameworks.length >= MAX_FRAMEWORKS}
                                  data-testid={`input-fw-other-${disc}`}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {showValidation && selectedDisciplines.length === 0 && (
                  <p className="text-xs text-destructive mt-1" data-testid="error-disciplines">
                    {t("canonicalCase.validationDisciplineRequired")}
                  </p>
                )}

                {selectedFrameworks.length >= MAX_FRAMEWORKS && (
                  <p className="text-xs text-muted-foreground mt-1" data-testid="text-frameworks-at-cap">
                    {t("canonicalCase.frameworksAtCap")}
                  </p>
                )}

                {(selectedDisciplines.length > 0 || selectedFrameworks.length > 0) && registryData && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedDisciplines.map((disc) => {
                      const label = DISCIPLINE_LABELS_MAP[disc]?.[language] ?? disc;
                      return (
                        <Badge key={`d-${disc}`} variant="secondary" className="gap-1 pr-1">
                          {label}
                          <button
                            type="button"
                            onClick={() => toggleDiscipline(disc)}
                            className="ml-1 rounded-full p-0.5"
                            data-testid={`button-remove-discipline-${disc}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    {selectedFrameworks.map((sel) => {
                      const fw = !sel.isCustom ? registryData.find(r => r.canonicalId === sel.canonicalId) : null;
                      const rawSelDesc = fw ? (fw.disciplineDescriptions?.[sel.discipline] ?? fw.conceptualDescription) : "";
                      const truncDesc = rawSelDesc.length > 120
                        ? rawSelDesc.slice(0, 117) + "..."
                        : rawSelDesc;
                      return (
                        <Card
                          key={`f-${sel.canonicalId}`}
                          className="p-3 space-y-1 w-full"
                          data-testid={`preview-card-${sel.canonicalId}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{sel.name}</span>
                              {sel.isCustom && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {t("canonicalCase.customLabel")}
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeFramework(sel.canonicalId)}
                              data-testid={`button-remove-picker-${sel.canonicalId}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          {fw && (
                            <>
                              <p className="text-xs text-muted-foreground">{truncDesc}</p>
                              <div className="flex flex-wrap gap-1">
                                {fw.coreConcepts.slice(0, 4).map((c, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {c}
                                  </Badge>
                                ))}
                              </div>
                            </>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="professor-notes" className="text-sm font-semibold">
                  {t("canonicalCase.professorNotes")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("canonicalCase.professorNotesHelp")}
                </p>
                <Textarea
                  id="professor-notes"
                  value={professorNotes}
                  onChange={(e) => setProfessorNotes(e.target.value.slice(0, 500))}
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                  data-testid="input-professor-notes"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {language === "en" ? "Target competencies (optional)" : "Competencias objetivo (opcional)"}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(["C1", "C2", "C3", "C4", "C5"] as const).map((c) => {
                    const selected = intentCompetencies.includes(c);
                    return (
                      <Badge
                        key={c}
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setIntentCompetencies(prev =>
                          selected ? prev.filter(x => x !== c) : [...prev, c]
                        )}
                        data-testid={`chip-competency-${c}`}
                      >
                        {selected && <Check className="w-3 h-3 mr-1" />}
                        {COMPETENCY_LABELS[c]}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="course-context" className="text-sm font-semibold">
                    {language === "en" ? "Course context *" : "Contexto del curso *"}
                  </Label>
                  <Textarea
                    id="course-context"
                    value={courseContext}
                    onChange={(e) => setCourseContext(e.target.value)}
                    placeholder={language === "en" ? "e.g., 2nd year MBA Strategy — students have covered basic financial analysis and market sizing." : "ej.: Estrategia MBA 2do año — los estudiantes han cubierto análisis financiero básico y dimensionamiento de mercado."}
                    className="min-h-[60px]"
                    data-testid="input-course-context"
                  />
                  {showValidation && courseContext.trim().length < 20 && (
                    <p className="text-xs text-destructive mt-1" data-testid="error-course-context">
                      {t("canonicalCase.validationCourseContextRequired")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reasoning-constraint" className="text-sm font-semibold">
                    {language === "en" ? "Reasoning constraint (optional)" : "Restricción de razonamiento (opcional)"}
                  </Label>
                  <Input
                    id="reasoning-constraint"
                    value={reasoningConstraint}
                    onChange={(e) => setReasoningConstraint(e.target.value)}
                    placeholder={language === "en" ? "e.g., Must justify with quantitative evidence" : "ej.: Debe justificar con evidencia cuantitativa"}
                    data-testid="input-reasoning-constraint"
                  />
                </div>
              </div>

              <DecisionDimensionsEditor
                value={intentDimensions}
                onChange={setIntentDimensions}
                language={language}
                stepCount={stepCount}
                testIdPrefix="creator"
              />
            </Card>

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
              {showValidation && topic.trim().length === 0 && (
                <p className="text-xs text-destructive mt-1" data-testid="error-topic">
                  {t("canonicalCase.validationTopicRequired")}
                </p>
              )}
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

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t("common.simulationLanguage")}</Label>
                <HelpIcon content={t("common.simulationLanguageHelp")} />
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

            <div className="pt-4">
              <Button
                onClick={() => {
                  const valid = topic.trim().length > 0
                    && teachingGoal.trim().length >= 20
                    && selectedDisciplines.length > 0
                    && courseContext.trim().length >= 20;
                  if (!valid) {
                    setShowValidation(true);
                    return;
                  }
                  setShowValidation(false);
                  generateMutation.mutate();
                }}
                disabled={generateMutation.isPending}
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
              setTeachingGoal("");
              setSelectedDisciplines([]);
              setSelectedFrameworks([]);
              setCustomFrameworkActive({});
              setCustomFrameworkInputs({});
              setProfessorNotes("");
              setIntentCompetencies([]);
              setIntentDimensions([]);
              setCourseContext("");
              setReasoningConstraint("");
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

          <EditableSection title={language === "en" ? "Hint Settings" : "Configuración de Pistas"} icon={Lightbulb} defaultExpanded={true}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="hint-toggle">{language === "en" ? "Hint button" : "Botón de pista"}</Label>
                <Switch
                  id="hint-toggle"
                  checked={canonicalCase.hintButtonEnabled}
                  onCheckedChange={(checked) => updateField("hintButtonEnabled", checked)}
                  disabled={!isEditing}
                  data-testid="switch-hint-enabled"
                />
              </div>
              {canonicalCase.hintButtonEnabled && (
                <div>
                  <Label htmlFor="max-hints">{language === "en" ? "Max hints per decision" : "Pistas máximas por decisión"}</Label>
                  <Select
                    value={String(canonicalCase.maxHintsPerTurn)}
                    onValueChange={(val) => updateField("maxHintsPerTurn", Number(val) as 1 | 2 | 3 | 4 | 5)}
                    disabled={!isEditing}
                  >
                    <SelectTrigger id="max-hints" className="mt-1" data-testid="select-max-hints">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </EditableSection>

          <EditableSection title={language === "en" ? "Analytical Frameworks" : "Marcos Analíticos"} icon={BookMarked} defaultExpanded={false}>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {language === "en"
                  ? "Add up to 8 theoretical/analytical frameworks students might apply (e.g., SWOT, Porter's Five Forces, Stakeholder Analysis). The engine will detect when students reference them."
                  : "Agrega hasta 8 marcos teóricos/analíticos que los estudiantes podrían aplicar (ej: FODA, Cinco Fuerzas de Porter, Análisis de Stakeholders). El motor detectará cuando los estudiantes los referencien."}
              </p>
              <div className="flex gap-2">
                <Input
                  value={frameworkNameInput}
                  onChange={(e) => setFrameworkNameInput(e.target.value)}
                  placeholder={language === "en" ? "Framework name..." : "Nombre del marco..."}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = frameworkNameInput.trim();
                      if (name && frameworks.length < 8 && !frameworks.some(f => f.name.toLowerCase() === name.toLowerCase())) {
                        const newFw: CaseFramework = {
                          id: `fw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          name,
                          domainKeywords: [],
                        };
                        setFrameworks([...frameworks, newFw]);
                        setFrameworkNameInput("");
                        fetchKeywordSuggestions(newFw);
                      }
                    }
                  }}
                  disabled={!isEditing || frameworks.length >= 8}
                  data-testid="input-framework-name"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isEditing || !frameworkNameInput.trim() || frameworks.length >= 8 || frameworks.some(f => f.name.toLowerCase() === frameworkNameInput.trim().toLowerCase())}
                  onClick={() => {
                    const name = frameworkNameInput.trim();
                    if (name && frameworks.length < 8) {
                      const newFw: CaseFramework = {
                        id: `fw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        name,
                        domainKeywords: [],
                      };
                      setFrameworks([...frameworks, newFw]);
                      setFrameworkNameInput("");
                      fetchKeywordSuggestions(newFw);
                    }
                  }}
                  data-testid="button-add-framework"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {frameworks.length > 0 && (
                <div className="space-y-2">
                  {frameworks.map((fw, idx) => (
                    <div key={fw.id} className="border rounded-md p-3 space-y-2" data-testid={`framework-card-${idx}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{fw.name}</span>
                        <div className="flex items-center gap-1">
                          {isEditing && (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={suggestingKeywords[fw.id]}
                              onClick={() => fetchKeywordSuggestions(fw)}
                              data-testid={`button-suggest-keywords-${idx}`}
                            >
                              {suggestingKeywords[fw.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                            </Button>
                          )}
                          {isEditing && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setFrameworks(frameworks.filter((_, i) => i !== idx));
                                setKeywordSuggestions(prev => { const n = { ...prev }; delete n[fw.id]; return n; });
                              }}
                              data-testid={`button-remove-framework-${idx}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">{language === "en" ? "Keywords" : "Palabras clave"}</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fw.domainKeywords.map((kw, kwIdx) => (
                            <Badge key={kwIdx} variant="secondary" data-testid={`badge-keyword-${idx}-${kwIdx}`}>
                              {kw}
                              {isEditing && (
                                <button
                                  className="ml-1"
                                  onClick={() => {
                                    const updated = [...frameworks];
                                    updated[idx] = { ...fw, domainKeywords: fw.domainKeywords.filter((_, ki) => ki !== kwIdx) };
                                    setFrameworks(updated);
                                  }}
                                  data-testid={`button-remove-keyword-${idx}-${kwIdx}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </Badge>
                          ))}
                          {isEditing && (
                            <Input
                              className="w-32 h-7 text-xs"
                              placeholder={language === "en" ? "Add keyword..." : "Agregar..."}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
                                  if (val && !fw.domainKeywords.includes(val)) {
                                    const updated = [...frameworks];
                                    updated[idx] = { ...fw, domainKeywords: [...fw.domainKeywords, val] };
                                    setFrameworks(updated);
                                    (e.target as HTMLInputElement).value = "";
                                  }
                                }
                              }}
                              data-testid={`input-keyword-${idx}`}
                            />
                          )}
                        </div>
                      </div>

                      {isEditing && keywordSuggestions[fw.id] && keywordSuggestions[fw.id].length > 0 && (
                        <div data-testid={`suggestions-${idx}`}>
                          <Label className="text-xs text-muted-foreground">
                            {language === "en" ? "Suggested keywords (click to add)" : "Sugerencias (clic para agregar)"}
                          </Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {keywordSuggestions[fw.id]
                              .filter(s => !fw.domainKeywords.includes(s.toLowerCase()))
                              .map((suggestion, sIdx) => (
                                <Badge
                                  key={sIdx}
                                  variant="outline"
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const val = suggestion.toLowerCase();
                                    if (!fw.domainKeywords.includes(val)) {
                                      const updated = [...frameworks];
                                      updated[idx] = { ...fw, domainKeywords: [...fw.domainKeywords, val] };
                                      setFrameworks(updated);
                                    }
                                  }}
                                  data-testid={`badge-suggestion-${idx}-${sIdx}`}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  {suggestion}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}

                      {suggestingKeywords[fw.id] && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`loading-suggestions-${idx}`}>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {language === "en" ? "Fetching keyword suggestions..." : "Obteniendo sugerencias..."}
                        </div>
                      )}

                      {isEditing && (
                        <div className="border-t pt-2 space-y-2" data-testid={`signal-pattern-${idx}`}>
                          <Label className="text-xs">{language === "en" ? "Signal Pattern (implicit detection)" : "Patrón de señales (detección implícita)"}</Label>
                          <div className="flex flex-wrap gap-2">
                            {(["intent", "justification", "tradeoffAwareness", "stakeholderAwareness", "ethicalAwareness"] as const).map(signal => {
                              const active = fw.signalPattern?.requiredSignals?.includes(signal) ?? false;
                              const signalLabels: Record<string, string> = {
                                intent: language === "en" ? "Intent" : "Intención",
                                justification: language === "en" ? "Justification" : "Justificación",
                                tradeoffAwareness: language === "en" ? "Tradeoff" : "Compensación",
                                stakeholderAwareness: language === "en" ? "Stakeholder" : "Stakeholders",
                                ethicalAwareness: language === "en" ? "Ethical" : "Ético",
                              };
                              return (
                                <Badge
                                  key={signal}
                                  variant={active ? "default" : "outline"}
                                  className="cursor-pointer toggle-elevate"
                                  onClick={() => {
                                    const current = fw.signalPattern?.requiredSignals || [];
                                    const newSignals = active
                                      ? current.filter(s => s !== signal)
                                      : [...current, signal] as typeof current;
                                    const updated = [...frameworks];
                                    updated[idx] = {
                                      ...fw,
                                      signalPattern: {
                                        requiredSignals: newSignals,
                                        minQuality: fw.signalPattern?.minQuality || "PRESENT",
                                      },
                                    };
                                    setFrameworks(updated);
                                  }}
                                  data-testid={`badge-signal-${idx}-${signal}`}
                                >
                                  {signalLabels[signal]}
                                </Badge>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">{language === "en" ? "Min Quality" : "Calidad mín."}</Label>
                            <Select
                              value={fw.signalPattern?.minQuality || "PRESENT"}
                              onValueChange={(val) => {
                                const updated = [...frameworks];
                                updated[idx] = {
                                  ...fw,
                                  signalPattern: {
                                    requiredSignals: fw.signalPattern?.requiredSignals || [],
                                    minQuality: val as "WEAK" | "PRESENT" | "STRONG",
                                  },
                                };
                                setFrameworks(updated);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-min-quality-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="WEAK">{language === "en" ? "Weak" : "Débil"}</SelectItem>
                                <SelectItem value="PRESENT">{language === "en" ? "Present" : "Presente"}</SelectItem>
                                <SelectItem value="STRONG">{language === "en" ? "Strong" : "Fuerte"}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{frameworks.length}/8 {language === "en" ? "frameworks" : "marcos"}</p>
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
            {unreviewedDecisions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => markAllReviewedMutation.mutate()}
                disabled={markAllReviewedMutation.isPending}
                data-testid="button-mark-all-reviewed"
              >
                {markAllReviewedMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {markAllReviewedMutation.isPending
                  ? t("canonicalCase.markingReviewed")
                  : t("canonicalCase.markAllReviewed")}
              </Button>
            )}
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || markAllReviewedMutation.isPending}
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
