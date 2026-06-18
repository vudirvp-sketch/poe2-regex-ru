/**
 * simulate-iter89-impact.ts — Mirror iter 89 candidate patterns on jewel.json +
 * all jewellery categories (amulet/ring/belt) to detect false positives.
 *
 * Strategy: place RAGE_CHARGES + META_SKILLS + BUFF_SKILLS AFTER area-duration
 * (step 17) and BEFORE the fallback (other). This way, the new patterns only
 * catch things that would otherwise fall into 'other' — never re-classifying
 * mods that are already correctly bucketed.
 *
 * iter 89 patterns:
 *  - RAGE_CHARGES_PATTERN: `свирепост|славы.*знам[её]н` — ferocity max + banner glory speed
 *  - META_SKILLS_PATTERN:  `Мета-умени|Архонт|запечат|вызываем.*умени`
 *  - BUFF_SKILLS_PATTERN:  `аур|Вестник|мет[о]?к(?!ост)|клич|знам[её]н|проклят`
 *    (note: `мет[о]?к(?!ост)` excludes «меткости» = accuracy)
 *
 * Run:  npx tsx scripts/simulate-iter89-impact.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Mirror of BREACH_LORD_TAGS ───
const BREACH_LORD_TAGS = new Set(['kurgal_mod', 'amanamu_mod', 'ulaman_mod']);

// ─── iter 85/86/87/88 patterns (existing — exact copy from mod-classifier.ts) ───
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
const AILMENTS_PATTERN = /(?:поджог|шок|охлажден|заморозк|отравлен|отравить|кровотеч|оцепенен|парир|пригвожден|Разрез|ослеплен|ослепить|горючест|восприимчивост|истощен|наложен.*состоян|стихийн.*состоян)/i;
const AREA_DURATION_PATTERN = /(?:област.*действ|длительн.*(?:проклят|знам[её]н)|Улучшает радиус)/i;

// ─── iter 89 NEW patterns (proposed) ───

/**
 * Rage-charges — Свирепость / Banner glory speed.
 *
 * iter 89: 4 family-keys in jewel.json `other` bucket.
 *  - "+# к максимуму свирепости" (Ruby jewel mechanic — ferocity)
 *  - "Дарует # свирепости при нанесении удара в ближнем бою" (gain rage on melee hit)
 *  - "Дарует # свирепости при получении удара от врага" (gain rage when hit)
 *  - "#% повышение скорости накопления славы для умений знамён" (banner glory speed)
 *
 * Must be checked BEFORE BUFF_SKILLS — the banner-glory mod contains «знамён»
 * which would otherwise match BUFF_SKILLS. RAGE_CHARGES is more specific.
 *
 * Note: «% увеличение области действия умений знамён» and «% увеличение
 * длительности умений знамён» are caught EARLIER by AREA_DURATION via
 * «област.*действ» and «длительн.*знам[её]н» respectively — those stay in
 * AREA_DURATION (correct: they're banner area/duration, not charge generation).
 */
const RAGE_CHARGES_PATTERN = /(?:свирепост|славы.*знам[её]н)/i;

/**
 * Meta-skills — Архонт / Запечатанные / Мета-умения / вызываемые умения.
 *
 * iter 89: 1 family-key in jewel.json `other` bucket.
 *  - "Мета-умения получают увеличенное на #% количество энергии"
 *
 * Future-proofing: also catches «Архонт» (Sapphire jewel undead archon)
 * and «запечат» (sealed skills) and «вызываем.*умени» (triggered skills)
 * if any of those appear in future jewel.json revisions.
 */
const META_SKILLS_PATTERN = /(?:Мета-умени|Архонт|запечат|вызываем.*умени)/i;

/**
 * Buff-skills — Ауры / Вестники / Метки / Кличи / Знамёна / Проклятия.
 *
 * iter 89: 6 family-keys in jewel.json `other` bucket (after RAGE_CHARGES
 * steals the banner-glory mod).
 *  - "#% увеличение силы умений аур" (aura effect)
 *  - "#% усиление эффекта ваших умений меток" (mark effect)
 *  - "#% усиление положительного эффекта боевого клича" (warcry effect)
 *  - "#% повышение скорости перезарядки боевых кличей" (warcry recharge speed)
 *  - "#% увеличение силы проклятий" (curse effect)
 *  - "На #% быстрее активация проклятия" (curse activation speed)
 *
 * CAREFUL exclusions (avoid false positives):
 *  - `мет[о]?к(?!ост)` — matches «меток/метки/метку/метка» (mark skill inflections)
 *    but NOT «меткости/меткость» (accuracy). The negative lookahead `(?!ост)`
 *    rejects matches where «метк» is followed by «ост» (the rest of «меткости»).
 *  - `проклят` is added to catch curse-strength/activation mods that don't
 *    have curse duration (duration is in AREA_DURATION). Curse mods belong
 *    conceptually with buff-skills (debuffs to enemies = marks/curses).
 *  - NOT matching «оберег» — already caught earlier by DEFENCE_STATS via
 *    `charm` tag (amulet/belt). Jewel has no «обереги» mods in current data.
 *  - NOT matching «Знак повелителя Бездны» — already caught earlier by BREACH.
 *
 * Order: AFTER area-duration, AFTER rage-charges, AFTER meta-skills.
 *  - area-duration takes banner area/duration mods first (more specific).
 *  - rage-charges takes banner-glory-accumulation mods first (more specific).
 *  - meta-skills takes meta-skill mods first (more specific).
 *  - buff-skills catches the rest (aura/mark/warcry/curse mods).
 */
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

/** Mirror of iter 88 classifyFunctionalBlock (current production state). */
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
  if (AILMENTS_PATTERN.test(text)) return 'ailments';
  if (AREA_DURATION_PATTERN.test(text)) return 'area-duration';
  return 'other';
}

/** Mirror of iter 89 classifyFunctionalBlock (with 3 new blocks). */
function classifyFunctionalBlock_iter89(text: string, allTags: Set<string>): FunctionalBlock {
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
  if (AILMENTS_PATTERN.test(text)) return 'ailments';
  if (AREA_DURATION_PATTERN.test(text)) return 'area-duration';
  // ─── iter 89: 3 new blocks BEFORE the fallback ───
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

console.log('=== iter 89 simulation: RAGE_CHARGES + META_SKILLS + BUFF_SKILLS blocks ===\n');
console.log('Strategy: add 3 new patterns after AREA_DURATION (step 17), before fallback.\n');
console.log('Goal: reduce jewel.json other-bucket from 14.0% to <10%, without\n' +
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

  // Count iter88 vs iter89 blocks
  const before = new Map<FunctionalBlock, number>();
  const after = new Map<FunctionalBlock, number>();
  const reclassifications: { from: FunctionalBlock; to: FunctionalBlock; text: string; familyKey: string; affix: string }[] = [];

  for (const g of groups) {
    const b = classifyFunctionalBlock_iter88(g.text, g.tags);
    const a = classifyFunctionalBlock_iter89(g.text, g.tags);
    before.set(b, (before.get(b) ?? 0) + 1);
    after.set(a, (after.get(a) ?? 0) + 1);
    if (b !== a) {
      reclassifications.push({ from: b, to: a, text: g.text, familyKey: g.familyKey, affix: g.affix });
    }
  }

  // Print before/after for non-zero blocks
  console.log('  Block                 iter88 → iter89  (delta)');
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
  console.log('⚠ iter 89 patterns have false positives — refine before deploying.');
  process.exit(1);
} else {
  console.log('🎉 All reclassifications are safe (from `other` only). iter 89 patterns are good to deploy.');
}
