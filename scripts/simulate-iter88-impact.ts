/**
 * simulate-iter88-impact.ts — Mirror iter 88 candidate patterns on jewel.json +
 * all jewellery categories (amulet/ring/belt) to detect false positives.
 *
 * Strategy: place AILMENTS + AREA_DURATION AFTER offence-speed (step 15) and
 * BEFORE the fallback (other). This way, the new patterns only catch things
 * that would otherwise fall into 'other' — never re-classifying mods that are
 * already correctly bucketed.
 *
 * Run:  npx tsx scripts/simulate-iter88-impact.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Mirror of BREACH_LORD_TAGS ───
const BREACH_LORD_TAGS = new Set(['kurgal_mod', 'amanamu_mod', 'ulaman_mod']);

// ─── iter 85/86/87 patterns (existing) ───
const SPIRIT_PATTERN = /к духу/i;
const RUNES_BARRIER_PATTERN = /руническ.*барьер/i;
const BREACH_PATTERN = /Знак.*повелител.*Бездн/i;
const MAGIC_FIND_PATTERN = /(?:редкост.*найден.*предмет|количеств.*найден.*предмет)/i;
const SKILL_LEVELS_PATTERN = /(?:уровен.*камн.*умени|уровн.*камн.*умени|качеств.*умени|качеств.*всех умени|максимальн.*качеств|скорост.*перезарядк.*умени(?!.*боев)|длительн.*эффект.*умени)/i;
const ATTRIBUTES_PATTERN = /(?:к силе|к ловк|к интелл|ко всем.*атрибут|ко всем.*характерист|силе.*ловкост|ловкост.*интеллект|силе.*интеллект|уменьшен.*требован.*характерист)/i;
const RESISTANCES_PATTERN = /(?:сопротивлен|добавлен.*свойств.*сопротивлен)/i;
const FLASKS_PATTERN = /флакон/i;
const MINIONS_PATTERN = /(?:приспешник|подношен)/i;
const RESOURCES_PATTERN = /(?:максимум.*энергетическ.*щит|похищен.*виде.*здоров|похищен.*виде.*ман|скорост.*регенерац.*здоров|скорост.*регенерац.*ман|восстанавливает.*здоровь|восстанавливает.*ман|получен.*урон.*восполня|от получаемого урона.*берется.*из ман|Регенерац.*здоров|Дарует.*здоровь.*убит|Дарует.*ман.*убит)/i;
const DEFENCE_STATS_PATTERN = /(?:брон|уклонен|блок|порог.*оглушен|отклонен.*удар)/i;
const WEAPON_SPECIFIC_PATTERN = /(?:мечами|кинжалами|топорами|булавами|луками|самострелами|копьями|боевыми посохами|кистенями|без оружия)/i;
const CRIT_PATTERN = /крит/i;
const DAMAGE_TYPE_PATTERN = /урон/i;
const OFFENCE_SPEED_PATTERN = /скорост.*(атак|сотворени|передвижен|снаряд)/i;

// ─── iter 88 NEW patterns (proposed) ───

/** Ailments — Поджог/Шок/Охлаждение/Отравление/Кровотечение/Оцепенение/Парирование/
 *  Пригвождение/Разрез/Ослепление/Горючесть/Восприимчивость/Истощение/
 *  Состояния (elemental ailments).
 *
 *  iter 88: 8 family-keys in jewel.json `other` bucket are ailment-related
 *  mods that currently have no proper bucket.
 *
 *  CAREFUL exclusions (avoid false positives):
 *  - NOT matching `мет[о]?к` (mark skills) — that's buff-skills (future iter)
 *  - NOT matching `меткости` (accuracy) — that's already caught by OFFENCE_SPEED
 *    for weapon accuracy mods; accuracy itself is a different concept
 *  - NOT matching «Отрицательные эффекты на вас заканчиваются быстрее» — that's
 *    ailment removal on self, functionally closer to defence (leave in other)
 *  - NOT matching «ослабление влияния замедления» — slow resistance, defensive
 */
const AILMENTS_PATTERN = /(?:поджог|шок|охлажден|заморозк|отравлен|отравить|кровотеч|оцепенен|парир|пригвожден|Разрез|ослеплен|ослепить|горючест|восприимчивост|истощен|наложен.*состоян|стихийн.*состоян)/i;

