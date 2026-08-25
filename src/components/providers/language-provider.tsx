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
import { usePathname, useRouter } from "next/navigation";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CHANGE_EVENT,
  type Dictionary,
  type Language,
  getDictionary,
  isLanguage,
} from "@/lib/i18n";
import { LANGUAGE_COOKIE } from "@/lib/locale-routing";

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

function languageFromPathname(pathname: string | null): Language | null {
  if (pathname === "/") {
    return "es";
  }

  const routeLanguage = pathname?.split("/")[1] ?? null;
  return isLanguage(routeLanguage) ? routeLanguage : null;
}

export function LanguageProvider({ children, initialLanguage = DEFAULT_LANGUAGE }: { children: React.ReactNode; initialLanguage?: Language }) {
  const pathname = usePathname();
  const router = useRouter();
  const routeLanguage = languageFromPathname(pathname);
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [transitionPhase, setTransitionPhase] = useState<LanguageTransitionPhase>("idle");
  const transitionPhaseRef = useRef<LanguageTransitionPhase>("idle");
  const pendingLanguageRef = useRef<Language | null>(null);
  const pendingPathnameRef = useRef<string | null>(null);
  const pendingSearchRef = useRef("");
  const navigationStartedRef = useRef(false);
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
      const nextPathname = pendingPathnameRef.current;
      if (!nextLanguage || !nextPathname || navigationStartedRef.current) {
        return;
      }

      clearTransitionWatchdog();
      navigationStartedRef.current = true;
      router.push(`${nextPathname}${pendingSearchRef.current}${window.location.hash}`, { scroll: false });
      return;
    }

    if (transitionPhaseRef.current === "revealing") {
      clearTransitionWatchdog();
      pendingLanguageRef.current = null;
      pendingPathnameRef.current = null;
      pendingSearchRef.current = "";
      navigationStartedRef.current = false;
      transitionPhaseRef.current = "idle";
      setTransitionPhase("idle");
    }
  }, [clearTransitionWatchdog, router]);

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
    if (!routeLanguage) {
      return;
    }

    document.documentElement.lang = routeLanguage;

    if (pendingLanguageRef.current === routeLanguage && pendingPathnameRef.current === pathname) {
      setLanguageState(routeLanguage);
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        pendingLanguageRef.current = null;
        pendingPathnameRef.current = null;
        pendingSearchRef.current = "";
        navigationStartedRef.current = false;
        transitionPhaseRef.current = "idle";
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Complete the route transition immediately when reduced motion is enabled.
        setTransitionPhase("idle");
        return;
      }

      transitionPhaseRef.current = "revealing";
      transitionFrameRef.current = window.requestAnimationFrame(() => {
        transitionFrameRef.current = null;
        setTransitionPhase("revealing");
      });
      return;
    }

    if (transitionPhaseRef.current === "idle") {
      setLanguageState(routeLanguage);
    }
  }, [pathname, routeLanguage]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    if (nextLanguage === routeLanguage || transitionPhaseRef.current !== "idle" || !pathname) {
      return;
    }

    document.cookie = `${LANGUAGE_COOKIE}=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
    pendingLanguageRef.current = nextLanguage;
    pendingPathnameRef.current = nextLanguage === "es" ? "/" : "/en";
    pendingSearchRef.current = window.location.search;
    navigationStartedRef.current = false;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(`${pendingPathnameRef.current}${pendingSearchRef.current}${window.location.hash}`, { scroll: false });
      return;
    }

    transitionPhaseRef.current = "covering";
    setTransitionPhase("covering");
  }, [pathname, routeLanguage, router]);

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
