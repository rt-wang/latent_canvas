import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { Button } from './ui/Button';

type Props = {
  videoRef: RefObject<HTMLVideoElement>;
  onReadyChange?: (ready: boolean) => void;
  onErrorChange?: (error: string | null) => void;
};

function toVideoMessage(error: unknown): string {
  const fallback = (error as Error)?.message ?? String(error);
  const name = typeof error === 'object' && error && 'name' in error
    ? String((error as { name?: unknown }).name)
    : '';

  switch (name) {
    case 'NotSupportedError':
      return 'That file format could not be played. Try MP4, WebM, or MOV.';
    case 'AbortError':
      return 'Video loading was interrupted. Choose the file again.';
    default:
      return fallback;
  }
}

export function VideoInput({ videoRef, onReadyChange, onErrorChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const openPicker = () => inputRef.current?.click();

  const resetVideo = () => {
    const video = videoRef.current;
    onReadyChange?.(false);
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const video = videoRef.current;
    if (!file || !video) return;

    onReadyChange?.(false);
    setError(null);
    onErrorChange?.(null);

    if (!file.type.startsWith('video/')) {
      const message = 'Choose a video file, not an image or document.';
      setFileName(null);
      setError(message);
      onErrorChange?.(message);
      event.target.value = '';
      return;
    }

    resetVideo();

    try {
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setFileName(file.name);

      video.srcObject = null;
      video.src = objectUrl;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';

      await new Promise<void>((resolve, reject) => {
        const onLoadedMetadata = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new DOMException('Failed to load selected video', 'NotSupportedError'));
        };
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.load();
      });

      video.currentTime = 0;
      await video.play().catch(() => undefined);
      onReadyChange?.(true);
    } catch (err) {
      const message = toVideoMessage(err);
      resetVideo();
      setFileName(null);
      setError(message);
      onErrorChange?.(message);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <>
      <video ref={videoRef} autoPlay muted loop playsInline style={{ display: 'none' }} />
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          width: 300,
          background: 'var(--bg-overlay)',
          border: '1px solid var(--fg-ghost)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 14,
          zIndex: 100,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: 8 }}>
          VIDEO SOURCE
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-primary)', marginBottom: 6, fontWeight: 500 }}>
          {fileName ? 'Uploaded video ready' : 'Upload a video to begin'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          {error
            ? error
            : fileName
              ? fileName
              : 'Choose a local MP4, WebM, or MOV file. The renderer will loop it silently.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" onClick={openPicker}>
            {fileName ? 'Choose another video' : 'Choose video'}
          </Button>
          {fileName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetVideo();
                setFileName(null);
                setError(null);
                onErrorChange?.(null);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
