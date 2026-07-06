"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/providers/language-provider";
import { assets, projects, type Project, type ProjectMedia } from "@/data/content";
import { Chip, SectionHeading, SectionShell } from "@/components/ui";

function ProjectAction({ link }: { link: Project["links"][number] }) {
  const { dictionary } = useLanguage();
  const label = dictionary.projects[link.labelKey];
  const icon = link.kind === "github" ? "/handwritten-icons/github.svg" : assets.icons.request;

  if (!link.href) {
    return (
      <button
        aria-label={label}
        className="mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        type="button"
      >
        {label}
        <Image alt="" aria-hidden="true" className="size-3.5 dark:invert" height={14} src={icon} width={14} />
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
      <Image alt="" aria-hidden="true" className="size-3.5 dark:invert" height={14} src={icon} width={14} />
    </a>
  );
}

function getMediaFrameClassName(aspect: ProjectMedia["aspect"]) {
  const base = "relative mx-auto overflow-hidden rounded-[20px] border border-border bg-surface";

  if (aspect === "mobile") {
    return `${base} aspect-[9/19] min-h-[28rem] w-full max-w-[17rem] sm:max-w-[18rem]`;
  }

  if (aspect === "desktop-wide") {
    return `${base} aspect-video min-h-56 w-full`;
  }

  return `${base} aspect-[16/10] min-h-64 w-full`;
}

function VideoFrame({ media, paused }: { media: ProjectMedia; paused: boolean }) {
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

    video.muted = true;

    const playVideo = () => {
      if (!videoRef.current || paused) {
        return;
      }

      void videoRef.current.play().catch(() => {
        // Autoplay can be timing-sensitive while metadata is loading.
        // Keep the video ready and retry on `canplay`/`loadeddata` instead of forcing pause.
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
    <div className={getMediaFrameClassName(media.aspect)}>
      <video
        aria-label={media.alt[language]}
        autoPlay={!paused}
        className="size-full object-contain"
        loop
        muted
        playsInline
        preload="auto"
        ref={videoRef}
        src={media.src}
      />
    </div>
  );
}

function MediaFrame({ media, paused }: { media: ProjectMedia; paused: boolean }) {
  const { language } = useLanguage();

  if (media.type === "video") {
    return <VideoFrame media={media} paused={paused} />;
  }

  return (
    <div className={getMediaFrameClassName(media.aspect)}>
      <Image alt={media.alt[language]} className="object-contain" fill sizes="(min-width: 1024px) 520px, 100vw" src={media.src} />
    </div>
  );
}

function ProjectMediaCarousel({ active, project }: { active: boolean; project: Project }) {
  const { dictionary } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const currentMedia = project.media[activeIndex];
  const hasMultipleMedia = project.media.length > 1;
  const isVideoMedia = currentMedia.type === "video";

  function goToMedia(nextIndex: number) {
    setActiveIndex((nextIndex + project.media.length) % project.media.length);
    setPaused(false);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <MediaFrame media={currentMedia} paused={paused || !active} />

        {isVideoMedia ? (
          <button
            aria-label={paused ? dictionary.projects.playLabel : dictionary.projects.pauseLabel}
            className="absolute right-4 bottom-4 grid size-10 place-items-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            onClick={() => setPaused((value) => !value)}
            type="button"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="size-4 dark:invert"
              height={16}
              src={paused ? assets.icons.play : assets.icons.pause}
              width={16}
            />
          </button>
        ) : null}

        {hasMultipleMedia ? (
          <>
            <button
              aria-label={dictionary.projects.previousMediaLabel}
              className="absolute top-1/2 left-4 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/80 backdrop-blur transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground lg:grid"
              onClick={() => goToMedia(activeIndex - 1)}
              type="button"
            >
              <Image alt="" aria-hidden="true" className="size-4 dark:invert" height={16} src="/handwritten-icons/leftChevron.svg" width={16} />
            </button>
            <button
              aria-label={dictionary.projects.nextMediaLabel}
              className="absolute top-1/2 right-4 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/80 backdrop-blur transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground lg:grid"
              onClick={() => goToMedia(activeIndex + 1)}
              type="button"
            >
              <Image alt="" aria-hidden="true" className="size-4 dark:invert" height={16} src="/handwritten-icons/rightChevron.svg" width={16} />
            </button>
          </>
        ) : null}
      </div>

      {hasMultipleMedia ? (
        <div className="flex justify-center gap-2">
          {project.media.map((media, index) => (
            <button
              aria-label={`${dictionary.projects.title} ${index + 1}`}
              className={`size-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                index === activeIndex ? "bg-foreground" : "bg-border hover:bg-muted-foreground"
              }`}
              key={`${project.id}-${media.type}-${index}`}
              onClick={() => goToMedia(index)}
              type="button"
            />
          ))}
        </div>
      ) : null}
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
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAutoOpened.current) {
          hasAutoOpened.current = true;
          setMediaResetKey((current) => current + 1);
          setOpenedProject("entrenar");
        }
      },
      { threshold: 0.28 },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  function toggleProject(projectId: Project["id"]) {
    hasAutoOpened.current = true;
    setMediaResetKey((resetKey) => resetKey + 1);
    setOpenedProject((current) => (current === projectId ? null : projectId));
  }

  return (
    <SectionShell id="projects" ref={sectionRef}>
      <SectionHeading description={dictionary.projects.description} label={dictionary.projects.label} title={dictionary.projects.title} />
      <div className="overflow-hidden rounded-[28px] border border-border bg-card">
        {projects.map((project, index) => {
          const panelId = `${idPrefix}-${project.id}-panel`;
          const active = openedProject === project.id;

          return (
            <article className={index > 0 ? "border-t border-border" : undefined} key={project.id}>
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
