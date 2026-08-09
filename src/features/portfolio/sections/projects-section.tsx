"use client";

import Image from "next/image";
import { type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/providers/language-provider";
import { projects, type Project, type ProjectMedia } from "@/data/content";
import { Chip, HandwrittenIcon, SectionHeading, SectionShell } from "@/components/ui";

function ProjectAction({ link }: { link: Project["links"][number] }) {
  const { dictionary } = useLanguage();
  const label = dictionary.projects[link.labelKey];
  const icon = link.kind === "github" ? "github" : "request";

  if (!link.href) {
    return (
      <button
        aria-label={label}
        className="mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        type="button"
      >
        {label}
        <HandwrittenIcon className="size-3.5" fallbackSrc={link.kind === "github" ? undefined : "request"} icon={icon} size={14} />
      </button>
    );
  }

  return (
    <a
      className="mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      href={link.href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
      <HandwrittenIcon className="size-3.5" fallbackSrc={link.kind === "github" ? undefined : "request"} icon={icon} size={14} />
    </a>
  );
}

function VideoFrame({ media, onMediaError, paused }: { media: ProjectMedia; onMediaError: () => void; paused: boolean }) {
  const { language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (paused) {
      video.pause();
      return;
    }

    // Delay source assignment until active to avoid buffering collapsed media.
    if (!video.src || video.src !== new URL(media.src, location.href).href) {
      video.src = media.src;
      video.load();
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      return;
    }

    video.muted = true;

    const playVideo = () => {
      if (!videoRef.current || paused) {
        return;
      }

      void videoRef.current.play().catch(() => {
        // Retry after metadata events because autoplay timing is browser-dependent.
      });
    };

    playVideo();
    video.addEventListener("canplay", playVideo);
    video.addEventListener("loadeddata", playVideo);

    return () => {
      video.removeEventListener("canplay", playVideo);
      video.removeEventListener("loadeddata", playVideo);
      video.pause();
    };
  }, [media.src, paused]);

  return (
    <video
      aria-label={media.alt[language]}
      autoPlay={false}
      className="size-full object-contain"
      loop
      muted
      onError={onMediaError}
      playsInline
      preload="none"
      ref={videoRef}
    />
  );
}

function mediaContainerClass(media: ProjectMedia | undefined): string {
  if (!media) return "aspect-video";

  switch (media.aspect) {
    case "mobile":
      return "aspect-[9/16] max-w-xs sm:max-w-sm";
    case "desktop-wide":
      return "aspect-[21/9]";
    case "desktop":
    default:
      return "aspect-[16/11]";
  }
}

function MediaFrame({ media, onMediaError, paused }: { media?: ProjectMedia; onMediaError: () => void; paused: boolean }) {
  const { dictionary, language } = useLanguage();

  if (!media) {
    return <p className="max-w-56 text-center text-sm leading-6 text-muted-foreground">{dictionary.projects.videoPlaceholder}</p>;
  }

  if (media.type === "video") {
    return <VideoFrame media={media} onMediaError={onMediaError} paused={paused} />;
  }

  return (
    <Image alt={media.alt[language]} className="object-contain" fill onError={onMediaError} sizes="(min-width: 1024px) 520px, 100vw" src={media.src} />
  );
}

