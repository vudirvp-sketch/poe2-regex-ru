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

export const PriorityFilterSchema = z.enum(['all', 'S+A', 'S']);

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
  genderForms: z.record(LocaleSchema, GenderFormsSchema),
  affix: AffixTypeSchema,
  tags: z.array(z.string()),
  ranges: z.array(z.array(z.number())),
  values: z.array(z.number()),
  hasYofication: z.boolean(),
  yoficationPositions: z.array(z.number()),
  level: z.number(),
  tradeStatId: z.string().optional(),
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
