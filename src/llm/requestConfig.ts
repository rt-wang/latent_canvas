import { VibeConfigSchema, type VibeConfig } from './schema';

export async function requestConfig(prompt: string, currentConfig: VibeConfig): Promise<VibeConfig> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, currentConfig }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  const json = await res.json();
  const parsed = VibeConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Server returned an invalid config shape');
  }
  return parsed.data;
}
