import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { Crown, TestTube, Bug, Eye, Sparkles, ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { User } from "@shared/schema";

interface OnboardingModalProps {
  user: User;
}

const ONBOARDING_STORAGE_KEY = "scenariox_onboarding_seen";

export function OnboardingModal({ user }: OnboardingModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user.isSuperAdmin) return;
    
    const seen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, [user.isSuperAdmin]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    }
    setOpen(newOpen);
  };

  const handleClose = () => {
    handleOpenChange(false);
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const steps = [
    {
      icon: Crown,
      title: t("onboarding.welcomeAdmin"),
      description: t("onboarding.welcomeAdminDesc"),
      highlight: t("onboarding.welcomeAdminHighlight"),
    },
    {
      icon: Eye,
      title: t("onboarding.switchView"),
      description: t("onboarding.switchViewDesc"),
      highlight: t("onboarding.switchViewHighlight"),
    },
    {
      icon: TestTube,
      title: t("onboarding.testEverything"),
      description: t("onboarding.testEverythingDesc"),
      highlight: t("onboarding.testEverythingHighlight"),
    },
    {
      icon: Bug,
      title: t("onboarding.reportBugs"),
      description: t("onboarding.reportBugsDesc"),
      highlight: t("onboarding.reportBugsHighlight"),
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  if (!user.isSuperAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {currentStep.title}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {currentStep.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted/50 rounded-lg p-4 mt-2">
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{currentStep.highlight}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            onClick={handleClose}
            data-testid="button-onboarding-skip"
          >
            {t("onboarding.skipTour")}
          </Button>
          <Button
            onClick={handleNext}
            data-testid="button-onboarding-next"
          >
            {step < steps.length - 1 ? (
              <>
                {t("common.next")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t("onboarding.startTour")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
