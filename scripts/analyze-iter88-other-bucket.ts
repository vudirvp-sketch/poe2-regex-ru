/**
 * analyze-iter88-other-bucket.ts — dump all 42 family-keys that currently fall into
 * `other` bucket in jewel.json (after iter 87), plus simulate the impact of adding
 * new functional blocks (penetration / ailments / area-duration).
 *
 * Output: for each `other` family-key, print its displayText + tags — so we can
 * design precise text patterns that capture them without false-positives.
 *
 * Run:  npx tsx scripts/analyze-iter88-other-bucket.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Mirror of BREACH_LORD_TAGS (src/shared/mod-classifier.ts) ───
const BREACH_LORD_TAGS = new Set(['kurgal_mod', 'amanamu_mod', 'ulaman_mod']);

// ─── Mirror of iter 85/86/87 patterns (exact copy) ───
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

// ─── iter 88 CANDIDATE patterns (what we want to test) ───
// Penetration: "пробивает сопротивление X"
const PENETRATION_CANDIDATE = /пробива.*сопротивлен/i;
// Ailments: поджог/шок/охлаждение/отравлен/кровотеч/оцепенен/парир/пригвожден/Разрез/ослеплен/горючест/восприимчивост/истощен/метки
const AILMENTS_CANDIDATE = /(?:поджог|шок|охлажден|заморозк|отравлен|кровотеч|оцепенен|парир|пригвожден|Разрез|ослеплен|горючест|восприимчивост|истощен|оберег|мет[о]?к|шанса.*наложен)/i;
// Area/duration: area of effect, skill duration, ailment duration, presence duration
const AREA_DURATION_CANDIDATE = /(?:област.*действ|длительн|присутстви|радиус)/i;

type FunctionalBlock = string;

/** Mirror of classifyFunctionalBlock from mod-classifier.ts (iter 87). */
function classifyFunctionalBlock(text: string, allTags: Set<string>): FunctionalBlock {
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

const groups = loadFamilyGroups('jewel');
console.log(`=== jewel.json: ${groups.length} family-groups ===\n`);

const others = groups.filter(g => classifyFunctionalBlock(g.text, g.tags) === 'other');
console.log(`=== ${others.length} family-keys in 'other' bucket ===\n`);

// For each 'other' family-key, show what candidate pattern it would match
let penetrationHits = 0;
let ailmentsHits = 0;
let areaDurationHits = 0;
let stillOther = 0;

console.log('affix | familyKey | tags | matches | displayText');
console.log('---');
for (const g of others) {
  const matches: string[] = [];
  if (PENETRATION_CANDIDATE.test(g.text)) { matches.push('PENETRATION'); penetrationHits++; }
  if (AILMENTS_CANDIDATE.test(g.text)) { matches.push('AILMENTS'); ailmentsHits++; }
  if (AREA_DURATION_CANDIDATE.test(g.text)) { matches.push('AREA-DURATION'); areaDurationHits++; }
  if (matches.length === 0) stillOther++;

  const tagsStr = Array.from(g.tags).join(',') || '(none)';
  console.log(`${g.affix} | ${g.familyKey} | ${tagsStr} | ${matches.join('+') || '—'} | ${g.text}`);
}

console.log('\n=== IMPACT SIMULATION ===\n');
console.log(`Current other-bucket: ${others.length}/${groups.length} = ${((others.length / groups.length) * 100).toFixed(1)}%`);
console.log(`After adding PENETRATION pattern: -${penetrationHits} → ${others.length - penetrationHits}/${groups.length} = ${(((others.length - penetrationHits) / groups.length) * 100).toFixed(1)}%`);
console.log(`After adding AILMENTS pattern:    -${ailmentsHits} → ${others.length - ailmentsHits}/${groups.length} = ${(((others.length - ailmentsHits) / groups.length) * 100).toFixed(1)}%`);
console.log(`After adding AREA-DURATION pattern: -${areaDurationHits} → ${others.length - areaDurationHits}/${groups.length} = ${(((others.length - areaDurationHits) / groups.length) * 100).toFixed(1)}%`);

const combinedReduction = others.filter(g =>
  PENETRATION_CANDIDATE.test(g.text) ||
  AILMENTS_CANDIDATE.test(g.text) ||
  AREA_DURATION_CANDIDATE.test(g.text)
).length;

console.log(`\nCombined (all 3 patterns, no overlap): -${combinedReduction} → ${others.length - combinedReduction}/${groups.length} = ${(((others.length - combinedReduction) / groups.length) * 100).toFixed(1)}%`);
console.log(`Still in 'other' after all 3 patterns: ${stillOther}`);
console.log(`Target: <15% = ${Math.ceil(groups.length * 0.15)} family-keys max in 'other'`);
