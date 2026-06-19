/**
 * simulate-iter94-impact.ts — Mirror iter 94 candidate refactor on jewel.json +
 * all jewellery categories (amulet/ring/belt) to detect false positives.
 *
 * Refactor: AILMENTS_PATTERN moved BEFORE DAMAGE_TYPE + add `ailment` tag check.
 *
 * GOAL: Reclassify jewel mods that have `ailment` tag (or match AILMENTS_PATTERN
 * text) but are currently in `damage-type` (or other higher-priority buckets).
 * Specifically expected:
 *  - jewel.mod_l1y0fl «увеличение силы накладываемых вами состояний» (damage,ailment tags):
 *    damage-type → ailments  (matches both text pattern `накладыва.*состоян` AND `ailment` tag)
 *  - jewel.mod_40sol4 «Наносящие урон состояния наносят урон быстрее» (damage,ailment tags):
 *    damage-type → ailments  (matches `ailment` tag only — text doesn't match AILMENTS_PATTERN)
 *  - jewel.mod_j05iep «сила наносящих урон состояний при крит» (damage,critical,ailment tags):
 *    stays as `crit`  (CRIT tag check is step 14 — BEFORE AILMENTS step 15 — critical tag wins)
 *
 * iter 94 classifier order (after refactor):
 *  1. SPIRIT            9. PENETRATION         17. OFFENCE_SPEED
 *  2. RUNES_BARRIER     10. RESISTANCES        18. AILMENTS (NEW POSITION — was 17)
 *  3. BREACH            11. RESOURCES          19. AREA_DURATION
 *  4. MAGIC_FIND        12. DEFENCE_STATS      20. RAGE_CHARGES
 *  5. SKILL_LEVELS      13. WEAPON_SPECIFIC    21. META_SKILLS
 *  6. FLASKS            14. CRIT               22. BUFF_SKILLS
 *  7. MINIONS           15. AILMENTS (NEW — moved from 17, +ailment tag check)
 *  8. ATTRIBUTES        16. DAMAGE_TYPE (was 15) 23. OTHER (fallback)
 *
 * Run:  npx tsx scripts/simulate-iter94-impact.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Mirror of BREACH_LORD_TAGS ───
const BREACH_LORD_TAGS = new Set(['kurgal_mod', 'amanamu_mod', 'ulaman_mod']);

// ─── iter 85-93 patterns (existing — exact copy from mod-classifier.ts) ───
const SPIRIT_PATTERN = /к духу/i;
const RUNES_BARRIER_PATTERN = /руническ.*барьер/i;
const BREACH_PATTERN = /Знак.*повелител.*Бездн/i;
const MAGIC_FIND_PATTERN = /(?:редкост.*найден.*предмет|количеств.*найден.*предмет)/i;
const SKILL_LEVELS_PATTERN = /(?:уровен.*камн.*умени|уровн.*камн.*умени|качеств.*умени|качеств.*всех умени|максимальн.*качеств|скорост.*перезарядк.*умени(?!.*боев)|длительн.*эффект.*умени)/i;
const FLASKS_PATTERN = /флакон/i;
const MINIONS_PATTERN = /(?:приспешник|подношен|компаньон)/i;
const ATTRIBUTES_PATTERN = /(?:к силе|к ловк|к интелл|ко всем.*атрибут|ко всем.*характерист|силе.*ловкост|ловкост.*интеллект|силе.*интеллект|уменьшен.*требован.*характерист)/i;
const PENETRATION_PATTERN = /пробива.*сопротивлен/i;
const RESISTANCES_PATTERN = /(?:сопротивлен|добавлен.*свойств.*сопротивлен)/i;
const RESOURCES_PATTERN = /(?:максимум.*энергетическ.*щит|похищен.*виде.*здоров|похищен.*виде.*ман|скорост.*регенерац.*здоров|скорост.*регенерац.*ман|восстанавливает.*здоровь|восстанавливает.*ман|получен.*урон.*восполня|от получаемого урона.*берется.*из ман|Регенерац.*здоров|Дарует.*здоровь.*убит|Дарует.*ман.*убит)/i;
const DEFENCE_STATS_PATTERN = /(?:брон|уклонен|блок|порог.*оглушен|отклонен.*удар)/i;
const WEAPON_SPECIFIC_PATTERN = /(?:мечами|кинжалами|топорами|булавами|луками|самострелами|копьями|боевыми посохами|кистенями|без оружия)/i;
const CRIT_PATTERN = /крит/i;
const DAMAGE_TYPE_PATTERN = /урон/i;
const OFFENCE_SPEED_PATTERN = /скорост.*(атак|сотворени|передвижен|снаряд)/i;
// iter 93 expanded AILMENTS_PATTERN (with `накладыва.*состоян` added)
const AILMENTS_PATTERN = /(?:поджог|шок|охлажден|заморозк|отравлен|отравить|кровотеч|оцепенен|парир|пригвожден|Разрез|ослеплен|ослепить|горючест|восприимчивост|истощен|накладыва.*состоян|наложен.*состоян|стихийн.*состоян)/i;
const AREA_DURATION_PATTERN = /(?:област.*действ|длительн.*(?:проклят|знам[eё]н)|Улучшает радиус)/i;
const RAGE_CHARGES_PATTERN = /(?:свирепост|славы.*знам[её]н)/i;
const META_SKILLS_PATTERN = /(?:Мета-умени|Архонт|запечат|вызываем.*умени)/i;
const BUFF_SKILLS_PATTERN = /(?:аур|Вестник|мет[о]?к(?!ост)|клич|знам[её]н|проклят)/i;

type FunctionalBlock =
  | 'spirit' | 'skill-levels' | 'attributes' | 'resources' | 'runes-barrier'
  | 'resistances' | 'magic-find' | 'defence-stats' | 'offence-speed' | 'crit'
  | 'damage-type' | 'penetration' | 'ailments' | 'area-duration' | 'wisps'
  | 'buff-skills' | 'minions' | 'meta-skills' | 'weapon-specific' | 'flasks'
  | 'conversion' | 'rage-charges' | 'breach' | 'other';

const FUNCTIONAL_BLOCK_ORDER: FunctionalBlock[] = [
  'spirit', 'skill-levels', 'attributes', 'resources',
  'runes-barrier', 'resistances', 'defence-stats',
  'offence-speed', 'crit', 'damage-type', 'penetration', 'ailments',
  'area-duration', 'wisps', 'buff-skills', 'minions', 'meta-skills', 'weapon-specific',
  'flasks', 'magic-find', 'conversion', 'rage-charges',
  'breach',
  'other',
];

/** Mirror of iter 93 classifyFunctionalBlock (current production).
 *  Source: src/shared/mod-classifier.ts (lines ~1613-1697).
 */
