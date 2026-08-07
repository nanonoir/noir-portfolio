"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, TransitionEvent } from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleThemeAt: (origin: { x: number; y: number }) => void;
};

const STORAGE_KEY = "nn-theme";
const THEME_CHANGE_EVENT = "nn-theme-change";

const ThemeContext = createContext<ThemeContextValue | null>(null);
type ThemeTransition = { phase: "idle" | "expanding" | "foreground"; origin: { x: number; y: number }; radius: number; target: Theme };

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readStoredTheme,
    getServerThemeSnapshot,
  );
  const [transition, setTransition] = useState<ThemeTransition>({ phase: "idle", origin: { x: 0, y: 0 }, radius: 0, target: "light" });
  const pendingThemeRef = useRef<Theme | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const toggleThemeAt = useCallback((origin: { x: number; y: number }) => {
    if (transition.phase !== "idle") return;
    const nextTheme = theme === "dark" ? "light" : "dark";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(nextTheme);
      return;
    }

    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    ) + 12;
    pendingThemeRef.current = nextTheme;
    setTransition({ phase: "expanding", origin, radius, target: nextTheme });
  }, [setTheme, theme, transition.phase]);

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "clip-path") return;
    const nextTheme = pendingThemeRef.current;
    if (!nextTheme) return;
    pendingThemeRef.current = null;
    setTheme(nextTheme);
    window.dispatchEvent(new CustomEvent("theme-transition-foreground", { detail: { duration: 220 } }));
    setTransition((current) => ({ ...current, phase: "foreground" }));
    window.setTimeout(() => {
      setTransition((current) => ({ ...current, phase: "idle" }));
    }, 220);
  }

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, toggleThemeAt }),
    [setTheme, theme, toggleTheme, toggleThemeAt],
  );

  const overlayStyle = {
    "--theme-origin-x": `${transition.origin.x}px`,
    "--theme-origin-y": `${transition.origin.y}px`,
    "--theme-reveal-radius": `${transition.radius}px`,
  } as CSSProperties;

  return (
    <ThemeContext.Provider value={value}>
      <div
        className="theme-transition-content"
        data-theme-busy={transition.phase !== "idle" ? "true" : undefined}
        data-theme-foreground={transition.phase === "foreground" ? "true" : undefined}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="theme-transition-overlay"
        data-theme-target={transition.target}
        data-theme-transition={transition.phase}
        onTransitionEnd={handleTransitionEnd}
        style={overlayStyle}
      />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
