"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { assets } from "@/data/content";
import { useLanguage } from "@/components/providers/language-provider";
import { ActionLink, HandwrittenIcon } from "@/components/ui";
import { InteractiveWarpGrid } from "@/components/ui/interactive-warp-grid/interactive-warp-grid";
import { scrollToHash } from "@/features/portfolio/navigation/portfolio-navigation";

const TYPE_SPEED_MS = 26;
const LABEL_DELAY_MS = 180;
const HEADLINE_DELAY_MS = 220;
const DESCRIPTION_DELAY_MS = 180;
const ILLUSTRATION_DELAY_MS = 120;

function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);

    updatePreference();
    media.addEventListener("change", updatePreference);

    return () => media.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function splitHeadline(headline: string, italicFragment: string) {
  const italicStart = headline.indexOf(italicFragment);

  if (italicStart === -1) {
    return { prefix: headline, italic: "", suffix: "" };
  }

  return {
    prefix: headline.slice(0, italicStart),
    italic: italicFragment,
    suffix: headline.slice(italicStart + italicFragment.length),
  };
}

function metricText(metric: string, metricPrefix: string) {
  return metric.replace(metricPrefix, "").trimStart();
}

function renderTypedHeadline(headline: string, italicFragment: string, visibleCharacters: number) {
  const { prefix, italic, suffix } = splitHeadline(headline, italicFragment);
  const visiblePrefix = prefix.slice(0, visibleCharacters);
  const italicVisibleCount = Math.max(0, Math.min(italic.length, visibleCharacters - prefix.length));
  const suffixVisibleCount = Math.max(0, visibleCharacters - prefix.length - italic.length);

  return (
    <>
      {visiblePrefix}
      {italicVisibleCount > 0 ? (
        <em className="editorial text-foreground/75">{italic.slice(0, italicVisibleCount)}</em>
      ) : null}
      {suffix.slice(0, suffixVisibleCount)}
      {visibleCharacters < headline.length ? <span aria-hidden="true" className="text-foreground/40">|</span> : null}
    </>
  );
}

function HeadlineTypewriter({
  headline,
  italicFragment,
  onComplete,
  prefersReducedMotion,
  showFinal,
  shouldAnimate,
}: {
  headline: string;
  italicFragment: string;
  onComplete: () => void;
  prefersReducedMotion: boolean;
  showFinal: boolean;
  shouldAnimate: boolean;
}) {
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    let currentCharacters = 0;
    const interval = window.setInterval(() => {
      currentCharacters += 1;
      setVisibleCharacters(Math.min(currentCharacters, headline.length));

      if (currentCharacters >= headline.length) {
        window.clearInterval(interval);
        onCompleteRef.current();
      }
    }, TYPE_SPEED_MS);

    return () => window.clearInterval(interval);
  }, [headline, shouldAnimate]);

  const renderedCharacters = prefersReducedMotion || showFinal ? headline.length : visibleCharacters;

  return (
    <h1
      aria-label={headline}
      className="relative mt-7 max-w-4xl text-[36px] leading-[1.05] font-semibold tracking-[-0.06em] text-balance sm:text-5xl lg:text-[68px]"
    >
      <span aria-hidden="true" className="invisible block select-none">
        {renderTypedHeadline(headline, italicFragment, headline.length)}
      </span>
      <span className="absolute inset-0">
        {renderTypedHeadline(headline, italicFragment, renderedCharacters)}
      </span>
    </h1>
  );
}

