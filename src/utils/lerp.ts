import type { StyleConfig } from '../llm/schema';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const RATES = {
  palette: 0.05,
  motion: 0.02,
  vibe: 0.08,
  layers: 0.06,
  distortion: 0.08,
  composition: 0.05,
} as const;

export function lerpStyleConfig(current: StyleConfig, target: StyleConfig): StyleConfig {
  const rP = RATES.palette;
  const rM = RATES.motion;
  const rV = RATES.vibe;
  const rL = RATES.layers;
  const rD = RATES.distortion;
  const rC = RATES.composition;

  return {
    palette: {
      tint: [
        Math.round(lerp(current.palette.tint[0], target.palette.tint[0], rP)),
        Math.round(lerp(current.palette.tint[1], target.palette.tint[1], rP)),
        Math.round(lerp(current.palette.tint[2], target.palette.tint[2], rP)),
      ],
      saturation: lerp(current.palette.saturation, target.palette.saturation, rP),
      contrast: lerp(current.palette.contrast, target.palette.contrast, rP),
      brightness: lerp(current.palette.brightness, target.palette.brightness, rP),
    },
    motion: {
      trailLength: lerp(current.motion.trailLength, target.motion.trailLength, rM),
      blur: lerp(current.motion.blur, target.motion.blur, rM),
    },
    vibe: {
      chaoticness: lerp(current.vibe.chaoticness, target.vibe.chaoticness, rV),
      softness: lerp(current.vibe.softness, target.vibe.softness, rV),
      density: lerp(current.vibe.density, target.vibe.density, rV),
    },
    layers: {
      sourceOpacity: lerp(current.layers.sourceOpacity, target.layers.sourceOpacity, rL),
      edgeGlow: lerp(current.layers.edgeGlow, target.layers.edgeGlow, rL),
      lineWeight: lerp(current.layers.lineWeight, target.layers.lineWeight, rL),
      lineGlow: lerp(current.layers.lineGlow, target.layers.lineGlow, rL),
      contourStroke: lerp(current.layers.contourStroke, target.layers.contourStroke, rL),
      contourFill: lerp(current.layers.contourFill, target.layers.contourFill, rL),
      depthFog: lerp(current.layers.depthFog, target.layers.depthFog, rL),
    },
    distortion: {
      noise: lerp(current.distortion.noise, target.distortion.noise, rD),
      pixelation: lerp(current.distortion.pixelation, target.distortion.pixelation, rD),
      wave: lerp(current.distortion.wave, target.distortion.wave, rD),
      displacement: lerp(current.distortion.displacement, target.distortion.displacement, rD),
    },
    composition: {
      blendMode: target.composition.blendMode,
      opacity: lerp(current.composition.opacity, target.composition.opacity, rC),
      symmetry: lerp(current.composition.symmetry, target.composition.symmetry, rC),
      vignette: lerp(current.composition.vignette, target.composition.vignette, rC),
    },
    audioMapping: target.audioMapping,
  };
}

export const lerpConfig = lerpStyleConfig;