/** Area / Duration — Область действия / Длительность умений и состояний.
 *
 *  iter 88: 7 family-keys in jewel.json `other` bucket are area/duration mods.
 *
 *  Pattern deliberately limited:
 *  - `област.*действ` — covers «области действия», «область действия»
 *  - `длительн.*(?:проклят|знам[её]н)` — curse/banner duration specifically
 *    (generic «длительность умения» already caught by SKILL_LEVELS_PATTERN,
 *     so we don't catch ALL «длительность» here — only non-skill ones)
 *  - `Улучшает радиус` — jewel radius upgrade (passive tree radius)
 *
 *  Note: «длительность эффекта Парирован» would match AREA_DURATION via «длительн»,
 *  but is caught by AILMENTS first (parry = ailment). Order matters.
 */
const AREA_DURATION_PATTERN = /(?:област.*действ|длительн.*(?:проклят|знам[её]н)|Улучшает радиус)/i;

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

/** Mirror of iter 87 classifyFunctionalBlock + iter 88 new AILMENTS + AREA_DURATION steps.
 *  iter 88: steps 16 (AILMENTS) and 17 (AREA_DURATION) inserted BEFORE the fallback. */
function classifyFunctionalBlock_iter88(text: string, allTags: Set<string>): FunctionalBlock {
  if (SPIRIT_PATTERN.test(text)) return 'spirit';
  if (RUNES_BARRIER_PATTERN.test(text)) return 'runes-barrier';
  if (BREACH_PATTERN.test(text)) return 'breach';
  if (MAGIC_FIND_PATTERN.test(text)) return 'magic-find';
  if (SKILL_LEVELS_PATTERN.test(text)) return 'skill-levels';
  if (FLASKS_PATTERN.test(text)) return 'flasks';
  if (allTags.has('minion') || MINIONS_PATTERN.test(text)) return 'minions';
  if (ATTRIBUTES_PATTERN.test(text) || allTags.has('attribute')) return 'attributes';
  if (allTags.has('resistance') || RESISTANCES_PATTERN.test(text)) return 'resistances';
  if (allTags.has('life') || allTags.has('mana') || RESOURCES_PATTERN.test(text)) return 'resources';
  if (allTags.has('armour') || allTags.has('evasion') || allTags.has('energy_shield') || allTags.has('charm') || DEFENCE_STATS_PATTERN.test(text)) return 'defence-stats';
  if (WEAPON_SPECIFIC_PATTERN.test(text)) return 'weapon-specific';
  if (allTags.has('critical') || CRIT_PATTERN.test(text)) return 'crit';
  if (allTags.has('damage') || allTags.has('physical') || allTags.has('elemental') || allTags.has('cold') || allTags.has('fire') || allTags.has('lightning') || allTags.has('chaos') || DAMAGE_TYPE_PATTERN.test(text)) return 'damage-type';
  if (allTags.has('speed') || OFFENCE_SPEED_PATTERN.test(text)) return 'offence-speed';
  // ─── iter 88: 2 new blocks BEFORE the fallback ───
  if (AILMENTS_PATTERN.test(text)) return 'ailments';
  if (AREA_DURATION_PATTERN.test(text)) return 'area-duration';
  return 'other';
}

/** iter 87 classifyFunctionalBlock (without iter 88 changes) — for diff comparison. */
function classifyFunctionalBlock_iter87(text: string, allTags: Set<string>): FunctionalBlock {
  if (SPIRIT_PATTERN.test(text)) return 'spirit';
  if (RUNES_BARRIER_PATTERN.test(text)) return 'runes-barrier';
  if (BREACH_PATTERN.test(text)) return 'breach';
  if (MAGIC_FIND_PATTERN.test(text)) return 'magic-find';
  if (SKILL_LEVELS_PATTERN.test(text)) return 'skill-levels';
  if (FLASKS_PATTERN.test(text)) return 'flasks';
  if (allTags.has('minion') || MINIONS_PATTERN.test(text)) return 'minions';
  if (ATTRIBUTES_PATTERN.test(text) || allTags.has('attribute')) return 'attributes';
  if (allTags.has('resistance') || RESISTANCES_PATTERN.test(text)) return 'resistances';
  if (allTags.has('life') || allTags.has('mana') || RESOURCES_PATTERN.test(text)) return 'resources';
  if (allTags.has('armour') || allTags.has('evasion') || allTags.has('energy_shield') || allTags.has('charm') || DEFENCE_STATS_PATTERN.test(text)) return 'defence-stats';
  if (WEAPON_SPECIFIC_PATTERN.test(text)) return 'weapon-specific';
  if (allTags.has('critical') || CRIT_PATTERN.test(text)) return 'crit';
  if (allTags.has('damage') || allTags.has('physical') || allTags.has('elemental') || allTags.has('cold') || allTags.has('fire') || allTags.has('lightning') || allTags.has('chaos') || DAMAGE_TYPE_PATTERN.test(text)) return 'damage-type';
  if (allTags.has('speed') || OFFENCE_SPEED_PATTERN.test(text)) return 'offence-speed';
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
}