function classifyFunctionalBlock_iter93(text: string, allTags: Set<string>): FunctionalBlock {
  if (SPIRIT_PATTERN.test(text)) return 'spirit';
  if (RUNES_BARRIER_PATTERN.test(text)) return 'runes-barrier';
  if (BREACH_PATTERN.test(text)) return 'breach';
  if (MAGIC_FIND_PATTERN.test(text)) return 'magic-find';
  if (SKILL_LEVELS_PATTERN.test(text)) return 'skill-levels';
  if (FLASKS_PATTERN.test(text)) return 'flasks';
  if (allTags.has('minion') || MINIONS_PATTERN.test(text)) return 'minions';
  if (ATTRIBUTES_PATTERN.test(text) || allTags.has('attribute')) return 'attributes';
  if (PENETRATION_PATTERN.test(text)) return 'penetration';
  if (allTags.has('resistance') || RESISTANCES_PATTERN.test(text)) return 'resistances';
  if (allTags.has('life') || allTags.has('mana') || RESOURCES_PATTERN.test(text)) return 'resources';
  if (allTags.has('armour') || allTags.has('evasion') || allTags.has('energy_shield') || allTags.has('charm') || DEFENCE_STATS_PATTERN.test(text)) return 'defence-stats';
  if (WEAPON_SPECIFIC_PATTERN.test(text)) return 'weapon-specific';
  if (allTags.has('critical') || CRIT_PATTERN.test(text)) return 'crit';
  if (allTags.has('damage') || allTags.has('physical') || allTags.has('elemental') || allTags.has('cold') || allTags.has('fire') || allTags.has('lightning') || allTags.has('chaos') || DAMAGE_TYPE_PATTERN.test(text)) return 'damage-type';
  if (allTags.has('speed') || OFFENCE_SPEED_PATTERN.test(text)) return 'offence-speed';
  if (AILMENTS_PATTERN.test(text)) return 'ailments';
  if (AREA_DURATION_PATTERN.test(text)) return 'area-duration';
  if (RAGE_CHARGES_PATTERN.test(text)) return 'rage-charges';
  if (META_SKILLS_PATTERN.test(text)) return 'meta-skills';
  if (BUFF_SKILLS_PATTERN.test(text)) return 'buff-skills';
  return 'other';
}

