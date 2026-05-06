import type { AnalysisConfig, StyleConfig } from '../llm/schema';

export const defaultAnalysisConfig: AnalysisConfig = {
  mode: 'manual',
  edges: {
    enabled: true,
    threshold: 0.38,
    blur: 0.25,
  },
  lines: {
    enabled: false,
    detector: 'fast',
    threshold: 0.45,
    minLength: 0.2,
  },
  contours: {
    enabled: false,
    minArea: 0.18,
    simplify: 0.28,
  },
  motion: {
    enabled: false,
    persistence: 0.25,
  },
  depth: {
    enabled: false,
    mode: 'pseudo',
    strength: 0.45,
  },
};

export const defaultStyleConfig: StyleConfig = {
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
  vibe: {
    chaoticness: 0,
    softness: 0.28,
    density: 0.45,
  },
  layers: {
    sourceOpacity: 0.9,
    edgeGlow: 0.18,
    lineWeight: 0.32,
    lineGlow: 0.2,
    contourStroke: 0.24,
    contourFill: 0.05,
    depthFog: 0.18,
  },
  distortion: {
    noise: 0,
    pixelation: 0,
    wave: 0,
    displacement: 0,
  },
  composition: {
    blendMode: 'normal',
    opacity: 1,
    symmetry: 0,
    vignette: 0,
  },
};

export const defaultPreviewStyleConfig: StyleConfig = {
  ...defaultStyleConfig,
  palette: {
    tint: [212, 238, 226],
    saturation: 0.28,
    contrast: 0.56,
    brightness: 0.52,
  },
  motion: {
    trailLength: 0,
    blur: 0,
  },
  vibe: {
    chaoticness: 0,
    softness: 0.18,
    density: 0.52,
  },
  layers: {
    sourceOpacity: 0.62,
    edgeGlow: 0.42,
    lineWeight: 0.46,
    lineGlow: 0.48,
    contourStroke: 0.38,
    contourFill: 0.08,
    depthFog: 0.35,
  },
  distortion: {
    noise: 0,
    pixelation: 0,
    wave: 0,
    displacement: 0,
  },
  composition: {
    blendMode: 'screen',
    opacity: 1,
    symmetry: 0,
    vignette: 0.12,
  },
};

export const defaultConfig = defaultStyleConfig;