function ProjectMediaCarousel({ active, project }: { active: boolean; project: Project }) {
  const { dictionary } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const pointerStartRef = useRef<{ id: number; x: number } | null>(null);
  const currentMedia = project.media[activeIndex];
  const hasMultipleMedia = project.media.length > 1;
  const isVideoMedia = currentMedia.type === "video";

  function goToMedia(nextIndex: number) {
    if (!project.media.length) return;
    setActiveIndex((nextIndex + project.media.length) % project.media.length);
    setMediaFailed(false);
    setPaused(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || !hasMultipleMedia || pointerStartRef.current !== null) return;
    pointerStartRef.current = { id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const pointerStart = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    const distance = event.clientX - pointerStart.x;
    if (Math.abs(distance) < 40) return;
    goToMedia(activeIndex + (distance < 0 ? 1 : -1));
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (pointerStartRef.current?.id === event.pointerId) {
      pointerStartRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const containerClass = mediaContainerClass(mediaFailed ? undefined : currentMedia);

  return (
    <div className="space-y-4">
      <div
        className={`relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-[20px] border border-border bg-surface ${containerClass}`}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ touchAction: hasMultipleMedia ? "pan-y" : undefined }}
      >
        {mediaFailed ? (
          <p className="max-w-56 text-center text-sm leading-6 text-muted-foreground">{dictionary.projects.videoPlaceholder}</p>
        ) : (
          <MediaFrame media={currentMedia} onMediaError={() => setMediaFailed(true)} paused={paused || !active} />
        )}

        {isVideoMedia ? (
          <button
            aria-label={paused ? dictionary.projects.playLabel : dictionary.projects.pauseLabel}
            className="absolute right-4 bottom-4 grid size-10 place-items-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            onClick={() => setPaused((value) => !value)}
            type="button"
          >
            <HandwrittenIcon className="size-4" icon={paused ? "play" : "pause"} />
          </button>
        ) : null}

        {hasMultipleMedia ? (
          <>
            <button
              aria-label={dictionary.projects.previousMediaLabel}
              className="absolute top-1/2 left-4 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/80 backdrop-blur transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() => goToMedia(activeIndex - 1)}
              type="button"
            >
              <HandwrittenIcon className="size-4 -scale-x-100" icon="rightArrow" />
            </button>
            <button
              aria-label={dictionary.projects.nextMediaLabel}
              className="absolute top-1/2 right-4 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/80 backdrop-blur transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() => goToMedia(activeIndex + 1)}
              type="button"
            >
              <HandwrittenIcon className="size-4" icon="rightArrow" />
            </button>
          </>
        ) : null}
      </div>

      {hasMultipleMedia ? <p aria-live="polite" className="mono whitespace-nowrap text-center text-[11px] tracking-[0.12em] text-muted-foreground uppercase">{dictionary.projects.mediaProgress.replace("{current}", String(activeIndex + 1)).replace("{total}", String(project.media.length))}</p> : null}
    </div>
  );
}

function ProjectPanel({ active, panelId, project, resetKey }: { active: boolean; panelId: string; project: Project; resetKey: number }) {
  const { dictionary, language } = useLanguage();

  return (
    <div
      className={`grid overflow-hidden transition-all duration-500 ease-out motion-reduce:transition-none ${
        active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
      id={panelId}
    >
      <div className="min-h-0">
        <div className="grid gap-8 border-t border-border px-5 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-8">
          <ProjectMediaCarousel active={active} key={`${project.id}-${resetKey}`} project={project} />
          <div className="space-y-6">
            <p className="max-w-xl text-sm leading-7 text-body-foreground">{project.description[language]}</p>
            {project.inDevelopment ? (
              <p className="mono inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                {dictionary.projects.inDevelopment}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {project.tech.map((tech) => (
                <Chip key={`${project.id}-${tech}`}>{tech}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {project.links.map((link) => (
                <ProjectAction key={`${project.id}-${link.kind}-${link.labelKey}`} link={link} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectsSection() {
  const { dictionary } = useLanguage();
  const sectionRef = useRef<HTMLElement | null>(null);
  const idPrefix = useId();
  const [openedProject, setOpenedProject] = useState<Project["id"] | null>(null);
  const [mediaResetKey, setMediaResetKey] = useState(0);
  const hasEnteredView = useRef(false);
  const hasAutoOpened = useRef(false);
  const navigationIntentRef = useRef<string | null>(null);

  useEffect(() => {
    const handleNavigationIntent = (event: Event) => {
      const customEvent = event as CustomEvent<{ target?: string }>;
      navigationIntentRef.current = customEvent.detail?.target ?? null;
    };

    window.addEventListener("portfolio:navigation-intent", handleNavigationIntent);

    const section = sectionRef.current;

    if (!section) {
      window.removeEventListener("portfolio:navigation-intent", handleNavigationIntent);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasEnteredView.current) {
          hasEnteredView.current = true;
        }

        const navigationIntent = navigationIntentRef.current;
        const shouldAutoOpen = navigationIntent === null || navigationIntent === "home" || navigationIntent === "projects";

        if (entry.isIntersecting && hasEnteredView.current && !hasAutoOpened.current && shouldAutoOpen) {
          hasAutoOpened.current = true;
          setMediaResetKey((current) => current + 1);
          setOpenedProject("entrenar");
        }

        if (entry.isIntersecting && navigationIntent !== null) {
          navigationIntentRef.current = null;
        }
      },
      { threshold: 0.28 },
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
      window.removeEventListener("portfolio:navigation-intent", handleNavigationIntent);
    };
  }, []);

  // Wait for the grid transition before measuring; reduced motion needs no delay.
  function scrollProjectIntoView(projectId: Project["id"]) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const doScroll = () => {
      const articleEl = sectionRef.current?.querySelector<HTMLElement>(`[data-project-id="${projectId}"]`);
      if (!articleEl) return;
      articleEl.scrollIntoView({ behavior: prefersReducedMotion ? "instant" : "smooth", block: "start" });
    };

    if (prefersReducedMotion) {
      window.requestAnimationFrame(doScroll);
    } else {
      // The collapsing sibling owns transitionend, so use a fixed delay.
      setTimeout(doScroll, 520);
    }
  }

  function toggleProject(projectId: Project["id"]) {
    hasAutoOpened.current = true;
    setMediaResetKey((resetKey) => resetKey + 1);
    setOpenedProject((current) => {
      const nextOpen = current === projectId ? null : projectId;
      if (nextOpen !== null) {
        scrollProjectIntoView(nextOpen);
      }
      return nextOpen;
    });
  }

  return (
    <SectionShell id="projects" ref={sectionRef}>
      <SectionHeading description={dictionary.projects.description} label={dictionary.projects.label} title={dictionary.projects.title} />
      <div className="overflow-hidden rounded-[28px] border border-border bg-card">
        {projects.map((project, index) => {
          const panelId = `${idPrefix}-${project.id}-panel`;
          const active = openedProject === project.id;

          return (
            <article
              className={index > 0 ? "border-t border-border" : undefined}
              data-project-id={project.id}
              key={project.id}
              style={{ scrollMarginTop: "var(--scroll-header-offset)" }}
            >
              <button
                aria-controls={panelId}
                aria-expanded={active}
                className="group flex w-full items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-foreground/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-foreground lg:px-8 lg:py-6"
                onClick={() => toggleProject(project.id)}
                type="button"
              >
                <span className="mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold tracking-[-0.02em] text-foreground">{project.name}</span>
                  <span className="mono mt-1 block text-[11px] tracking-[0.08em] text-muted-foreground uppercase">{project.tag}</span>
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border transition-transform duration-300 group-hover:border-border-strong">
                  <span className={`text-2xl leading-none transition-transform duration-300 ${active ? "rotate-45" : "rotate-0"}`}>+</span>
                </span>
              </button>
              <ProjectPanel active={active} panelId={panelId} project={project} resetKey={active ? mediaResetKey : 0} />
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}
