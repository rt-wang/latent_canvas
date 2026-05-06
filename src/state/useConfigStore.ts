import { create } from 'zustand';
import type { AnalysisConfig, RenderMode, StyleConfig } from '../llm/schema';
import { defaultAnalysisConfig, defaultStyleConfig } from './defaultConfig';

export type VisualSignals = {
  edgeDensity: number;
  motionAmount: number;
  averageBrightness: number;
  lineCount: number;
  contourCount: number;
  depthMean: number;
  sceneStability: number;
};

export const defaultSignals: VisualSignals = {
  edgeDensity: 0,
  motionAmount: 0,
  averageBrightness: 0,
  lineCount: 0,
  contourCount: 0,
  depthMean: 0,
  sceneStability: 1,
};

export type HistoryItem = {
  id: string;
  prompt: string;
  style: StyleConfig;
  analysis: AnalysisConfig;
  createdAt: number;
};

type ConfigState = {
  currentStyle: StyleConfig;
  targetStyle: StyleConfig;
  analysis: AnalysisConfig;
  renderMode: RenderMode;
  signals: VisualSignals;
  history: HistoryItem[];
  activeHistoryId: string | null;
  fps: number;
  status: 'idle' | 'loading' | 'error';
  error: string | null;

  setTargetStyle: (cfg: StyleConfig, prompt?: string) => void;
  setCurrentStyle: (cfg: StyleConfig) => void;
  setAnalysis: (cfg: AnalysisConfig) => void;
  setRenderMode: (mode: RenderMode) => void;
  setSignals: (s: VisualSignals) => void;
  setFps: (fps: number) => void;
  setStatus: (s: 'idle' | 'loading' | 'error', error?: string | null) => void;
  resetStyle: () => void;
  selectHistory: (id: string) => void;
  clearHistory: () => void;
};

export const useConfigStore = create<ConfigState>((set) => ({
  currentStyle: defaultStyleConfig,
  targetStyle: defaultStyleConfig,
  analysis: defaultAnalysisConfig,
  renderMode: 'geometry-preview',
  signals: defaultSignals,
  history: [],
  activeHistoryId: null,
  fps: 0,
  status: 'idle',
  error: null,

  setTargetStyle: (cfg, prompt) =>
    set((s) => {
      const next: Partial<ConfigState> = {
        targetStyle: cfg,
        renderMode: 'styled',
        status: 'idle',
        error: null,
      };
      if (prompt) {
        const item: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          prompt,
          style: cfg,
          analysis: s.analysis,
          createdAt: Date.now(),
        };
        next.history = [item, ...s.history].slice(0, 30);
        next.activeHistoryId = item.id;
      }
      return next;
    }),
  setCurrentStyle: (cfg) => set({ currentStyle: cfg }),
  setAnalysis: (analysis) => set({ analysis }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setSignals: (signals) => set({ signals }),
  setFps: (fps) => set({ fps }),
  setStatus: (status, error = null) => set({ status, error }),
  resetStyle: () =>
    set({
      currentStyle: defaultStyleConfig,
      targetStyle: defaultStyleConfig,
      renderMode: 'geometry-preview',
      activeHistoryId: null,
      status: 'idle',
      error: null,
    }),
  selectHistory: (id) =>
    set((s) => {
      const item = s.history.find((h) => h.id === id);
      if (!item) return {};
      return {
        targetStyle: item.style,
        analysis: item.analysis,
        renderMode: 'styled',
        activeHistoryId: id,
      };
    }),
  clearHistory: () => set({ history: [], activeHistoryId: null }),
}));
