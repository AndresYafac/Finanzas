const memoryCache = new Map();

function now() {
  return Date.now();
}

function isFresh(entry) {
  return entry && entry.expiresAt > now();
}

export function cacheKey(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null)
    .map((part) => (typeof part === 'object' ? JSON.stringify(part) : String(part)))
    .join(':');
}

export async function withCache(key, loader, ttlMs = 30000) {
  const entry = memoryCache.get(key);
  if (isFresh(entry)) return entry.value;
  const value = await loader();
  memoryCache.set(key, { value, expiresAt: now() + ttlMs });
  return value;
}

export function invalidateCache(prefix) {
  const token = String(prefix || '');
  Array.from(memoryCache.keys()).forEach((key) => {
    if (!token || key.startsWith(token)) {
      memoryCache.delete(key);
    }
  });
}

export function clearCache() {
  memoryCache.clear();
}