/** Mirror of iter 94 classifyFunctionalBlock (proposed refactor).
 *  Changes vs iter 93:
 *   - AILMENTS check moved BEFORE DAMAGE_TYPE (was AFTER OFFENCE_SPEED)
 *   - AILMENTS check now ALSO matches `ailment` tag (was text-only)
 *  Source: src/shared/mod-classifier.ts (proposed lines ~1613-1697).
 */
function classifyFunctionalBlock_iter94(text: string, allTags: Set<string>): FunctionalBlock {
  if (SPIRIT_PATTERN.test(text)) return 'spirit';
  if (RUNES_BARRIER_PATTERN.test(text)) return 'runes-barrier';
  if (BREACH_PATTERN.test(text)) return 'breach';
  if (MAGIC_FIND_PATTERN.test(text)) return 'magic-find';
  if (SKILL_LEVELS_PATTERN.test(text)) return 'skill-levels';
  if (FLASKS_PATTERN.test(text)) return 'flasks';
  if (allTags.has('minion') || MINIONS_PATTERN.test(text)) return 'minions';
  if (ATTRIBUTES_PATTERN.test(text) || allTags.has('attribute')) return 'attributes';
  if (PENETRATION_PATTERN.test(text)) return 'penetration';
  if (allTags.has('resistance') || RESISTANCES_PATTERN.test(text)) return 'resistances';
  if (allTags.has('life') || allTags.has('mana') || RESOURCES_PATTERN.test(text)) return 'resources';
  if (allTags.has('armour') || allTags.has('evasion') || allTags.has('energy_shield') || allTags.has('charm') || DEFENCE_STATS_PATTERN.test(text)) return 'defence-stats';
  if (WEAPON_SPECIFIC_PATTERN.test(text)) return 'weapon-specific';
  if (allTags.has('critical') || CRIT_PATTERN.test(text)) return 'crit';
  // ─── iter 94: AILMENTS moved BEFORE DAMAGE_TYPE (was step 17). ───
  // ─── iter 94: AILMENTS now ALSO matches `ailment` tag (was text-only). ───
  // Rationale: mods with `ailment` tag should bucket as ailments, not damage-type.
  // CRIT stays BEFORE AILMENTS — `critical` tag still wins for crit-ailment mods.
  if (allTags.has('ailment') || AILMENTS_PATTERN.test(text)) return 'ailments';
  if (allTags.has('damage') || allTags.has('physical') || allTags.has('elemental') || allTags.has('cold') || allTags.has('fire') || allTags.has('lightning') || allTags.has('chaos') || DAMAGE_TYPE_PATTERN.test(text)) return 'damage-type';
  if (allTags.has('speed') || OFFENCE_SPEED_PATTERN.test(text)) return 'offence-speed';
  if (AREA_DURATION_PATTERN.test(text)) return 'area-duration';
  if (RAGE_CHARGES_PATTERN.test(text)) return 'rage-charges';
  if (META_SKILLS_PATTERN.test(text)) return 'meta-skills';
  if (BUFF_SKILLS_PATTERN.test(text)) return 'buff-skills';
  return 'other';
}

interface JsonToken {
  id: string;
  category: string;
  origin: string;
  rawText: { ru: string };
  familyKey: { ru: string };
  affix: string;
  tags: string[];
  functionalCategory?: string;
}

interface FamilyGroup {
  text: string;
  tags: Set<string>;
  affix: string;
  familyKey: string;
  tokenCount: number;
  tokenIds: string[];
  hasAilmentTag: boolean;
  matchesAilmentsPattern: boolean;
}

