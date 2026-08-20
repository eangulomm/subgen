import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const headers = readFileSync(join(process.cwd(), 'public/_headers'), 'utf8');

describe('production Content-Security-Policy', () => {
  it('allows the exact model and runtime hosts without a broad network wildcard', () => {
    const policy = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1];
    expect(policy).toBeDefined();

    const connectDirective = policy
      ?.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('connect-src '));
    const sources = connectDirective?.split(/\s+/).slice(1);

    expect(sources).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://huggingface.co',
        'https://*.huggingface.co',
        'https://*.hf.co',
        'https://cdn.jsdelivr.net',
      ]),
    );
    expect(sources).not.toContain('*');
    expect(sources).not.toContain('https:');
  });
});
