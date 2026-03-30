import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  ArrowLeft,
  Target,
  Building2,
  User,
  MessageSquare,
  Clock,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function ExploreExample() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const EXAMPLE_CASE = {
    title: t("exploreExample.scenarioTitle"),
    domain: t("exploreExample.domain"),
    duration: t("exploreExample.duration"),
    role: t("exploreExample.role"),
    company: t("exploreExample.company"),
    industry: t("exploreExample.industry"),
    context: t("exploreExample.context"),
    coreChallenge: t("exploreExample.challengeText"),
    constraints: [
      t("exploreExample.constraint1"),
      t("exploreExample.constraint2"),
      t("exploreExample.constraint3"),
      t("exploreExample.constraint4"),
    ],
    decisionPoints: [
      {
        id: 1,
        type: "multiple_choice",
        title: t("exploreExample.decision1Title"),
        description: t("exploreExample.decision1Desc"),
        preview: t("exploreExample.decision1Preview"),
      },
      {
        id: 2,
        type: "written",
        title: t("exploreExample.decision2Title"),
        description: t("exploreExample.decision2Desc"),
        preview: t("exploreExample.decision2Preview"),
      },
      {
        id: 3,
        type: "reflection",
        title: t("exploreExample.decision3Title"),
        description: t("exploreExample.decision3Desc"),
        preview: t("exploreExample.decision3Preview"),
      },
    ],
    indicators: [
      { id: "revenue", label: t("exploreExample.indicatorRevenue"), description: t("exploreExample.indicatorRevenueDesc") },
      { id: "morale", label: t("exploreExample.indicatorMorale"), description: t("exploreExample.indicatorMoraleDesc") },
      { id: "reputation", label: t("exploreExample.indicatorReputation"), description: t("exploreExample.indicatorReputationDesc") },
      { id: "efficiency", label: t("exploreExample.indicatorEfficiency"), description: t("exploreExample.indicatorEfficiencyDesc") },
      { id: "trust", label: t("exploreExample.indicatorTrust"), description: t("exploreExample.indicatorTrustDesc") },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-[1000]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-semibold" data-testid="text-preview-title">{t("exploreExample.simulationExample")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Badge variant="secondary" data-testid="badge-readonly">
              {t("exploreExample.readOnly")}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >

          <Card className="mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl mb-2" data-testid="text-example-title">
                    {EXAMPLE_CASE.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{EXAMPLE_CASE.domain}</Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {EXAMPLE_CASE.duration}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{t("exploreExample.yourRole")}</p>
                    <p className="text-sm text-muted-foreground">{EXAMPLE_CASE.role}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Building2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{t("exploreExample.organization")}</p>
                    <p className="text-sm text-muted-foreground">{EXAMPLE_CASE.company} • {EXAMPLE_CASE.industry}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {t("exploreExample.caseContext")}
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {EXAMPLE_CASE.context}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  {t("exploreExample.coreChallenge")}
                </h3>
                <p className="text-sm">{EXAMPLE_CASE.coreChallenge}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                {t("exploreExample.decisionPoints")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {EXAMPLE_CASE.decisionPoints.map((decision, index) => (
                <div
                  key={decision.id}
                  className="flex items-start gap-4 p-4 rounded-lg border"
                  data-testid={`card-decision-preview-${decision.id}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-sm">
                    {decision.id}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium" data-testid={`text-decision-title-${decision.id}`}>{decision.title}</h4>
                      <Badge variant="outline" className="text-xs" data-testid={`badge-decision-type-${decision.id}`}>
                        {decision.type === "multiple_choice" ? t("exploreExample.multipleChoice") : 
                         decision.type === "written" ? t("exploreExample.writtenResponse") : t("exploreExample.reflection")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2" data-testid={`text-decision-description-${decision.id}`}>{decision.description}</p>
                    <p className="text-xs text-muted-foreground/70 italic" data-testid={`text-decision-preview-${decision.id}`}>{decision.preview}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">{t("exploreExample.indicatorsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_CASE.indicators.map((indicator) => (
                  <Badge key={indicator.id} variant="outline" data-testid={`badge-indicator-${indicator.id}`}>
                    {indicator.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Link href="/">
              <Button variant="outline" data-testid="button-back-to-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("exploreExample.backToHome")}
              </Button>
            </Link>
            <Button onClick={() => navigate("/demo-simulation")} data-testid="button-start-demo">
              <Play className="w-4 h-4 mr-2" />
              {t("exploreExample.startDemo")}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
