import dotenv from 'dotenv';
dotenv.config({ override: true });
import express, { type Response } from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import {
  AnalysisConfigSchema,
  StyleConfigJsonSchema,
  StyleConfigSchema,
  type AnalysisConfig,
  type StyleConfig,
} from '../src/llm/schema.js';
import { defaultStyleConfig } from '../src/state/defaultConfig.js';

const PORT = Number(process.env.PORT ?? 3001);
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('[server] ANTHROPIC_API_KEY is not set; /api/config will use local fallback mode.');
}

const SYSTEM_PROMPT = `You are a visual art direction engine for a live geometry renderer.

The user manually chooses the computer vision geometry layers. Your job is to style those active layers.

Rules:
- Do NOT generate code. Do NOT explain your choices. Use the provided tool to emit style configuration only.
- Do NOT change the analysis pipeline.
- All numeric values are between 0 and 1 unless otherwise specified.
- "tint" is an RGB array of three integers between 0 and 255.
- Build on the current style: nudge values when the user refines; restructure when they switch mood.

Available style controls:
- palette.tint, saturation, contrast, brightness.
- motion.trailLength and blur.
- vibe.chaoticness, softness, density.
- layers.sourceOpacity, edgeGlow, lineWeight, lineGlow, contourStroke, contourFill, depthFog.
- distortion.noise, pixelation, wave, displacement.
- composition.blendMode, opacity, symmetry, vignette.

Mood vocabulary:
- lonely: desaturated, cool tint, sparse geometry, soft depth haze.
- anxious: high chaoticness, high noise, hard contrast, sharp line emphasis.
- nostalgic: warm tint, low contrast, long trails, soft contour fill.
- sacred: gold tint, low motion, glowing lines, diffuse fog.
- violent: high contrast, red tint, sharp edges, aggressive displacement.
- underwater: blue-green tint, blur, depth fog, low contrast.
- glitchy: pixelation, noise, difference blend, broken line energy.
- dreamlike: soft blur, pastel tint, trails, depth wash.
- mechanical: high edge clarity, precise lines, cool palette, low softness.`;

const TOOL = {
  name: 'set_style_config',
  description: 'Emit the style configuration for the active geometry renderer.',
  input_schema: StyleConfigJsonSchema as any,
};

const client = apiKey ? new Anthropic({ apiKey }) : null;

type StyleConfigPatch = {
  palette?: Partial<StyleConfig['palette']>;
  motion?: Partial<StyleConfig['motion']>;
  vibe?: Partial<StyleConfig['vibe']>;
  layers?: Partial<StyleConfig['layers']>;
  distortion?: Partial<StyleConfig['distortion']>;
  composition?: Partial<StyleConfig['composition']>;
};

type FallbackReason = 'missing_api_key' | 'credit_balance_low' | 'rate_limited' | 'provider_unavailable';

const INTENSITY_UP_WORDS = [
  'very',
  'extreme',
  'extremely',
  'intense',
  'heavy',
  'dramatic',
  'aggressive',
  'maximum',
  'super',
  'ultra',
];
const INTENSITY_DOWN_WORDS = ['slight', 'slightly', 'subtle', 'gentle', 'soft', 'minimal', 'a little', 'just a bit'];

