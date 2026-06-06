export type Locale = 'ru';  // Future: | 'en'
export type AffixType = 'prefix' | 'suffix';
export type ModOrigin = 'normal' | 'desecrated' | 'corrupted' | 'essence' | 'breachborn';
export type SearchLogic = 'and' | 'or';

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
  /** Regex prefix: text before the number placeholder, used to anchor number
   *  to the correct mod line. Prevents .* from crossing mod boundaries.
   *  Example: "даруют на" for "Боссы карт даруют на ##% больше опыта" */
  regexPrefix: Record<Locale, string>;
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
}

export type ASTNode =
  | { type: 'AND'; children: ASTNode[] }
  | { type: 'OR'; children: ASTNode[] }
  | { type: 'EXCLUDE'; child: ASTNode }
  | { type: 'LITERAL'; value: string; tokenId?: string }
  | { type: 'RANGE'; min?: number; max?: number; suffix?: string; prefix?: string; exact?: boolean };
