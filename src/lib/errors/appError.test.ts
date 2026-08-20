import { describe, expect, it } from 'vitest';
import { AppError, serializeError } from './appError';

describe('error mapping', () => {
  it('preserves intentional user-facing errors', () => {
    expect(serializeError(new AppError('invalid-file', 'Archivo inválido.'))).toMatchObject({
      code: 'invalid-file',
      userMessage: 'Archivo inválido.',
    });
  });

  it('translates low-level allocation failures', () => {
    expect(serializeError(new Error('tensor allocation failed: out of memory'))).toMatchObject({
      code: 'memory',
      recoverable: true,
    });
  });
});
