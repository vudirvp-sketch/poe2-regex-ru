/**
 * Fetch a page from poe2db.tw with retry logic and local caching.
 * All data is server-rendered HTML — no JS challenges.
 *
 * CLI flags (consumed by run-etl.ts):
 *   --fresh       Clear all cached HTML before fetching (force re-download)
 *   --check-stale Report cache staleness per URL and exit (no ETL run)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CACHE_DIR = path.resolve(process.cwd(), '.etl-cache');
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Cache management ───

/** Clear all cached HTML files. Returns number of files deleted. */
export function clearCache(): number {
  if (!fs.existsSync(CACHE_DIR)) return 0;
  const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.html'));
  let deleted = 0;
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(CACHE_DIR, file));
      deleted++;
    } catch {
      // Ignore individual file deletion errors
    }
  }
  return deleted;
}

export interface CacheEntryInfo {
  url: string;
  cached: boolean;
  ageMs: number | null;
  sizeBytes: number | null;
  contentHash: string | null;
  stale: boolean;
}

/** Get cache info for a specific URL (staleness check). */
export function getCacheInfo(url: string): CacheEntryInfo {
  const cachePath = getCachePath(url);
  if (!fs.existsSync(cachePath)) {
    return { url, cached: false, ageMs: null, sizeBytes: null, contentHash: null, stale: true };
  }
  const stat = fs.statSync(cachePath);
  const ageMs = Date.now() - stat.mtimeMs;
  const content = fs.readFileSync(cachePath, 'utf-8');
  const contentHash = hashContent(content);
  return {
    url,
    cached: true,
    ageMs,
    sizeBytes: stat.size,
    contentHash,
    stale: ageMs >= CACHE_TTL_MS,
  };
}

/** Compute a short SHA-256 hash of content for change detection. */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ─── Fetch logic ───

export async function fetchPage(url: string, useCache = true): Promise<string> {
  if (useCache) {
    const cached = loadFromCache(url);
    if (cached) {
      console.log(`  [cache] ${url}`);
      return cached;
    }
  }

  console.log(`  [fetch] ${url}`);

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'poe2-regex-ru-etl/1.0 (https://github.com/user/poe2-regex-ru)',
          'Accept': 'text/html',
          'Accept-Language': 'ru-RU,ru;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      saveToCache(url, html);
      return html;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`  [retry ${attempt}/${RETRY_COUNT}] ${lastError.message}`);
      if (attempt < RETRY_COUNT) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(`Failed to fetch ${url} after ${RETRY_COUNT} attempts: ${lastError?.message}`);
}

// ─── Internal helpers ───

function getCachePath(url: string): string {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  // Create a safe filename from URL
  const safeName = url
    .replace(/https?:\/\//, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 200);
  return path.join(CACHE_DIR, `${safeName}.html`);
}

function loadFromCache(url: string): string | null {
  const cachePath = getCachePath(url);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    const ageMs = Date.now() - stat.mtimeMs;
    // Cache is valid for 24 hours
    if (ageMs < CACHE_TTL_MS) {
      return fs.readFileSync(cachePath, 'utf-8');
    }
  }
  return null;
}

function saveToCache(url: string, html: string): void {
  const cachePath = getCachePath(url);
  fs.writeFileSync(cachePath, html, 'utf-8');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
