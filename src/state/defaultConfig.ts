import type { VibeConfig } from '../llm/schema';

export const defaultConfig: VibeConfig = {
  palette: {
    tint: [255, 255, 255],
    saturation: 0.5,
    contrast: 0.5,
    brightness: 0.5,
  },
  motion: {
    trailLength: 0,
    blur: 0,
  },
  edges: {
    enabled: false,
    threshold: 0.4,
    glow: 0,
  },
  distortion: {
    noise: 0,
    pixelation: 0,
  },
};
