"use client";

import { useEffect, useMemo, useState } from "react";
import { assets } from "@/data/content";
import { useLanguage } from "@/components/providers/language-provider";

const TYPE_SPEED_MS = 26;
const LABEL_DELAY_MS = 180;
const HEADLINE_DELAY_MS = 220;
const DESCRIPTION_DELAY_MS = 180;
const ILLUSTRATION_DELAY_MS = 120;
const CTA_DELAY_MS = 160;
const METRIC_STEP_MS = 120;

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
        <em className="font-serif italic text-foreground/75">{italic.slice(0, italicVisibleCount)}</em>
      ) : null}
      {suffix.slice(0, suffixVisibleCount)}
      {visibleCharacters < headline.length ? <span aria-hidden="true" className="text-foreground/40">|</span> : null}
    </>
  );
}

function HeroCta({
  href,
  children,
  variant,
  icon,
  iconPosition = "right",
}: {
  href: string;
  children: string;
  variant: "primary" | "outlined";
  icon?: string;
  iconPosition?: "left" | "right";
}) {
  const variantClassName = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    outlined: "border border-foreground/20 text-foreground hover:bg-foreground hover:text-background",
  }[variant];
  const iconClassName = {
    primary: "size-4 shrink-0 invert dark:invert-0",
    outlined: "size-4 shrink-0 transition group-hover:invert dark:invert dark:group-hover:invert-0",
  }[variant];
  const iconElement = icon ? (
    // eslint-disable-next-line @next/next/no-img-element -- Handwritten SVG icons are static public assets.
    <img alt="" aria-hidden="true" className={iconClassName} src={icon} />
  ) : null;

  return (
    <a
      className={`group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${variantClassName}`}
      href={href}
    >
      {iconPosition === "left" ? iconElement : null}
      {children}
      {iconPosition === "right" ? iconElement : null}
    </a>
  );
}

