import 'dotenv/config';
import express, { type Response } from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { VibeConfigSchema, VibeConfigJsonSchema, type VibeConfig } from '../src/llm/schema.js';

const PORT = Number(process.env.PORT ?? 3001);
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('[server] ANTHROPIC_API_KEY is not set — /api/config will use local fallback mode.');
}

const SYSTEM_PROMPT = `You are a visual art direction engine for a live webcam renderer.

You translate abstract mood, vibe, and aesthetic prompts into structured visual configuration JSON for a real-time renderer that takes a webcam feed and applies effects.

Rules:
- Do NOT generate code. Do NOT explain your choices. Use the provided tool to emit configuration only.
- All numeric values are between 0 and 1 unless otherwise specified.
- "tint" is an RGB array of three integers between 0 and 255. White [255,255,255] means no tint.
- Be expressive: lean into the mood. Subtle prompts get subtle configs; extreme prompts get extreme configs.
- Build on the current configuration: nudge values when the user is refining; restructure when they are switching mood.

Phase-1 controls available:
- palette.tint: RGB color multiplied over the frame.
- palette.saturation: 0 (grayscale) → 0.5 (natural) → 1 (oversaturated).
- palette.contrast / palette.brightness: 0.5 is identity.
- motion.trailLength: ghost trails. 0 = clear each frame, 1 = blown-out persistence.
- motion.blur: 0 = sharp, 1 = heavy motion blur.
- edges.enabled: turn on edge glow overlay.
- edges.threshold: lower = more edges. 0.2 catches subtle edges, 0.8 only strong ones.
- edges.glow: how brightly the edges shine on top of the frame.
- distortion.noise: film grain / static. 0 = clean, 1 = heavy.
- distortion.pixelation: blocky digital artifact. 0 = sharp, 1 = chunky pixels.

Mood vocabulary:
- lonely → desaturated, cool tint (blue-grey), long trails, low brightness.
- anxious → high noise, jitter via pixelation, sharp contrast, fast motion.
- nostalgic → warm sepia tint, low contrast, long trails, gentle blur.
- sacred → low motion, soft glow on edges, low noise, warm gold-ish tint.
- violent → high contrast, red tint, sharp edges, hard pixelation.
- underwater → blue-green tint, blur, mid trails, low contrast.
- glitchy → pixelation, noise, high contrast, edges enabled.
- dreamlike → soft blur, pastel tint, long trails, low edge threshold.
- mechanical → high edge clarity, low saturation, low trails, low noise.
- edge detection / contours / computer vision → prioritize visible outlines and suppress pixelation unless explicitly requested.`;

const TOOL = {
  name: 'set_vibe_config',
  description: 'Emit the visual configuration for the renderer.',
  input_schema: VibeConfigJsonSchema as any,
};

const client = apiKey ? new Anthropic({ apiKey }) : null;
type VibeConfigPatch = {
  palette?: Partial<VibeConfig['palette']>;
  motion?: Partial<VibeConfig['motion']>;
  edges?: Partial<VibeConfig['edges']>;
  distortion?: Partial<VibeConfig['distortion']>;
};
type FallbackProfile = {
  name: string;
  keywords: string[];
  patch: VibeConfigPatch;
  strength: number;
};
type FallbackDirective = {
  name: string;
  phrases: string[];
  patch: VibeConfigPatch;
  strength: number;
};
type FallbackReason =
  | 'missing_api_key'
  | 'credit_balance_low'
  | 'rate_limited'
  | 'provider_unavailable';
type FallbackDerivation = {
  config: VibeConfig;
  baseSource: 'current' | 'default';
  intensity: number;
  matchedProfiles: string[];
  matchedDirectives: string[];
  signature: string;
};

