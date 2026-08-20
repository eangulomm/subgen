import { MODEL_CACHE_NAME } from '../../config/models';

export interface CacheSummary {
  entries: number;
  bytes: number | null;
}

export async function inspectModelCache(): Promise<CacheSummary> {
  if (typeof caches === 'undefined') return { entries: 0, bytes: null };
  const names = await caches.keys();
  const modelCaches = names.filter(
    (name) => name.includes(MODEL_CACHE_NAME) || name.includes('transformers'),
  );
  let entries = 0;
  let bytes = 0;
  let sizesKnown = true;
  for (const name of modelCaches) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    entries += requests.length;
    for (const request of requests) {
      const response = await cache.match(request);
      const length = response?.headers.get('content-length');
      if (length) bytes += Number(length);
      else sizesKnown = false;
    }
  }
  return { entries, bytes: sizesKnown ? bytes : null };
}

export async function clearModelCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.includes(MODEL_CACHE_NAME) || name.includes('transformers'))
      .map((name) => caches.delete(name)),
  );
}
