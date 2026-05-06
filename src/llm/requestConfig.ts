import { StyleConfigSchema, type AnalysisConfig, type StyleConfig } from './schema';
import type { VisualSignals } from '../state/useConfigStore';

export async function requestConfig(
  prompt: string,
  currentStyle: StyleConfig,
  analysis: AnalysisConfig,
  signals: VisualSignals,
): Promise<StyleConfig> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, currentStyle, analysis, signals }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  const json = await res.json();
  const parsed = StyleConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Server returned an invalid style config shape');
  }
  return parsed.data;
}
