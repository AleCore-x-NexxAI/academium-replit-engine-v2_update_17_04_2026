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
import { useTranslation } from "@/contexts/LanguageContext";

interface ManualCaseCreatorProps {
  onSuccess: () => void;
  onClose: () => void;
}

const STANDARD_INDICATORS = [
  { id: "revenue", labelKey: "indicators.revenueBudget" },
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
  const { t } = useTranslation();
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
        title: formData.title || t("manualCase.untitledDraft"),
        description: formData.caseContext.slice(0, 200) || t("manualCase.caseInDevelopment"),
        domain: t("manualCase.business"),
        initialState: {
          role: formData.studentRole || t("manualCase.professional"),
          objective: t("manualCase.makeStrategicDecisions"),
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
      toast({ title: t("manualCase.draftSaved"), description: t("manualCase.draftSavedDesc") });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: t("manualCase.sessionExpired"), description: t("manualCase.pleaseLoginAgain"), variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: t("common.error"), description: t("manualCase.couldNotSave"), variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scenarios", {
        title: formData.title,
        description: formData.caseContext.slice(0, 200),
        domain: t("manualCase.business"),
        initialState: {
          role: formData.studentRole || t("manualCase.professional"),
          objective: t("manualCase.makeStrategicDecisions"),
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
      toast({ title: t("manualCase.casePublished"), description: t("manualCase.casePublishedDesc") });
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios/authored"] });
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: t("manualCase.sessionExpired"), description: t("manualCase.pleaseLoginAgain"), variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: t("common.error"), description: t("manualCase.couldNotPublish"), variant: "destructive" });
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

      {/* Scrollable Form Content */}
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
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder={t("manualCase.caseTitlePlaceholder")}
            data-testid="input-case-title"
          />
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
            onChange={(e) => setFormData(prev => ({ ...prev, caseContext: e.target.value }))}
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
            onChange={(e) => setFormData(prev => ({ ...prev, studentRole: e.target.value }))}
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
                } ${formData.tradeoffs.length >= 2 && !formData.tradeoffs.includes(option.id) ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => toggleTradeoff(option.id)}
                data-testid={`chip-tradeoff-${option.id}`}
              >
                {t(option.labelKey)}
              </Badge>
            ))}
          </div>
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
          <p className="text-xs text-muted-foreground">
            {t("manualCase.standardIndicators")}
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
              <span className="font-medium text-muted-foreground">{t("manualCase.optionalFields")}</span>
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
                onChange={(e) => setFormData(prev => ({ ...prev, restrictions: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, learningObjectives: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, stakeholders: e.target.value }))}
                placeholder={t("manualCase.keyStakeholdersPlaceholder")}
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
