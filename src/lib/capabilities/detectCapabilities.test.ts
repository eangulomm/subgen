import { describe, expect, it, vi } from 'vitest';
import { detectCapabilities, recommendedFileBytes } from './detectCapabilities';

describe('capability detection', () => {
  it('recommends a light model on constrained devices', async () => {
    const nav = {
      hardwareConcurrency: 4,
      deviceMemory: 4,
      storage: { estimate: vi.fn().mockResolvedValue({ quota: 1_000, usage: 250 }) },
    } as unknown as Navigator;
    const result = await detectCapabilities(nav);
    expect(result.recommendedModel).toBe('light');
    expect(result.storageAvailableBytes).toBe(750);
    expect(recommendedFileBytes(result)).toBe(320 * 1024 * 1024);
  });

  it('does not fail when storage estimates are denied', async () => {
    const nav = {
      hardwareConcurrency: 8,
      storage: { estimate: vi.fn().mockRejectedValue(new Error('denied')) },
    } as unknown as Navigator;
    await expect(detectCapabilities(nav)).resolves.toMatchObject({
      recommendedModel: 'balanced',
      storageAvailableBytes: null,
    });
  });
});
