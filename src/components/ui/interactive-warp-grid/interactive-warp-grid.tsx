"use client";

import { useEffect, useRef } from "react";
import {
  drawGrid,
  type WarpGridConfig,
  type WarpState,
} from "./warp-grid-engine";

type InteractiveWarpGridProps = {
  spacing?: number;
  radius?: number;
  maxDisplacement?: number;
  followSpeed?: number;
  lineOpacity?: number;
  reducedMotion?: boolean;
  className?: string;
};

type PointerState = {
  x: number;
  y: number;
  fieldX: number;
  fieldY: number;

  lastX: number;
  lastY: number;
  lastTime: number;
  lastMove: number;

  strength: number;
  target: number;

  inside: boolean;
  touching: boolean;
  initialized: boolean;

  type: PointerEvent["pointerType"];
};

const IDLE_DELAY = 110;
const TOUCH_STRENGTH = 0.7;
const BASE_MOUSE_STRENGTH = 0.28;
const MOUSE_VELOCITY_SCALE = 900;
const ENTER_EASE = 0.09;
const EXIT_EASE = 0.045;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function createPointer(): PointerState {
  return {
    x: 0,
    y: 0,
    fieldX: 0,
    fieldY: 0,

    lastX: 0,
    lastY: 0,
    lastTime: 0,
    lastMove: 0,

    strength: 0,
    target: 0,

    inside: false,
    touching: false,
    initialized: false,

    type: "mouse",
  };
}

export function InteractiveWarpGrid({
  spacing = 56,
  radius = 230,
  maxDisplacement = 5,
  followSpeed = 0.065,
  lineOpacity = 0.09,
  reducedMotion = false,
  className = "",
}: InteractiveWarpGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const context = canvasElement.getContext("2d");
    if (!context) return;

    const canvas: HTMLCanvasElement = canvasElement;
    const ctx: CanvasRenderingContext2D = context;

    const pointer = createPointer();

    const config: WarpGridConfig = {
      spacing,
      radius,
      maxDisplacement,
      lineOpacity,
    };

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let strokeColor = "rgb(0, 0, 0)";
    let colorTransitionUntil = 0;

    const getWarpState = (): WarpState => ({
      fieldX: pointer.fieldX,
      fieldY: pointer.fieldY,
      strength: pointer.strength,
    });

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function updateColor() {
      strokeColor = getComputedStyle(canvas).color;
    }

    function render(time = performance.now()) {
      if (time < colorTransitionUntil) {
        strokeColor = getComputedStyle(canvas).color;
      }

      drawGrid(
        ctx,
        width,
        height,
        time,
        strokeColor,
        getWarpState(),
        config,
      );
    }

    function getLocalPoint(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      return {
        x,
        y,
        inside:
          x >= 0 &&
          x <= rect.width &&
          y >= 0 &&
          y <= rect.height,
      };
    }

    function initializeField(x: number, y: number) {
      pointer.x = x;
      pointer.y = y;
      pointer.fieldX = x;
      pointer.fieldY = y;
      pointer.lastX = x;
      pointer.lastY = y;
      pointer.initialized = true;
    }

    function updateMouse(x: number, y: number, now: number) {
      pointer.x = x;
      pointer.y = y;

      if (pointer.lastTime) {
        const deltaTime = Math.max(now - pointer.lastTime, 1);
        const distance = Math.hypot(
          x - pointer.lastX,
          y - pointer.lastY,
        );

        const velocity = (distance / deltaTime) * 1000;
        const velocityStrength = clamp(
          velocity / MOUSE_VELOCITY_SCALE,
          0,
          1,
        );

        pointer.target =
          BASE_MOUSE_STRENGTH +
          velocityStrength * (1 - BASE_MOUSE_STRENGTH);
      } else {
        pointer.target = 0.35;
      }

      pointer.lastX = x;
      pointer.lastY = y;
      pointer.lastTime = now;
      pointer.lastMove = now;
    }

    function updatePointer(event: PointerEvent) {
      const { x, y, inside } = getLocalPoint(event);

      if (!inside) {
        if (event.pointerType === "mouse") {
          pointer.inside = false;
          pointer.target = 0;
        }

        return;
      }

      const now = performance.now();

      if (!pointer.initialized) {
        initializeField(x, y);
      }

      pointer.inside = true;
      pointer.type = event.pointerType;

      if (
        event.pointerType === "touch" ||
        event.pointerType === "pen"
      ) {
        pointer.x = x;
        pointer.y = y;
        pointer.target = TOUCH_STRENGTH;
        pointer.lastMove = now;
        return;
      }

      updateMouse(x, y, now);
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.pointerType !== "touch" &&
        event.pointerType !== "pen"
      ) {
        return;
      }

      const point = getLocalPoint(event);
      if (!point.inside) return;

      pointer.touching = true;
      pointer.initialized = false;
      pointer.type = event.pointerType;

      updatePointer(event);
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === "mouse") {
        updatePointer(event);
        return;
      }

      if (pointer.touching) {
        updatePointer(event);
      }
    }

    function handlePointerEnd(event: PointerEvent) {
      if (
        event.pointerType !== "touch" &&
        event.pointerType !== "pen"
      ) {
        return;
      }

      pointer.touching = false;
      pointer.inside = false;
      pointer.initialized = false;
      pointer.target = 0;
    }

    function animate(time: number) {
      if (pointer.inside && pointer.initialized) {
        pointer.fieldX += (pointer.x - pointer.fieldX) * followSpeed;
        pointer.fieldY += (pointer.y - pointer.fieldY) * followSpeed;
      }

      if (
        pointer.inside &&
        pointer.type === "mouse" &&
        time - pointer.lastMove > IDLE_DELAY
      ) {
        pointer.target = 0;
      }

      if (!pointer.inside) {
        pointer.target = 0;
      }

      const ease =
        pointer.target > pointer.strength
          ? ENTER_EASE
          : EXIT_EASE;

      pointer.strength +=
        (pointer.target - pointer.strength) * ease;

      if (pointer.strength < 0.001) {
        pointer.strength = 0;
      }

      render(time);
      animationFrame = requestAnimationFrame(animate);
    }

    resize();
    updateColor();
    render();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      render();
    });

    const themeObserver = new MutationObserver(() => {
      updateColor();
      render();
    });

    const handleThemeForeground = (event: Event) => {
      const customEvent = event as CustomEvent<{ duration?: number }>;
      colorTransitionUntil = performance.now() + (customEvent.detail?.duration ?? 220);
      render();
    };

    window.addEventListener("theme-transition-foreground", handleThemeForeground);

    resizeObserver.observe(canvas);

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });

    if (!reducedMotion) {
      window.addEventListener("pointerdown", handlePointerDown, {
        passive: true,
      });

      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });

      window.addEventListener("pointerup", handlePointerEnd, {
        passive: true,
      });

      window.addEventListener("pointercancel", handlePointerEnd, {
        passive: true,
      });

      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationFrame);

      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("theme-transition-foreground", handleThemeForeground);

      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [
    spacing,
    radius,
    maxDisplacement,
    followSpeed,
    lineOpacity,
    reducedMotion,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full text-foreground ${className}`}
      style={{
        maskImage:
          "radial-gradient(ellipse 94% 88% at 50% 48%, black 15%, rgba(0,0,0,.92) 48%, rgba(0,0,0,.5) 72%, transparent 96%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 94% 88% at 50% 48%, black 15%, rgba(0,0,0,.92) 48%, rgba(0,0,0,.5) 72%, transparent 96%)",
      }}
    />
  );
}
