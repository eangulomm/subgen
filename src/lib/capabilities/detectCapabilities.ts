import type { Capabilities } from '../../types';

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  gpu?: { requestAdapter: () => Promise<unknown> };
}

export async function detectCapabilities(nav: Navigator = navigator): Promise<Capabilities> {
  const hinted = nav as NavigatorWithHints;
  let storageAvailableBytes: number | null = null;
  let storageQuotaBytes: number | null = null;

  try {
    const estimate = await nav.storage?.estimate();
    storageQuotaBytes = estimate?.quota ?? null;
    storageAvailableBytes =
      estimate?.quota && estimate.usage != null ? estimate.quota - estimate.usage : null;
  } catch {
    // Storage estimation is optional and privacy-sensitive in some browsers.
  }

  const cores = nav.hardwareConcurrency || null;
  const memory = hinted.deviceMemory ?? null;
  const constrained = (memory !== null && memory <= 4) || (cores !== null && cores <= 4);
  let webgpu = false;
  try {
    webgpu = Boolean(await hinted.gpu?.requestAdapter());
  } catch {
    // A present API without an adapter cannot accelerate inference.
  }

  return {
    webgpu,
    wasm: typeof WebAssembly === 'object',
    workers: typeof Worker === 'function',
    cacheStorage: typeof caches !== 'undefined',
    indexedDb: typeof indexedDB !== 'undefined',
    hardwareConcurrency: cores,
    deviceMemoryGb: memory,
    storageAvailableBytes,
    storageQuotaBytes,
    recommendedModel: constrained ? 'light' : 'balanced',
    recommendedMaxMinutes: constrained ? 30 : memory !== null && memory >= 8 ? 90 : 60,
  };
}

export function recommendedFileBytes(capabilities: Capabilities): number {
  const memoryGb = capabilities.deviceMemoryGb ?? 4;
  return Math.min(Math.max(memoryGb * 80 * 1024 * 1024, 250 * 1024 * 1024), 1024 * 1024 * 1024);
}
