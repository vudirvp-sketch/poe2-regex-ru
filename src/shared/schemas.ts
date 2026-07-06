/**
 * Zod schemas for CategoryData — runtime validation at ETL→runtime boundaries.
 *
 * These schemas validate JSON data loaded from public/generated/*.json at the
 * data loader boundary (loader.ts). They catch malformed or outdated JSON files
 * before they corrupt runtime state.
 *
 * Schema structure mirrors src/shared/types.ts exactly.
 * Optional fields use .optional() — matches the TypeScript interface definitions.
 *
 * Usage:
 *   import { CategoryDataSchema } from '@shared/schemas';
 *   const data = CategoryDataSchema.parse(json);   // throws ZodError on invalid
 *   const result = CategoryDataSchema.safeParse(json); // { success, error? }
 */
import { z } from 'zod';

// ─── Primitives ──────────────────────────────────────────────────────

export const LocaleSchema = z.literal('ru'); // Future: z.union([z.literal('ru'), z.literal('en')])

export const AffixTypeSchema = z.enum(['prefix', 'suffix', 'implicit']);

export const ModOriginSchema = z.enum(['normal', 'desecrated', 'corrupted', 'essence', 'breachborn']);

export const SearchLogicSchema = z.enum(['and', 'or']);

export const JewelTypeSchema = z.enum(['ruby', 'emerald', 'sapphire', 'shared']);

export const PriorityTierSchema = z.enum(['S', 'A', 'B', 'C']);

// ─── Record<Locale, T> helpers ───────────────────────────────────────

/** Record<Locale, string> — currently { ru: string } */
const LocalizedString = z.record(LocaleSchema, z.string());

/** Record<Locale, string[]> — currently { ru: string[] } */
const LocalizedStringArray = z.record(LocaleSchema, z.array(z.string()));

// ─── GenderForms ─────────────────────────────────────────────────────

export const GenderFormsSchema = z.object({
  ms: z.string().optional(),
  fs: z.string().optional(),
  ns: z.string().optional(),
  mp: z.string().optional(),
  fp: z.string().optional(),
  np: z.string().optional(),
});

// ─── GameToken ───────────────────────────────────────────────────────

export const GameTokenSchema = z.object({
  id: z.string(),
  category: z.string(),
  origin: ModOriginSchema,
  rawText: LocalizedString,
  rawTextTemplate: LocalizedString,
  regex: LocalizedString,
  familyKey: LocalizedString,
  regexPrefix: LocalizedString,
  hasMultiPlaceholder: z.boolean(),
  regexExclude: LocalizedStringArray.optional(),
  regexPrefixContext: LocalizedString.optional(),
  jewelType: JewelTypeSchema.optional(),
  // iter 101 (Known Issue #4 fix): functionalCategory was missing here — Zod
  // stripped it from every token at loadCategoryData() → classifyFunctionalBlock()
  // fell into 'other' fallback → all affixes rendered as "Прочее" in production.
  // Added as optional to match types.ts GameToken.functionalCategory?.
  functionalCategory: z.string().optional(),
  genderForms: z.record(LocaleSchema, GenderFormsSchema),
  affix: AffixTypeSchema,
  tags: z.array(z.string()),
  ranges: z.array(z.array(z.number())),
  values: z.array(z.number()),
  hasYofication: z.boolean(),
  yoficationPositions: z.array(z.number()),
  level: z.number(),
  tradeStatId: z.string().optional(),
  // iter 153 KI#10/KI#12 hardening: marks tokens whose regex was set by an
  // explicit i18n-overrides.json entry. Iterative optimizer must skip them.
  manualOverride: z.boolean().optional(),
});

// ─── OptimizationEntry ──────────────────────────────────────────────

export const OptimizationEntrySchema = z.object({
  ids: z.array(z.string()),
  regex: LocalizedString,
  regexPrefixContext: LocalizedString.optional(),
  regexExclude: LocalizedStringArray.optional(),
  weight: z.number(),
  count: z.number(),
});

// ─── CategoryData ────────────────────────────────────────────────────

export const CategoryDataSchema = z.object({
  version: z.string(),
  category: z.string(),
  source: z.string(),
  sourceHash: z.string().optional(),
  tokens: z.array(GameTokenSchema),
  optimizationTable: z.record(z.string(), OptimizationEntrySchema),
});

// ─── Inferred TypeScript types (should match types.ts) ───────────────

/** Type inferred from Zod schema — use for runtime-validated data */
export type ValidatedCategoryData = z.infer<typeof CategoryDataSchema>;
export type ValidatedGameToken = z.infer<typeof GameTokenSchema>;
export type ValidatedOptimizationEntry = z.infer<typeof OptimizationEntrySchema>;

// ─── ETL internal types ─────────────────────────────────────────────

/** Affix type for ETL-internal tiers (prefix | suffix only — no implicit in ModsView data) */
const EtlAffixTypeSchema = z.enum(['prefix', 'suffix']);

/** RawModTier — parsed from poe2db.tw ModsView JSON before normalization.
 *  Validates each tier entry extracted from the HTML scraper. */
export const RawModTierSchema = z.object({
  tier: z.string(),
  nameHtml: z.string(),
  level: z.number().int().min(0),
  descriptionHtml: z.string(),
  weight: z.string(),
  modCode: z.string(),
  affix: EtlAffixTypeSchema,
  tags: z.array(z.string()),
  modFamily: z.array(z.string()),
});

/** RawModGroupData — grouped mod tiers from poe2db.tw before normalization.
 *  Validates the output of parseTypeBPage() / parseTypeAPage() at the ETL boundary. */
export const RawModGroupDataSchema = z.object({
  genGroup: z.string().min(1),
  origin: ModOriginSchema,
  tags: z.array(z.string()),
  maxLevel: z.number().int().min(0),
  tiers: z.array(RawModTierSchema).min(1),
});

/** Inferred ETL types */
export type ValidatedRawModTier = z.infer<typeof RawModTierSchema>;
export type ValidatedRawModGroupData = z.infer<typeof RawModGroupDataSchema>;

// ─── Atlas Timeless Jewel schemas (iter 176) ─────────────────────────
//
// Runtime validation for `public/generated/timeless-jewel.json`.
// Mirrors AtlasNodeToken / AtlasJewelCategoryData in src/shared/types.ts.
// Used by src/data/atlas-jewel-loader.ts at the fetch→runtime boundary.

export const AtlasJewelIdSchema = z.enum(['undying-hate', 'heroic-tragedy']);

export const AtlasNodeTokenSchema = z.object({
  id: z.string().min(1),
  jewel: AtlasJewelIdSchema,
  name: LocalizedString,
  // REQUIRED — UI shows effects to player. Parser always populates this.
  description: LocalizedString,
  iconUrl: z.string().url(),
  slug: z.string().min(1),
  sourceKey: z.string().min(1),
});

export const AtlasJewelCategoryDataSchema = z.object({
  version: z.string(),
  category: z.literal('timeless-jewel'),
  source: z.string(),
  sourceHash: z.string().optional(),
  jewels: z.array(
    z.object({
      id: AtlasJewelIdSchema,
      name: LocalizedString,
      nodes: z.array(AtlasNodeTokenSchema).min(1),
    }),
  ).min(1),
});

export type ValidatedAtlasNodeToken = z.infer<typeof AtlasNodeTokenSchema>;
export type ValidatedAtlasJewelCategoryData = z.infer<typeof AtlasJewelCategoryDataSchema>;
