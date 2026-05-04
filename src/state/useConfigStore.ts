import { create } from 'zustand';
import type { VibeConfig } from '../llm/schema';
import { defaultConfig } from './defaultConfig';

export type VisualSignals = {
  edgeDensity: number;
  motionAmount: number;
  averageBrightness: number;
};

export type HistoryItem = {
  id: string;
  prompt: string;
  config: VibeConfig;
  createdAt: number;
};

type ConfigState = {
  current: VibeConfig;
  target: VibeConfig;
  signals: VisualSignals;
  history: HistoryItem[];
  activeHistoryId: string | null;
  fps: number;
  status: 'idle' | 'loading' | 'error';
  error: string | null;

  setTarget: (cfg: VibeConfig, prompt?: string) => void;
  setCurrent: (cfg: VibeConfig) => void;
  setSignals: (s: VisualSignals) => void;
  setFps: (fps: number) => void;
  setStatus: (s: 'idle' | 'loading' | 'error', error?: string | null) => void;
  selectHistory: (id: string) => void;
  clearHistory: () => void;
};

export const useConfigStore = create<ConfigState>((set) => ({
  current: defaultConfig,
  target: defaultConfig,
  signals: { edgeDensity: 0, motionAmount: 0, averageBrightness: 0 },
  history: [],
  activeHistoryId: null,
  fps: 0,
  status: 'idle',
  error: null,

  setTarget: (cfg, prompt) =>
    set((s) => {
      const next: Partial<ConfigState> = { target: cfg, status: 'idle', error: null };
      if (prompt) {
        const item: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          prompt,
          config: cfg,
          createdAt: Date.now(),
        };
        next.history = [item, ...s.history].slice(0, 30);
        next.activeHistoryId = item.id;
      }
      return next;
    }),
  setCurrent: (cfg) => set({ current: cfg }),
  setSignals: (signals) => set({ signals }),
  setFps: (fps) => set({ fps }),
  setStatus: (status, error = null) => set({ status, error }),
  selectHistory: (id) =>
    set((s) => {
      const item = s.history.find((h) => h.id === id);
      if (!item) return {};
      return { target: item.config, activeHistoryId: id };
    }),
  clearHistory: () => set({ history: [], activeHistoryId: null }),
}));
