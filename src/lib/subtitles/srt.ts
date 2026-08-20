import type { OutputMode, SubtitleSegment } from '../../types';

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const milliseconds = Math.round(safe * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function cleanText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeSegments(
  segments: SubtitleSegment[],
  mediaDuration?: number,
): SubtitleSegment[] {
  const sorted = segments
    .filter((segment) => cleanText(segment.text) || cleanText(segment.translatedText ?? ''))
    .map((segment) => ({
      ...segment,
      start: Math.max(0, segment.start),
      end: Math.max(0, segment.end),
    }))
    .sort((a, b) => a.start - b.start);

  const normalized: SubtitleSegment[] = [];
  for (const segment of sorted) {
    const previous = normalized.at(-1);
    let start = previous && segment.start < previous.end ? previous.end : segment.start;
    let end = Math.max(segment.end, start + 0.2);
    if (mediaDuration != null) {
      start = Math.min(start, mediaDuration);
      end = Math.min(end, mediaDuration);
      if (end <= start) continue;
    }
    const text = cleanText(segment.text);
    if (previous && previous.text === text && start - previous.end < 0.15) {
      previous.end = Math.max(previous.end, end);
      continue;
    }
    normalized.push({
      ...segment,
      start,
      end,
      text,
      translatedText: cleanText(segment.translatedText ?? '') || undefined,
    });
  }
  return normalized;
}

export function toSrt(
  segments: SubtitleSegment[],
  mode: OutputMode,
  mediaDuration?: number,
): string {
  const normalized = normalizeSegments(segments, mediaDuration);
  return `${normalized
    .map((segment, index) => {
      const original = cleanText(segment.text);
      const translated = cleanText(segment.translatedText ?? '');
      const text =
        mode === 'translated'
          ? translated || original
          : mode === 'bilingual'
            ? [original, translated].filter(Boolean).join('\n')
            : original;
      return `${index + 1}\n${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}\n${text}`;
    })
    .join('\n\n')}\n`;
}