const FALLBACK_PROFILES: Array<{ name: string; keywords: string[]; patch: StyleConfigPatch; strength: number }> = [
  {
    name: 'nostalgic',
    keywords: ['memory', 'decay', 'decaying', 'nostalg', 'sepia', 'aged', 'vintage'],
    patch: {
      palette: { tint: [214, 184, 138], saturation: 0.24, contrast: 0.35, brightness: 0.45 },
      motion: { trailLength: 0.64, blur: 0.32 },
      vibe: { chaoticness: 0.18, softness: 0.68, density: 0.38 },
      layers: { lineGlow: 0.42, contourFill: 0.16, depthFog: 0.45 },
      distortion: { noise: 0.22, pixelation: 0.04 },
    },
    strength: 0.64,
  },
  {
    name: 'anxious',
    keywords: ['anxious', 'panic', 'static', 'glitch', 'glitchy', 'unstable', 'tense'],
    patch: {
      palette: { tint: [204, 214, 255], saturation: 0.32, contrast: 0.84, brightness: 0.48 },
      motion: { trailLength: 0.16, blur: 0.05 },
      vibe: { chaoticness: 0.86, softness: 0.12, density: 0.78 },
      layers: { edgeGlow: 0.7, lineWeight: 0.58, lineGlow: 0.64, contourStroke: 0.55 },
      distortion: { noise: 0.82, pixelation: 0.48, displacement: 0.42 },
      composition: { blendMode: 'difference', vignette: 0.46 },
    },
    strength: 0.72,
  },
  {
    name: 'sacred',
    keywords: ['sacred', 'slow', 'ritual', 'holy', 'reverent', 'ceremonial'],
    patch: {
      palette: { tint: [226, 202, 144], saturation: 0.36, contrast: 0.46, brightness: 0.56 },
      motion: { trailLength: 0.24, blur: 0.18 },
      vibe: { chaoticness: 0.1, softness: 0.62, density: 0.34 },
      layers: { edgeGlow: 0.45, lineGlow: 0.72, depthFog: 0.5 },
      distortion: { noise: 0.04, pixelation: 0.02, wave: 0.1 },
      composition: { blendMode: 'screen', vignette: 0.26 },
    },
    strength: 0.58,
  },
  {
    name: 'violent',
    keywords: ['violent', 'red', 'danger', 'rage', 'brutal', 'hostile', 'blood'],
    patch: {
      palette: { tint: [188, 70, 58], saturation: 0.62, contrast: 0.9, brightness: 0.43 },
      motion: { trailLength: 0.08, blur: 0.03 },
      vibe: { chaoticness: 0.74, softness: 0.06, density: 0.72 },
      layers: { edgeGlow: 0.78, lineWeight: 0.72, contourStroke: 0.66 },
      distortion: { noise: 0.34, pixelation: 0.42, displacement: 0.52 },
    },
    strength: 0.74,
  },
  {
    name: 'underwater',
    keywords: ['underwater', 'ocean', 'sea', 'submerged', 'tidal', 'aquatic'],
    patch: {
      palette: { tint: [112, 170, 188], saturation: 0.38, contrast: 0.36, brightness: 0.47 },
      motion: { trailLength: 0.38, blur: 0.46 },
      vibe: { chaoticness: 0.16, softness: 0.78, density: 0.42 },
      layers: { sourceOpacity: 0.54, depthFog: 0.72, lineGlow: 0.28 },
      distortion: { noise: 0.06, wave: 0.34, displacement: 0.2 },
    },
    strength: 0.62,
  },
  {
    name: 'mechanical',
    keywords: ['mechanical', 'machine', 'industrial', 'metal', 'robotic', 'clinical', 'circuit', 'circuitry'],
    patch: {
      palette: { tint: [210, 220, 224], saturation: 0.18, contrast: 0.72, brightness: 0.5 },
      motion: { trailLength: 0.06, blur: 0.02 },
      vibe: { chaoticness: 0.16, softness: 0.08, density: 0.68 },
      layers: { sourceOpacity: 0.42, edgeGlow: 0.34, lineWeight: 0.58, lineGlow: 0.36, contourStroke: 0.28 },
      distortion: { noise: 0.03, pixelation: 0.08 },
    },
    strength: 0.58,
  },
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function countHits(text: string, phrases: string[]): number {
  return phrases.reduce((count, phrase) => count + (text.includes(phrase) ? 1 : 0), 0);
}

function computeIntensity(text: string): number {
  const raised = countHits(text, INTENSITY_UP_WORDS);
  const lowered = countHits(text, INTENSITY_DOWN_WORDS);
  let intensity = 0.56 + raised * 0.08 - lowered * 0.08;
  if (text.includes('!')) intensity += 0.04;
  return clamp01(intensity);
}

function blend(base: StyleConfig, target: StyleConfigPatch, strength: number): StyleConfig {
  const s = clamp01(strength);
  const lerp = (a: number, b: number) => a + (b - a) * s;
  const palette = target.palette ?? {};
  const motion = target.motion ?? {};
  const vibe = target.vibe ?? {};
  const layers = target.layers ?? {};
  const distortion = target.distortion ?? {};
  const composition = target.composition ?? {};

  return {
    palette: {
      tint: [
        clampByte(lerp(base.palette.tint[0], palette.tint?.[0] ?? base.palette.tint[0])),
        clampByte(lerp(base.palette.tint[1], palette.tint?.[1] ?? base.palette.tint[1])),
        clampByte(lerp(base.palette.tint[2], palette.tint?.[2] ?? base.palette.tint[2])),
      ],
      saturation: clamp01(lerp(base.palette.saturation, palette.saturation ?? base.palette.saturation)),
      contrast: clamp01(lerp(base.palette.contrast, palette.contrast ?? base.palette.contrast)),
      brightness: clamp01(lerp(base.palette.brightness, palette.brightness ?? base.palette.brightness)),
    },
    motion: {
      trailLength: clamp01(lerp(base.motion.trailLength, motion.trailLength ?? base.motion.trailLength)),
      blur: clamp01(lerp(base.motion.blur, motion.blur ?? base.motion.blur)),
    },
    vibe: {
      chaoticness: clamp01(lerp(base.vibe.chaoticness, vibe.chaoticness ?? base.vibe.chaoticness)),
      softness: clamp01(lerp(base.vibe.softness, vibe.softness ?? base.vibe.softness)),
      density: clamp01(lerp(base.vibe.density, vibe.density ?? base.vibe.density)),
    },
    layers: {
      sourceOpacity: clamp01(lerp(base.layers.sourceOpacity, layers.sourceOpacity ?? base.layers.sourceOpacity)),
      edgeGlow: clamp01(lerp(base.layers.edgeGlow, layers.edgeGlow ?? base.layers.edgeGlow)),
      lineWeight: clamp01(lerp(base.layers.lineWeight, layers.lineWeight ?? base.layers.lineWeight)),
      lineGlow: clamp01(lerp(base.layers.lineGlow, layers.lineGlow ?? base.layers.lineGlow)),
      contourStroke: clamp01(lerp(base.layers.contourStroke, layers.contourStroke ?? base.layers.contourStroke)),
      contourFill: clamp01(lerp(base.layers.contourFill, layers.contourFill ?? base.layers.contourFill)),
      depthFog: clamp01(lerp(base.layers.depthFog, layers.depthFog ?? base.layers.depthFog)),
    },
    distortion: {
      noise: clamp01(lerp(base.distortion.noise, distortion.noise ?? base.distortion.noise)),
      pixelation: clamp01(lerp(base.distortion.pixelation, distortion.pixelation ?? base.distortion.pixelation)),
      wave: clamp01(lerp(base.distortion.wave, distortion.wave ?? base.distortion.wave)),
      displacement: clamp01(lerp(base.distortion.displacement, distortion.displacement ?? base.distortion.displacement)),
    },
    composition: {
      blendMode: composition.blendMode ?? base.composition.blendMode,
      opacity: clamp01(lerp(base.composition.opacity, composition.opacity ?? base.composition.opacity)),
      symmetry: clamp01(lerp(base.composition.symmetry, composition.symmetry ?? base.composition.symmetry)),
      vignette: clamp01(lerp(base.composition.vignette, composition.vignette ?? base.composition.vignette)),
    },
    audioMapping: base.audioMapping,
  };
}

function deriveFromAnalysis(style: StyleConfig, analysis: AnalysisConfig | null): StyleConfig {
  if (!analysis) return style;
  let next = style;
  if (analysis.edges.enabled) next = blend(next, { layers: { edgeGlow: 0.46 } }, 0.24);
  if (analysis.lines.enabled) next = blend(next, { layers: { sourceOpacity: 0.56, lineWeight: 0.52, lineGlow: 0.5 } }, 0.3);
  if (analysis.contours.enabled) next = blend(next, { layers: { contourStroke: 0.42, contourFill: 0.12 } }, 0.26);
  if (analysis.depth.enabled) next = blend(next, { layers: { sourceOpacity: 0.52, depthFog: 0.58 } }, 0.26);
  if (analysis.motion.enabled) next = blend(next, { vibe: { chaoticness: 0.42 }, distortion: { displacement: 0.2 } }, 0.2);
  return next;
}

function deriveLocalStyle(prompt: string, currentStyle: unknown, analysisInput: unknown): StyleConfig {
  const parsedStyle = StyleConfigSchema.safeParse(currentStyle);
  const parsedAnalysis = AnalysisConfigSchema.safeParse(analysisInput);
  let style = parsedStyle.success ? parsedStyle.data : defaultStyleConfig;
  const analysis = parsedAnalysis.success ? parsedAnalysis.data : null;
  const text = prompt.toLowerCase();
  const intensity = computeIntensity(text);

  style = deriveFromAnalysis(style, analysis);

  for (const profile of FALLBACK_PROFILES) {
    const hits = countHits(text, profile.keywords);
    if (hits > 0) {
      style = blend(style, profile.patch, clamp01(profile.strength + (hits - 1) * 0.08 + (intensity - 0.56) * 0.35));
    }
  }

  if (text.includes('brighter') || text.includes('glowing') || text.includes('luminous')) {
    style = blend(style, { palette: { brightness: 0.7 }, layers: { lineGlow: 0.7, edgeGlow: 0.62 } }, 0.28);
  }
  if (text.includes('darker') || text.includes('shadow') || text.includes('moody')) {
    style = blend(style, { palette: { brightness: 0.28, contrast: 0.72 }, composition: { vignette: 0.62 } }, 0.3);
  }
  if (text.includes('soft') || text.includes('fog') || text.includes('haze')) {
    style = blend(style, { vibe: { softness: 0.78 }, layers: { depthFog: 0.68 }, motion: { blur: 0.32 } }, 0.32);
  }
  if (text.includes('sharp') || text.includes('crisp')) {
    style = blend(style, { vibe: { softness: 0.04 }, layers: { lineWeight: 0.68, edgeGlow: 0.54 }, motion: { blur: 0.02 } }, 0.32);
  }

  return StyleConfigSchema.parse(style);
}

function getLocalFallbackReason(error: any): FallbackReason | null {
  if (!client) return 'missing_api_key';

  const message = String(error?.message ?? '').toLowerCase();
  const status = Number(error?.status ?? 0);

  if (message.includes('credit balance is too low')) return 'credit_balance_low';
  if (status === 429 || message.includes('rate limit')) return 'rate_limited';
  if (status >= 500 || message.includes('overloaded') || message.includes('timed out') || message.includes('network')) {
    return 'provider_unavailable';
  }
  return null;
}

function sendFallbackStyle(
  res: Response,
  reason: FallbackReason,
  prompt: string,
  currentStyle: unknown,
  analysis: unknown,
) {
  const style = deriveLocalStyle(prompt, currentStyle, analysis);
  const excerpt = prompt.trim().replace(/\s+/g, ' ').slice(0, 160);
  console.warn(`[/api/config] using local fallback | reason=${reason} | prompt="${excerpt}"`);
  res.setHeader('X-Config-Source', 'fallback');
  res.setHeader('X-Fallback-Reason', reason);
  return res.json(style);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey) });
});

