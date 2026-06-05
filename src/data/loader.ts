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