export function Hero() {
  const { dictionary } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [labelCharacters, setLabelCharacters] = useState(0);
  const [headlineStarted, setHeadlineStarted] = useState(false);
  const [descriptionVisible, setDescriptionVisible] = useState(false);
  const [illustrationVisible, setIllustrationVisible] = useState(false);
  const [ctasVisible, setCtasVisible] = useState(false);
  const [metricVisible, setMetricVisible] = useState(false);
  const [metricCount, setMetricCount] = useState(0);
  const [metricCharacters, setMetricCharacters] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const completionTimeoutsRef = useRef<number[]>([]);
  const hero = dictionary.hero;
  const finalMetricText = useMemo(() => metricText(hero.metric, hero.metricPrefix), [hero.metric, hero.metricPrefix]);

  function handleNavigation(event: MouseEvent<HTMLAnchorElement>, hash: string) {
    event.preventDefault();
    scrollToHash(hash);
  }

  useEffect(() => {
    const timeouts: number[] = [];
    const intervals: number[] = [];
    completionTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    completionTimeoutsRef.current = [];

    const showFinalContent = () => {
      setLabelCharacters(hero.label.length);
      setHeadlineStarted(true);
      setDescriptionVisible(true);
      setIllustrationVisible(true);
      setCtasVisible(true);
      setMetricVisible(true);
      setMetricCount(3);
      setMetricCharacters(finalMetricText.length);
    };

    if (prefersReducedMotion || animationComplete) {
      showFinalContent();
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset timeline when locale or motion changes.
    setLabelCharacters(0);
    setHeadlineStarted(false);
    setAnimationComplete(false);
    setDescriptionVisible(false);
    setIllustrationVisible(false);
    setCtasVisible(true);
    setMetricVisible(true);
    setMetricCount(3);
    setMetricCharacters(finalMetricText.length);

    timeouts.push(
      window.setTimeout(() => {
        let currentLabelCharacters = 0;
        const labelInterval = window.setInterval(() => {
          currentLabelCharacters += 1;
          setLabelCharacters(Math.min(currentLabelCharacters, hero.label.length));

          if (currentLabelCharacters < hero.label.length) {
            return;
          }

          window.clearInterval(labelInterval);
          timeouts.push(
            window.setTimeout(() => setHeadlineStarted(true), HEADLINE_DELAY_MS),
          );
        }, TYPE_SPEED_MS);

        intervals.push(labelInterval);
      }, LABEL_DELAY_MS),
    );

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      intervals.forEach((interval) => window.clearInterval(interval));
      completionTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      completionTimeoutsRef.current = [];
    };
  }, [animationComplete, finalMetricText, hero.headline, hero.label, prefersReducedMotion]);

  function handleHeadlineComplete() {
    const descriptionTimeout = window.setTimeout(() => {
      setDescriptionVisible(true);
      setAnimationComplete(true);
      const illustrationTimeout = window.setTimeout(() => setIllustrationVisible(true), ILLUSTRATION_DELAY_MS);
      completionTimeoutsRef.current.push(illustrationTimeout);
    }, DESCRIPTION_DELAY_MS);
    completionTimeoutsRef.current.push(descriptionTimeout);
  }

  return (
    <main className="theme-transition-hero text-foreground">
      <section className="relative overflow-hidden px-6 pt-32 pb-20 lg:pt-40 lg:pb-28" id="top">
        <InteractiveWarpGrid
          spacing={56}
          radius={530}
          maxDisplacement={27}
          followSpeed={0.025}
          lineOpacity={0.12}
          reducedMotion={prefersReducedMotion}
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-3 lg:gap-16">
          <div className="lg:col-span-2">
            <p className="mono min-h-[1.4rem] text-[18px] tracking-[0.18em] text-muted-foreground uppercase">
              {hero.label.slice(0, labelCharacters)}
              {labelCharacters < hero.label.length ? <span aria-hidden="true" className="text-foreground/40">|</span> : null}
            </p>

            <HeadlineTypewriter
              headline={hero.headline}
              italicFragment={hero.italicFragment}
              key={hero.headline}
              onComplete={handleHeadlineComplete}
              prefersReducedMotion={prefersReducedMotion}
              showFinal={animationComplete}
              shouldAnimate={headlineStarted && !animationComplete}
            />

            <p
              className={`mt-7 max-w-xl text-base leading-8 text-body-foreground transition duration-500 ease-out motion-reduce:transition-none sm:text-[17px] ${
                descriptionVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              {hero.description}
            </p>

            <div
              className={`mt-9 flex flex-wrap gap-3 transition duration-500 ease-out motion-reduce:transition-none ${
                ctasVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              <ActionLink
                href="#contact"
                icon={
                  <HandwrittenIcon className="size-4 shrink-0" icon="card" />
                }
                label={hero.ctaContact}
                onClick={(event) => handleNavigation(event, "#contact")}
                size="lg"
                variant="primary"
              />
              <ActionLink
                href="#projects"
                icon={
                  <HandwrittenIcon className="size-4 shrink-0" icon="view" />
                }
                label={hero.ctaProjects}
                onClick={(event) => handleNavigation(event, "#projects")}
                size="lg"
                variant="outlined"
              />
              <ActionLink
                href="#services"
                icon={
                  <HandwrittenIcon className="size-4 shrink-0" icon="service" />
                }
                label={hero.ctaServices}
                onClick={(event) => handleNavigation(event, "#services")}
                size="lg"
                variant="outlined"
              />
            </div>

            <p
              className={`mono mt-8 flex min-h-8 items-center gap-2 text-sm text-body-foreground transition duration-500 ease-out motion-reduce:transition-none ${
                metricVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              <span className="text-lg font-semibold text-foreground underline decoration-foreground underline-offset-4">
                +{metricCount}
              </span>
              <span>
                {finalMetricText.slice(0, metricCharacters)}
                {metricCharacters < finalMetricText.length ? <span aria-hidden="true" className="text-foreground/40">|</span> : null}
              </span>
            </p>
          </div>

          <aside
            className={`hidden transition duration-700 ease-out motion-reduce:transition-none lg:block ${
              illustrationVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
            aria-label={hero.illustrationPhrase}
          >
            <div className="relative ml-auto w-full max-w-[430px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- Native AVIF rendering avoids optimization issues. */}
              <img
                alt=""
                aria-hidden="true"
                className="hero-organic-mask pointer-events-none absolute inset-0 h-auto w-full scale-[1.035] object-contain opacity-45 blur-md dark:opacity-15 dark:blur-lg dark:brightness-[0.85] dark:contrast-[1.08]"
                decoding="async"
                loading="lazy"
                src={assets.hero}
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- Native AVIF rendering avoids optimization issues. */}
              <img
                alt=""
                aria-hidden="true"
                className="hero-organic-mask relative h-auto w-full object-contain dark:opacity-[0.88] dark:brightness-[0.85] dark:contrast-[1.08]"
                decoding="async"
                loading="lazy"
                src={assets.hero}
              />
              <p className="editorial mt-3 text-right text-sm text-muted-foreground">
                {hero.illustrationPhrase}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
