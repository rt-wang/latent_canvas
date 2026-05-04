import { useEffect, useState, type RefObject } from 'react';
import { Button } from './ui/Button';

type Props = {
  videoRef: RefObject<HTMLVideoElement>;
  onReadyChange?: (ready: boolean) => void;
};

export function VideoInput({ videoRef, onReadyChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setError(null);
        onReadyChange?.(true);
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        setError(msg);
        onReadyChange?.(false);
      }
    })();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      onReadyChange?.(false);
    };
  }, [attempt, videoRef, onReadyChange]);

  return (
    <>
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      {error && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--fg-ghost)',
            borderRadius: 'var(--r-lg)',
            padding: 20,
            maxWidth: 380,
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--fg-primary)', marginBottom: 8, fontWeight: 500 }}>
            Camera unavailable
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 14 }}>{error}</div>
          <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}
    </>
  );
}
