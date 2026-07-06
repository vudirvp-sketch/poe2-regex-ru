/**
 * atlas-jewel-loader.ts — Runtime loader for `public/generated/timeless-jewel.json`.
 *
 * iter 176 — NEW. Mirrors `loader.ts` (which loads CategoryData) but targets
 * the smaller Atlas Timeless Jewel shape (see AtlasJewelCategoryData in
 * src/shared/types.ts).
 *
 * Responsibilities:
 *   - Fetch the JSON via `fetch()` (relative to BASE_URL).
 *   - Validate with `AtlasJewelCategoryDataSchema` (Zod) at the boundary.
 *   - Cache the parsed result in memory for the lifetime of the page.
 *   - Provide a convenience `getJewel(id)` accessor used by the page UI.
 *
 * Throws ZodError (via `.parse`) when the JSON shape is wrong — this is
 * intentional: a corrupt committed JSON should fail loud, not silently
 * render an empty page.
 */
import type { AtlasJewelCategoryData, AtlasJewelId, AtlasNodeToken } from '@shared/types';
import { AtlasJewelCategoryDataSchema } from '@shared/schemas';

const CACHE_KEY = 'timeless-jewel';
let cached: AtlasJewelCategoryData | null = null;

/** Load (and cache) the timeless-jewel data file. */
export async function loadAtlasJewelData(): Promise<AtlasJewelCategoryData> {
  if (cached) return cached;

  const url = `${import.meta.env.BASE_URL}generated/timeless-jewel.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load timeless-jewel data: ${response.status} ${response.statusText}`);
  }
  const raw = await response.json();
  const data = AtlasJewelCategoryDataSchema.parse(raw) as AtlasJewelCategoryData;
  cached = data;
  return data;
}

/** Convenience accessor — returns the nodes for a specific jewel. */
export function getJewelNodes(
  data: AtlasJewelCategoryData,
  jewelId: AtlasJewelId,
): AtlasNodeToken[] {
  const jewel = data.jewels.find((j) => j.id === jewelId);
  return jewel ? jewel.nodes : [];
}

/** Clear cache — used by tests to force a fresh load. */
export function clearAtlasJewelCache(): void {
  cached = null;
}

/** Stable cache key — exported for tests that want to assert identity. */
export const ATLAS_JEWEL_CACHE_KEY = CACHE_KEY;
