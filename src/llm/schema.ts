import { z } from 'zod';

const unit = z.number().min(0).max(1);
const byte = z.number().int().min(0).max(255);

export const VibeConfigSchema = z.object({
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
  edges: z.object({
    enabled: z.boolean(),
    threshold: unit,
    glow: unit,
  }),
  distortion: z.object({
    noise: unit,
    pixelation: unit,
  }),
});

export type VibeConfig = z.infer<typeof VibeConfigSchema>;

export const VibeConfigJsonSchema = {
  type: 'object',
  required: ['palette', 'motion', 'edges', 'distortion'],
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
          description: 'RGB tint applied as multiply over the frame.',
        },
        saturation: { type: 'number', minimum: 0, maximum: 1 },
        contrast:   { type: 'number', minimum: 0, maximum: 1 },
        brightness: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    motion: {
      type: 'object',
      required: ['trailLength', 'blur'],
      properties: {
        trailLength: { type: 'number', minimum: 0, maximum: 1, description: 'Higher = longer ghost trails.' },
        blur:        { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    edges: {
      type: 'object',
      required: ['enabled', 'threshold', 'glow'],
      properties: {
        enabled:   { type: 'boolean' },
        threshold: { type: 'number', minimum: 0, maximum: 1, description: 'Lower = more edges detected.' },
        glow:      { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    distortion: {
      type: 'object',
      required: ['noise', 'pixelation'],
      properties: {
        noise:      { type: 'number', minimum: 0, maximum: 1 },
        pixelation: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
  },
} as const;
