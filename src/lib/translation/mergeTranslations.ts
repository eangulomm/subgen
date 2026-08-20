import type { SubtitleSegment } from '../../types';

export function mergeTranslations(
  segments: SubtitleSegment[],
  translations: string[],
): SubtitleSegment[] {
  return segments.map((segment, index) => ({
    ...segment,
    translatedText: translations[index]?.trim() || segment.translatedText || segment.text,
  }));
}