function loadFamilyGroups(category: string): FamilyGroup[] {
  const path = join(process.cwd(), 'public/generated', `${category}.json`);
  const data = JSON.parse(readFileSync(path, 'utf-8')) as { tokens: JsonToken[] };

  const byKey = new Map<string, FamilyGroup>();
  for (const tok of data.tokens) {
    const key = `${tok.affix}::${tok.familyKey.ru}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        text: tok.rawText.ru,
        tags: new Set<string>(),
        affix: tok.affix,
        familyKey: tok.familyKey.ru,
        tokenCount: 0,
        tokenIds: [],
        hasAilmentTag: false,
        matchesAilmentsPattern: false,
      });
    }
    const group = byKey.get(key)!;
    group.tokenCount++;
    group.tokenIds.push(tok.id);
    for (const t of tok.tags) {
      if (BREACH_LORD_TAGS.has(t)) continue;
      group.tags.add(t);
      if (t === 'ailment') group.hasAilmentTag = true;
    }
    if (AILMENTS_PATTERN.test(tok.rawText.ru)) {
      group.matchesAilmentsPattern = true;
    }
  }
  return Array.from(byKey.values());
}

// ─── Main ───

const CATEGORIES = ['jewel', 'amulet', 'ring', 'belt'] as const;
let anyFailures = false;

console.log('=== iter 94 simulation: AILMENTS_TAG_PRIORITY refactor ===\n');
console.log('Strategy: move AILMENTS check BEFORE DAMAGE_TYPE + add `ailment` tag check.\n');
console.log('Goal: reclassify jewel mods with `ailment` tag from `damage-type` to `ailments`.\n');
console.log('Expected reclassifications:');
console.log('  jewel.mod_l1y0fl «сила накладываемых вами состояний» → ailments');
console.log('  jewel.mod_40sol4 «Наносящие урон состояния наносят урон быстрее» → ailments');
console.log('  jewel.mod_j05iep «сила наносящих урон состояний при крит» → stays as crit (CRIT before AILMENTS)\n');

// Collect ailment-tagged groups across all categories for FP check.
const ailmentTaggedGroups: { cat: string; group: FamilyGroup }[] = [];

for (const cat of CATEGORIES) {
  let groups: FamilyGroup[];
  try {
    groups = loadFamilyGroups(cat);
  } catch {
    console.log(`=== ${cat}: file not found, skipping ===\n`);
    continue;
  }

  console.log(`=== ${cat}.json (${groups.length} family-groups) ===`);

  const before = new Map<FunctionalBlock, number>();
  const after = new Map<FunctionalBlock, number>();
  const reclassifications: {
    from: FunctionalBlock;
    to: FunctionalBlock;
    text: string;
    familyKey: string;
    affix: string;
    tokenIds: string[];
    hasAilmentTag: boolean;
    matchesAilmentsPattern: boolean;
  }[] = [];

  for (const g of groups) {
    const b = classifyFunctionalBlock_iter93(g.text, g.tags);
    const a = classifyFunctionalBlock_iter94(g.text, g.tags);
    before.set(b, (before.get(b) ?? 0) + 1);
    after.set(a, (after.get(a) ?? 0) + 1);
    if (b !== a) {
      reclassifications.push({
        from: b, to: a, text: g.text, familyKey: g.familyKey, affix: g.affix,
        tokenIds: g.tokenIds, hasAilmentTag: g.hasAilmentTag, matchesAilmentsPattern: g.matchesAilmentsPattern,
      });
    }
    if (g.hasAilmentTag || g.matchesAilmentsPattern) {
      ailmentTaggedGroups.push({ cat, group: g });
    }
  }

  // Print before/after for non-zero blocks
  console.log('  Block                 iter93 → iter94  (delta)');
  for (const block of FUNCTIONAL_BLOCK_ORDER) {
    const b = before.get(block) ?? 0;
    const a = after.get(block) ?? 0;
    if (b === 0 && a === 0) continue;
    const delta = a - b;
    const deltaStr = delta > 0 ? `+${delta}` : delta === 0 ? ' 0' : `${delta}`;
    console.log(`  ${block.padEnd(20)} ${String(b).padStart(3)} → ${String(a).padStart(3)}  (${deltaStr})`);
  }

  // Show reclassifications
  if (reclassifications.length > 0) {
    console.log(`\n  Reclassifications (${reclassifications.length}):`);
    for (const r of reclassifications) {
      const tagInfo = [
        r.hasAilmentTag ? 'ailment-tag' : '',
        r.matchesAilmentsPattern ? 'ailment-text' : '',
      ].filter(Boolean).join('+');
      console.log(`    ${r.from} → ${r.to}  [${tagInfo || 'no-ailment-signal'}]`);
      console.log(`        [${r.affix}] ${r.familyKey}`);
      console.log(`        ids: ${r.tokenIds.join(', ')}`);
      console.log(`        "${r.text}"`);
    }
  }

  // other-bucket before/after
  const beforeOther = before.get('other') ?? 0;
  const afterOther = after.get('other') ?? 0;
  const beforePct = ((beforeOther / groups.length) * 100).toFixed(1);
  const afterPct = ((afterOther / groups.length) * 100).toFixed(1);
  console.log(`\n  other-bucket: ${beforeOther}/${groups.length} = ${beforePct}%  →  ${afterOther}/${groups.length} = ${afterPct}%\n`);
  console.log('');
}

// ─── FP check: list ALL ailment-tagged + ailment-pattern-matching groups ───
// Expected behavior: ailment-tagged/pattern-matching groups should classify to
// `ailments` UNLESS a higher-priority bucket legitimately wins:
//   - crit (critical tag wins — step 14 before AILMENTS step 15)
//   - weapon-specific (weapon name in text — step 13 before AILMENTS)
//   - resources (ES max + ailment threshold — step 11 before AILMENTS)
//   - defence-stats (stun threshold + parry condition — step 12 before AILMENTS)
//   - minions (minion+ailment tag — step 7 before AILMENTS)
//   - resistances, attributes, etc. (all steps before 15)
// These higher-priority wins are NOT false positives — they're correct.
const EXPECTED_HIGHER_PRIORITY_BUCKETS = new Set<FunctionalBlock>([
  'crit', 'weapon-specific', 'resources', 'defence-stats', 'minions',
  'spirit', 'runes-barrier', 'breach', 'magic-find', 'skill-levels',
  'flasks', 'attributes', 'penetration', 'resistances',
]);

console.log('=== ailment-tagged + ailment-pattern-matching groups (consistency check) ===\n');
console.log('Goal: every group below should classify to `ailments` in iter 94,');
console.log('OR to a higher-priority bucket (crit/weapon-specific/resources/defence-stats/minions/...).');
console.log('If any group classifies to `damage-type` or `other`, that is a real FP.\n');

let ailmentOk = 0;
let ailmentHigherPriority = 0;
let ailmentFail = 0;
for (const { cat, group } of ailmentTaggedGroups) {
  const a = classifyFunctionalBlock_iter94(group.text, group.tags);
  const isAilments = a === 'ailments';
  const isHigherPriority = EXPECTED_HIGHER_PRIORITY_BUCKETS.has(a);
  if (isAilments) ailmentOk++;
  else if (isHigherPriority) ailmentHigherPriority++;
  else ailmentFail++;
  const tagInfo = [
    group.hasAilmentTag ? 'ailment-tag' : '',
    group.matchesAilmentsPattern ? 'ailment-text' : '',
  ].filter(Boolean).join('+');
  const marker = isAilments ? '✓' : isHigherPriority ? '•' : '⚠';
  const note = isAilments ? '' : isHigherPriority ? ' (higher-priority bucket — expected)' : ' (REAL FP — investigate)';
  console.log(`  ${marker} [${cat}] ${a}  [${tagInfo}]${note}`);
  console.log(`      ids: ${group.tokenIds.join(', ')}`);
  console.log(`      "${group.text.substring(0, 100)}"`);
}
console.log(`\n  Total ailment-related groups: ${ailmentTaggedGroups.length}`);
console.log(`    ${ailmentOk} → ailments (correct)`);
console.log(`    ${ailmentHigherPriority} → higher-priority bucket (correct — expected)`);
console.log(`    ${ailmentFail} → unexpected bucket (REAL FP — investigate)`);

if (ailmentFail > 0) {
  console.log(`\n⚠⚠⚠ ${ailmentFail} ailment-tagged/pattern-matching groups classified to unexpected buckets.`);
  anyFailures = true;
}

if (anyFailures) {
  console.log('\n⚠ iter 94 patterns need review — see flagged groups above.');
  process.exit(1);
} else {
  console.log('\n🎉 All reclassifications are damage-type → ailments. No FPs. iter 94 patterns are good to deploy.');
}
