import { describe, expect, it } from 'vitest';
import { mergeTranslations } from './mergeTranslations';

describe('mergeTranslations', () => {
  it('preserves ids and timestamps while attaching translations', () => {
    const result = mergeTranslations([{ id: '1', start: 1, end: 2, text: 'Hello' }], [' Hola ']);
    expect(result).toEqual([{ id: '1', start: 1, end: 2, text: 'Hello', translatedText: 'Hola' }]);
  });

  it('falls back to original text for missing translations', () => {
    expect(
      mergeTranslations([{ id: '1', start: 0, end: 1, text: 'Hello' }], [])[0]?.translatedText,
    ).toBe('Hello');
  });
});
