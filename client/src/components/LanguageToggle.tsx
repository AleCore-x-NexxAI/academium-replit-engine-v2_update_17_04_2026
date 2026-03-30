import { useTranslation } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="flex items-center gap-1" data-testid="language-toggle">
      <Globe className="w-4 h-4 text-muted-foreground mr-1" />
      <Button
        variant={language === "es" ? "default" : "ghost"}
        size="sm"
        className="px-2 min-h-7 text-xs font-semibold"
        onClick={() => setLanguage("es")}
        data-testid="button-lang-es"
      >
        ES
      </Button>
      <Button
        variant={language === "en" ? "default" : "ghost"}
        size="sm"
        className="px-2 min-h-7 text-xs font-semibold"
        onClick={() => setLanguage("en")}
        data-testid="button-lang-en"
      >
        EN
      </Button>
    </div>
  );
}
