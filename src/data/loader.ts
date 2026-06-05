import type { CategoryData } from '@shared/types';

const cache = new Map<string, CategoryData>();

/**
 * Load category data from public/generated/*.json
 * Results are cached in memory.
 */
export async function loadCategoryData(category: string): Promise<CategoryData> {
  if (cache.has(category)) {
    return cache.get(category)!;
  }

  const response = await fetch(`${import.meta.env.BASE_URL}generated/${category}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load ${category} data: ${response.statusText}`);
  }

  const data: CategoryData = await response.json();
  cache.set(category, data);
  return data;
}

/**
 * Load and merge multiple category data files into a single CategoryData.
 *
 * This is used for categories like "jewel" which have separate JSON files
 * for different origins (normal, desecrated, corrupted) that need to be
 * displayed together in one page with origin-based grouping.
 *
 * The merge strategy:
 * - Uses the first category's metadata (version, source)
 * - Merges all tokens arrays
 * - Merges optimizationTable entries (first category takes priority for duplicates)
 * - Caches the merged result under the primary category key + suffix
 *
 * @param categories - Array of category IDs to load and merge (first is primary)
 * @param cacheKey - Optional custom cache key (defaults to categories joined with "+")
 */
export async function loadMergedCategoryData(
  categories: string[],
  cacheKey?: string,
): Promise<CategoryData> {
  const key = cacheKey ?? categories.join('+');
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const allData = await Promise.all(categories.map(loadCategoryData));
  const primary = allData[0];

  const mergedTokens = allData.flatMap(d => d.tokens);

  const mergedOptTable = { ...primary.optimizationTable };
  for (let i = 1; i < allData.length; i++) {
    for (const [k, v] of Object.entries(allData[i].optimizationTable)) {
      if (!(k in mergedOptTable)) {
        mergedOptTable[k] = v;
      }
    }
  }

  const merged: CategoryData = {
    version: primary.version,
    category: primary.category,
    source: primary.source,
    tokens: mergedTokens,
    optimizationTable: mergedOptTable,
  };

  cache.set(key, merged);
  return merged;
}

/**
 * Clear the cache (useful for testing or forcing a refresh)
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Preload multiple categories in parallel
 */
export async function preloadCategories(categories: string[]): Promise<void> {
  await Promise.all(categories.map(loadCategoryData));
}
