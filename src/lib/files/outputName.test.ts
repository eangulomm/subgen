import { describe, expect, it } from 'vitest';
import { baseName, outputFileName } from './outputName';

describe('output names', () => {
  it('preserves Unicode and removes unsafe path characters', () => {
    expect(baseName('película: final?.mkv')).toBe('película- final-');
  });

  it('uses correct language suffixes', () => {
    expect(outputFileName('movie.mkv', 'original', 'en')).toBe('movie.en.srt');
    expect(outputFileName('movie.mkv', 'translated', 'en')).toBe('movie.es.srt');
    expect(outputFileName('movie.mkv', 'bilingual', 'en')).toBe('movie.en-es.srt');
  });
});
