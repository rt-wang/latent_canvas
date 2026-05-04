import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { VibeConfigSchema, VibeConfigJsonSchema } from '../src/llm/schema.js';

const PORT = Number(process.env.PORT ?? 3001);
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('[server] ANTHROPIC_API_KEY is not set — /api/config will return 500.');
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
- mechanical → high edge clarity, low saturation, low trails, low noise.`;

const TOOL = {
  name: 'set_vibe_config',
  description: 'Emit the visual configuration for the renderer.',
  input_schema: VibeConfigJsonSchema as any,
};

const client = apiKey ? new Anthropic({ apiKey }) : null;

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey) });
});

app.post('/api/config', async (req, res) => {
  if (!client) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }
  const { prompt, currentConfig } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
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
    res.status(500).json({ error: e?.message ?? 'Unknown error' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} · model=${MODEL}`);
});
