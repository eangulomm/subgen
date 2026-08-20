export interface MediaMetadata {
  duration: number | null;
  mimeType: string;
  size: number;
}

export async function readMediaMetadata(file: File): Promise<MediaMetadata> {
  const url = URL.createObjectURL(file);
  const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
  media.preload = 'metadata';
  try {
    const duration = await new Promise<number | null>((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), 5000);
      media.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve(Number.isFinite(media.duration) ? media.duration : null);
      };
      media.onerror = () => {
        window.clearTimeout(timeout);
        resolve(null);
      };
      media.src = url;
    });
    return { duration, mimeType: file.type || 'application/octet-stream', size: file.size };
  } finally {
    media.removeAttribute('src');
    media.load();
    URL.revokeObjectURL(url);
  }
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return 'Duración no disponible';
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
