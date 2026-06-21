/**
 * Block Sort Rules — per-functional-block canonical ordering for within-block sort.
 *
 * iter 112: introduces systematic within-block ordering to replace pure
 * alphabetical sort. The user explicitly complained that alphabetical sort
 * produces "каша" (chaos) inside functional blocks:
 *
 *   - In «Сопротивления»: «молния» → «огонь» → «хаос» → «холод» (alphabetical)
 *     breaks the player's mental model of "chaos → lightning → cold → fire".
 *   - In «Приспешники»: «максимум здоровья» → «урон» → «максимум здоровья» →
 *     «урон» (mixed Compañions/Minions) — same stat appears multiple times
 *     non-contiguously.
 *   - In «Состояния»: «увеличение силы» and «увеличение шанса» mods intermixed
 *     instead of grouped.
 *
 * Architecture:
 *  - Each functional block has an ordered list of `SortRule { pattern, order }`.
 *  - The first rule whose `pattern` matches the familyKey text determines the
 *    sortKey prefix (zero-padded numeric string).
 *  - If no rule matches, the sortKey is `99` (large number → falls to end,
 *    then alphabetical within that bucket).
 *  - `sortGroupsAlphabetically` (in mod-classifier.ts) sorts by sortKey first,
 *    then familyKey as tiebreaker.
 *
 * Conservative scope (iter 112):
 *  - Only 4 blocks have explicit rules: resistances, attributes, minions, ailments.
 *  - All other blocks return empty rule list → sortKey defaults to "99" →
 *    behaviour identical to pre-iter-112 (pure alphabetical).
 *  - Future iterations can extend by adding rules to BLOCK_SORT_RULES.
 *
 * Design principles:
 *  1. Rules are ordered MOST-SPECIFIC to LEAST-SPECIFIC. First match wins.
 *  2. Patterns use case-insensitive regex on the familyKey text.
 *  3. Each rule's `order` is the primary sort position (0-first).
 *  4. The alpha tiebreaker within the same order bucket preserves
 *     alphabetical readability for mods that share the same semantic slot.
 *
 * Source: docs/AFFIX_ORDERING_PLAN.md (iter 112).
 */
import type { FunctionalBlock } from './mod-classifier';

export interface SortRule {
  /** Case-insensitive regex matched against familyKey text.
   *  First match wins — order rules from most-specific to least-specific. */
  pattern: RegExp;
  /** Primary sort position. Lower = earlier. */
  order: number;
  /** Optional human-readable comment explaining why this rule exists. */
  comment?: string;
}

/**
 * Per-block sort rules. Empty array = no rules → sortKey defaults to "99"
 * (behaviour identical to pre-iter-112 alphabetical sort).
 *
 * To add a new block's rules, add an entry here. No other code changes needed.
 */
