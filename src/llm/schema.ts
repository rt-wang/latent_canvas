import { z } from 'zod';

const unit = z.number().min(0).max(1);
const byte = z.number().int().min(0).max(255);

export const AnalysisConfigSchema = z.object({
  mode: z.enum(['manual', 'auto-suggest']),
  edges: z.object({
    enabled: z.boolean(),
    threshold: unit,
    blur: unit,
  }),
  lines: z.object({
    enabled: z.boolean(),
    detector: z.enum(['fast']),
    threshold: unit,
    minLength: unit,
  }),
  contours: z.object({
    enabled: z.boolean(),
    minArea: unit,
    simplify: unit,
  }),
  motion: z.object({
    enabled: z.boolean(),
    persistence: unit,
  }),
  depth: z.object({
    enabled: z.boolean(),
    mode: z.enum(['pseudo', 'ml']),
    strength: unit,
  }),
});

export const StyleConfigSchema = z.object({
  palette: z.object({
    tint: z.tuple([byte, byte, byte]),
    saturation: unit,
    contrast: unit,
    brightness: unit,
  }),
  motion: z.object({
    trailLength: unit,
    blur: unit,
  }),
  vibe: z.object({
    chaoticness: unit,
    softness: unit,
    density: unit,
  }),
  layers: z.object({
    sourceOpacity: unit,
    edgeGlow: unit,
    lineWeight: unit,
    lineGlow: unit,
    contourStroke: unit,
    contourFill: unit,
    depthFog: unit,
  }),
  distortion: z.object({
    noise: unit,
    pixelation: unit,
    wave: unit,
    displacement: unit,
  }),
  composition: z.object({
    blendMode: z.enum(['normal', 'screen', 'multiply', 'difference', 'overlay']),
    opacity: unit,
    symmetry: unit,
    vignette: unit,
  }),
  audioMapping: z
    .object({
      edgeDensity: z.string().optional(),
      motionAmount: z.string().optional(),
      brightness: z.string().optional(),
      contourCount: z.string().optional(),
      lineCount: z.string().optional(),
    })
    .optional(),
});

export const SessionConfigSchema = z.object({
  analysis: AnalysisConfigSchema,
  style: StyleConfigSchema,
  renderMode: z.enum(['geometry-preview', 'styled']),
});

export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;
export type StyleConfig = z.infer<typeof StyleConfigSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
export type RenderMode = SessionConfig['renderMode'];

// Compatibility aliases while the app migrates from the old phase-1 naming.
export const VibeConfigSchema = StyleConfigSchema;
export type VibeConfig = StyleConfig;

export const StyleConfigJsonSchema = {
  type: 'object',
  required: ['palette', 'motion', 'vibe', 'layers', 'distortion', 'composition'],
  properties: {
    palette: {
      type: 'object',
      required: ['tint', 'saturation', 'contrast', 'brightness'],
      properties: {
        tint: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 255 },
          minItems: 3,
          maxItems: 3,
          description: 'RGB tint applied to the source and geometry layers.',
        },
        saturation: { type: 'number', minimum: 0, maximum: 1 },
        contrast: { type: 'number', minimum: 0, maximum: 1 },
        brightness: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    motion: {
      type: 'object',
      required: ['trailLength', 'blur'],
      properties: {
        trailLength: { type: 'number', minimum: 0, maximum: 1 },
        blur: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    vibe: {
      type: 'object',
      required: ['chaoticness', 'softness', 'density'],
      properties: {
        chaoticness: { type: 'number', minimum: 0, maximum: 1 },
        softness: { type: 'number', minimum: 0, maximum: 1 },
        density: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    layers: {
      type: 'object',
      required: [
        'sourceOpacity',
        'edgeGlow',
        'lineWeight',
        'lineGlow',
        'contourStroke',
        'contourFill',
        'depthFog',
      ],
      properties: {
        sourceOpacity: { type: 'number', minimum: 0, maximum: 1 },
        edgeGlow: { type: 'number', minimum: 0, maximum: 1 },
        lineWeight: { type: 'number', minimum: 0, maximum: 1 },
        lineGlow: { type: 'number', minimum: 0, maximum: 1 },
        contourStroke: { type: 'number', minimum: 0, maximum: 1 },
        contourFill: { type: 'number', minimum: 0, maximum: 1 },
        depthFog: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    distortion: {
      type: 'object',
      required: ['noise', 'pixelation', 'wave', 'displacement'],
      properties: {
        noise: { type: 'number', minimum: 0, maximum: 1 },
        pixelation: { type: 'number', minimum: 0, maximum: 1 },
        wave: { type: 'number', minimum: 0, maximum: 1 },
        displacement: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    composition: {
      type: 'object',
      required: ['blendMode', 'opacity', 'symmetry', 'vignette'],
      properties: {
        blendMode: {
          type: 'string',
          enum: ['normal', 'screen', 'multiply', 'difference', 'overlay'],
        },
        opacity: { type: 'number', minimum: 0, maximum: 1 },
        symmetry: { type: 'number', minimum: 0, maximum: 1 },
        vignette: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    audioMapping: {
      type: 'object',
      properties: {
        edgeDensity: { type: 'string' },
        motionAmount: { type: 'string' },
        brightness: { type: 'string' },
        contourCount: { type: 'string' },
        lineCount: { type: 'string' },
      },
    },
  },
} as const;

export const VibeConfigJsonSchema = StyleConfigJsonSchema;