app.post('/api/config', async (req, res) => {
  const { prompt, currentStyle, currentConfig, analysis, signals } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const styleInput = currentStyle ?? currentConfig;
  if (!client) {
    return sendFallbackStyle(res, 'missing_api_key', prompt, styleInput, analysis);
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1400,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Current style:\n${JSON.stringify(styleInput ?? null, null, 2)}\n\n` +
                `Active analysis:\n${JSON.stringify(analysis ?? null, null, 2)}\n\n` +
                `Current signals:\n${JSON.stringify(signals ?? null, null, 2)}\n\n` +
                `User prompt:\n${prompt}`,
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return res.status(502).json({ error: 'Model did not call the style configuration tool' });
    }

    const parsed = StyleConfigSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return res.status(422).json({
        error: 'Model returned an invalid style configuration',
        issues: parsed.error.issues,
      });
    }
    res.json(parsed.data);
  } catch (e: any) {
    console.error('[/api/config]', e);
    const fallbackReason = getLocalFallbackReason(e);
    if (fallbackReason) {
      return sendFallbackStyle(res, fallbackReason, prompt, styleInput, analysis);
    }
    res.status(500).json({ error: e?.message ?? 'Unknown error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} · model=${MODEL}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] port ${PORT} is already in use. Stop the existing API process and restart to use model=${MODEL}.`);
    process.exit(1);
  }

  console.error('[server] failed to start', err);
  process.exit(1);
});