const FALLBACK_CONFIG: VibeConfig = {
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
const INTENSITY_UP_WORDS = [
  'very',
  'extreme',
  'extremely',
  'intense',
  'intensely',
  'heavy',
  'dramatic',
  'aggressive',
  'maximum',
  'super',
  'ultra',
];
const INTENSITY_DOWN_WORDS = [
  'slight',
  'slightly',
  'subtle',
  'gently',
  'gentle',
  'softly',
  'soft',
  'minimal',
  'a little',
  'just a bit',
];
const FALLBACK_PROFILES: FallbackProfile[] = [
  {
    name: 'nostalgic',
    keywords: ['memory', 'decay', 'decaying', 'nostalg', 'sepia', 'aged', 'vintage'],
    patch: {
      palette: { tint: [212, 182, 138], saturation: 0.22, contrast: 0.34, brightness: 0.42 },
      motion: { trailLength: 0.68, blur: 0.36 },
      edges: { enabled: false, glow: 0.08, threshold: 0.5 },
      distortion: { noise: 0.24, pixelation: 0.06 },
    },
    strength: 0.62,
  },
  {
    name: 'anxious',
    keywords: ['anxious', 'panic', 'static', 'glitch', 'glitchy', 'unstable', 'tense'],
    patch: {
      palette: { tint: [204, 214, 255], saturation: 0.28, contrast: 0.82, brightness: 0.48 },
      motion: { trailLength: 0.18, blur: 0.08 },
      edges: { enabled: true, glow: 0.58, threshold: 0.28 },
      distortion: { noise: 0.86, pixelation: 0.62 },
    },
    strength: 0.7,
  },
  {
    name: 'dreamlike',
    keywords: ['dream', 'dreamlike', 'pastel', 'hazy', 'ethereal', 'float'],
    patch: {
      palette: { tint: [221, 202, 236], saturation: 0.34, contrast: 0.38, brightness: 0.58 },
      motion: { trailLength: 0.54, blur: 0.42 },
      edges: { enabled: false, glow: 0.1, threshold: 0.38 },
      distortion: { noise: 0.12, pixelation: 0.04 },
    },
    strength: 0.56,
  },
  {
    name: 'underwater',
    keywords: ['underwater', 'ocean', 'sea', 'submerged', 'tidal', 'aquatic'],
    patch: {
      palette: { tint: [118, 169, 186], saturation: 0.38, contrast: 0.36, brightness: 0.46 },
      motion: { trailLength: 0.36, blur: 0.44 },
      edges: { enabled: false, glow: 0.14, threshold: 0.52 },
      distortion: { noise: 0.08, pixelation: 0.04 },
    },
    strength: 0.58,
  },
  {
    name: 'sacred',
    keywords: ['sacred', 'slow', 'ritual', 'holy', 'reverent', 'ceremonial'],
    patch: {
      palette: { tint: [222, 198, 144], saturation: 0.34, contrast: 0.42, brightness: 0.56 },
      motion: { trailLength: 0.24, blur: 0.18 },
      edges: { enabled: true, glow: 0.42, threshold: 0.54 },
      distortion: { noise: 0.04, pixelation: 0.02 },
    },
    strength: 0.54,
  },
  {
    name: 'violent',
    keywords: ['violent', 'red', 'danger', 'rage', 'brutal', 'hostile', 'blood'],
    patch: {
      palette: { tint: [188, 70, 58], saturation: 0.62, contrast: 0.88, brightness: 0.44 },
      motion: { trailLength: 0.1, blur: 0.06 },
      edges: { enabled: true, glow: 0.76, threshold: 0.32 },
      distortion: { noise: 0.32, pixelation: 0.42 },
    },
    strength: 0.72,
  },
  {
    name: 'mechanical',
    keywords: ['mechanical', 'machine', 'industrial', 'metal', 'robotic', 'clinical'],
    patch: {
      palette: { tint: [210, 218, 224], saturation: 0.18, contrast: 0.7, brightness: 0.48 },
      motion: { trailLength: 0.08, blur: 0.04 },
      edges: { enabled: true, glow: 0.44, threshold: 0.58 },
      distortion: { noise: 0.03, pixelation: 0.06 },
    },
    strength: 0.58,
  },
  {
    name: 'lonely',
    keywords: ['lonely', 'isolated', 'empty', 'distant', 'abandoned', 'solitary'],
    patch: {
      palette: { tint: [166, 186, 214], saturation: 0.2, contrast: 0.42, brightness: 0.36 },
      motion: { trailLength: 0.48, blur: 0.22 },
      edges: { enabled: false, glow: 0.08, threshold: 0.46 },
      distortion: { noise: 0.12, pixelation: 0.04 },
    },
    strength: 0.52,
  },
];
const FALLBACK_DIRECTIVES: FallbackDirective[] = [
  {
    name: 'warmer',
    phrases: ['warm', 'warmer', 'gold', 'golden', 'amber'],
    patch: { palette: { tint: [230, 190, 128], saturation: 0.48, brightness: 0.56 } },
    strength: 0.26,
  },
  {
    name: 'cooler',
    phrases: ['cool', 'cooler', 'cold', 'icy', 'blue', 'frost'],
    patch: { palette: { tint: [150, 184, 228], saturation: 0.34, brightness: 0.44 } },
    strength: 0.26,
  },
  {
    name: 'darker',
    phrases: ['dark', 'darker', 'dim', 'shadowy', 'moody'],
    patch: { palette: { brightness: 0.24, contrast: 0.72 }, edges: { glow: 0.14 } },
    strength: 0.28,
  },
  {
    name: 'brighter',
    phrases: ['bright', 'brighter', 'glowing', 'radiant', 'luminous'],
    patch: { palette: { brightness: 0.7, contrast: 0.46 }, edges: { glow: 0.38 } },
    strength: 0.28,
  },
  {
    name: 'more-blur',
    phrases: ['more blur', 'blurrier', 'more blurry', 'softer', 'softer focus'],
    patch: { motion: { blur: 0.84 }, edges: { threshold: 0.44 } },
    strength: 0.3,
  },
  {
    name: 'less-blur',
    phrases: ['less blur', 'sharper', 'crisper', 'more crisp', 'clearer'],
    patch: { motion: { blur: 0.02 }, edges: { enabled: true, threshold: 0.6 } },
    strength: 0.3,
  },
  {
    name: 'more-trails',
    phrases: ['more trails', 'longer trails', 'echoes', 'persistent', 'linger'],
    patch: { motion: { trailLength: 0.86, blur: 0.42 } },
    strength: 0.3,
  },
  {
    name: 'less-trails',
    phrases: ['less trails', 'short trails', 'snappier', 'frozen', 'still'],
    patch: { motion: { trailLength: 0.04, blur: 0.08 } },
    strength: 0.28,
  },
  {
    name: 'more-noise',
    phrases: ['more noise', 'grainier', 'grainy', 'noisier', 'dirty'],
    patch: { distortion: { noise: 0.84 } },
    strength: 0.32,
  },
  {
    name: 'less-noise',
    phrases: ['less noise', 'cleaner', 'clean', 'minimal noise', 'pristine'],
    patch: { distortion: { noise: 0.02, pixelation: 0.02 } },
    strength: 0.32,
  },
  {
    name: 'more-pixelation',
    phrases: ['more pixelation', 'pixelated', 'blocky', '8-bit', 'chunkier'],
    patch: { distortion: { pixelation: 0.82 }, edges: { enabled: true, threshold: 0.34 } },
    strength: 0.34,
  },
  {
    name: 'less-pixelation',
    phrases: ['less pixelation', 'smoother', 'higher resolution', 'finer'],
    patch: { distortion: { pixelation: 0.01 } },
    strength: 0.28,
  },
  {
    name: 'more-contrast',
    phrases: ['more contrast', 'higher contrast', 'punchier', 'harder'],
    patch: { palette: { contrast: 0.86 } },
    strength: 0.26,
  },
  {
    name: 'less-contrast',
    phrases: ['less contrast', 'lower contrast', 'flatter', 'washed'],
    patch: { palette: { contrast: 0.28 } },
    strength: 0.26,
  },
  {
    name: 'more-saturation',
    phrases: ['more saturation', 'more saturated', 'vivid', 'vibrant', 'neon'],
    patch: { palette: { saturation: 0.82, contrast: 0.7 } },
    strength: 0.28,
  },
  {
    name: 'less-saturation',
    phrases: ['less saturation', 'desaturated', 'muted', 'grayscale', 'monochrome', 'black and white'],
    patch: { palette: { saturation: 0.04, contrast: 0.5 } },
    strength: 0.32,
  },
  {
    name: 'more-edges',
    phrases: ['more edges', 'more outlines', 'outlined', 'edge glow', 'edge detection', 'contour', 'contours', 'computer vision', 'cv'],
    patch: { edges: { enabled: true, threshold: 0.3, glow: 0.7 }, distortion: { pixelation: 0.02 } },
    strength: 0.32,
  },
  {
    name: 'less-edges',
    phrases: ['less edges', 'no edges', 'smooth', 'no outline'],
    patch: { edges: { enabled: false, glow: 0, threshold: 0.56 } },
    strength: 0.28,
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

function hashPrompt(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number, offset: number): number {
  const mixed = Math.imul(seed ^ (offset * 2654435761), 1597334677) >>> 0;
  return mixed / 4294967295;
}

function computeIntensity(text: string): number {
  const raised = countHits(text, INTENSITY_UP_WORDS);
  const lowered = countHits(text, INTENSITY_DOWN_WORDS);
  let intensity = 0.56 + raised * 0.08 - lowered * 0.08;
  if (text.includes('!')) {
    intensity += 0.04;
  }
  return clamp01(intensity);
}

function buildPromptSignature(text: string): { name: string; patch: VibeConfigPatch } {
  const seed = hashPrompt(text);
  const labelsA = ['mist', 'glass', 'ember', 'brine', 'chrome', 'velvet', 'dust', 'static'];
  const labelsB = ['drift', 'echo', 'pulse', 'haze', 'veil', 'spark', 'wash', 'grain'];
  const tint: [number, number, number] = [
    clampByte(132 + seededUnit(seed, 1) * 86),
    clampByte(132 + seededUnit(seed, 2) * 86),
    clampByte(132 + seededUnit(seed, 3) * 86),
  ];

  return {
    name: `${labelsA[seed % labelsA.length]}-${labelsB[(seed >>> 3) % labelsB.length]}`,
    patch: {
      palette: {
        tint,
        saturation: 0.26 + seededUnit(seed, 4) * 0.42,
        contrast: 0.34 + seededUnit(seed, 5) * 0.36,
        brightness: 0.36 + seededUnit(seed, 6) * 0.28,
      },
      motion: {
        trailLength: 0.06 + seededUnit(seed, 7) * 0.4,
        blur: 0.02 + seededUnit(seed, 8) * 0.28,
      },
      edges: {
        enabled: seededUnit(seed, 9) > 0.55,
        threshold: 0.3 + seededUnit(seed, 10) * 0.34,
        glow: seededUnit(seed, 11) * 0.34,
      },
      distortion: {
        noise: seededUnit(seed, 12) * 0.26,
        pixelation: seededUnit(seed, 13) * 0.18,
      },
    },
  };
}

function blend(base: VibeConfig, target: VibeConfigPatch, strength: number): VibeConfig {
  const s = clamp01(strength);
  const lerp = (a: number, b: number) => a + (b - a) * s;
  const palette = target.palette ?? {};
  const motion = target.motion ?? {};
  const edges = target.edges ?? {};
  const distortion = target.distortion ?? {};

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
    edges: {
      enabled: edges.enabled ?? base.edges.enabled,
      threshold: clamp01(lerp(base.edges.threshold, edges.threshold ?? base.edges.threshold)),
      glow: clamp01(lerp(base.edges.glow, edges.glow ?? base.edges.glow)),
    },
    distortion: {
      noise: clamp01(lerp(base.distortion.noise, distortion.noise ?? base.distortion.noise)),
      pixelation: clamp01(lerp(base.distortion.pixelation, distortion.pixelation ?? base.distortion.pixelation)),
    },
  };
}

function deriveLocalConfig(prompt: string, currentConfig: unknown): FallbackDerivation {
  const parsed = VibeConfigSchema.safeParse(currentConfig);
  let config = parsed.success ? parsed.data : FALLBACK_CONFIG;
  const text = prompt.toLowerCase();
  const intensity = computeIntensity(text);
  const signature = buildPromptSignature(text);
  const matchedProfiles: string[] = [];
  const matchedDirectives: string[] = [];

  for (const profile of FALLBACK_PROFILES) {
    const hits = countHits(text, profile.keywords);
    if (hits > 0) {
      const strength = clamp01(profile.strength + (hits - 1) * 0.08 + (intensity - 0.56) * 0.35);
      config = blend(config, profile.patch, strength);
      matchedProfiles.push(profile.name);
    }
  }

  for (const directive of FALLBACK_DIRECTIVES) {
    if (directive.phrases.some((phrase) => text.includes(phrase))) {
      const strength = clamp01(directive.strength + (intensity - 0.56) * 0.2);
      config = blend(config, directive.patch, strength);
      matchedDirectives.push(directive.name);
    }
  }

  const signatureStrength =
    matchedProfiles.length === 0 && matchedDirectives.length === 0
      ? 0.38 + intensity * 0.18
      : 0.08 + intensity * 0.08;
  config = blend(config, signature.patch, signatureStrength);

  return {
    config,
    baseSource: parsed.success ? 'current' : 'default',
    intensity,
    matchedProfiles,
    matchedDirectives,
    signature: signature.name,
  };
}

function getLocalFallbackReason(error: any): FallbackReason | null {
  if (!client) {
    return 'missing_api_key';
  }

  const message = String(error?.message ?? '').toLowerCase();
  const status = Number(error?.status ?? 0);

  if (message.includes('credit balance is too low')) {
    return 'credit_balance_low';
  }
  if (status === 429 || message.includes('rate limit')) {
    return 'rate_limited';
  }
  if (status >= 500 || message.includes('overloaded') || message.includes('timed out') || message.includes('network')) {
    return 'provider_unavailable';
  }
  return null;
}

function summarizeConfig(config: VibeConfig): string {
  return [
    `tint=${config.palette.tint.join(',')}`,
    `sat=${config.palette.saturation.toFixed(2)}`,
    `ctr=${config.palette.contrast.toFixed(2)}`,
    `bri=${config.palette.brightness.toFixed(2)}`,
    `trail=${config.motion.trailLength.toFixed(2)}`,
    `blur=${config.motion.blur.toFixed(2)}`,
    `edges=${config.edges.enabled ? 'on' : 'off'}`,
    `glow=${config.edges.glow.toFixed(2)}`,
    `noise=${config.distortion.noise.toFixed(2)}`,
    `pix=${config.distortion.pixelation.toFixed(2)}`,
  ].join(' ');
}

function logFallbackUsage(reason: FallbackReason, prompt: string, result: FallbackDerivation) {
  const excerpt = prompt.trim().replace(/\s+/g, ' ').slice(0, 160);
  const promptLabel = excerpt.length < prompt.trim().length ? `${excerpt}...` : excerpt;
  const profiles = result.matchedProfiles.length > 0 ? result.matchedProfiles.join('+') : 'none';
  const directives = result.matchedDirectives.length > 0 ? result.matchedDirectives.join('+') : 'none';

  console.warn(
    `[/api/config] using local fallback | reason=${reason} | base=${result.baseSource} | intensity=${result.intensity.toFixed(2)} | signature=${result.signature} | profiles=${profiles} | directives=${directives} | prompt="${promptLabel}"`,
  );
  console.warn(`[/api/config] fallback config | ${summarizeConfig(result.config)}`);
}

function sendFallbackConfig(res: Response, reason: FallbackReason, prompt: string, currentConfig: unknown) {
  const result = deriveLocalConfig(prompt, currentConfig);
  logFallbackUsage(reason, prompt, result);
  res.setHeader('X-Config-Source', 'fallback');
  res.setHeader('X-Fallback-Reason', reason);
  return res.json(result.config);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey) });
});

app.post('/api/config', async (req, res) => {
  const { prompt, currentConfig } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  if (!client) {
    return sendFallbackConfig(res, 'missing_api_key', prompt, currentConfig);
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
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
              text: `Current config:\n${JSON.stringify(currentConfig ?? null, null, 2)}\n\nUser prompt:\n${prompt}`,
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return res.status(502).json({ error: 'Model did not call the configuration tool' });
    }

    const parsed = VibeConfigSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return res.status(422).json({
        error: 'Model returned an invalid configuration',
        issues: parsed.error.issues,
      });
    }
    res.json(parsed.data);
  } catch (e: any) {
    console.error('[/api/config]', e);
    const fallbackReason = getLocalFallbackReason(e);
    if (fallbackReason) {
      return sendFallbackConfig(res, fallbackReason, prompt, currentConfig);
    }
    res.status(500).json({ error: e?.message ?? 'Unknown error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} · model=${MODEL}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[server] port ${PORT} is already in use. Stop the existing API process and restart to use model=${MODEL}.`,
    );
    process.exit(1);
  }

  console.error('[server] failed to start', err);
  process.exit(1);
});
