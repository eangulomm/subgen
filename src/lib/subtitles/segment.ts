import type { SubtitleSegment } from '../../types';

const MAX_LINE = 42;

export function wrapSubtitleText(text: string, maxLineLength = MAX_LINE): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLineLength || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 2) return lines.join('\n');
  const midpoint = Math.ceil(words.join(' ').length / 2);
  let split = 1;
  let length = words[0]?.length ?? 0;
  while (split < words.length - 1 && length + 1 + (words[split]?.length ?? 0) < midpoint) {
    length += 1 + (words[split]?.length ?? 0);
    split += 1;
  }
  return `${words.slice(0, split).join(' ')}\n${words.slice(split).join(' ')}`;
}

export function improveSegmentReadability(segments: SubtitleSegment[]): SubtitleSegment[] {
  return segments.map((segment) => ({
    ...segment,
    text: wrapSubtitleText(segment.text),
    translatedText: segment.translatedText ? wrapSubtitleText(segment.translatedText) : undefined,
  }));
}
