export type Locale = 'ru';  // Future: | 'en'
// 'implicit' = item implicit properties (waystone implicits, tablet charges, etc.)
export type AffixType = 'prefix' | 'suffix' | 'implicit';
export type ModOrigin = 'normal' | 'desecrated' | 'corrupted' | 'essence' | 'breachborn';
/**
 * Search logic mode for category pages.
 *  - 'and'   : ALL selected mods must appear on the item (each in own quoted group).
 *  - 'or'    : ANY of the selected mods may appear (all share a single quoted OR-group).
 *  - 'mixed' : iter 159 — combined AND+OR pattern (in-game verified iter 157, KI#44).
 *              selectedIds → MUST tokens (each in own quoted group, AND across blocks).
 *              optionalIds → OPT tokens (collected into a single MIXED_OR quoted group).
 *              excludedIds → `!BAD` item-wide negation as the FIRST AND child.
 *              Output: `"!BAD" "MUST1" "MUST2" "OPT1|OPT2|OPT3"`.
 *              Core layer (AST + compiler + builder + tests) landed in iter 158.
 *              UI integration lands in iter 159.
 */
export type SearchLogic = 'and' | 'or' | 'mixed';
export type JewelType = 'ruby' | 'emerald' | 'sapphire' | 'shared';
/** Priority tier based on affix popularity research (S=highest, C=lowest) */
export type PriorityTier = 'S' | 'A' | 'B' | 'C';
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
  /** iter 153 (KI#10/KI#12 hardening): set to true by ETL applyI18nOverrides
   *  when an explicit `regex` override was applied. Iterative optimizer MUST
   *  skip these tokens (no FN-repair, no suffix-shortening, no dialect) so
   *  the manual override survives subsequent ETL runs. Absent = false. */
  manualOverride?: boolean;
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

/**
 * Options for MIXED_OR node (iter 158, KI#45/KI#46 mitigations).
 *
 * MIXED_OR represents an OR-group inside an AND-context — the verified
 * combined-mode pattern: `"MUST1" "MUST2" "OPT1|OPT2|OPT3"`.
 *
 * Semantically equivalent to OR for compilation (children share a single
 * quoted group separated by `|`), but with two in-game-verified mitigations:
 *
 * - `anchorFirstAltOnly`: KI#45 — `^`-anchor on the second+ ALT in an OR-group
 *   breaks matching (T4 in iter 157). When true, the compiler strips a leading
 *   `^` from every alternative EXCEPT the first. This lets the AST builder
 *   reuse the existing reversed-RANGE / anchorStart logic without worrying
 *   about which alt ends up first in the compiled output.
 *
 * - `autoTruncate`: KI#46 — PoE2 has a hard 250-char limit in combined mode
 *   (T5 in iter 157). When true, the post-build helper `truncateMixedOrLiterals`
 *   shortens LITERAL children values (preserving the start, which is the most
 *   distinctive part of Russian mod names) to fit the budget. Verified in-game
 *   (T8): truncation works in combined mode and saves length.
 */
export interface MixedOrOptions {
  /** KI#45 mitigation: strip leading ^ from non-first alternatives. Default false. */
  anchorFirstAltOnly?: boolean;
}

export type ASTNode =
  | { type: 'AND'; children: ASTNode[] }
  | { type: 'OR'; children: ASTNode[] }
  | { type: 'MIXED_OR'; children: ASTNode[]; options?: MixedOrOptions }
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

// ─── Atlas Timeless Jewel — new minimal data model (iter 176) ─────────────
//
// These types are intentionally SEPARATE from GameToken / CategoryData because
// they model a fundamentally different domain:
//
//   GameToken       → item affixes (search via PoE2 inventory search bar)
//                     Uses item-regex semantics: AND ✅, NOT ✅, multi-word OR ❌
//                     Has ranges, familyKey, affix type, gender forms, etc.
//
//   AtlasNodeToken  → atlas tree passives replaced by Timeless Jewels
//                     (Undying Hate + Heroic Tragedy). Search via atlas tree
//                     search bar. Uses ATLAS-regex semantics (verified iter 175):
//                       - multi-word OR ✅  `"А Б\|В Г"` works
//                       - AND ❌            `"А" "Б"` = 0 matches
//                       - NOT ❌            `"!А\|Б"` highlights ALL nodes
//                     No ranges, no affix type, no gender forms — just a name.
//
// The `description` field is REQUIRED because the UI must show the player what
// the node does (effects) so they can decide which nodes to highlight. The
// generator uses ONLY `name` — description never enters the regex.
//
// See `docs/ATLAS_JEWEL_PLAN.md` for the full design rationale.

/** Which Timeless Jewel a node belongs to. */
export type AtlasJewelId = 'undying-hate' | 'heroic-tragedy';

/**
 * A single atlas-tree passive node that a Timeless Jewel can replace the
 * original node with. Stored inside `AtlasJewelCategoryData.jewels[].nodes`.
 */
export interface AtlasNodeToken {
  /** Stable unique id, format: `<jewelId>.<sourceKey>` (e.g. `undying-hate.abyss_notable_1`). */
  id: string;
  /** Which jewel replaces the original node with this one. */
  jewel: AtlasJewelId;
  /** Display name in the client locale — used BOTH for UI and for the regex. */
  name: Record<Locale, string>;
  /**
   * Effect description shown in the UI (one or more mod lines joined with `\n`).
   * REQUIRED — the player needs to see what the node gives before clicking.
   * NEVER enters the regex (regex uses `name` only).
   */
  description: Record<Locale, string>;
  /** Absolute CDN URL of the node icon (poe2db.tw hosted). */
  iconUrl: string;
  /** English slug from poe2db href (e.g. `Disciple_of_Darkness`). */
  slug: string;
  /** AlternatePassiveSkills key from poe2db `data-hover` (e.g. `abyss_notable_1`). */
  sourceKey: string;
}

/**
 * Top-level shape of `public/generated/timeless-jewel.json`.
 * Contains metadata + an array of jewels, each with its full node list.
 */
export interface AtlasJewelCategoryData {
  /** ISO timestamp of the parser run that produced this file. */
  version: string;
  /** Fixed literal — distinguishes from CategoryData.category. */
  category: 'timeless-jewel';
  /** Always `'poe2db.tw'`. */
  source: string;
  /** Optional SHA-256 prefix of source HTML (for staleness detection). */
  sourceHash?: string;
  /** The two Timeless Jewels + their node lists. */
  jewels: Array<{
    id: AtlasJewelId;
    name: Record<Locale, string>;
    nodes: AtlasNodeToken[];
  }>;
}
