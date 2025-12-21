import { useState, useEffect } from "react";
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

const ONBOARDING_STORAGE_KEY = "simulearn_onboarding_seen";

export function OnboardingModal({ user }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user.isSuperAdmin) return;
    
    const seen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, [user.isSuperAdmin]);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setOpen(false);
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
      title: "Welcome, Super Admin!",
      description: "You've been granted full access to SIMULEARN as a beta tester. This means you can explore all features from every perspective - student, professor, and administrator.",
      highlight: "Thank you for helping us test this platform!",
    },
    {
      icon: Eye,
      title: "Switch Views Freely",
      description: "Use the role switcher in the top navigation to experience the platform as different user types. Try the student simulation experience, explore professor tools, or manage users as an admin.",
      highlight: "Click your role badge to switch views anytime.",
    },
    {
      icon: TestTube,
      title: "Test Everything",
      description: "Try creating scenarios, running simulations, checking analytics, and using all features. Your feedback is invaluable for improving the platform before launch.",
      highlight: "Don't hold back - try to break things!",
    },
    {
      icon: Bug,
      title: "Report Bugs Easily",
      description: "Found something broken or confusing? Click the bug icon in the bottom-right corner to submit a report. We'll receive it immediately and work on fixing it.",
      highlight: "Every bug report helps us improve!",
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  if (!user.isSuperAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Skip tour
          </Button>
          <Button
            onClick={handleNext}
            data-testid="button-onboarding-next"
          >
            {step < steps.length - 1 ? (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Get Started
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
