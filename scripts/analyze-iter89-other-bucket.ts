/**
 * analyze-iter89-other-bucket.ts — dump all 27 family-keys that still fall into
 * `other` bucket in jewel.json AFTER iter 88 (AILMENTS + AREA_DURATION are in),
 * and test candidate patterns for iter 89 (buff-skills / meta-skills / wisps /
 * conversion / rage-charges).
 *
 * Output: for each `other` family-key, print its displayText + tags + which
 * candidate pattern it would match — so we can design precise text patterns
 * that capture them without false-positives.
 *
 * Run:  npx tsx scripts/analyze-iter89-other-bucket.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Mirror of BREACH_LORD_TAGS (src/shared/mod-classifier.ts) ───
const BREACH_LORD_TAGS = new Set(['kurgal_mod', 'amanamu_mod', 'ulaman_mod']);

// ─── Mirror of iter 85/86/87/88 patterns (exact copy from mod-classifier.ts) ───
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
// iter 88 patterns
const AILMENTS_PATTERN = /(?:поджог|шок|охлажден|заморозк|отравлен|отравить|кровотеч|оцепенен|парир|пригвожден|Разрез|ослеплен|ослепить|горючест|восприимчивост|истощен|наложен.*состоян|стихийн.*состоян)/i;
const AREA_DURATION_PATTERN = /(?:област.*действ|длительн.*(?:проклят|знам[её]н)|Улучшает радиус)/i;

type FunctionalBlock = string;

/** Mirror of classifyFunctionalBlock from mod-classifier.ts (iter 88 — current state). */
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

// ─── iter 89 CANDIDATE patterns ───

/** buff-skills — Ауры / Вестники / Метки / Знаки / Кличи / Знамёна / Обереги.
 *  Note: «оберег» is already caught earlier by DEFENCE_STATS_PATTERN via `charm` tag
 *  for "длительность оберега" type mods — but only for belt. For jewel, «обереги»
 *  mods without charm tag would land in `other`. Need to test overlap carefully. */
const BUFF_SKILLS_CANDIDATE = /(?:аур|Вестник|мет[о]?к|клич|знам[её]н|оберег|Знак(?!.*повелител))/i;

/** meta-skills — Архонт / Запечатанные / Мета-умения / вызываемые умения. */
const META_SKILLS_CANDIDATE = /(?:Мета-умени|Архонт|запечат|вызываем.*умени)/i;

/** wisps — Сгустки (Breach mechanic). */
const WISPS_CANDIDATE = /сгустк/i;

/** conversion — MoM / Урон→Здоровье / похищение. */
const CONVERSION_CANDIDATE = /(?:от получаемого урона|берется сначала из ман|похищен)/i;

/** rage-charges — Свирепость / Banner glory. */
const RAGE_CHARGES_CANDIDATE = /(?:свирепост|славы.*умени.*знам[её]н|славы для умений знамён)/i;

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

const groups = loadFamilyGroups('jewel');
console.log(`=== jewel.json: ${groups.length} family-groups ===\n`);

const others = groups.filter(g => classifyFunctionalBlock_iter88(g.text, g.tags) === 'other');
console.log(`=== ${others.length} family-keys in 'other' bucket (after iter 88) ===\n`);

let buffSkillsHits = 0;
let metaSkillsHits = 0;
let wispsHits = 0;
let conversionHits = 0;
let rageChargesHits = 0;
let stillOther = 0;

console.log('affix | familyKey | tags | matches | displayText');
console.log('---');
for (const g of others) {
  const matches: string[] = [];
  if (BUFF_SKILLS_CANDIDATE.test(g.text)) { matches.push('BUFF-SKILLS'); buffSkillsHits++; }
  if (META_SKILLS_CANDIDATE.test(g.text)) { matches.push('META-SKILLS'); metaSkillsHits++; }
  if (WISPS_CANDIDATE.test(g.text)) { matches.push('WISPS'); wispsHits++; }
  if (CONVERSION_CANDIDATE.test(g.text)) { matches.push('CONVERSION'); conversionHits++; }
  if (RAGE_CHARGES_CANDIDATE.test(g.text)) { matches.push('RAGE-CHARGES'); rageChargesHits++; }
  if (matches.length === 0) stillOther++;

  const tagsStr = Array.from(g.tags).join(',') || '(none)';
  console.log(`${g.affix} | ${g.familyKey} | ${tagsStr} | ${matches.join('+') || '—'} | ${g.text}`);
}

console.log('\n=== IMPACT SIMULATION (iter 89 candidates) ===\n');
console.log(`Current other-bucket (iter 88): ${others.length}/${groups.length} = ${((others.length / groups.length) * 100).toFixed(1)}%`);
console.log(`After BUFF_SKILLS pattern:    -${buffSkillsHits} → ${others.length - buffSkillsHits}/${groups.length} = ${(((others.length - buffSkillsHits) / groups.length) * 100).toFixed(1)}%`);
console.log(`After META_SKILLS pattern:    -${metaSkillsHits} → ${others.length - metaSkillsHits}/${groups.length} = ${(((others.length - metaSkillsHits) / groups.length) * 100).toFixed(1)}%`);
console.log(`After WISPS pattern:          -${wispsHits} → ${others.length - wispsHits}/${groups.length} = ${(((others.length - wispsHits) / groups.length) * 100).toFixed(1)}%`);
console.log(`After CONVERSION pattern:     -${conversionHits} → ${others.length - conversionHits}/${groups.length} = ${(((others.length - conversionHits) / groups.length) * 100).toFixed(1)}%`);
console.log(`After RAGE_CHARGES pattern:   -${rageChargesHits} → ${others.length - rageChargesHits}/${groups.length} = ${(((others.length - rageChargesHits) / groups.length) * 100).toFixed(1)}%`);

const combinedReduction = others.filter(g =>
  BUFF_SKILLS_CANDIDATE.test(g.text) ||
  META_SKILLS_CANDIDATE.test(g.text) ||
  WISPS_CANDIDATE.test(g.text) ||
  CONVERSION_CANDIDATE.test(g.text) ||
  RAGE_CHARGES_CANDIDATE.test(g.text)
).length;

console.log(`\nCombined (all 5 patterns, with overlaps): -${combinedReduction} → ${others.length - combinedReduction}/${groups.length} = ${(((others.length - combinedReduction) / groups.length) * 100).toFixed(1)}%`);
console.log(`Still in 'other' after all 5 patterns: ${stillOther}`);
