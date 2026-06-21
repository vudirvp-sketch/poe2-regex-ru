export type Locale = 'ru';  // Future: | 'en'
// 'implicit' = item implicit properties (waystone implicits, tablet charges, etc.)
export type AffixType = 'prefix' | 'suffix' | 'implicit';
export type ModOrigin = 'normal' | 'desecrated' | 'corrupted' | 'essence' | 'breachborn';
export type SearchLogic = 'and' | 'or';
export type JewelType = 'ruby' | 'emerald' | 'sapphire' | 'shared';
/** Priority tier based on affix popularity research (S=highest, C=lowest) */
export type PriorityTier = 'S' | 'A' | 'B' | 'C';
/** Filter mode for priority tiers in UI */
export type PriorityFilter = 'all' | 'S+A' | 'S';
/**
 * Within-block sort mode for family groups inside a sub-group.
 *  - 'alpha'      : familyKey (Russian locale) primary, priorityTier tiebreaker
 *                   (iter 99 default — preserves alphabetical flow within
 *                   functional blocks; tier still visible as a coloured badge).
 *  - 'tier-first' : priorityTier (S→A→B→C) primary, familyKey tiebreaker
 *                   (legacy pre-iter-99 behaviour — surfaces best-in-class
 *                   mods at the top of every block).
 *
 * iter 106 (P4): exposed as a UI toggle in CategoryControlPanel for categories
 * that have priority classification (ring/amulet/belt/jewel/waystone/tablet).
 * Persisted via filter-store.extraState → URL hash (key: 'sortMode').
 */
export type SortMode = 'alpha' | 'tier-first';

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
  /** Functional category (only for jewel/jewellery categories). Populated by ETL from
   *  poe2db ModCalc pages using tag-based classification. When present, classifyFunctionalBlock()
   *  uses this directly instead of regex-based heuristics — ~100% accuracy, no fragile patterns.
   *  Undefined for categories without ETL-tagged data (waystone/tablet/relic). */
  functionalCategory?: string;
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
  /** AND-composed prefix context from the family's tokens.
   *  When all tokens in the optimization group share the same regexPrefixContext,
   *  it is stored here so the runtime optimizer can create AND(context, regex) nodes.
   *  Empty string or absent means no prefix context. */
  regexPrefixContext?: Record<Locale, string>;
  /** Exclusion patterns from the family's tokens.
   *  When all tokens in the optimization group share the same regexExclude patterns,
   *  they are stored here so the runtime optimizer can add exclude nodes.
   *  Empty array or absent means no exclusions. */
  regexExclude?: Record<Locale, string[]>;
  weight: number;
  count: number;
}

export interface CategoryData {
  version: string;
  category: string;
  source: string;
  /** SHA-256 hash (16-char prefix) of all poe2db.tw source HTML files.
   *  Used by --check-stale to detect if source data has changed since last ETL run.
   *  When sourceHash in generated JSON differs from current cache hash, re-run ETL. */
  sourceHash?: string;
  tokens: GameToken[];
  optimizationTable: Record<string, OptimizationEntry>;
}

/** A group of GameTokens that share the same familyKey + affix (Family Pooling) */
export interface FamilyGroup {
  /** familyKey.ru — normalized key for grouping */
  familyKey: string;
  /** Affix type of the group (prefix, suffix, or implicit) */
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
  /** Priority tier based on affix popularity research (S=highest demand, C=lowest).
   *  Assigned by classifyPriorityTier() during grouping. Used for default sort order
   *  (S→A→B→C) and UI filter. Defaults to 'C' if not classified. */
  priorityTier: PriorityTier;
  /** iter 112: canonical within-block sort key.
   *
   *  Computed by `computeSortKey(functionalCategory, familyKey)` based on
   *  per-block ordering rules in `src/shared/block-sort-rules.ts`.
   *
   *  Format: `"<2-digit order>::<familyKey>"`.
   *  - When rules exist for the block and one matches, the 2-digit order
   *    encodes the semantic position (e.g., chaos=00, lightning=01, cold=02,
   *    fire=03 in `resistances`).
   *  - When the block has no rules or no rule matches, defaults to "99" or
   *    "90" respectively — both fall back to alphabetical familyKey as
   *    tiebreaker (preserves pre-iter-112 behaviour).
   *
   *  Used by `sortGroupsAlphabetically()` (primary sort) before familyKey.
   *  Undefined when set by tests/legacy callers → falls back to familyKey. */
  sortKey?: string;
}

export type ASTNode =
  | { type: 'AND'; children: ASTNode[] }
  | { type: 'OR'; children: ASTNode[] }
  | { type: 'EXCLUDE'; child: ASTNode }
  | { type: 'LITERAL'; value: string; tokenId?: string }
  | { type: 'RANGE'; min?: number; max?: number; suffix?: string; prefix?: string; exact?: boolean; anchorStart?: boolean; anchorEnd?: string; reversed?: boolean; colonAnchor?: boolean; threshold?: boolean; signPrefix?: '+' | '-' }
  | { type: 'MULTI_RANGE'; slots: Array<{ min?: number; max?: number; prefix: string }>; suffix: string; exact?: boolean; threshold?: boolean };
// prefix: only for dual-number mods ("От ## до ## ..."), anchors number within same block
// signPrefix: '+' or '-' when the template has +## or -## before the number.
//   '+' → compiler emits \+ before number regex (e.g. \+(2[7-9]|[3-9][0-9]|\d{3,})%.*suffix)
//   '-' → compiler emits - before number regex (e.g. -(1[0-9]|[0-9])%.*suffix)
//   Also provides implicit anchoring: \+ or - prevents FP from range notation numbers
//   (range notation numbers like 27 in (27-50) never have a +/- sign before them).
// anchorStart: when true, adds ^ before the number pattern to prevent range notation FP.
//   Set when rawTextTemplate starts with ## or [+-]## (number at position 0 of the mod block).
//   Verified in-game (Phase 9b): ^ anchors to start of mod block in PoE2 search.
// anchorEnd: when set, inserts this string after the number pattern (before .*suffix).
//   Used for suffix anchoring — e.g. '%' after number for ##% mods.
//   Verified in-game (Phase 9c): (2[7-9]|30)%.*suffix prevents FP from range notation
//   because numbers in range notation (e.g. 27 from (27-50)) are not followed by %.
//   ⚠️ FN risk: items where the actual roll has range notation (e.g. 27(22-27)%)
//   have '(' after the roll, not '%' — suffix anchoring would miss these.
// colonAnchor: when true AND reversed=true, inserts ': ' between .* and the number pattern.
//   Used for non-% reversed mods (e.g. "дополнительных редких монстров: ##") where
//   the template ends with ': ##'. Verified in-game: ': ' anchor prevents FP from range
//   notation because the rolled value appears right after ': ', while secondary numbers
//   in range notation (e.g. '2' in '1(1-2)') do not. Pattern: "suffix.*: (number)".
