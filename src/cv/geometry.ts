import type { VisualSignals } from '../state/useConfigStore';

export type GeometryFrame = {
  width: number;
  height: number;
  signals: VisualSignals;
  edgeMask: ImageData | null;
  motionMask: ImageData | null;
  depthMap: ImageData | null;
  lineSegments: Float32Array | null;
  contours: Float32Array | null;
};

export type WorkerGeometryPayload = {
  width: number;
  height: number;
  signals: VisualSignals;
  edgeAlphaBuffer?: ArrayBuffer;
  motionAlphaBuffer?: ArrayBuffer;
  depthBuffer?: ArrayBuffer;
  lineSegmentsBuffer?: ArrayBuffer;
  contoursBuffer?: ArrayBuffer;
};
