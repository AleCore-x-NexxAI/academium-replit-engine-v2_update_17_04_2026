import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  BookOpen, 
  Target,
  Building2,
  User,
  MessageSquare,
  Send,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

const INITIAL_INDICATOR_VALUES: Record<string, number> = {
  revenue: 65,
  morale: 70,
  reputation: 75,
  efficiency: 60,
  trust: 72,
};

const DEMO_INDICATOR_CHANGES: Record<number, Record<string, number>> = {
  1: { morale: -5, trust: 10, reputation: 5 },
  2: { revenue: -10, efficiency: 5, trust: 8 },
  3: { revenue: 5, reputation: 10, morale: 8 },
};

interface HistoryEntry {
  role: "system" | "user" | "npc";
  content: string;
  timestamp: Date;
}

export default function DemoSimulation() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const indicatorLabels: Record<string, string> = {
    revenue: t("demoSimulation.indicatorRevenue"),
    morale: t("demoSimulation.indicatorMorale"),
    reputation: t("demoSimulation.indicatorReputation"),
    efficiency: t("demoSimulation.indicatorEfficiency"),
    trust: t("demoSimulation.indicatorTrust"),
  };

  const [currentDecision, setCurrentDecision] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      role: "system",
      content: t("demoSimulation.scenarioContext"),
      timestamp: new Date(),
    },
  ]);
  const [indicators, setIndicators] = useState([
    { id: "revenue", label: t("demoSimulation.indicatorRevenue"), value: 65, previousValue: 65 },
    { id: "morale", label: t("demoSimulation.indicatorMorale"), value: 70, previousValue: 70 },
    { id: "reputation", label: t("demoSimulation.indicatorReputation"), value: 75, previousValue: 75 },
    { id: "efficiency", label: t("demoSimulation.indicatorEfficiency"), value: 60, previousValue: 60 },
    { id: "trust", label: t("demoSimulation.indicatorTrust"), value: 72, previousValue: 72 },
  ]);
  const [selectedOption, setSelectedOption] = useState("");
  const [writtenResponse, setWrittenResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const [inputWarning, setInputWarning] = useState<{ title: string; message: string } | null>(null);
  const [currentRationale, setCurrentRationale] = useState<Record<string, string[]> | null>(null);
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  const decisions = [
    {
      id: 1,
      title: t("demoSimulation.decision1Title"),
      prompt: t("demoSimulation.decision1Prompt"),
      format: "multiple_choice" as const,
      options: [
        { id: "A", text: t("demoSimulation.decision1OptionA") },
        { id: "B", text: t("demoSimulation.decision1OptionB") },
        { id: "C", text: t("demoSimulation.decision1OptionC") },
        { id: "D", text: t("demoSimulation.decision1OptionD") },
      ],
    },
    {
      id: 2,
      title: t("demoSimulation.decision2Title"),
      prompt: t("demoSimulation.decision2Prompt"),
      format: "written" as const,
      placeholder: t("demoSimulation.decision2Placeholder"),
    },
    {
      id: 3,
      title: t("demoSimulation.decision3Title"),
      prompt: t("demoSimulation.decision3Prompt"),
      format: "written" as const,
      placeholder: t("demoSimulation.decision3Placeholder"),
    },
  ];

  const getTranslatedRationale = (decisionNum: number): Record<string, string[]> => {
    switch (decisionNum) {
      case 1: return {
        morale: [t("demoSimulation.r1MoraleA"), t("demoSimulation.r1MoraleB")],
        trust: [t("demoSimulation.r1TrustA"), t("demoSimulation.r1TrustB"), t("demoSimulation.r1TrustC")],
        reputation: [t("demoSimulation.r1ReputationA"), t("demoSimulation.r1ReputationB")],
      };
      case 2: return {
        revenue: [t("demoSimulation.r2RevenueA"), t("demoSimulation.r2RevenueB")],
        efficiency: [t("demoSimulation.r2EfficiencyA"), t("demoSimulation.r2EfficiencyB")],
        trust: [t("demoSimulation.r2TrustA"), t("demoSimulation.r2TrustB")],
      };
      case 3: return {
        revenue: [t("demoSimulation.r3RevenueA"), t("demoSimulation.r3RevenueB")],
        reputation: [t("demoSimulation.r3ReputationA"), t("demoSimulation.r3ReputationB"), t("demoSimulation.r3ReputationC")],
        morale: [t("demoSimulation.r3MoraleA"), t("demoSimulation.r3MoraleB"), t("demoSimulation.r3MoraleC")],
      };
      default: return {};
    }
  };

  const getNarrative = (decisionNum: number): string => {
    switch (decisionNum) {
      case 1: return t("demoSimulation.narrative1");
      case 2: return t("demoSimulation.narrative2");
      case 3: return t("demoSimulation.narrative3");
      default: return "";
    }
  };

  const getFeedback = (decisionNum: number): string => {
    switch (decisionNum) {
      case 1: return t("demoSimulation.feedback1");
      case 2: return t("demoSimulation.feedback2");
      case 3: return t("demoSimulation.feedback3");
      default: return "";
    }
  };

  const validateInput = (input: string): { valid: boolean; title?: string; message?: string } => {
    const trimmedInput = input.trim().toLowerCase();
    
    if (!trimmedInput || trimmedInput.length < 5) {
      return { 
        valid: false, 
        title: t("demoSimulation.needMoreDetail"),
        message: t("demoSimulation.needMoreDetailMsg"),
      };
    }

    const offensivePatterns = [
      /\b(idiota|pendejo|estupido|tonto|imbecil|mierda|carajo|puta|joder|cabron|maldito)\b/i,
      /\b(idiot|stupid|dumb|ass|fuck|shit|damn|bastard)\b/i,
    ];
    
    for (const pattern of offensivePatterns) {
      if (pattern.test(trimmedInput)) {
        return { 
          valid: false, 
          title: t("demoSimulation.keepProfessional"),
          message: t("demoSimulation.keepProfessionalMsg"),
        };
      }
    }

    const caseKeywords = ["equipo", "lanzamiento", "producto", "decision", "cliente", "empresa", "vulnerabilidad", 
                          "seguridad", "riesgo", "comunicar", "ceo", "ventas", "marketing", "estrategia", "proyecto",
                          "plan", "opcion", "alternativa", "solucion", "problema", "impacto", "resultado", "tiempo",
                          "recurso", "presupuesto", "stakeholder", "reputacion", "confianza", "moral", "eficiencia",
                          "team", "launch", "product", "decision", "customer", "company", "vulnerability",
                          "security", "risk", "communicate", "sales", "strategy", "project",
                          "option", "alternative", "solution", "problem", "impact", "result", "time",
                          "resource", "budget", "reputation", "trust", "morale", "efficiency"];
    
    const hasRelevantContent = caseKeywords.some(keyword => trimmedInput.includes(keyword)) || trimmedInput.length > 30;
    
    if (!hasRelevantContent) {
      return { 
        valid: false, 
        title: t("demoSimulation.needMoreDetail"),
        message: t("demoSimulation.needMoreDetailMsg"),
      };
    }

    return { valid: true };
  };

  const handleSubmitDecision = useCallback(async () => {
    if (currentDecision >= decisions.length) return;
    
    const decision = decisions[currentDecision];
    const userResponse = decision.format === "multiple_choice" 
      ? decision.options?.find(o => o.id === selectedOption)?.text || ""
      : writtenResponse;
    
    if (!userResponse.trim()) return;

    if (decision.format !== "multiple_choice") {
      const validation = validateInput(userResponse);
      if (!validation.valid) {
        setInputWarning({
          title: validation.title || t("demoSimulation.needMoreDetail"),
          message: validation.message || t("demoSimulation.provideValidResponse"),
        });
        return;
      }
    }

    setInputWarning(null);
    setIsProcessing(true);
    setCurrentFeedback(null);

    setHistory(prev => [...prev, {
      role: "user" as const,
      content: userResponse,
      timestamp: new Date(),
    }]);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const decisionNum = currentDecision + 1;
    const indicatorChanges = DEMO_INDICATOR_CHANGES[decisionNum] || {};
    
    setHistory(prev => [...prev, {
      role: "npc" as const,
      content: getNarrative(decisionNum),
      timestamp: new Date(),
    }]);

    setIndicators(prev => prev.map(ind => ({
      ...ind,
      previousValue: ind.value,
      value: ind.value + (indicatorChanges[ind.id] || 0),
    })));

    setCurrentFeedback(getFeedback(decisionNum));
    setCurrentRationale(getTranslatedRationale(decisionNum));
    setExpandedIndicator(null);
    setIsProcessing(false);
    setSelectedOption("");
    setWrittenResponse("");

    if (currentDecision + 1 >= decisions.length) {
      setIsComplete(true);
    } else {
      setCurrentDecision(prev => prev + 1);
    }
  }, [currentDecision, selectedOption, writtenResponse, t]);

  const currentDecisionData = decisions[currentDecision];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-[1000]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/explore">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <span className="font-semibold text-sm" data-testid="text-demo-title">
                {t("demoSimulation.scenarioTitle")}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="w-3 h-3" />
                {t("demoSimulation.demoMode")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {t("demoSimulation.noDataSaved")}
            </Badge>
            <Badge variant="secondary">
              {t("demoSimulation.decisionOf", { current: Math.min(currentDecision + 1, decisions.length), total: decisions.length })}
            </Badge>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="w-72 border-r bg-muted/30 p-4 hidden lg:block">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("demoSimulation.roleLabel")}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-primary" />
                {t("demoSimulation.scenarioRole")}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("demoSimulation.organizationLabel")}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-primary" />
                {t("demoSimulation.scenarioCompany")}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("demoSimulation.objectiveLabel")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("demoSimulation.scenarioObjective")}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("demoSimulation.progressLabel")}
              </h3>
              <Progress 
                value={(currentDecision / decisions.length) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isComplete ? t("demoSimulation.completedLabel") : t("demoSimulation.decisionsCount", { current: currentDecision, total: decisions.length })}
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col lg:flex-row">
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-2xl mx-auto space-y-4">
                <AnimatePresence mode="popLayout">
                  {history.map((entry, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-4 rounded-lg ${
                        entry.role === "user" 
                          ? "bg-primary/10 ml-8" 
                          : entry.role === "system"
                          ? "bg-muted border"
                          : "bg-card border mr-8"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {entry.role === "system" && (
                          <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        )}
                        {entry.role === "npc" && (
                          <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">
                            {entry.role === "user" ? t("demoSimulation.yourDecision") : entry.role === "system" ? t("demoSimulation.contextLabel") : t("demoSimulation.resultLabel")}
                          </p>
                          <p className="text-sm whitespace-pre-line">{entry.content}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 rounded-lg bg-muted border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="animate-pulse flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-muted-foreground">{t("demoSimulation.processingDecision")}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {!isComplete && currentDecisionData && (
              <div className="border-t p-6 bg-background">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="p-5 rounded-xl bg-primary/5 border-2 border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-5 h-5 text-primary" />
                      <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                        {t("demoSimulation.yourDecisionNow")}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold mb-3" data-testid="text-decision-title">
                      {currentDecisionData.title}
                    </h3>
                    <p className="text-base text-foreground leading-relaxed" data-testid="text-decision-prompt">
                      {currentDecisionData.prompt}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {currentDecisionData.format === "multiple_choice" && currentDecisionData.options && (
                      <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="space-y-3">
                        {currentDecisionData.options.map((option) => (
                          <div
                            key={option.id}
                            className="flex items-start gap-4 p-4 rounded-lg border-2 hover-elevate cursor-pointer transition-all data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                            onClick={() => setSelectedOption(option.id)}
                            data-state={selectedOption === option.id ? "checked" : "unchecked"}
                          >
                            <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                            <Label htmlFor={option.id} className="text-base cursor-pointer flex-1 leading-relaxed">
                              <span className="font-semibold text-primary">{option.id}.</span> {option.text}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {currentDecisionData.format === "written" && (
                      <Textarea
                        value={writtenResponse}
                        onChange={(e) => {
                          setWrittenResponse(e.target.value);
                          if (inputWarning) setInputWarning(null);
                        }}
                        placeholder={currentDecisionData.placeholder || t("demoSimulation.writeYourResponse")}
                        rows={5}
                        className="resize-none text-base"
                        data-testid="input-written-response"
                      />
                    )}

                    {inputWarning && (
                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30" data-testid="text-input-warning">
                        <div className="flex items-start gap-3">
                          <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{inputWarning.title}</p>
                            <p className="text-sm text-muted-foreground">{inputWarning.message}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSubmitDecision}
                      disabled={isProcessing || (currentDecisionData.format === "multiple_choice" ? !selectedOption : !writtenResponse.trim())}
                      className="w-full h-12 text-base"
                      data-testid="button-submit-decision"
                    >
                      {isProcessing ? (
                        t("demoSimulation.processingText")
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          {t("demoSimulation.sendDecision")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isComplete && (
              <div className="flex-1 overflow-auto p-6 bg-background">
                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold" data-testid="text-summary-title">
                      {t("demoSimulation.summaryTitle")}
                    </h2>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                      {t("demoSimulation.summaryDesc")}
                    </p>
                  </div>

                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        {t("demoSimulation.finalIndicators")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {indicators.slice(0, 4).map((indicator) => {
                          const totalChange = indicator.value - INITIAL_INDICATOR_VALUES[indicator.id];
                          return (
                            <div key={indicator.id} className="p-4 rounded-lg bg-muted/50 space-y-2">
                              <p className="text-sm text-muted-foreground">{indicatorLabels[indicator.id] || indicator.label}</p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold">{indicator.value}%</span>
                                {totalChange !== 0 && (
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs ${
                                      totalChange > 0 
                                        ? "bg-green-500/15 text-green-700" 
                                        : "bg-red-500/15 text-red-700"
                                    }`}
                                  >
                                    {totalChange > 0 ? "+" : ""}{totalChange}
                                  </Badge>
                                )}
                              </div>
                              <Progress 
                                value={indicator.value} 
                                className={`h-2 ${totalChange > 0 ? "[&>div]:bg-green-500" : totalChange < 0 ? "[&>div]:bg-red-500" : ""}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        {t("demoSimulation.yourDecisions")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {history.filter(h => h.role === "user").map((decision, index) => (
                          <div key={index} className="flex gap-4 items-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium mb-1">{t("demoSimulation.decisionN", { n: index + 1 })}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {decision.content.length > 150 
                                  ? decision.content.substring(0, 150) + "..." 
                                  : decision.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="text-center p-6 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-lg font-medium mb-2">
                      {t("demoSimulation.completedSuccess")}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      {t("demoSimulation.completedSuccessDesc")}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Button 
                      onClick={() => {
                        const historySection = document.querySelector('[data-testid="simulation-history"]');
                        if (historySection) {
                          historySection.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="min-w-[200px]"
                      data-testid="button-review-decisions"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {t("demoSimulation.reviewDecisions")}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate("/")}
                      className="min-w-[200px]"
                      data-testid="button-back-home"
                    >
                      {t("demoSimulation.backToHome")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="w-96 border-l bg-muted/20 p-6 hidden xl:block">
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-semibold uppercase tracking-wide text-muted-foreground mb-6">
                  {t("demoSimulation.indicatorsTitle")}
                </h3>
                <div className="space-y-5">
                  {indicators.map((indicator) => {
                    const change = indicator.value - indicator.previousValue;
                    const hasRationale = currentRationale && currentRationale[indicator.id];
                    const isExpanded = expandedIndicator === indicator.id;
                    
                    return (
                      <div key={indicator.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-medium">{indicatorLabels[indicator.id] || indicator.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">{indicator.value}%</span>
                            {change !== 0 && (
                              <Badge 
                                variant="secondary" 
                                className={`text-sm px-2 py-0.5 ${
                                  change > 0 
                                    ? "bg-green-500/15 text-green-700 border-green-500/30" 
                                    : "bg-red-500/15 text-red-700 border-red-500/30"
                                }`}
                              >
                                {change > 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                                {change > 0 ? "+" : ""}{change}
                              </Badge>
                            )}
                            {change === 0 && (
                              <Badge variant="secondary" className="text-sm px-2 py-0.5">
                                <Minus className="w-3.5 h-3.5 mr-1" />
                                0
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Progress 
                          value={indicator.value} 
                          className={`h-3 ${change > 0 ? "[&>div]:bg-green-500" : change < 0 ? "[&>div]:bg-red-500" : ""}`}
                        />
                        
                        {hasRationale && change !== 0 && (
                          <div className="pt-1">
                            <button
                              onClick={() => setExpandedIndicator(isExpanded ? null : indicator.id)}
                              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                              data-testid={`button-why-${indicator.id}`}
                            >
                              <HelpCircle className="w-4 h-4" />
                              <span>{t("demoSimulation.whyChanged")}</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            
                            <AnimatePresence>
                              {isExpanded && currentRationale[indicator.id] && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <ul className="mt-3 space-y-2 pl-1">
                                    {currentRationale[indicator.id].map((reason, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-2" />
                                        <span>{reason}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {currentFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h3 className="text-base font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                    {t("demoSimulation.observations")}
                  </h3>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-5">
                      <p className="text-base leading-relaxed">{currentFeedback}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
