export type Locale = 'ru';  // Future: | 'en'
export type AffixType = 'prefix' | 'suffix';
export type ModOrigin = 'normal' | 'desecrated' | 'corrupted' | 'essence' | 'breachborn';
export type SearchLogic = 'and' | 'or';
export type JewelType = 'ruby' | 'emerald' | 'sapphire' | 'shared';

export interface GenderForms {
  ms?: string;  // masculine singular
  fs?: string;  // feminine singular
  ns?: string;  // neuter singular
  mp?: string;  // masculine plural
  fp?: string;  // feminine plural
  np?: string;  // neuter plural
}

export interface GameToken {
  id: string;
  category: string;
  origin: ModOrigin;
  rawText: Record<Locale, string>;
  rawTextTemplate: Record<Locale, string>;
  regex: Record<Locale, string>;
  /** Family key: normalized rawTextTemplate for grouping mods of the same family */
  familyKey: Record<Locale, string>;
  /** Regex prefix: text before the number placeholder, used for disambiguation
   *  in dual-number mods only (e.g., "От" for "От ## до ## урона").
   *  Since .* does NOT cross block boundaries, prefix is empty for single-number mods. */
  regexPrefix: Record<Locale, string>;
  /** Whether the template has multiple ##/# placeholders (dual-number or dual-stat).
   *  Used for numeric filtering: dual-number mods filter by ranges[0] (first placeholder). */
  hasMultiPlaceholder: boolean;
  /** Exclusion patterns for cross-family FP prevention.
   *  When the main regex suffix also matches compound-family tokens,
   *  these patterns are used to generate negation groups:
   *  "suffix" !"exclude1" !"exclude2"
   *  Empty array or absent means no exclusions needed. */
  regexExclude?: Record<Locale, string[]>;
  /** AND-composed prefix context for cross-family FP prevention.
   *  When regex + regexExclude cannot eliminate all FP because the suffix
   *  appears in both target and conflict families, this field provides a
   *  short substring that appears ONLY in the target family's rawText
   *  (typically a word before the number placeholder like "имеют" for
   *  "Приспешники имеют ... увеличение урона").
   *  UI compiles: AND(LITERAL(regexPrefixContext), LITERAL(regex)) → "context" "suffix"
   *  Both must appear on the item (AND across blocks), eliminating FP
   *  where "suffix" appears without "context".
   *  Empty string or absent means no prefix context needed. */
  regexPrefixContext?: Record<Locale, string>;
  /** Jewel type classification (only for jewel category). Populated by ETL from
   *  poe2db ModCalc pages. 'shared' if mod appears on multiple jewel types or unknown. */
  jewelType?: JewelType;
  genderForms: Record<Locale, GenderForms>;
  affix: AffixType;
  tags: string[];
  ranges: number[][];
  values: number[];
  hasYofication: boolean;
  yoficationPositions: number[];
  level: number;
  tradeStatId?: string;
}

export interface OptimizationEntry {
  ids: string[];
  regex: Record<Locale, string>;
  weight: number;
  count: number;
}

export interface CategoryData {
  version: string;
  category: string;
  source: string;
  tokens: GameToken[];
  optimizationTable: Record<string, OptimizationEntry>;
}

/** A group of GameTokens that share the same familyKey + affix (Family Pooling) */
export interface FamilyGroup {
  /** familyKey.ru — normalized key for grouping */
  familyKey: string;
  /** Affix type of the group (prefix or suffix) */
  affix: AffixType;
  /** All tokens in this family group (after filtering) */
  members: GameToken[];
  /** Minimum value across all members' ranges/values */
  globalMin: number;
  /** Maximum value across all members' ranges/values */
  globalMax: number;
  /** Display text: template with global range substituted */
  displayText: string;
  /** Whether the template has multiple ## placeholders */
  hasMultiPlaceholder: boolean;
  /** For multi-placeholder: [[min1,max1],[min2,max2],...] per slot */
  rangeSlots: number[][];
  /** Index of the range slot used for numeric filtering (0 = first placeholder).
   *  For dual-number mods like "От ## до ## урона", this is 0 (filter by min damage). */
  filterSlotIndex: number;
}

export type ASTNode =
  | { type: 'AND'; children: ASTNode[] }
  | { type: 'OR'; children: ASTNode[] }
  | { type: 'EXCLUDE'; child: ASTNode }
  | { type: 'LITERAL'; value: string; tokenId?: string }
  | { type: 'RANGE'; min?: number; max?: number; suffix?: string; prefix?: string; exact?: boolean };
// prefix: only for dual-number mods ("От ## до ## ..."), anchors number within same block
