export type WarpGridConfig = {
  spacing: number;
  radius: number;
  maxDisplacement: number;
  lineOpacity: number;
};

export type WarpState = {
  fieldX: number;
  fieldY: number;
  strength: number;
};

const SAMPLE_STEP = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const smoothstep = (value: number) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

export function warpPoint(
  x: number,
  y: number,
  time: number,
  state: WarpState,
  config: WarpGridConfig,
): [number, number] {
  const { fieldX, fieldY, strength } = state;
  const { radius, maxDisplacement } = config;

  if (strength < 0.001) return [x, y];

  const dx = x - fieldX;
  const dy = y - fieldY;
  const distance = Math.hypot(dx, dy);

  if (distance >= radius) return [x, y];

  const normalized = 1 - distance / radius;
  const influence = smoothstep(normalized) * normalized;
  const safeDistance = Math.max(distance, 0.001);

  const radialX = dx / safeDistance;
  const radialY = dy / safeDistance;

  const tangentX = -radialY;
  const tangentY = radialX;

  const t = time * 0.00045;

  const organic =
    Math.sin(distance * 0.026 + t * 1.1 + radialX * 1.8) * 0.52 +
    Math.sin(dx * 0.018 - dy * 0.014 - t * 0.75) * 0.3 +
    Math.sin((dx + dy) * 0.011 + t * 0.42) * 0.18;

  const radialWave = Math.sin(distance * 0.02 - t * 0.65);
  const displacement = maxDisplacement * strength * influence;

  const tangentAmount = displacement * organic * 0.85;
  const radialAmount = displacement * radialWave * 0.32;

  return [
    x + tangentX * tangentAmount + radialX * radialAmount,
    y + tangentY * tangentAmount + radialY * radialAmount,
  ];
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  strokeColor: string,
  state: WarpState,
  config: WarpGridConfig,
) {
  const { spacing, lineOpacity } = config;

  ctx.clearRect(0, 0, width, height);
  ctx.save();

  ctx.strokeStyle = strokeColor;
  ctx.globalAlpha = lineOpacity;
  ctx.lineWidth = 1;
  ctx.beginPath();

  if (state.strength < 0.001) {
    for (let x = 0; x <= width + spacing; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }

    for (let y = 0; y <= height + spacing; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    ctx.stroke();
    ctx.restore();
    return;
  }

  for (let gridX = 0; gridX <= width + spacing; gridX += spacing) {
    let first = true;

    for (
      let y = -SAMPLE_STEP;
      y <= height + SAMPLE_STEP;
      y += SAMPLE_STEP
    ) {
      const [px, py] = warpPoint(gridX, y, time, state, config);

      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
  }

  for (let gridY = 0; gridY <= height + spacing; gridY += spacing) {
    let first = true;

    for (
      let x = -SAMPLE_STEP;
      x <= width + SAMPLE_STEP;
      x += SAMPLE_STEP
    ) {
      const [px, py] = warpPoint(x, gridY, time, state, config);

      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
  }

  ctx.stroke();
  ctx.restore();
}