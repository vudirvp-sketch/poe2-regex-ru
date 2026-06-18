/**
 * simulate-iter86-impact.ts — Mirror classifyFunctionalBlock() on real jewellery JSON.
 *
 * Reads public/generated/{ring,amulet,belt}.json, builds family-groups the same
 * way the UI does (group by familyKey + affix), then runs the SAME regex/tag
 * logic as src/shared/mod-classifier.ts classifyFunctionalBlock() on each group.
 *
 * Reports per-category counts: how many groups land in each FunctionalBlock.
 * The metric we care about is `other-bucket` — must be < 30% before we flip
 * the production pages to `affix-functional`.
 *
 * Run:  npx tsx scripts/simulate-iter86-impact.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Mirror of BREACH_LORD_TAGS (src/shared/mod-classifier.ts) ───
const BREACH_LORD_TAGS = new Set(['kurgal_mod', 'amanamu_mod', 'ulaman_mod']);

// ─── Mirror of iter 85 patterns ───
const SPIRIT_PATTERN = /к духу/i;
const RUNES_BARRIER_PATTERN = /руническ.*барьер/i;
const BREACH_PATTERN = /Знак.*повелител.*Бездн/i;
const MAGIC_FIND_PATTERN = /(?:редкост.*найден.*предмет|количеств.*найден.*предмет)/i;
const SKILL_LEVELS_PATTERN = /(?:уровен.*камн.*умени|уровн.*камн.*умени|качеств.*умени|качеств.*всех умени|максимальн.*качеств|скорост.*перезарядк.*умени(?!.*боев)|длительн.*эффект.*умени)/i;
const ATTRIBUTES_PATTERN = /(?:к силе|к ловк|к интелл|ко всем.*атрибут|ко всем.*характерист|силе.*ловкост|ловкост.*интеллект|силе.*интеллект|уменьшен.*требован.*характерист)/i;
const RESISTANCES_PATTERN = /(?:сопротивлен|добавлен.*свойств.*сопротивлен)/i;

// ─── iter 86 new patterns (must match mod-classifier.ts) ───
const FLASKS_PATTERN = /флакон/i;
const MINIONS_PATTERN = /(?:приспешник|подношен)/i;
const RESOURCES_PATTERN = /(?:максимум.*энергетическ.*щит|похищен.*виде.*здоров|похищен.*виде.*ман|скорост.*регенерац.*здоров|скорост.*регенерац.*ман|восстанавливает.*здоровь|восстанавливает.*ман|получен.*урон.*восполня|от получаемого урона.*берется.*из ман|Регенерац.*здоров|Дарует.*здоровь.*убит|Дарует.*ман.*убит)/i;
const DEFENCE_STATS_PATTERN = /(?:брон|уклонен|блок|порог.*оглушен|отклонен.*удар)/i;
const CRIT_PATTERN = /крит/i;
const DAMAGE_TYPE_PATTERN = /урон/i;
const OFFENCE_SPEED_PATTERN = /скорост.*(атак|сотворени|передвижен|снаряд)/i;

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

/** Mirror of classifyFunctionalBlock from mod-classifier.ts (iter 86). */
function classifyFunctionalBlock(text: string, allTags: Set<string>): FunctionalBlock {
  // 1. spirit (text)
  if (SPIRIT_PATTERN.test(text)) return 'spirit';
  // 2. runes-barrier (text)
  if (RUNES_BARRIER_PATTERN.test(text)) return 'runes-barrier';
  // 3. breach (text)
  if (BREACH_PATTERN.test(text)) return 'breach';
  // 4. magic-find (text)
  if (MAGIC_FIND_PATTERN.test(text)) return 'magic-find';
  // 5. skill-levels (text)
  if (SKILL_LEVELS_PATTERN.test(text)) return 'skill-levels';
  // 6. flasks (text «флакон»)
  if (FLASKS_PATTERN.test(text)) return 'flasks';
  // 7. minions (tag minion OR text «приспешник»/«подношен»)
  if (allTags.has('minion') || MINIONS_PATTERN.test(text)) return 'minions';
  // 8. attributes (text + tag attribute)
  if (ATTRIBUTES_PATTERN.test(text) || allTags.has('attribute')) return 'attributes';
  // 9. resistances (text + tag resistance) — BEFORE damage-type
  if (allTags.has('resistance') || RESISTANCES_PATTERN.test(text)) return 'resistances';
  // 10. resources (tags life/mana + text) — BEFORE defence-stats (for ES max)
  if (allTags.has('life') || allTags.has('mana') || RESOURCES_PATTERN.test(text)) return 'resources';
  // 11. defence-stats (tags armour/evasion/energy_shield/charm + text)
  if (allTags.has('armour') || allTags.has('evasion') || allTags.has('energy_shield') || allTags.has('charm') || DEFENCE_STATS_PATTERN.test(text)) return 'defence-stats';
  // 12. crit (tag critical + text «крит») — BEFORE damage-type
  if (allTags.has('critical') || CRIT_PATTERN.test(text)) return 'crit';
  // 13. damage-type (tags damage/physical/elemental/cold/fire/lightning/chaos + text «урон»)
  if (allTags.has('damage') || allTags.has('physical') || allTags.has('elemental') || allTags.has('cold') || allTags.has('fire') || allTags.has('lightning') || allTags.has('chaos') || DAMAGE_TYPE_PATTERN.test(text)) return 'damage-type';
  // 14. offence-speed (tag speed + text)
  if (allTags.has('speed') || OFFENCE_SPEED_PATTERN.test(text)) return 'offence-speed';
  // 15. other
  return 'other';
}

// ─── JSON loading & family-group construction ───

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
      });
    }
    const group = byKey.get(key)!;
    for (const t of tok.tags) {
      if (BREACH_LORD_TAGS.has(t)) continue; // mirror Breach Lord skip
      group.tags.add(t);
    }
  }
  return Array.from(byKey.values());
}

// ─── Main ───

const CATEGORIES = ['ring', 'amulet', 'belt'] as const;
const totals: Record<string, number> = { total: 0, other: 0 };

console.log('=== iter 86 simulation (7 + 7 = 14 active blocks) ===\n');

for (const cat of CATEGORIES) {
  const groups = loadFamilyGroups(cat);
  const counts = new Map<FunctionalBlock, number>();
  for (const g of groups) {
    const block = classifyFunctionalBlock(g.text, g.tags);
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }

  console.log(`=== ${cat} (${groups.length} family-groups) ===`);
  for (const block of FUNCTIONAL_BLOCK_ORDER) {
    const n = counts.get(block) ?? 0;
    if (n === 0) continue;
    const pct = ((n / groups.length) * 100).toFixed(1);
    console.log(`  ${block.padEnd(20)} ${String(n).padStart(3)}  (${pct}%)`);
  }
  const otherCount = counts.get('other') ?? 0;
  const otherPct = ((otherCount / groups.length) * 100).toFixed(1);
  console.log(`  ─── other-bucket: ${otherCount}/${groups.length} = ${otherPct}%\n`);

  totals.total += groups.length;
  totals.other += otherCount;
}

const overallPct = ((totals.other / totals.total) * 100).toFixed(1);
console.log('=== TOTAL ===');
console.log(`  ${CATEGORIES.join('+')}: ${totals.other}/${totals.total} = ${overallPct}% other-bucket\n`);

if (Number(overallPct) < 30) {
  console.log('✓ other-bucket < 30% → safe to flip pages to affix-functional');
} else {
  console.log('✗ other-bucket >= 30% → DO NOT flip pages yet; add more blocks');
}
