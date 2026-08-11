"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

type LanguageTransitionPhase = "idle" | "covering" | "revealing";

const LANGUAGE_TRANSITION_DURATION_MS = 400;
const LANGUAGE_TRANSITION_WATCHDOG_MS = LANGUAGE_TRANSITION_DURATION_MS + 75;

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

export function LanguageProvider({ children, initialLanguage = DEFAULT_LANGUAGE }: { children: React.ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [transitionPhase, setTransitionPhase] = useState<LanguageTransitionPhase>("idle");
  const transitionPhaseRef = useRef<LanguageTransitionPhase>("idle");
  const pendingLanguageRef = useRef<Language | null>(null);
  const transitionFrameRef = useRef<number | null>(null);
  const transitionWatchdogRef = useRef<number | null>(null);

  const clearTransitionWatchdog = useCallback(() => {
    if (transitionWatchdogRef.current !== null) {
      window.clearTimeout(transitionWatchdogRef.current);
      transitionWatchdogRef.current = null;
    }
  }, []);

  const advanceTransition = useCallback(() => {
    if (transitionPhaseRef.current === "covering") {
      const nextLanguage = pendingLanguageRef.current;
      if (!nextLanguage) {
        return;
      }

      clearTransitionWatchdog();
      transitionPhaseRef.current = "revealing";
      setLanguageState(nextLanguage);
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
      document.documentElement.lang = nextLanguage;
      transitionFrameRef.current = window.requestAnimationFrame(() => {
        transitionFrameRef.current = null;
        setTransitionPhase("revealing");
      });
      return;
    }

    if (transitionPhaseRef.current === "revealing") {
      clearTransitionWatchdog();
      pendingLanguageRef.current = null;
      transitionPhaseRef.current = "idle";
      setTransitionPhase("idle");
    }
  }, [clearTransitionWatchdog]);

  useEffect(() => {
    if (transitionPhase === "idle") {
      return;
    }

    transitionWatchdogRef.current = window.setTimeout(
      advanceTransition,
      LANGUAGE_TRANSITION_WATCHDOG_MS,
    );

    return clearTransitionWatchdog;
  }, [advanceTransition, clearTransitionWatchdog, transitionPhase]);

  useEffect(() => () => {
    clearTransitionWatchdog();
    if (transitionFrameRef.current !== null) {
      window.cancelAnimationFrame(transitionFrameRef.current);
    }
  }, [clearTransitionWatchdog]);

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
    if (nextLanguage === language || transitionPhaseRef.current !== "idle") {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    pendingLanguageRef.current = nextLanguage;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLanguageState(nextLanguage);
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
      document.documentElement.lang = nextLanguage;
      pendingLanguageRef.current = null;
      return;
    }

    transitionPhaseRef.current = "covering";
    setTransitionPhase("covering");
  }, [language]);

  function handleTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "clip-path") {
      return;
    }

    advanceTransition();
  }

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "es" ? "en" : "es");
  }, [language, setLanguage]);

  const dictionary = useMemo(() => getDictionary(language), [language]);

  const value = useMemo(
    () => ({ language, dictionary, setLanguage, toggleLanguage }),
    [dictionary, language, setLanguage, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
      <div
        aria-hidden="true"
        className="language-transition-overlay"
        data-language-transition={transitionPhase}
        onTransitionEnd={handleTransitionEnd}
      />
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