interface FamilyGroup {
  text: string;
  tags: Set<string>;
  affix: string;
  familyKey: string;
  tokenCount: number;
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
      });
    }
    const group = byKey.get(key)!;
    group.tokenCount++;
    for (const t of tok.tags) {
      if (BREACH_LORD_TAGS.has(t)) continue;
      group.tags.add(t);
    }
  }
  return Array.from(byKey.values());
}

// ─── Main ───

const CATEGORIES = ['jewel', 'amulet', 'ring', 'belt'] as const;
let anyFailures = false;

console.log('=== iter 88 simulation: AILMENTS + AREA_DURATION blocks ===\n');
console.log('Strategy: add 2 new patterns after OFFENCE_SPEED, before fallback.\n');
console.log('Goal: reduce jewel.json other-bucket from 21.8% to <15%, without\n' +
            'reclassifying mods in amulet/ring/belt that are already bucketed.\n');

for (const cat of CATEGORIES) {
  let groups: FamilyGroup[];
  try {
    groups = loadFamilyGroups(cat);
  } catch {
    console.log(`=== ${cat}: file not found, skipping ===\n`);
    continue;
  }

  console.log(`=== ${cat}.json (${groups.length} family-groups) ===`);

  // Count iter87 vs iter88 blocks
  const before = new Map<FunctionalBlock, number>();
  const after = new Map<FunctionalBlock, number>();
  const reclassifications: { from: FunctionalBlock; to: FunctionalBlock; text: string; familyKey: string; affix: string }[] = [];

  for (const g of groups) {
    const b = classifyFunctionalBlock_iter87(g.text, g.tags);
    const a = classifyFunctionalBlock_iter88(g.text, g.tags);
    before.set(b, (before.get(b) ?? 0) + 1);
    after.set(a, (after.get(a) ?? 0) + 1);
    if (b !== a) {
      reclassifications.push({ from: b, to: a, text: g.text, familyKey: g.familyKey, affix: g.affix });
    }
  }

  // Print before/after for non-zero blocks
  console.log('  Block                 iter87 → iter88  (delta)');
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
      const safe = r.from === 'other' ? '✓' : '⚠ RE-CLASSIFY';
      console.log(`    ${safe} ${r.from} → ${r.to}`);
      console.log(`        [${r.affix}] ${r.familyKey}`);
      console.log(`        "${r.text}"`);
    }
  }

  // other-bucket before/after
  const beforeOther = before.get('other') ?? 0;
  const afterOther = after.get('other') ?? 0;
  const beforePct = ((beforeOther / groups.length) * 100).toFixed(1);
  const afterPct = ((afterOther / groups.length) * 100).toFixed(1);
  console.log(`\n  other-bucket: ${beforeOther}/${groups.length} = ${beforePct}%  →  ${afterOther}/${groups.length} = ${afterPct}%\n`);

  // Flag any reclassification that's NOT from 'other' (those are bugs)
  const falsePositives = reclassifications.filter(r => r.from !== 'other');
  if (falsePositives.length > 0) {
    console.log(`  ⚠⚠⚠ ${falsePositives.length} FALSE POSITIVES in ${cat}.json — review patterns!`);
    anyFailures = true;
  } else {
    console.log(`  ✓ All reclassifications are from 'other' (safe — no existing buckets broken)`);
  }
  console.log('');
}

if (anyFailures) {
  console.log('⚠ iter 88 patterns have false positives — refine before deploying.');
  process.exit(1);
} else {
  console.log('🎉 All reclassifications are safe (from `other` only). iter 88 patterns are good to deploy.');
}
