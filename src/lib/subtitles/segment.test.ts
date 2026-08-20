import { describe, expect, it } from 'vitest';
import { improveSegmentReadability, wrapSubtitleText } from './segment';

describe('subtitle readability', () => {
  it('keeps short semantic units on one line', () => {
    expect(wrapSubtitleText('This is short.')).toBe('This is short.');
  });

  it('balances long captions into no more than two lines', () => {
    const wrapped = wrapSubtitleText(
      'This is a deliberately long subtitle that should wrap into two readable and balanced lines for viewers',
    );
    expect(wrapped.split('\n')).toHaveLength(2);
  });

  it('wraps original and translated structures without changing timing', () => {
    const [segment] = improveSegmentReadability([
      { id: 'x', start: 1, end: 3, text: 'A short line', translatedText: 'Una línea corta' },
    ]);
    expect(segment).toMatchObject({ start: 1, end: 3, translatedText: 'Una línea corta' });
  });
});
