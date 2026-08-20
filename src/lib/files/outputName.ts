import type { OutputMode } from '../../types';

export function baseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '') || 'subtitles';
  const withoutControls = Array.from(withoutExtension, (character) =>
    character.charCodeAt(0) < 32 ? '-' : character,
  ).join('');
  return (
    withoutControls
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'subtitles'
  );
}

export function outputFileName(
  fileName: string,
  mode: OutputMode,
  sourceLanguage = 'original',
): string {
  const suffix =
    mode === 'translated' ? 'es' : mode === 'bilingual' ? `${sourceLanguage}-es` : sourceLanguage;
  return `${baseName(fileName)}.${suffix}.srt`;
}
