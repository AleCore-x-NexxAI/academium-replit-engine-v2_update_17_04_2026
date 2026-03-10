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

const ONBOARDING_STORAGE_KEY = "scenariox_onboarding_seen";

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
      title: "¡Bienvenido, Super Administrador!",
      description: "Se te ha otorgado acceso completo a Academium como probador beta. Esto significa que puedes explorar todas las funciones desde cada perspectiva: estudiante, profesor y administrador.",
      highlight: "¡Gracias por ayudarnos a probar esta plataforma!",
    },
    {
      icon: Eye,
      title: "Cambia de Vista Libremente",
      description: "Usa el selector de rol en la navegación superior para experimentar la plataforma como diferentes tipos de usuario. Prueba la experiencia de simulación del estudiante, explora las herramientas del profesor o gestiona usuarios como administrador.",
      highlight: "Haz clic en tu insignia de rol para cambiar de vista en cualquier momento.",
    },
    {
      icon: TestTube,
      title: "Prueba Todo",
      description: "Intenta crear escenarios, ejecutar simulaciones, revisar analíticas y usar todas las funciones. Tu retroalimentación es invaluable para mejorar la plataforma antes del lanzamiento.",
      highlight: "¡No te contengas - intenta romper cosas!",
    },
    {
      icon: Bug,
      title: "Reporta Errores Fácilmente",
      description: "¿Encontraste algo roto o confuso? Haz clic en el ícono de error en la esquina inferior derecha para enviar un reporte. Lo recibiremos inmediatamente y trabajaremos en solucionarlo.",
      highlight: "¡Cada reporte de error nos ayuda a mejorar!",
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
            Omitir tour
          </Button>
          <Button
            onClick={handleNext}
            data-testid="button-onboarding-next"
          >
            {step < steps.length - 1 ? (
              <>
                Siguiente
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Comenzar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