export const BLOCK_SORT_RULES: Partial<Record<FunctionalBlock, SortRule[]>> = {
  // ─── resistances (18 family-keys) ────────────────────────────────────────
  // User request: chaos → lightning → cold → fire consistency.
  // Order:
  //   0. Chaos (single) — rarest, most-coveted.
  //   1. Lightning.
  //   2. Cold.
  //   3. Fire.
  //   4. Dual-element combinations (lightning+chaos, cold+chaos, fire+chaos)
  //      — ordered by their first element using the same chaos/light/cold/fire rule.
  //   5. All-elements (всем стихиям).
  //   6. Max-resist variants (same element order as 0-3 but in a separate bucket
  //      so max-resist mods group together).
  //   7. Added-resist properties (#% повышение значений добавленных свойств
  //      сопротивлений) — meta-mod, comes after concrete resists.
  //   8. Passive-tree-granted resists (jewel-specific — "Значимые пассивные
  //      умения в радиусе также дают: +#% к сопротивлению ...") — last because
  //      these are jewel-timeless-jewel-style mods, not direct gear resists.
  resistances: [
    // Passive-tree granted (jewel-specific) — checked FIRST (most specific)
    // because passive-tree family-keys END with the same "к сопротивлению X"
    // text as direct resists. First-match-wins requires more-specific rules first.
    { pattern: /значимые пассивные умения.*сопротивлению хаосу/i, order: 30, comment: 'passive-tree chaos' },
    { pattern: /значимые пассивные умения.*сопротивлению молнии/i, order: 31, comment: 'passive-tree lightning' },
    { pattern: /значимые пассивные умения.*сопротивлению холоду/i, order: 32, comment: 'passive-tree cold' },
    { pattern: /значимые пассивные умения.*сопротивлению огню/i, order: 33, comment: 'passive-tree fire' },
    // Single-element regular resists (anchored at end of familyKey)
    { pattern: /к сопротивлению хаосу$/i, order: 0, comment: 'chaos single' },
    { pattern: /к сопротивлению молнии$/i, order: 1, comment: 'lightning single' },
    { pattern: /к сопротивлению холоду$/i, order: 2, comment: 'cold single' },
    { pattern: /к сопротивлению огню$/i, order: 3, comment: 'fire single' },
    // Dual-element resists (sorted by non-chaos element)
    { pattern: /к сопротивлениям молнии и хаосу/i, order: 4, comment: 'lightning+chaos' },
    { pattern: /к сопротивлениям холоду и хаосу/i, order: 5, comment: 'cold+chaos' },
    { pattern: /к сопротивлениям огню и хаосу/i, order: 6, comment: 'fire+chaos' },
    // All-elements
    { pattern: /к сопротивлению всем стихиям/i, order: 7, comment: 'all-elements regular' },
    { pattern: /к максимуму сопротивлений всем стихиям/i, order: 8, comment: 'all-elements max' },
    // Max-resist single-element (anchored at end of familyKey)
    { pattern: /к максимальному сопротивлению хаосу$/i, order: 10, comment: 'chaos max' },
    { pattern: /к максимальному сопротивлению молнии$/i, order: 11, comment: 'lightning max' },
    { pattern: /к максимальному сопротивлению холоду$/i, order: 12, comment: 'cold max' },
    { pattern: /к максимальному сопротивлению огню$/i, order: 13, comment: 'fire max' },
    // Meta-mod: added-resist properties
    { pattern: /добавленных свойств сопротивлений/i, order: 20, comment: 'meta: added-resist properties' },
  ],

  // ─── attributes (13 family-keys) ─────────────────────────────────────────
  // Order:
  //   0. Сила (single)
  //   1. Ловкость (single)
  //   2. Интеллект (single)
  //   3. Все характеристики (+# ко всем характеристикам)
  //   4. Dual-attribute combinations (Сила+Ловкость, Сила+Интеллект, Ловкость+Интеллект)
  //   5. Tri-attribute OR-choice ("силе, ловкости или интеллекту")
  //   6. Percentage increase to one attribute (same 0-2 order, offset 10-12)
  //   7. Percentage increase to tri-or-choice
  //   8. Requirement reduction
  attributes: [
    // Single-attribute flat
    { pattern: /к силе$/i, order: 0, comment: 'Сила flat' },
    { pattern: /к ловкости$/i, order: 1, comment: 'Ловкость flat' },
    { pattern: /к интеллекту$/i, order: 2, comment: 'Интеллект flat' },
    // All-attributes
    { pattern: /ко всем характеристикам/i, order: 3, comment: 'all attrs flat' },
    // Dual-attribute combinations
    { pattern: /к силе и ловкости/i, order: 4, comment: 'Сила+Ловкость' },
    { pattern: /к силе и интеллекту/i, order: 5, comment: 'Сила+Интеллект' },
    { pattern: /к ловкости и интеллекту/i, order: 6, comment: 'Ловкость+Интеллект' },
    // Tri-attribute OR-choice
    { pattern: /силе, ловкости или интеллекту/i, order: 7, comment: 'tri-or flat' },
    // Percentage increase to single attribute
    { pattern: /повышение силы/i, order: 10, comment: 'Сила %' },
    { pattern: /повышение ловкости/i, order: 11, comment: 'Ловкость %' },
    { pattern: /повышение интеллекта/i, order: 12, comment: 'Интеллект %' },
    // Percentage increase to tri-or-choice
    { pattern: /увеличение силы, ловкости или интеллекта/i, order: 13, comment: 'tri-or %' },
    // Requirement reduction
    { pattern: /уменьшение требований/i, order: 20, comment: 'requirement reduction' },
  ],

  // ─── minions (36 family-keys) ────────────────────────────────────────────
  // User complaint: "сначала здоровье, потом урон, потом снова здоровье и
  // потом урон. Каша получается."
  //
  // Strategy: 2-level sort — SUBJECT (Кукловод/Компаньон/Приспешник/Подношение)
  // then STAT (Здоровье → Урон → Крит → Скорость → Область → Сопротивления → ...).
  //
  // Sort key format: `subjectOrder * 100 + statOrder`.
  // Subject groups (tens digit):
  //   0. Companion mods (Компаньоны)
  //   1. Minion mods (Приспешники)
  //   2. Offering mods (Подношения)
  //   3. Other minion-ecosystem mods
  //
  // Stat groups (ones digit, within each subject):
  //   0. Health/max-health
  //   1. Damage
  //   2. Critical
  //   3. Speed (attack/cast/move/reload)
  //   4. Area
  //   5. Resistances
  //   6. Other (charge, armour, projectile, etc.)
  minions: [
    // ─── Companion (Компаньоны) — order 0-99 ───
    { pattern: /максимума здоровья компаньонов/i, order: 0, comment: 'Companion: health' },
    { pattern: /компаньоны наносят.*урон/i, order: 1, comment: 'Companion: damage' },

    // ─── Minion (Приспешники) — order 100-199 ───
    // Health
    { pattern: /приспешники имеют.*максимума здоровья/i, order: 100, comment: 'Minion: health' },
    { pattern: /приспешники.*дополнительного уменьшения.*физического урона/i, order: 101, comment: 'Minion: phys reduction (defensive)' },
    // Damage
    { pattern: /приспешники имеют.*увеличение урона(?!\s+(?:умениями|скорости))/i, order: 110, comment: 'Minion: damage (generic)' },
    { pattern: /приспешники наносят.*урон умениями-приказами/i, order: 111, comment: 'Minion: damage (order skills)' },
    { pattern: /приспешники наносят.*урон, если недавно вы наносили удар/i, order: 112, comment: 'Minion: damage (conditional)' },
    { pattern: /приспешники.*увеличение силы наносящих урон состояний/i, order: 113, comment: 'Minion: ailment damage' },
    { pattern: /приспешники разрушают броню/i, order: 114, comment: 'Minion: armour break' },
    { pattern: /приспешников за каждое.*умение-приказ/i, order: 115, comment: 'Minion: damage (per-order skill)' },
    // Critical — note: family-keys have both "приспешники имеют ... шанса критического удара"
    // and "критическому урону приспешников" (word order varies)
    { pattern: /(приспешников.*критическому урону|критическому урону приспешников)/i, order: 120, comment: 'Minion: crit damage' },
    { pattern: /приспешники имеют.*шанса критического удара/i, order: 121, comment: 'Minion: crit chance' },
    // Speed
    { pattern: /приспешники имеют.*скорости атаки и сотворения/i, order: 130, comment: 'Minion: attack+cast speed' },
    { pattern: /приспешники имеют.*скорости умений приказов/i, order: 131, comment: 'Minion: order skill speed' },
    { pattern: /приспешники имеют.*скорости перезарядки/i, order: 132, comment: 'Minion: reload speed' },
    { pattern: /приспешники имеют.*скорости передвижения/i, order: 133, comment: 'Minion: move speed' },
    { pattern: /приспешники воскрешаются.*быстрее/i, order: 134, comment: 'Minion: resurrect speed' },
    // Area
    { pattern: /приспешники имеют.*области действия/i, order: 140, comment: 'Minion: area' },
    // Resistances
    { pattern: /приспешники имеют.*сопротивлению всем стихиям/i, order: 150, comment: 'Minion: all-res' },
    { pattern: /приспешники имеют.*сопротивлению хаосу/i, order: 151, comment: 'Minion: chaos res' },
    // Minion utility (note: many family-keys have pattern "X приспешников", not "приспешников X")
    { pattern: /приспешники имеют.*накопления обездвиживания/i, order: 160, comment: 'Minion: slow accum' },
    { pattern: /приспешники имеют.*выпустить дополнительный снаряд/i, order: 161, comment: 'Minion: extra projectile' },
    { pattern: /(приспешников.*превосходящий шанс|кукловода)/i, order: 162, comment: 'Minion: puppeteer charge' },
    { pattern: /(приспешников.*меткости|меткости приспешников)/i, order: 163, comment: 'Minion: accuracy' },
    { pattern: /(приспешников.*эффективности удержания ресурсов|удержания ресурсов умениями приспешников)/i, order: 164, comment: 'Minion: reservation eff' },
    { pattern: /(приспешников.*времени существования|времени существования приспешников)/i, order: 165, comment: 'Minion: duration' },
    { pattern: /лимит.*приспешников/i, order: 166, comment: 'Minion: minion cap' },
    { pattern: /приспешники становятся гигантскими/i, order: 167, comment: 'Minion: giant transform' },
    { pattern: /усиленные удары приспешников/i, order: 168, comment: 'Minion: enhanced hits' },
    { pattern: /урона от ударов.*здоровья ваших призраков/i, order: 169, comment: 'Minion: ghost damage redirect' },

    // ─── Offerings (Подношения) — order 200-299 ───
    { pattern: /максимума здоровья подношений/i, order: 200, comment: 'Offering: health' },
    { pattern: /усиление эффекта подношений/i, order: 210, comment: 'Offering: effect' },
    { pattern: /длительности умений подношений/i, order: 220, comment: 'Offering: duration' },
    { pattern: /архонта нежити.*подношения/i, order: 230, comment: 'Offering: archon undead chance' },
  ],

  // ─── ailments (41 family-keys) ───────────────────────────────────────────
  // User complaint: "увеличение силы" and "увеличение шанса" intermixed.
  //
  // Strategy: 2-level sort — OPERATION (увеличение силы / увеличение шанса /
  // увеличение длительности / уменьшение / шанс наложения / ...) then
  // ELEMENT/STATE (chaos/Истощение Бездны → bleed → poison → burn → chill →
  // shock → stun → pin → ...).
  //
  // Sort key format: `operationOrder * 100 + stateOrder`.
  // Operation groups (hundreds digit):
  //   0. Увеличение силы (effect strength)
  //   1. Увеличение шанса (chance to apply)
  //   2. Увеличение длительности (duration)
  //   3. Уменьшение длительности (reduction — defensive)
  //   4. Шанс наложения (chance-on-hit)
  //   5. Порог (threshold)
  //   6. Скорость накопления шкалы (gauge accumulation speed)
  //   7. Прочее (other — восприимчивость, ослепление, Разрез, etc.)
  ailments: [
    // ─── Увеличение силы (operation=0) ───
    // State order: Истощение Бездны → Истощение → Кровотечение → Отравление →
    // Поджог → Шок → состояния (generic) → Горючесть → Парирование
    { pattern: /увеличение силы накладываемого вами Истощения Бездны/i, order: 0, comment: 'str: Abyss Depletion' },
    { pattern: /увеличение силы истощения/i, order: 1, comment: 'str: depletion' },
    { pattern: /увеличение силы накладываемого вами кровотечения/i, order: 2, comment: 'str: bleed' },
    { pattern: /увеличение силы накладываемого вами отравления/i, order: 3, comment: 'str: poison' },
    { pattern: /увеличение силы поджога, если недавно/i, order: 4, comment: 'str: burn (conditional)' },
    { pattern: /увеличение силы поджога/i, order: 5, comment: 'str: burn' },
    { pattern: /увеличение силы накладываемого вами шока/i, order: 6, comment: 'str: shock' },
    { pattern: /увеличение силы шока, если недавно/i, order: 7, comment: 'str: shock (conditional)' },
    { pattern: /увеличение силы накладываемых вами состояний/i, order: 8, comment: 'str: states (generic)' },
    { pattern: /увеличение силы горючести/i, order: 9, comment: 'str: combustibility' },
    { pattern: /увеличение урона парирования/i, order: 10, comment: 'str: parry damage' },

    // ─── Увеличение шанса (operation=100) ───
    { pattern: /увеличение шанса наложения кровотечения/i, order: 100, comment: 'chance: bleed' },
    { pattern: /увеличение шанса отравить/i, order: 101, comment: 'chance: poison' },
    { pattern: /увеличение шанса наложения шока/i, order: 102, comment: 'chance: shock' },
    { pattern: /увеличение шанса наложения состояний/i, order: 103, comment: 'chance: states (generic)' },

    // ─── Увеличение длительности (operation=200) ───
    { pattern: /увеличение длительности кровотечения/i, order: 200, comment: 'dur: bleed' },
    { pattern: /увеличение длительности яда/i, order: 201, comment: 'dur: poison' },
    { pattern: /увеличение длительности поджога, шока и охлаждения/i, order: 202, comment: 'dur: burn+shock+chill combo' },
    { pattern: /увеличение длительности охлаждения/i, order: 203, comment: 'dur: chill' },
    { pattern: /увеличение длительности шока/i, order: 204, comment: 'dur: shock' },
    { pattern: /увеличение длительности эффекта парирован/i, order: 205, comment: 'dur: parried' },
    { pattern: /увеличение длительности наносящих урон состояний/i, order: 206, comment: 'dur: damaging states (generic)' },

    // ─── Уменьшение длительности (operation=300, defensive) ───
    { pattern: /уменьшение длительности кровотечения на вас/i, order: 300, comment: 'reduce: bleed on you' },
    { pattern: /уменьшение длительности отравления на вас/i, order: 301, comment: 'reduce: poison on you' },
    { pattern: /уменьшение длительности поджога на вас/i, order: 302, comment: 'reduce: burn on you' },

    // ─── Шанс наложения (operation=400, on-hit procs) ───
    { pattern: /шанс наложить кровотечение при нанесении удара/i, order: 400, comment: 'proc: bleed on hit' },
    { pattern: /шанс отравить при нанесении удара/i, order: 401, comment: 'proc: poison on hit' },
    { pattern: /шанс наложения оцепенения при нанесении удара/i, order: 402, comment: 'proc: stun on hit' },
    { pattern: /шанс ослепить врагов при нанесении удара атаками/i, order: 403, comment: 'proc: blind on hit (attacks)' },
    // iter 112 fix: "Разрез" proc has different wording — "шансом могут наложить Разрез"
    // (instrumental case "шансом" not nominative "шанс", verb form differ).
    { pattern: /наложить разрез|шансом.*разрез/i, order: 404, comment: 'proc: slit on hit' },

    // ─── Порог (operation=500) ───
    { pattern: /увеличение порога заморозки/i, order: 500, comment: 'threshold: freeze' },
    { pattern: /увеличение порога стихийных состояний/i, order: 501, comment: 'threshold: elemental states' },

    // ─── Скорость накопления шкалы (operation=600) ───
    // Note: family-keys use genitive case "скорости накопления", not nominative "скорость".
    // Use stem "скорост" to match both.
    { pattern: /скорост.* накопления шкалы заморозки(?!.*боевыми)/i, order: 600, comment: 'gauge: freeze speed' },
    { pattern: /скорост.* накопления шкалы пригвождения/i, order: 601, comment: 'gauge: pin speed' },
    { pattern: /увеличение накопления шкалы заморозки, если недавно/i, order: 602, comment: 'gauge: freeze (conditional)' },

    // ─── Прочее (operation=700) ───
    { pattern: /усиление эффекта восприимчивости/i, order: 700, comment: 'other: susceptibility' },
    { pattern: /усиление эффекта ослепления/i, order: 701, comment: 'other: blind effect' },
    { pattern: /на вас нельзя наложить эффект оскверненной крови/i, order: 702, comment: 'other: corrupted blood immune' },
    { pattern: /накладывает восприимчивость к стихиям/i, order: 703, comment: 'other: elem susceptibility proc' },
    { pattern: /наносящие урон состояния наносят урон на #% быстрее/i, order: 704, comment: 'other: faster damaging states' },
  ],
};

/**
 * Compute the sortKey for a FamilyGroup based on its functional block and text.
 *
 * Returns a string that sorts lexicographically in the desired order:
 *  - 3-digit zero-padded order number (from BLOCK_SORT_RULES, supports up to 999)
 *  - Then "::" separator
 *  - Then the familyKey (for alphabetical tiebreaker within the same order bucket)
 *
 * If the block has no rules in BLOCK_SORT_RULES, returns "999::<familyKey>"
 * which puts all unmatched mods in a single bucket at the end (preserving
 * alphabetical order within that bucket — same as pre-iter-112 behaviour).
 *
 * If the block has rules but none match, returns "900::<familyKey>" —
 * a bucket just before the "no-rules" 999 bucket. This makes it easy to spot
 * unhandled mods during rule iteration.
 *
 * 3-digit padding is used because some blocks (minions, ailments) use
 * hierarchical order values that exceed 100 (e.g., minions: subject*100 +
 * stat; ailments: operation*100 + state).
 *
 * @param block - Functional block key (e.g., 'resistances', 'minions')
 * @param familyKey - familyKey text (already has ::origin suffix stripped by caller)
 * @returns sortKey string for use in sortGroupsAlphabetically
 */
export function computeSortKey(block: FunctionalBlock | string, familyKey: string): string {
  const rules = BLOCK_SORT_RULES[block as FunctionalBlock];
  if (!rules || rules.length === 0) {
    // No rules for this block → default bucket preserves alphabetical order.
    return `999::${familyKey}`;
  }

  // Find first matching rule (rules are pre-ordered most-specific to least-specific)
  for (const rule of rules) {
    if (rule.pattern.test(familyKey)) {
      return String(rule.order).padStart(3, '0') + '::' + familyKey;
    }
  }

  // Block has rules but none matched — log bucket for future iteration.
  return `900::${familyKey}`;
}
