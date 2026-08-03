"use client";

import Image from "next/image";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { assets } from "@/data/content";
import { useLanguage } from "@/components/providers/language-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { ActionLink, Button, PdfModal } from "@/components/ui";

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

const DRAWER_PHASES = {
  CLOSED: "closed",
  ENTERING: "entering",
  OPEN: "open",
  EXITING: "exiting",
} as const;

type DrawerPhase = (typeof DRAWER_PHASES)[keyof typeof DRAWER_PHASES];

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

function NavigationLinks({ activeSection, onNavigate }: { activeSection: string | null; onNavigate?: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <nav aria-label={dictionary.navigation.primaryNavigationLabel} className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => (
        <ActionLink
          aria-current={activeSection === item.id ? "page" : undefined}
          className={
            item.id === "services"
              ? "gap-1.5 border border-foreground/20 px-3 py-1.5 text-foreground"
              : "nav-section-link px-3 py-1.5"
          }
          data-nav-active={activeSection === item.id ? "true" : undefined}
          href={`#${item.id}`}
          icon={
            item.id === "services" ? (
              <Image alt="" aria-hidden="true" className="size-4 opacity-70 dark:invert" height={16} src={item.icon} width={16} />
            ) : undefined
          }
          iconPosition="start"
          key={item.id}
          label={dictionary.navigation[item.key]}
          onClick={(event) => navigateToHash(event, `#${item.id}`, onNavigate)}
          size="sm"
          variant={item.id === "services" ? "outlined" : "nav"}
        />
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const { dictionary } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      aria-label={dictionary.navigation.themeToggleLabel}
      className="text-muted-foreground"
      icon={<Image alt="" aria-hidden="true" className="size-4 dark:invert" height={16} src={theme === "dark" ? assets.icons.sun : assets.icons.moon} width={16} />}
      onClick={toggleTheme}
      size="icon"
      variant="icon"
    />
  );
}

function LanguageToggle() {
  const { dictionary, toggleLanguage } = useLanguage();

  return (
    <Button
      aria-label={dictionary.navigation.languageToggleLabel}
      className="text-muted-foreground"
      icon={<Image alt="" aria-hidden="true" className="size-4 opacity-70 dark:invert" height={16} src={assets.icons.language} width={16} />}
      onClick={toggleLanguage}
      size="icon"
      variant="icon"
    />
  );
}

function DrawerLanguageButton({ onNavigate }: { onNavigate?: () => void }) {
  const { dictionary, language, toggleLanguage } = useLanguage();
  const label = language === "es" ? dictionary.navigation.changeToEnglish : dictionary.navigation.changeToSpanish;

  return (
    <Button
      aria-label={dictionary.navigation.languageToggleLabel}
      className="w-full justify-start px-4 py-3 text-base font-medium text-muted-foreground"
      icon={<Image alt="" aria-hidden="true" className="size-5 opacity-70 dark:invert" height={20} src={assets.icons.language} width={20} />}
      iconPosition="start"
      label={label}
      onClick={() => {
        toggleLanguage();
        onNavigate?.();
      }}
      size="md"
      variant="ghost"
    />
  );
}

function DrawerThemeButton() {
  const { dictionary } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const icon = theme === "dark" ? assets.icons.sun : assets.icons.moon;
  const label = theme === "dark" ? dictionary.navigation.lightTheme : dictionary.navigation.darkTheme;

  return (
    <Button
      aria-label={dictionary.navigation.themeToggleLabel}
      className="w-full justify-start px-4 py-3 text-base font-medium text-muted-foreground"
      icon={<Image alt="" aria-hidden="true" className="size-5 opacity-70 dark:invert" height={20} src={icon} width={20} />}
      iconPosition="start"
      label={label}
      onClick={toggleTheme}
      size="md"
      variant="ghost"
    />
  );
}

function ResumeButton({ className = "", onOpen }: { className?: string; onOpen: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <Button
      className={`resume-action border border-foreground/20 px-5 py-1.5 text-foreground ${className}`}
      icon={<Image alt="" aria-hidden="true" className="size-4 shrink-0 opacity-70 dark:invert" height={16} src={assets.icons.view} width={16} />}
      label={dictionary.navigation.resume}
      onClick={onOpen}
      size="sm"
      variant="outlined"
    />
  );
}

function MenuButton({ onClick }: { onClick: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <Button
      aria-haspopup="dialog"
      aria-label={dictionary.navigation.menuLabel}
      className="border border-border bg-background/60 text-muted-foreground"
      data-portfolio-menu-button="true"
      icon={<Image alt="" aria-hidden="true" className="size-4 opacity-60 dark:invert" height={16} src={assets.icons.menu} width={16} />}
      onClick={onClick}
      size="icon"
      variant="icon"
    />
  );
}

function TopHeader({ activeSection, onMenuOpen, onResumeOpen }: { activeSection: string | null; onMenuOpen: () => void; onResumeOpen: () => void }) {
  const { dictionary } = useLanguage();

  return (
    <header className="relative z-40 px-6 pt-6 lg:pt-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <a className="text-sm font-medium tracking-tight text-foreground" href="#top" onClick={(event) => navigateToHash(event, "#top")}>
          {dictionary.meta.siteName}
        </a>

        <div className="hidden items-center gap-4 lg:flex">
          <NavigationLinks activeSection={activeSection} />
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

function StickyHeader({ activeSection, onMenuOpen, onResumeOpen, visible }: { activeSection: string | null; onMenuOpen: () => void; onResumeOpen: () => void; visible: boolean }) {
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
            <ActionLink
              aria-current={activeSection === item.id ? "page" : undefined}
              className={
                item.id === "services"
                  ? "gap-1.5 border border-foreground/20 px-3 py-1.5 text-foreground"
                  : "nav-section-link px-3 py-1.5"
              }
              data-nav-active={activeSection === item.id ? "true" : undefined}
              href={`#${item.id}`}
              icon={
                item.id === "services" ? (
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="size-4 dark:invert"
                    height={16}
                    src={assets.icons.service}
                    width={16}
                  />
                ) : undefined
              }
              iconPosition="start"
              key={item.id}
              label={dictionary.navigation[item.key]}
              onClick={(event) => navigateToHash(event, `#${item.id}`)}
              size="sm"
              variant={item.id === "services" ? "outlined" : "nav"}
            />
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

function MobileDrawer({
  onClose,
  onExited,
  onResumeOpen,
  phase,
}: {
  onClose: () => void;
  onExited: () => void;
  onResumeOpen: () => void;
  phase: DrawerPhase;
}) {
  const { dictionary } = useLanguage();
  const drawerRef = useRef<HTMLDivElement>(null);
  const isVisible = phase !== DRAWER_PHASES.CLOSED;

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirstElement = () => {
      const focusableElements = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      focusableElements[0]?.focus();
    };

    focusFirstElement();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      const focusableElements = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);

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
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      aria-label={dictionary.navigation.drawerLabel}
      className="drawer-scrim fixed inset-0 z-[60] lg:hidden"
      data-drawer-phase={phase}
      ref={drawerRef}
      role="dialog"
    >
      <button
        aria-label={dictionary.navigation.closeMenuLabel}
        className="absolute inset-0"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        className="drawer-panel absolute inset-0 flex flex-col bg-background px-6 py-6 text-foreground"
        onTransitionEnd={(event) => {
          if (phase === DRAWER_PHASES.EXITING && event.target === event.currentTarget && event.propertyName === "transform") {
            onExited();
          }
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <a className="text-sm font-medium tracking-tight" href="#top" onClick={(event) => navigateToHash(event, "#top", onClose)}>
            {dictionary.meta.siteName}
          </a>
          <Button
            aria-label={dictionary.navigation.closeMenuLabel}
            className="text-muted-foreground"
            icon={<Image alt="" aria-hidden="true" className="size-4 dark:invert" height={16} src={assets.icons.close} width={16} />}
            onClick={onClose}
            size="icon"
            variant="icon"
          />
        </div>

        <nav aria-label={dictionary.navigation.mobileNavigationLabel} className="mt-12 flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <ActionLink
              className={
                item.id === "services"
                  ? "drawer-item w-full justify-start gap-4 border border-foreground/20 px-4 py-4 text-3xl font-semibold tracking-tight text-foreground"
                  : "drawer-item w-full justify-start gap-4 px-4 py-4 text-3xl font-semibold tracking-tight text-foreground"
              }
              data-drawer-item="true"
              href={`#${item.id}`}
              icon={<Image alt="" aria-hidden="true" className="size-6 shrink-0 opacity-70 dark:invert" height={24} src={item.icon} width={24} />}
              iconPosition="start"
              key={item.id}
              label={dictionary.navigation[item.key]}
              onClick={(event) => navigateToHash(event, `#${item.id}`, onClose)}
              size="md"
              style={{ transitionDelay: phase === DRAWER_PHASES.OPEN ? `${38 * (NAV_ITEMS.indexOf(item) + 1)}ms` : "0ms" }}
              variant={item.id === "services" ? "outlined" : "ghost"}
            />
          ))}
        </nav>

        <div className="mt-3 grid gap-3 pb-4">
          <ResumeButton className="drawer-item w-full justify-between px-4 py-3 text-base font-medium" onOpen={onResumeOpen} />
          <DrawerLanguageButton />
          <DrawerThemeButton />
        </div>
      </div>
    </div>
  );
}

export function PortfolioNavigation() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [drawerPhase, setDrawerPhase] = useState<DrawerPhase>(DRAWER_PHASES.CLOSED);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const resumeAfterDrawerCloseRef = useRef(false);
  const { dictionary, language } = useLanguage();

  useEffect(() => {
    const STICKY_THRESHOLD = 350;
    // Below this scroll offset the visitor is in the hero / top zone and no section is active.
    const HERO_THRESHOLD = 120;

    const handleScroll = () => {
      setStickyVisible(window.scrollY > STICKY_THRESHOLD);
      // When the visitor scrolls back to the hero area, clear the active section so no
      // nav item appears underlined / aria-current while the hero is in view.
      if (window.scrollY < HERO_THRESHOLD) {
        setActiveSection(null);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_ITEMS.map(({ id }) => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        // Skip observer updates while in the hero zone — scroll listener owns that state.
        if (window.scrollY < 120) {
          return;
        }

        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        if (activeEntry) {
          setActiveSection(activeEntry.target.id);
        }
      },
      { rootMargin: "-20% 0px -65%", threshold: [0.1, 0.35, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (drawerPhase !== DRAWER_PHASES.ENTERING) {
      return;
    }

    const frame = requestAnimationFrame(() => setDrawerPhase(DRAWER_PHASES.OPEN));
    return () => cancelAnimationFrame(frame);
  }, [drawerPhase]);

  useEffect(() => {
    if (drawerPhase !== DRAWER_PHASES.EXITING) {
      return;
    }

    const exitTimeout = window.setTimeout(finishDrawerClose, 180);
    return () => window.clearTimeout(exitTimeout);
  }, [drawerPhase]);

  function openDrawer() {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setDrawerPhase(prefersReducedMotion ? DRAWER_PHASES.OPEN : DRAWER_PHASES.ENTERING);
  }

  function closeDrawer() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      finishDrawerClose();
      return;
    }

    setDrawerPhase(DRAWER_PHASES.EXITING);
  }

  function finishDrawerClose() {
    setDrawerPhase(DRAWER_PHASES.CLOSED);
    requestAnimationFrame(() => {
      const fallbackMenuButton = Array.from(
        document.querySelectorAll<HTMLElement>('[data-portfolio-menu-button="true"]'),
      ).find(canReceiveFocus);
      const focusTarget = canReceiveFocus(openerRef.current) ? openerRef.current : fallbackMenuButton;

      focusTarget?.focus();
      openerRef.current = null;

      if (resumeAfterDrawerCloseRef.current) {
        resumeAfterDrawerCloseRef.current = false;
        setResumeOpen(true);
      }
    });
  }

  function openResume() {
    setResumeOpen(true);
  }

  function openResumeFromDrawer() {
    resumeAfterDrawerCloseRef.current = true;
    closeDrawer();
  }

  return (
    <>
      <TopHeader activeSection={activeSection} onMenuOpen={openDrawer} onResumeOpen={openResume} />
      <StickyHeader activeSection={activeSection} onMenuOpen={openDrawer} onResumeOpen={openResume} visible={stickyVisible} />
      <MobileDrawer onClose={closeDrawer} onExited={finishDrawerClose} onResumeOpen={openResumeFromDrawer} phase={drawerPhase} />
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
