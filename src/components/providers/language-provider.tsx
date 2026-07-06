"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  type Dictionary,
  type Language,
  detectBrowserLanguage,
  getDictionary,
  isLanguage,
} from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  dictionary: Dictionary;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readPreferredLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (isLanguage(storedLanguage)) {
    return storedLanguage;
  }

  return detectBrowserLanguage(window.navigator.language);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const syncLanguage = (event?: Event) => {
      if (event instanceof StorageEvent && event.key && event.key !== LANGUAGE_STORAGE_KEY) {
        return;
      }

      const nextLanguage = readPreferredLanguage();

      setLanguageState(nextLanguage);
      document.documentElement.lang = nextLanguage;
    };

    syncLanguage();
    window.addEventListener("storage", syncLanguage);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);

    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
    document.documentElement.lang = nextLanguage;
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "es" ? "en" : "es");
  }, [language, setLanguage]);

  const dictionary = useMemo(() => getDictionary(language), [language]);

  const value = useMemo(
    () => ({ language, dictionary, setLanguage, toggleLanguage }),
    [dictionary, language, setLanguage, toggleLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
