import { describe, expect, it } from 'vitest';
import { formatTimestamp, normalizeSegments, toSrt } from './srt';
import type { SubtitleSegment } from '../../types';

describe('formatTimestamp', () => {
  it('formats SRT timestamps and rounds milliseconds', () => {
    expect(formatTimestamp(3661.9996)).toBe('01:01:02,000');
    expect(formatTimestamp(-2)).toBe('00:00:00,000');
    expect(formatTimestamp(Number.NaN)).toBe('00:00:00,000');
  });
});

describe('normalizeSegments', () => {
  it('sorts, removes empty segments, prevents overlaps, deduplicates, and clamps duration', () => {
    const input: SubtitleSegment[] = [
      { id: '2', start: 2, end: 4, text: 'Repeat' },
      { id: '1', start: -1, end: 2.5, text: 'First' },
      { id: '3', start: 3.9, end: 4.2, text: 'Repeat' },
      { id: '4', start: 4.5, end: 5, text: '  ' },
    ];
    expect(normalizeSegments(input, 4)).toEqual([
      { id: '1', start: 0, end: 2.5, text: 'First', translatedText: undefined },
      { id: '2', start: 2.5, end: 4, text: 'Repeat', translatedText: undefined },
    ]);
  });
});

describe('toSrt', () => {
  const segments: SubtitleSegment[] = [
    { id: 'a', start: 1.5, end: 4.2, text: 'How are you?', translatedText: '¿Cómo estás?' },
  ];

  it('generates UTF-8 friendly translated SRT', () => {
    expect(toSrt(segments, 'translated')).toBe('1\n00:00:01,500 --> 00:00:04,200\n¿Cómo estás?\n');
  });

  it('generates bilingual SRT', () => {
    expect(toSrt(segments, 'bilingual')).toContain('How are you?\n¿Cómo estás?');
  });
});
