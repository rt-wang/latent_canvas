import type { VibeConfig } from '../llm/schema';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const RATES = {
  palette: 0.05,
  motion: 0.02,
  edges: 0.05,
  distortion: 0.08,
} as const;

export function lerpConfig(current: VibeConfig, target: VibeConfig): VibeConfig {
  const rP = RATES.palette;
  const rM = RATES.motion;
  const rE = RATES.edges;
  const rD = RATES.distortion;

  return {
    palette: {
      tint: [
        Math.round(lerp(current.palette.tint[0], target.palette.tint[0], rP)),
        Math.round(lerp(current.palette.tint[1], target.palette.tint[1], rP)),
        Math.round(lerp(current.palette.tint[2], target.palette.tint[2], rP)),
      ],
      saturation: lerp(current.palette.saturation, target.palette.saturation, rP),
      contrast:   lerp(current.palette.contrast,   target.palette.contrast,   rP),
      brightness: lerp(current.palette.brightness, target.palette.brightness, rP),
    },
    motion: {
      trailLength: lerp(current.motion.trailLength, target.motion.trailLength, rM),
      blur:        lerp(current.motion.blur,        target.motion.blur,        rM),
    },
    edges: {
      // boolean: snap when target's effective glow is meaningful, else hold
      enabled:   target.edges.enabled,
      threshold: lerp(current.edges.threshold, target.edges.threshold, rE),
      glow:      lerp(current.edges.glow,      target.edges.glow,      rE),
    },
    distortion: {
      noise:      lerp(current.distortion.noise,      target.distortion.noise,      rD),
      pixelation: lerp(current.distortion.pixelation, target.distortion.pixelation, rD),
    },
  };
}
