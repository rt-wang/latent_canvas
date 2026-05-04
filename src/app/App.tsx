import { useRef, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { PromptBox } from '../components/PromptBox';
import { HistoryPanel } from '../components/HistoryPanel';
import { CanvasRenderer } from '../components/CanvasRenderer';
import { VideoInput } from '../components/VideoInput';
import { ConfigInspector } from '../components/ConfigInspector';

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar />

      <div
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--fg-ghost)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <PromptBox />
        <HistoryPanel />
      </div>

      <CanvasRenderer videoRef={videoRef} videoReady={videoReady} videoError={videoError} />

      <ConfigInspector />

      <VideoInput
        videoRef={videoRef}
        onReadyChange={setVideoReady}
        onErrorChange={setVideoError}
      />
    </div>
  );
}
