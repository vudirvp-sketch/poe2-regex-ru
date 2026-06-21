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
 * iter 113: added damage-type (47 family-keys, most visible category).
 * iter 114: added defence-stats (28 family-keys, second-most-visible defensive block).
 * iter 115: added resources (29 family-keys — health/mana/ES pools + damage conversion).
 * iter 116: added weapon-specific (24 family-keys, jewel-only) + flasks (16 family-keys, belt+jewel).
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

  // ─── damage-type (47 family-keys) — iter 113 ────────────────────────────
  // User feedback (iter 112 carry-over): damage-type is the most visible
  // functional block; alphabetical sort produces "каша" mixing elemental
  // damage with conversion mods, conditional damage, by-source damage, etc.
  //
  // Canonical order (player mental model):
  //   0-9:   Физический (глобальный, добавленный к атакам, шипы)
  //   10-19: Огонь (увеличение, добавленный, насыщение, конверсия, шипы-огонь)
  //   20-29: Холод (увеличение, добавленный, насыщение, конверсия в холод)
  //   30-39: Молния (увеличение, добавленный, насыщение, конверсия в молнию)
  //   40-49: Хаос (увеличение, конверсия в хаос)
  //   50-59: Стихийный / насыщения (увеличение, max-насыщений, mechanic)
  //   60-79: Generic damage + by-source damage types (атаки, чары, снаряды,
  //          ближний бой, тотемы, кличи, растения, ловушки, помехи, шипы,
  //          улучшенные атаки, срабатывающие чары, вестники)
  //   80-89: Условный урон (low-HP, full-ES, transformed, corpse, melee-if-proj,
  //          proj-if-melee)
  //   90-99: По мишени (редкие/уникальные враги)
  //   100-109: Проколы + elementales недуги + Анемия + оскверненная кровь
  //
  // Design notes:
  //   - Rules are ordered MOST-SPECIFIC to LEAST-SPECIFIC. First match wins.
  //   - Generic patterns use `$` end-anchor to NOT match conditional variants
  //     (e.g., `увеличение урона от огня$` matches "#% увеличение урона от огня"
  //     but NOT "(#)% увеличение урона от огня, если вы подобрали ...").
  //   - Conversion patterns (Наносит ... в виде дополнительного урона от X)
  //     come BEFORE generic element patterns because they contain the same
  //     element name as substring but at end of familyKey.
  //   - `^#% увеличение урона$` (exact-match generic damage) is anchored both
  //     ends to NOT match "#% увеличение урона будучи превращенным" etc.
  'damage-type': [
    // ─── Conversion (must come BEFORE generic element rules) ───────────
    { pattern: /наносит.*дополнительного урона от огня/i, order: 13, comment: 'fire: conversion to fire' },
    { pattern: /дарует.*дополнительного урона от холода/i, order: 23, comment: 'cold: phys→cold conversion (Дарует)' },
    { pattern: /наносит.*дополнительного урона от холода/i, order: 24, comment: 'cold: conversion to cold (Наносит)' },
    { pattern: /наносит.*дополнительного урона от молнии/i, order: 33, comment: 'lightning: conversion to lightning' },
    { pattern: /чары наносят.*дополнительного урона хаосом/i, order: 41, comment: 'chaos: conversion to chaos' },

    // ─── Added damage to attacks (must come BEFORE generic element rules) ──
    { pattern: /добавляет.*физического урона к атакам/i, order: 1, comment: 'physical: added to attacks' },
    { pattern: /добавляет.*урона от огня к атакам/i, order: 11, comment: 'fire: added to attacks' },
    { pattern: /добавляет.*урона от холода к атакам/i, order: 21, comment: 'cold: added to attacks' },
    { pattern: /добавляет.*урона от молнии к атакам/i, order: 31, comment: 'lightning: added to attacks' },

    // ─── Saturation-conditional element damage (before generic) ────────
    { pattern: /увеличение урона от огня, если вы подобрали/i, order: 12, comment: 'fire: saturation-conditional' },
    { pattern: /увеличение урона от холода, если вы подобрали/i, order: 22, comment: 'cold: saturation-conditional' },
    { pattern: /увеличение урона от молнии, если вы подобрали/i, order: 32, comment: 'lightning: saturation-conditional' },

    // ─── Thorns variants (must come BEFORE generic element/$-anchored rules) ──
    { pattern: /физического урона шипами/i, order: 2, comment: 'physical: thorns (flat)' },
    { pattern: /урона от огня шипами/i, order: 14, comment: 'fire: thorns (per 100 max health)' },

    // ─── Generic element damage (end-anchored to exclude conditional/conversion) ──
    { pattern: /глобального физического урона/i, order: 0, comment: 'physical: global %' },
    { pattern: /увеличение урона от огня$/i, order: 10, comment: 'fire: increase generic' },
    { pattern: /увеличение урона от холода$/i, order: 20, comment: 'cold: increase generic' },
    { pattern: /увеличение урона от молнии$/i, order: 30, comment: 'lightning: increase generic' },
    { pattern: /увеличение урона хаосом/i, order: 40, comment: 'chaos: increase generic' },
    { pattern: /увеличение урона от стихий$/i, order: 50, comment: 'elemental: all-elements increase' },

    // ─── Elemental saturation mechanics (ring/belt) ────────────────────
    { pattern: /максимальному количеству стихийных насыщений/i, order: 51, comment: 'elemental: max saturation count' },
    { pattern: /могут не удалить стихийные насыщения/i, order: 52, comment: 'elemental: saturation preservation mechanic' },

    // ─── Conditional damage (must come BEFORE by-source generic rules) ──
    // End-anchored generic rules below would match conditional variants if
    // we don't intercept them here first.
    { pattern: /увеличение урона от атак при малом количестве здоровья/i, order: 80, comment: 'conditional: low-HP attacks' },
    { pattern: /увеличение урона от чар при полном энергетическом щите/i, order: 81, comment: 'conditional: full-ES spells' },
    { pattern: /увеличение урона будучи превращенным/i, order: 82, comment: 'conditional: transformed' },
    { pattern: /увеличение урона, если вы недавно поглотили труп/i, order: 83, comment: 'conditional: corpse consumed' },
    { pattern: /увеличение урона в ближнем бою, если/i, order: 84, comment: 'conditional: melee if projectile' },
    { pattern: /увеличение урона снарядами, если/i, order: 85, comment: 'conditional: projectile if melee' },

    // ─── Generic damage + by-source damage types ───────────────────────
    // `^...$` exact match for the bare generic damage (no continuation).
    { pattern: /^#% увеличение урона$/i, order: 60, comment: 'generic: damage increase (bare)' },
    // End-anchored rules — match the bare by-source variant but NOT conditional
    // (conditional variants were intercepted above).
    { pattern: /увеличение урона от атак$/i, order: 61, comment: 'by-source: attacks generic' },
    { pattern: /увеличение урона от чар$/i, order: 62, comment: 'by-source: spells generic' },
    { pattern: /увеличение урона снарядов$/i, order: 63, comment: 'by-source: projectiles generic' },
    { pattern: /увеличение урона в ближнем бою$/i, order: 64, comment: 'by-source: melee generic' },
    { pattern: /увеличение урона тотемов/i, order: 65, comment: 'by-source: totems' },
    { pattern: /увеличение урона боевыми кличами/i, order: 66, comment: 'by-source: warcries' },
    { pattern: /увеличение урона умениями растений/i, order: 67, comment: 'by-source: plants' },
    { pattern: /увеличение урона от ловушек/i, order: 68, comment: 'by-source: traps' },
    { pattern: /увеличение урона помехами/i, order: 69, comment: 'by-source: obstacles' },
    { pattern: /увеличение урона шипами$/i, order: 70, comment: 'by-source: thorns generic' },
    // Word-form variants ("Улучшенные атаки наносят ...", "Срабатывающие чары наносят ...",
    // "Умения Вестников наносят ...") — different verb form, not intercepted above.
    { pattern: /улучшенные атаки наносят/i, order: 71, comment: 'by-source: enhanced attacks' },
    { pattern: /срабатывающие чары наносят/i, order: 72, comment: 'by-source: triggered spells' },
    { pattern: /умения вестников наносят/i, order: 73, comment: 'by-source: heralds' },

    // ─── By-target damage ──────────────────────────────────────────────
    { pattern: /увеличение урона от ударов по редким/i, order: 90, comment: 'by-target: rare/unique enemies' },

    // ─── Special mechanics (Проколы, elementales недуги, Анемия, оскверненная кровь) ──
    { pattern: /накладываемых чарами проколов/i, order: 100, comment: 'special: Puncture strength' },
    { pattern: /увеличение величины элементальных недугов/i, order: 101, comment: 'special: elemental ailments magnitude' },
    { pattern: /накладывает анем/i, order: 102, comment: 'special: Anemia on hit' },
    { pattern: /отрицательных эффектов оскверненной крови/i, order: 103, comment: 'special: corrupted blood extra debuffs' },
  ],

  // ─── defence-stats (28 family-keys) — iter 114 ───────────────────────────
  // User feedback (iter 113 carry-over): alphabetical sort mixes flat armour
  // with %-increase, body-armour-source mods with shield-triple mods, ward
  // mechanics with armour-break mechanics, etc. — produces "каша" inside the
  // "Защита" functional block.
  //
  // Canonical order (player mental model — "from most concrete to most meta"):
  //   0-9:   Броня (flat, %, from-body, shield-triple, global-triple)
  //   10-19: Уклонение (flat, %, from-body)
  //   20-29: Энергетический щит (from-body, from-focus, recharge-speed,
  //          recharge-start)
  //   30-39: Блок (% шанс)
  //   40-49: Порог оглушения (flat, %, conditional-recent, conditional-parry)
  //   50-59: Отклонение (%)
  //   60-69: Обереги (длительность, заряды получаемые, заряды используемые,
  //          условное замедление, free-use chance, регенерация, ward-active damage)
  //   70-79: Разрушение брони (длительность, количество, урон по разбитой броне)
  //
  // Design notes:
  //   - Triple-stat rules (shield, global) MUST come BEFORE single-stat rules.
  //     Family-keys like "#% увеличение брони, уклонения и энергетического щита
  //     от щита в руках" contain "брони", "уклонения", "энергетического щита"
  //     — patterns for single-stat rules would match these triples.
  //   - Conditional порог оглушения rules MUST come BEFORE bare "увеличение
  //     порога оглушения$" (end-anchored) — otherwise the bare rule wouldn't
  //     match the conditional variant anyway (anchored), but it's clearer.
  //   - Flat rules (`+# к броне$`, `+# к уклонению$`, `+# к порогу оглушению$`)
  //     use `$` end-anchor to NOT match the dual-stat "..., уклонению и ..."
  //     family-keys (which would otherwise be intercepted by triple-stat rules
  //     above, but defensive anchoring is best practice).
  //   - Stem "оберег" covers all case forms: оберега (genitive sg),
  //     оберегов (genitive pl), обереги (nominative pl), оберег (accusative).
  //   - Pattern "уменьшение силы замедления.*если недавно вы использовали оберег"
  //     uses `.*` bridge because family-key is long with commas.
  'defence-stats': [
    // ─── Triple-stat (must come BEFORE single-stat rules) ──────────────
    // Shield triple: armour + evasion + ES from shield
    { pattern: /от щита в руках/i, order: 3, comment: 'armour: shield triple-stat (armour+evasion+ES)' },
    // Global triple: armour + evasion + ES global %
    { pattern: /глобальной брони/i, order: 4, comment: 'armour: global triple-stat (armour+evasion+ES)' },

    // ─── Броня (0-9) ───────────────────────────────────────────────────
    { pattern: /к броне$/i, order: 0, comment: 'armour: flat (+# к броне)' },
    { pattern: /повышение брони/i, order: 1, comment: 'armour: % generic' },
    { pattern: /увеличение брони от надетого нательного доспеха/i, order: 2, comment: 'armour: from body armour' },

    // ─── Уклонение (10-19) ─────────────────────────────────────────────
    { pattern: /к уклонению$/i, order: 10, comment: 'evasion: flat (+# к уклонению)' },
    // From-body must come BEFORE bare `увеличение уклонения$` (both end-anchored
    // for "уклонения" but the from-body one continues with "от вашего...").
    { pattern: /увеличение уклонения от вашего нательного доспеха/i, order: 12, comment: 'evasion: from body armour' },
    { pattern: /увеличение уклонения$/i, order: 11, comment: 'evasion: % generic' },

    // ─── Энергетический щит (20-29) ────────────────────────────────────
    { pattern: /увеличение энергетического щита от надетого нательного доспеха/i, order: 20, comment: 'ES: from body armour' },
    { pattern: /увеличение энергетического щита от фокуса в руках/i, order: 21, comment: 'ES: from focus' },
    { pattern: /скорости перезарядки энергетического щита/i, order: 22, comment: 'ES: recharge speed' },
    { pattern: /ускорение начала перезарядки энергетического щита/i, order: 23, comment: 'ES: recharge start' },

    // ─── Блок (30-39) ──────────────────────────────────────────────────
    { pattern: /увеличение шанса блока/i, order: 30, comment: 'block: chance' },

    // ─── Порог оглушения (40-49) ───────────────────────────────────────
    // Conditional variants MUST come BEFORE bare (defensive: bare is end-anchored
    // so wouldn't match conditional anyway, but ordering is clearer this way).
    { pattern: /увеличение порога оглушения если недавно/i, order: 42, comment: 'stun threshold: conditional (recently not stunned)' },
    { pattern: /увеличение порога оглушения при парировании/i, order: 43, comment: 'stun threshold: conditional (parry)' },
    { pattern: /увеличение порога оглушения$/i, order: 41, comment: 'stun threshold: % generic' },
    { pattern: /к порогу оглушения$/i, order: 40, comment: 'stun threshold: flat (+# к порогу оглушения)' },

    // ─── Отклонение (50-59) ────────────────────────────────────────────
    { pattern: /увеличение отклонения ударов/i, order: 50, comment: 'deflection: %' },

    // ─── Обереги (60-69) ───────────────────────────────────────────────
    // Stem "оберег" covers all case forms (оберега, оберегов, обереги).
    { pattern: /увеличение длительности эффекта оберега/i, order: 60, comment: 'ward: duration' },
    { pattern: /увеличение количества получаемых зарядов оберегов/i, order: 61, comment: 'ward: charges gained' },
    { pattern: /уменьшение количества используемых зарядов оберегов/i, order: 62, comment: 'ward: charges used reduction' },
    { pattern: /уменьшение силы замедления.*если недавно вы использовали оберег/i, order: 63, comment: 'ward: conditional slow reduction' },
    { pattern: /обереги с .* шансом могут не потратить заряды/i, order: 64, comment: 'ward: free use chance' },
    { pattern: /обереги получают зарядов в секунду/i, order: 65, comment: 'ward: regen per second' },
    // Ward-synergy damage mod — comes last in ward bucket (it's a damage buff
    // gated on ward being active, conceptually a synergy mod not a ward mod).
    { pattern: /увеличение урона.*активен оберег/i, order: 66, comment: 'ward: damage while ward active' },

    // ─── Разрушение брони (70-79) ──────────────────────────────────────
    { pattern: /увеличение длительности разрушения брони/i, order: 70, comment: 'armour break: duration' },
    { pattern: /увеличение количества разрушаемой брони/i, order: 71, comment: 'armour break: quantity' },
    { pattern: /увеличение урона по врагам с полностью разрушенной брон/i, order: 72, comment: 'armour break: damage vs broken armour' },
  ],

  // ─── resources (29 family-keys) ─────────────────────────────────────────
  // Resources pool management: Health / Mana / ES / damage conversion / totem.
  // User-mental-model: "first all Health mods, then all Mana mods, then ES,
  // then conversion-of-pools mods, then totem, then misc". Alphabetical sort
  // mixes Health and Mana (both have "максимума" / "похищен" / "при убийстве"
  // wording) — this rule set groups them.
  //
  // Order:
  //   0-9:   Здоровье (10 keys: flat max, % max, flat regen, % regen,
  //          leech generic, leech phys, recovery generic, recovery fire,
  //          on-kill %, per-kill flat)
  //   10-19: Мана (9 keys — same shape as Health, + mana cost efficiency at 18)
  //   20-29: Энергетический щит (4 keys: flat max, % max, ES→stun threshold,
  //          ES→ailment threshold)
  //   30-39: Damage conversion (MoM, mana-cost→health, mana→armour)
  //   40-49: Тотем здоровье
  //   50-59: Прочее (vision radius, Hexblast skill effect)
  //
  // Design notes:
  //   - Each rule matches exactly one family-key (patterns are independent —
  //     no first-match-wins conflicts). Order within the array is for
  //     readability (most-specific patterns listed first within each bucket).
  //   - End-anchored `$` for flat max rules (`+# к максимуму здоровья$`)
  //     prevents collision with conversion key `Дарует #% максимума маны
  //     в виде брони` (ends with "брони", not "маны").
  //   - ES→threshold rules (orders 22, 23) use `.*` bridge for long family-keys
  //     with "в размере #% от максимума энергетического щита" wording.
  //   - Per-kill rules (`Дарует # ... за каждого убитого врага`) and on-kill
  //     rules (`Восстанавливает #% ... при убийстве`) use `.*` bridge to
  //     accommodate the `#` / `#%` placeholder in family-key text.
  //   - Health and Mana buckets have parallel structure: same 8 stat types
  //     (flat max, % max, regen, leech, recovery, on-kill, per-kill). Mana
  //     additionally has cost-efficiency at order 18.
  //   - Hexblast skill effect (`#% усиление эффекта Колдовского выброса на вас`)
  //     is classified as `resources` in the data (likely because it modifies
  //     a buff effect on the player); rule placed in Other bucket at order 51.
  'resources': [
    // ─── ES→threshold conversions (most-specific, use `.*` bridge) ──────
    { pattern: /дарует дополнительный порог оглушения.*от максимума энергетического щита/i, order: 22, comment: 'ES: →stun threshold conversion' },
    { pattern: /дарует дополнительный порог состояний.*от максимума энергетического щита/i, order: 23, comment: 'ES: →ailment threshold conversion' },

    // ─── Здоровье (0-9) ──────────────────────────────────────────────────
    // Fire-variant rule listed BEFORE generic recovery (independent match,
    // ordering for clarity).
    { pattern: /полученного урона от огня восполняется в виде здоровья/i, order: 7, comment: 'health: fire-damage recovery' },
    { pattern: /физического урона от атак похищается в виде здоровья/i, order: 5, comment: 'health: phys-attack leech' },
    { pattern: /к максимуму здоровья$/i, order: 0, comment: 'health: flat max (+# к максимуму здоровья)' },
    { pattern: /увеличение максимума здоровья/i, order: 1, comment: 'health: % max' },
    { pattern: /регенерация .* здоровья в секунду/i, order: 2, comment: 'health: flat regen' },
    { pattern: /повышение скорости регенерации здоровья/i, order: 3, comment: 'health: % regen speed' },
    { pattern: /увеличение количества похищенного здоровья/i, order: 4, comment: 'health: leech generic' },
    { pattern: /полученного урона восполняется в виде здоровья/i, order: 6, comment: 'health: damage recovery' },
    { pattern: /восстанавливает .* здоровья при убийстве/i, order: 8, comment: 'health: on-kill %' },
    { pattern: /дарует .* здоровья за каждого убитого врага/i, order: 9, comment: 'health: per-kill flat' },

    // ─── Мана (10-19) ────────────────────────────────────────────────────
    { pattern: /физического урона от атак похищается в виде маны/i, order: 15, comment: 'mana: phys-attack leech' },
    { pattern: /к максимуму маны$/i, order: 10, comment: 'mana: flat max (+# к максимуму маны)' },
    { pattern: /увеличение максимума маны/i, order: 11, comment: 'mana: % max' },
    { pattern: /повышение скорости регенерации маны/i, order: 12, comment: 'mana: % regen speed' },
    { pattern: /увеличение количества похищенной маны/i, order: 13, comment: 'mana: leech generic' },
    { pattern: /полученного урона восполняется в виде маны/i, order: 14, comment: 'mana: damage recovery' },
    { pattern: /восстанавливает .* маны при убийстве/i, order: 16, comment: 'mana: on-kill %' },
    { pattern: /дарует .* маны за каждого убитого врага/i, order: 17, comment: 'mana: per-kill flat' },
    { pattern: /увеличение эффективности расхода маны чарами/i, order: 18, comment: 'mana: cost efficiency' },

    // ─── Энергетический щит (20-29) ─────────────────────────────────────
    { pattern: /к максимуму энергетического щита$/i, order: 20, comment: 'ES: flat max (+# к максимуму ЭЩ)' },
    { pattern: /увеличение максимума энергетического щита/i, order: 21, comment: 'ES: % max' },

    // ─── Конверсия урона (30-39) ────────────────────────────────────────
    // MoM = Mind Over Matter (damage taken from mana before health).
    { pattern: /от получаемого урона берется сначала из маны/i, order: 30, comment: 'conversion: MoM (damage→mana before health)' },
    { pattern: /стоимости умений в мане берется из здоровья/i, order: 31, comment: 'conversion: mana-cost→health' },
    { pattern: /дарует.*максимума маны в виде брони/i, order: 32, comment: 'conversion: mana→armour' },

    // ─── Тотем (40-49) ──────────────────────────────────────────────────
    { pattern: /увеличение здоровья тотема/i, order: 40, comment: 'totem: health' },

    // ─── Прочее (50-59) ─────────────────────────────────────────────────
    { pattern: /увеличение радиуса обзора/i, order: 50, comment: 'other: vision radius' },
    { pattern: /усиление эффекта Колдовского выброса/i, order: 51, comment: 'other: Hexblast skill effect' },
  ],

  // ─── weapon-specific (24 family-keys) — iter 116 ──────────────────────────
  // All family-keys are jewel-only. Each key has the shape
  // "#% <stat> <weapon-instrumental-case>" where stat is one of:
  //   - увеличение урона                (damage increase)
  //   - повышение скорости атаки        (attack speed)
  //   - повышение шанса критического удара (crit chance)
  //   - увеличение бонуса к критическому урону (crit damage bonus)
  //   - повышение меткости              (accuracy)
  //   - повышение скорости накопления шкалы ... (gauge accumulation speed)
  //
  // Canonical order: WEAPON TYPE (tens digit) × STAT TYPE (ones digit).
  //
  // Weapon type order (player mental model — melee first, then ranged, then unarmed):
  //   0-9:   Мечи (Swords)             — damage 0, attack-speed 1
  //   10-19: Топоры (Axes)             — damage 10, attack-speed 11
  //   20-29: Булавы (Maces)            — damage 20, stun-gauge 21
  //   30-39: Боевые посохи (Warstaves) — damage 30, attack-speed 31, freeze-gauge 32
  //   40-49: Кинжалы (Daggers)         — damage 40, attack-speed 41, crit-chance 42
  //   50-59: Копья (Spears)            — damage 50, attack-speed 51, crit-damage 52
  //   60-69: Кистени (Flails)          — damage 60, crit-chance 61
  //   70-79: Луки (Bows)               — damage 70, attack-speed 71, accuracy 72
  //   80-89: Самострелы (Crossbows)    — damage 80, attack-speed 81
  //   90-99: Без оружия (Unarmed)      — damage 90, attack-speed 91
  //
  // Design notes:
  //   - Each weapon name (instrumental case: мечами/топорами/булавами/etc.) is
  //     unique — no collision risk between weapons. No end-anchoring needed.
  //   - Stat-type patterns are word-specific: "увеличение урона X" vs
  //     "скорости атаки X" vs "критического удара X" vs "бонуса к критическому
  //     урону X" vs "меткости X" vs "скорости накопления шкалы Y X" — all
  //     distinct substrings, no first-match-wins conflict within a weapon.
  //   - Some weapons lack certain stat types in the data (e.g., swords have
  //     no crit, maces have no attack-speed, flails have no attack-speed) —
  //     canonical orders leave gaps intentionally.
  //   - "Без оружия" (unarmed) uses slightly different wording: "увеличение
  //     урона атаками без оружия" (with "атаками") vs other weapons' "увеличение
  //     урона X". Pattern includes "атаками" to match only unarmed damage.
  'weapon-specific': [
    // ─── Мечи (Swords) — 0-9 ────────────────────────────────────────────
    { pattern: /увеличение урона мечами/i, order: 0, comment: 'swords: damage' },
    { pattern: /скорости атаки мечами/i, order: 1, comment: 'swords: attack-speed' },

    // ─── Топоры (Axes) — 10-19 ──────────────────────────────────────────
    { pattern: /увеличение урона топорами/i, order: 10, comment: 'axes: damage' },
    { pattern: /скорости атаки топорами/i, order: 11, comment: 'axes: attack-speed' },

    // ─── Булавы (Maces) — 20-29 ─────────────────────────────────────────
    { pattern: /увеличение урона булавами/i, order: 20, comment: 'maces: damage' },
    { pattern: /скорости накопления шкалы оглушения булавами/i, order: 21, comment: 'maces: stun-gauge' },

    // ─── Боевые посохи (Warstaves) — 30-39 ──────────────────────────────
    { pattern: /увеличение урона боевыми посохами/i, order: 30, comment: 'warstaves: damage' },
    { pattern: /скорости атаки боевыми посохами/i, order: 31, comment: 'warstaves: attack-speed' },
    { pattern: /скорости накопления шкалы заморозки боевыми посохами/i, order: 32, comment: 'warstaves: freeze-gauge' },

    // ─── Кинжалы (Daggers) — 40-49 ───────────────────────────────────────
    { pattern: /увеличение урона кинжалами/i, order: 40, comment: 'daggers: damage' },
    { pattern: /скорости атаки кинжалами/i, order: 41, comment: 'daggers: attack-speed' },
    { pattern: /шанса критического удара кинжалами/i, order: 42, comment: 'daggers: crit-chance' },

    // ─── Копья (Spears) — 50-59 ─────────────────────────────────────────
    { pattern: /увеличение урона копьями/i, order: 50, comment: 'spears: damage' },
    { pattern: /скорости атаки копьями/i, order: 51, comment: 'spears: attack-speed' },
    { pattern: /бонуса к критическому урону копьями/i, order: 52, comment: 'spears: crit-damage' },

    // ─── Кистени (Flails) — 60-69 ───────────────────────────────────────
    { pattern: /увеличение урона кистенями/i, order: 60, comment: 'flails: damage' },
    { pattern: /шанса критического удара кистенями/i, order: 61, comment: 'flails: crit-chance' },

    // ─── Луки (Bows) — 70-79 ────────────────────────────────────────────
    { pattern: /увеличение урона луками/i, order: 70, comment: 'bows: damage' },
    { pattern: /скорости атаки луками/i, order: 71, comment: 'bows: attack-speed' },
    { pattern: /меткости луками/i, order: 72, comment: 'bows: accuracy' },

    // ─── Самострелы (Crossbows) — 80-89 ─────────────────────────────────
    { pattern: /увеличение урона самострелами/i, order: 80, comment: 'crossbows: damage' },
    { pattern: /скорости атаки самострелами/i, order: 81, comment: 'crossbows: attack-speed' },

    // ─── Без оружия (Unarmed) — 90-99 ───────────────────────────────────
    // Note: unarmed damage uses "атаками без оружия" (with "атаками"), other
    // weapons use just "<weapon-instrumental>".
    { pattern: /увеличение урона атаками без оружия/i, order: 90, comment: 'unarmed: damage' },
    { pattern: /скорости атаки без оружия/i, order: 91, comment: 'unarmed: attack-speed' },
  ],

  // ─── flasks (16 family-keys) — iter 116 ───────────────────────────────────
  // Family-keys are split across belt + jewel files. Canonical order groups
  // by RESOURCE TYPE (Health/Mana/Any) × MECHANIC (recovery speed, recovery
  // amount, charges gained, regen, etc.).
  //
  // Bucket layout:
  //   0-9:   Health flask (5 keys: recovery-speed, recovery-amount,
  //          charges-gained, regen-during-effect, regen-per-sec)
  //   10-19: Mana flask (4 keys: recovery-speed, recovery-amount,
  //          charges-gained, regen-per-sec — no regen-during-effect for mana)
  //   20-29: Any flask (5 keys: duration, charges-gained, charges-used-reduction,
  //          keep-charges, regen-per-sec)
  //   30-39: Flask buffs (2 keys: cast-speed while flask active,
  //          spell-damage while flask active)
  //
  // Design notes:
  //   - Resource-first bucketing (vs §5.8 plan's mechanic-first bucketing)
  //     is cleaner because each resource (health/mana) has parallel stat
  //     types (recovery-speed, recovery-amount, charges-gained). The plan's
  //     "Passive regen" bucket would have split this parallel structure.
  //   - End-anchored `$` for `флакона$` (any-flask duration/charges-gained)
  //     prevents collision with `флакона здоровья` / `флакона маны` variants
  //     which end with "здоровья" / "маны".
  //   - Start-anchored `^` for `^Флаконы получают зарядов` (any-flask regen-per-sec)
  //     prevents collision with `^Флаконы здоровья получают` / `^Флаконы маны
  //     получают` variants. All three exist in the data.
  //   - Specific (health/mana) rules listed BEFORE generic (any) rules —
  //     first-match-wins safety. Even though end/start anchors make them
  //     independent, listing specific-first is more readable.
  //   - Health bucket has 5 keys (most prominent), Mana has 4 (no
  //     regen-during-effect in data), Any has 5, Buffs has 2.
  //   - Mana lacks the "regen-during-effect" stat type in the data —
  //     only Health has `#% увеличение регенерации здоровья во время действия
  //     эффекта любого флакона здоровья`.
  //   - Flask buffs (orders 30, 31) are separated because they affect player
  //     stats while flask is active, not flask properties themselves.
  'flasks': [
    // ─── Health flask (0-9) — 5 keys ────────────────────────────────────
    { pattern: /скорости восстановления здоровья от флакона/i, order: 0, comment: 'health-flask: recovery-speed' },
    { pattern: /восстановления здоровья от флаконов/i, order: 1, comment: 'health-flask: recovery-amount' },
    { pattern: /получаемых зарядов флакона здоровья/i, order: 2, comment: 'health-flask: charges-gained' },
    { pattern: /регенерации здоровья во время действия эффекта/i, order: 3, comment: 'health-flask: regen-during-effect' },
    { pattern: /^Флаконы здоровья получают зарядов в секунду/i, order: 4, comment: 'health-flask: regen-per-sec' },

    // ─── Mana flask (10-19) — 4 keys ────────────────────────────────────
    { pattern: /скорости восстановления маны от флакона/i, order: 10, comment: 'mana-flask: recovery-speed' },
    { pattern: /восстановления маны от флаконов/i, order: 11, comment: 'mana-flask: recovery-amount' },
    { pattern: /получаемых зарядов флакона маны/i, order: 12, comment: 'mana-flask: charges-gained' },
    { pattern: /^Флаконы маны получают зарядов в секунду/i, order: 13, comment: 'mana-flask: regen-per-sec' },

    // ─── Any flask (20-29) — 5 keys ─────────────────────────────────────
    // End-anchored to prevent collision with health/mana specific variants.
    { pattern: /увеличение длительности эффекта флакона$/i, order: 20, comment: 'any-flask: duration' },
    { pattern: /получаемых зарядов флакона$/i, order: 21, comment: 'any-flask: charges-gained' },
    { pattern: /уменьшение используемого количества зарядов флакона/i, order: 22, comment: 'any-flask: charges-used-reduction' },
    { pattern: /шанс сохранить заряды флаконов/i, order: 23, comment: 'any-flask: keep-charges' },
    { pattern: /^Флаконы получают зарядов в секунду/i, order: 24, comment: 'any-flask: regen-per-sec' },

    // ─── Flask buffs (30-39) — 2 keys ───────────────────────────────────
    { pattern: /увеличение скорости сотворения чар во время действия любого флакона/i, order: 30, comment: 'buff: cast-speed while flask active' },
    { pattern: /увеличение урона чар во время действия любого флакона/i, order: 31, comment: 'buff: spell-damage while flask active' },
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
