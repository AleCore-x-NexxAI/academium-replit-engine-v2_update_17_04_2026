import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { t as translate, type Language } from "@/lib/translations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "es",
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("academium_language");
    return (stored === "en" || stored === "es") ? stored : "es";
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  useEffect(() => {
    if (user?.language) {
      setLanguageState(user.language as Language);
      localStorage.setItem("academium_language", user.language);
    }
  }, [user?.language]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("academium_language", lang);

    if (user) {
      try {
        await apiRequest("PATCH", "/api/users/language", { language: lang });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      } catch (error) {
        console.error("Failed to persist language preference:", error);
      }
    }
  }, [user]);

  const tFn = useCallback(
    (key: string, replacements?: Record<string, string | number>) => {
      return translate(key, language, replacements);
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
