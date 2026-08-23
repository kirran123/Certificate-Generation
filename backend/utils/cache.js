/**
 * Simple In-Memory Cache helper for Firestore queries to protect Firebase Quota
 */
const cache = new Map();

/**
 * Get cached data or execute fallback async function if expired/missing
 * @param {string} key - Cache key
 * @param {number} ttlMs - Time to live in milliseconds (default 15 seconds)
 * @param {Function} fetchFn - Async function to fetch fresh data
 */
async function getOrFetch(key, ttlMs, fetchFn) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && (now - cached.timestamp < ttlMs)) {
    return cached.data;
  }

  try {
    const data = await fetchFn();
    cache.set(key, { data, timestamp: now });
    return data;
  } catch (err) {
    // If Firestore throws Quota Exceeded or network error, return stale cache if available
    if (cached && cached.data) {
      console.warn(`[Cache Warning] Using stale cache for "${key}" due to error:`, err.message);
      return cached.data;
    }
    throw err;
  }
}

function clearCache(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

module.exports = { getOrFetch, clearCache };