export function Hero() {
  const { dictionary } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [labelCharacters, setLabelCharacters] = useState(0);
  const [headlineCharacters, setHeadlineCharacters] = useState(0);
  const [descriptionVisible, setDescriptionVisible] = useState(false);
  const [illustrationVisible, setIllustrationVisible] = useState(false);
  const [ctasVisible, setCtasVisible] = useState(false);
  const [metricVisible, setMetricVisible] = useState(false);
  const [metricCount, setMetricCount] = useState(0);
  const [metricCharacters, setMetricCharacters] = useState(0);
  const hero = dictionary.hero;
  const finalMetricText = useMemo(() => metricText(hero.metric, hero.metricPrefix), [hero.metric, hero.metricPrefix]);

  useEffect(() => {
    const timeouts: number[] = [];
    const intervals: number[] = [];

    const startAnimation = () => {
      setLabelCharacters(prefersReducedMotion ? hero.label.length : 0);
      setHeadlineCharacters(prefersReducedMotion ? hero.headline.length : 0);
      setDescriptionVisible(prefersReducedMotion);
      setIllustrationVisible(prefersReducedMotion);
      setCtasVisible(prefersReducedMotion);
      setMetricVisible(prefersReducedMotion);
      setMetricCount(prefersReducedMotion ? 3 : 0);
      setMetricCharacters(prefersReducedMotion ? finalMetricText.length : 0);

      if (prefersReducedMotion) {
        return;
      }

      timeouts.push(
        window.setTimeout(() => {
        let currentLabelCharacters = 0;
        const labelInterval = window.setInterval(() => {
          currentLabelCharacters += 1;
          setLabelCharacters(Math.min(currentLabelCharacters, hero.label.length));

          if (currentLabelCharacters >= hero.label.length) {
            window.clearInterval(labelInterval);

            timeouts.push(
              window.setTimeout(() => {
                let currentHeadlineCharacters = 0;
                const headlineInterval = window.setInterval(() => {
                  currentHeadlineCharacters += 1;
                  setHeadlineCharacters(Math.min(currentHeadlineCharacters, hero.headline.length));

                  if (currentHeadlineCharacters >= hero.headline.length) {
                    window.clearInterval(headlineInterval);

                    timeouts.push(
                      window.setTimeout(() => {
                        setDescriptionVisible(true);

                        timeouts.push(
                          window.setTimeout(() => {
                            setIllustrationVisible(true);

                            timeouts.push(
                              window.setTimeout(() => {
                                setCtasVisible(true);

                                timeouts.push(
                                  window.setTimeout(() => {
                                    setMetricVisible(true);

                                    let currentCount = 0;
                                    const countInterval = window.setInterval(() => {
                                      currentCount += 1;
                                      setMetricCount(Math.min(currentCount, 3));

                                      if (currentCount >= 3) {
                                        window.clearInterval(countInterval);
                                      }
                                    }, METRIC_STEP_MS);

                                    let currentMetricCharacters = 0;
                                    const metricInterval = window.setInterval(() => {
                                      currentMetricCharacters += 1;
                                      setMetricCharacters(Math.min(currentMetricCharacters, finalMetricText.length));

                                      if (currentMetricCharacters >= finalMetricText.length) {
                                        window.clearInterval(metricInterval);
                                      }
                                    }, TYPE_SPEED_MS);

                                    intervals.push(countInterval, metricInterval);
                                  }, CTA_DELAY_MS),
                                );
                              }, CTA_DELAY_MS),
                            );
                          }, ILLUSTRATION_DELAY_MS),
                        );
                      }, DESCRIPTION_DELAY_MS),
                    );
                  }
                }, TYPE_SPEED_MS);

                intervals.push(headlineInterval);
              }, HEADLINE_DELAY_MS),
            );
          }
        }, TYPE_SPEED_MS);

        intervals.push(labelInterval);
      }, LABEL_DELAY_MS),
      );
    };

    timeouts.push(window.setTimeout(startAnimation, 0));

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      intervals.forEach((interval) => window.clearInterval(interval));
    };
  }, [finalMetricText, hero.headline, hero.label, prefersReducedMotion]);

  return (
    <main className="bg-background text-foreground">
      <section className="relative overflow-hidden px-6 pt-32 pb-20 lg:pt-40 lg:pb-28" id="top">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_7%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_7%,transparent)_1px,transparent_1px)] bg-[size:56px_56px] opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_72%)]"
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-3 lg:gap-16">
          <div className="lg:col-span-2">
            <p className="mono min-h-[1.4rem] text-[18px] tracking-[0.18em] text-muted-foreground uppercase">
              {hero.label.slice(0, labelCharacters)}
              {labelCharacters < hero.label.length ? <span aria-hidden="true" className="text-foreground/40">|</span> : null}
            </p>

            <h1
              aria-label={hero.headline}
              className="mt-7 max-w-4xl text-[36px] leading-[1.05] font-semibold tracking-[-0.06em] text-balance sm:text-5xl lg:text-[68px]"
            >
              {renderTypedHeadline(hero.headline, hero.italicFragment, headlineCharacters)}
            </h1>

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
              <HeroCta href="#contact" icon={assets.icons.card} iconPosition="left" variant="primary">
                {hero.ctaContact}
              </HeroCta>
              <HeroCta href="#projects" icon={assets.icons.view} variant="outlined">
                {hero.ctaProjects}
              </HeroCta>
              <HeroCta href="#services" icon={assets.icons.service} variant="outlined">
                {hero.ctaServices}
              </HeroCta>
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
              {/* eslint-disable-next-line @next/next/no-img-element -- PRD requires native AVIF rendering to avoid optimization issues. */}
              <img
                alt=""
                aria-hidden="true"
                className="hero-organic-mask pointer-events-none absolute inset-0 h-auto w-full scale-[1.035] object-contain opacity-45 blur-md dark:opacity-15 dark:blur-lg dark:invert dark:brightness-[0.85] dark:contrast-[1.08]"
                decoding="async"
                loading="eager"
                src={assets.hero}
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- PRD requires native AVIF rendering to avoid optimization issues. */}
              <img
                alt=""
                aria-hidden="true"
                className="hero-organic-mask relative h-auto w-full object-contain dark:opacity-[0.88] dark:invert dark:brightness-[0.85] dark:contrast-[1.08]"
                decoding="async"
                loading="eager"
                src={assets.hero}
              />
              <p className="mt-3 text-right font-serif text-sm italic text-muted-foreground">
                {hero.illustrationPhrase}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
