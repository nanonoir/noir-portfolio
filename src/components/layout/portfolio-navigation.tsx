"use client";

import Image from "next/image";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { assets } from "@/data/content";
import { useLanguage } from "@/components/providers/language-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { PdfModal } from "@/components/ui";

const NAV_ITEMS = [
  { id: "about", key: "about", icon: assets.icons.about },
  { id: "projects", key: "projects", icon: assets.icons.project },
  { id: "services", key: "services", icon: assets.icons.service },
  { id: "stack", key: "stack", icon: assets.icons.toolbox },
  { id: "contact", key: "contact", icon: assets.icons.card },
] as const;

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function canReceiveFocus(element: HTMLElement | null) {
  if (!element || !document.contains(element)) {
    return false;
  }

  const styles = window.getComputedStyle(element);

  return styles.display !== "none" && styles.visibility !== "hidden" && element.getClientRects().length > 0;
}

function controlClassName(extra = "") {
  return [
    "inline-flex items-center justify-center rounded-full transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function navigateToHash(event: MouseEvent<HTMLAnchorElement>, hash: string, onBeforeScroll?: () => void) {
  event.preventDefault();
  onBeforeScroll?.();

  window.setTimeout(
    () => {
      const target = document.getElementById(hash.replace("#", ""));

      if (!target) {
        return;
      }

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      window.history.pushState(null, "", hash);
    },
    onBeforeScroll ? 80 : 0,
  );
}

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <nav aria-label={dictionary.navigation.primaryNavigationLabel} className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => (
        <a
          className={controlClassName(
            item.id === "services"
              ? "gap-1.5 border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5"
              : "px-3 py-1.5 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
          href={`#${item.id}`}
          key={item.id}
          onClick={(event) => navigateToHash(event, `#${item.id}`, onNavigate)}
        >
          {item.id === "services" ? (
            <Image alt="" aria-hidden="true" className="size-4 opacity-70 dark:invert" height={16} src={item.icon} width={16} />
          ) : null}
          {dictionary.navigation[item.key]}
        </a>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const { dictionary } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      aria-label={dictionary.navigation.themeToggleLabel}
      className={controlClassName("size-8 text-muted-foreground hover:bg-foreground/5 hover:text-foreground")}
      onClick={toggleTheme}
      type="button"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="size-4 dark:invert"
        height={16}
        src={theme === "dark" ? assets.icons.sun : assets.icons.moon}
        width={16}
      />
    </button>
  );
}

function LanguageToggle() {
  const { dictionary, toggleLanguage } = useLanguage();

  return (
    <button
      aria-label={dictionary.navigation.languageToggleLabel}
      className={controlClassName("size-8 text-muted-foreground hover:bg-foreground/5 hover:text-foreground")}
      onClick={toggleLanguage}
      type="button"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="size-4 opacity-70 dark:invert"
        height={16}
        src={assets.icons.language}
        width={16}
      />
    </button>
  );
}

function DrawerLanguageButton({ onNavigate }: { onNavigate?: () => void }) {
  const { dictionary, language, toggleLanguage } = useLanguage();
  const label = language === "es" ? dictionary.navigation.changeToEnglish : dictionary.navigation.changeToSpanish;

  return (
    <button
      aria-label={dictionary.navigation.languageToggleLabel}
      className={controlClassName(
        "w-full justify-start gap-3 px-4 py-3 text-base font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
      onClick={() => {
        toggleLanguage();
        onNavigate?.();
      }}
      type="button"
    >
      <Image alt="" aria-hidden="true" className="size-5 opacity-70 dark:invert" height={20} src={assets.icons.language} width={20} />
      {label}
    </button>
  );
}

function DrawerThemeButton() {
  const { dictionary } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const icon = theme === "dark" ? assets.icons.sun : assets.icons.moon;
  const label = theme === "dark" ? dictionary.navigation.lightTheme : dictionary.navigation.darkTheme;

  return (
    <button
      aria-label={dictionary.navigation.themeToggleLabel}
      className={controlClassName(
        "w-full justify-start gap-3 px-4 py-3 text-base font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
      onClick={toggleTheme}
      type="button"
    >
      <Image alt="" aria-hidden="true" className="size-5 opacity-70 dark:invert" height={20} src={icon} width={20} />
      {label}
    </button>
  );
}

function ResumeButton({ className = "", onOpen }: { className?: string; onOpen: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <button
      className={controlClassName(
        `gap-1.5 border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5 ${className}`,
      )}
      onClick={onOpen}
      type="button"
    >
      {dictionary.navigation.resume}
      <Image alt="" aria-hidden="true" className="size-4 opacity-70 dark:invert" height={16} src={assets.icons.view} width={16} />
    </button>
  );
}

function MenuButton({ onClick }: { onClick: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <button
      aria-haspopup="dialog"
      aria-label={dictionary.navigation.menuLabel}
      className={controlClassName("size-9 border border-border bg-background/60 text-muted-foreground hover:bg-foreground/5")}
      data-portfolio-menu-button="true"
      onClick={onClick}
      type="button"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="size-4 opacity-60 dark:invert"
        height={16}
        src={assets.icons.menu}
        width={16}
      />
    </button>
  );
}

function TopHeader({ onMenuOpen, onResumeOpen }: { onMenuOpen: () => void; onResumeOpen: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <header className="relative z-40 px-6 pt-6 lg:pt-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <a className="text-sm font-medium tracking-tight text-foreground" href="#top" onClick={(event) => navigateToHash(event, "#top")}>
          {dictionary.meta.siteName}
        </a>

        <div className="hidden items-center gap-4 lg:flex">
          <NavigationLinks />
          <div aria-hidden="true" className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
            <ResumeButton onOpen={onResumeOpen} />
          </div>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ResumeButton className="max-[499px]:hidden" onOpen={onResumeOpen} />
          <LanguageToggle />
          <ThemeToggle />
          <MenuButton onClick={onMenuOpen} />
        </div>
      </div>
    </header>
  );
}

function StickyHeader({ onMenuOpen, onResumeOpen, visible }: { onMenuOpen: () => void; onResumeOpen: () => void; visible: boolean }) {
  const { dictionary } = useLanguage();

  if (!visible) {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 lg:inset-x-auto lg:left-1/2 lg:top-4 lg:-translate-x-1/2">
      <div className="hidden items-center gap-1 rounded-full px-4 py-2 shadow-pill glass lg:flex">
        <a
          aria-label={dictionary.navigation.homeLabel}
          className={controlClassName("size-8 text-muted-foreground hover:bg-foreground/5 hover:text-foreground")}
          href="#top"
          onClick={(event) => navigateToHash(event, "#top")}
        >
          <Image alt="" aria-hidden="true" className="size-4 dark:invert" height={16} src={assets.icons.home} width={16} />
        </a>
        <nav aria-label={dictionary.navigation.stickyNavigationLabel} className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              className={controlClassName(
                item.id === "services"
                  ? "gap-1.5 border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5"
                  : "px-3 py-1.5 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
              href={`#${item.id}`}
              key={item.id}
              onClick={(event) => navigateToHash(event, `#${item.id}`)}
            >
              {item.id === "services" ? (
                <Image
                  alt=""
                  aria-hidden="true"
                  className="size-4 dark:invert"
                  height={16}
                  src={assets.icons.service}
                  width={16}
                />
              ) : null}
              {dictionary.navigation[item.key]}
            </a>
          ))}
        </nav>
        <div aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        <ThemeToggle />
        <LanguageToggle />
        <ResumeButton onOpen={onResumeOpen} />
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <a className="min-w-0 truncate text-sm font-medium tracking-tight text-foreground" href="#top" onClick={(event) => navigateToHash(event, "#top")}>
          {dictionary.meta.siteName}
        </a>
        <div className="flex shrink-0 items-center gap-1">
          <ResumeButton className="max-[499px]:hidden" onOpen={onResumeOpen} />
          <LanguageToggle />
          <ThemeToggle />
          <MenuButton onClick={onMenuOpen} />
        </div>
      </div>
    </header>
  );
}

function MobileDrawer({ onClose, onResumeOpen, open }: { onClose: () => void; onResumeOpen: () => void; open: boolean }) {
  const { dictionary } = useLanguage();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableElements = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    focusableElements[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      aria-label={dictionary.navigation.drawerLabel}
      className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-xl lg:hidden"
      ref={drawerRef}
      role="dialog"
    >
      <button
        aria-label={dictionary.navigation.closeMenuLabel}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div className="absolute inset-0 flex translate-x-0 flex-col bg-background px-6 py-6 text-foreground transition-transform duration-300 ease-out">
        <div className="flex items-center justify-between gap-4">
          <a className="text-sm font-medium tracking-tight" href="#top" onClick={(event) => navigateToHash(event, "#top", onClose)}>
            {dictionary.meta.siteName}
          </a>
          <button
            aria-label={dictionary.navigation.closeMenuLabel}
            className={controlClassName("size-9 text-muted-foreground hover:bg-foreground/5 hover:text-foreground")}
            onClick={onClose}
            type="button"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="size-4 dark:invert"
              height={16}
              src={assets.icons.close}
              width={16}
            />
          </button>
        </div>

        <nav aria-label={dictionary.navigation.mobileNavigationLabel} className="mt-12 flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <a
              className={controlClassName(
                item.id === "services"
                  ? "w-full justify-start gap-4 border border-foreground/20 px-4 py-4 text-3xl font-semibold tracking-tight text-foreground hover:bg-foreground/5"
                  : "w-full justify-start gap-4 px-4 py-4 text-3xl font-semibold tracking-tight text-foreground hover:bg-foreground/5 hover:text-muted-foreground",
              )}
              href={`#${item.id}`}
              key={item.id}
              onClick={(event) => navigateToHash(event, `#${item.id}`, onClose)}
            >
              <Image alt="" aria-hidden="true" className="size-6 shrink-0 opacity-70 dark:invert" height={24} src={item.icon} width={24} />
              {dictionary.navigation[item.key]}
            </a>
          ))}
        </nav>

        <div className="mt-3 grid gap-3 pb-4">
          <ResumeButton className="w-full justify-between px-4 py-3 text-base font-medium" onOpen={onResumeOpen} />
          <DrawerLanguageButton />
          <DrawerThemeButton />
        </div>
      </div>
    </div>
  );
}

export function PortfolioNavigation() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const { dictionary, language } = useLanguage();

  useEffect(() => {
    const updateStickyVisibility = () => setStickyVisible(window.scrollY > 350);

    updateStickyVisibility();
    window.addEventListener("scroll", updateStickyVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateStickyVisibility);
  }, []);

  function openDrawer() {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    requestAnimationFrame(() => {
      const fallbackMenuButton = Array.from(
        document.querySelectorAll<HTMLElement>('[data-portfolio-menu-button="true"]'),
      ).find(canReceiveFocus);
      const focusTarget = canReceiveFocus(openerRef.current) ? openerRef.current : fallbackMenuButton;

      focusTarget?.focus();
      openerRef.current = null;
    });
  }

  function openResume() {
    setDrawerOpen(false);
    setResumeOpen(true);
  }

  return (
    <>
      <TopHeader onMenuOpen={openDrawer} onResumeOpen={openResume} />
      <StickyHeader onMenuOpen={openDrawer} onResumeOpen={openResume} visible={stickyVisible} />
      <MobileDrawer onClose={closeDrawer} onResumeOpen={openResume} open={drawerOpen} />
      <PdfModal
        closeLabel={dictionary.modals.closeLabel}
        isOpen={resumeOpen}
        onClose={() => setResumeOpen(false)}
        src={assets.resume[language]}
        title={dictionary.modals.resumeTitle}
      />
    </>
  );
}
