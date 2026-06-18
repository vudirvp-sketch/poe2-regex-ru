/**
 * ETL-tagged functionalCategory builder.
 *
 * Classifies jewel (and jewellery) mods into functional blocks during ETL,
 * using poe2db ModCalc page data (tags + modCode + description text).
 * The result is stored as `functionalCategory` on each GameToken.
 *
 * This mirrors the classifyJewelType pattern: ModCalc pages provide richer
 * tag data than Type A HTML tables. By classifying at ETL time, we get
 * ~100% accuracy without relying on fragile runtime regex patterns.
 *
 * Classification strategy (same as classifyFunctionalBlock in mod-classifier.ts):
 *  1. Tag-based: ModCalc tags (damage, attack, critical, speed, caster, minion,
 *     physical, chaos, ailment, elemental, cold, fire, lightning, curse, aura, gem,
 *     resistance, life, mana, armour, energy_shield, charm, evasion, attribute)
 *  2. Text-pattern fallback: for mods with no tags or ambiguous tags
 *
 * BREACH_LORD_TAGS (kurgal_mod, amanamu_mod, ulaman_mod) are excluded from
 * classification — they indicate mod source, not function.
 */

import type { NormalizedMod } from './normalize.js';
import type { JewelType } from '../../src/shared/types.js';
import { fetchPage } from './fetch-poe2db.js';
import { parseTypeBPage } from './parse-modifiers-calc.js';
import { extractTextAndRanges } from './normalize.js';

// ─── Tag sets (mirrored from mod-classifier.ts) ───

// BREACH_LORD_TAGS are excluded from classification — they indicate mod source, not function.
const BREACH_LORD_TAGS = new Set([
  'kurgal_mod', 'amanamu_mod', 'ulaman_mod',
]);

// ─── Text patterns (exact copies from mod-classifier.ts) ───

const SPIRIT_PATTERN = /к духу/i;
const RUNES_BARRIER_PATTERN = /руническ.*барьер/i;
const BREACH_PATTERN = /Знак.*повелител.*Бездн/i;
const MAGIC_FIND_PATTERN = /(?:редкост.*найден.*предмет|количеств.*найден.*предмет)/i;
const SKILL_LEVELS_PATTERN = /(?:уровен.*камн.*умени|уровн.*камн.*умени|качеств.*умени|качеств.*всех умени|максимальн.*качеств|скорост.*перезарядк.*умени(?!.*боев)|длительн.*эффект.*умени)/i;
const FLASKS_PATTERN = /флакон/i;
const MINIONS_PATTERN = /(?:приспешник|подношен)/i;
const ATTRIBUTES_PATTERN = /(?:к силе|к ловк|к интелл|ко всем.*атрибут|ко всем.*характерист|силе.*ловкост|ловкост.*интеллект|силе.*интеллект|уменьшен.*требован.*характерист)/i;
const RESISTANCES_PATTERN = /(?:сопротивлен|добавлен.*свойств.*сопротивлен)/i;
const RESOURCES_PATTERN = /(?:максимум.*энергетическ.*щит|похищен.*виде.*здоров|похищен.*виде.*ман|скорост.*регенерац.*здоров|скорост.*регенерац.*ман|восстанавливает.*здоровь|восстанавливает.*ман|получен.*урон.*восполня|от получаемого урона.*берется.*из ман|Регенерац.*здоров|Дарует.*здоровь.*убит|Дарует.*ман.*убит)/i;
const DEFENCE_STATS_PATTERN = /(?:брон|уклонен|блок|порог.*оглушен|отклонен.*удар)/i;
const WEAPON_SPECIFIC_PATTERN = /(?:мечами|кинжалами|топорами|булавами|луками|самострелами|копьями|боевыми посохами|кистенями|без оружия)/i;
const CRIT_PATTERN = /крит/i;
const DAMAGE_TYPE_PATTERN = /урон/i;
const OFFENCE_SPEED_PATTERN = /скорост.*(атак|сотворени|передвижен|снаряд)/i;
const AILMENTS_PATTERN = /(?:поджог|шок|охлажден|заморозк|отравлен|отравить|кровотеч|оцепенен|парир|пригвожден|Разрез|ослеплен|ослепить|горючест|восприимчивост|истощен|наложен.*состоян|стихийн.*состоян)/i;
const AREA_DURATION_PATTERN = /(?:област.*действ|длительн.*(?:проклят|знам[eё]н)|Улучшает радиус)/i;
const RAGE_CHARGES_PATTERN = /(?:свирепост|славы.*знам[её]н)/i;
const META_SKILLS_PATTERN = /(?:Мета-умени|Архонт|запечат|вызываем.*умени)/i;
const BUFF_SKILLS_PATTERN = /(?:аур|Вестник|мет[о]?к(?!ост)|клич|знам[её]н|проклят)/i;

// ─── Functional block type ───

export type FunctionalBlock =
  | 'spirit' | 'skill-levels' | 'attributes' | 'resources'
  | 'runes-barrier' | 'resistances' | 'defence-stats'
  | 'offence-speed' | 'crit' | 'damage-type' | 'penetration' | 'ailments'
  | 'area-duration' | 'wisps' | 'buff-skills' | 'minions' | 'meta-skills'
  | 'weapon-specific' | 'flasks' | 'magic-find' | 'conversion' | 'rage-charges'
  | 'breach' | 'other';

/**
 * Classify a mod into a functional block using tags + text patterns.
 *
 * This is a standalone version of classifyFunctionalBlock that works on
 * individual mod data (tags + rawText) rather than FamilyGroup.
 * The logic mirrors classifyFunctionalBlock in mod-classifier.ts.
 */
export function classifyModFunctionalBlock(
  tags: string[],
  rawText: string,
): FunctionalBlock {
  // Filter out Breach Lord source tags
  const functionalTags = new Set(
    tags.filter(t => !BREACH_LORD_TAGS.has(t))
  );

  // 1. Spirit
  if (SPIRIT_PATTERN.test(rawText)) return 'spirit';
  // 2. Runes barrier
  if (RUNES_BARRIER_PATTERN.test(rawText)) return 'runes-barrier';
  // 3. Breach
  if (BREACH_PATTERN.test(rawText)) return 'breach';
  // 4. Magic Find
  if (MAGIC_FIND_PATTERN.test(rawText)) return 'magic-find';
  // 5. Skill levels
  if (SKILL_LEVELS_PATTERN.test(rawText)) return 'skill-levels';
  // 6. Flasks
  if (FLASKS_PATTERN.test(rawText)) return 'flasks';
  // 7. Minions
  if (functionalTags.has('minion') || MINIONS_PATTERN.test(rawText)) return 'minions';
  // 8. Attributes
  if (ATTRIBUTES_PATTERN.test(rawText) || functionalTags.has('attribute')) return 'attributes';
  // 9. Resistances
  if (functionalTags.has('resistance') || RESISTANCES_PATTERN.test(rawText)) return 'resistances';
  // 10. Resources
  if (functionalTags.has('life') || functionalTags.has('mana') || RESOURCES_PATTERN.test(rawText)) return 'resources';
  // 11. Defence-stats
  if (functionalTags.has('armour') || functionalTags.has('evasion') || functionalTags.has('energy_shield') || functionalTags.has('charm') || DEFENCE_STATS_PATTERN.test(rawText)) return 'defence-stats';
  // 12. Weapon-specific
  if (WEAPON_SPECIFIC_PATTERN.test(rawText)) return 'weapon-specific';
  // 13. Crit
  if (functionalTags.has('critical') || CRIT_PATTERN.test(rawText)) return 'crit';
  // 14. Damage-type
  if (functionalTags.has('damage') || functionalTags.has('physical') || functionalTags.has('elemental') || functionalTags.has('cold') || functionalTags.has('fire') || functionalTags.has('lightning') || functionalTags.has('chaos') || DAMAGE_TYPE_PATTERN.test(rawText)) return 'damage-type';
  // 15. Offence-speed
  if (functionalTags.has('speed') || OFFENCE_SPEED_PATTERN.test(rawText)) return 'offence-speed';
  // 16. Ailments
  if (AILMENTS_PATTERN.test(rawText)) return 'ailments';
  // 17. Area / Duration
  if (AREA_DURATION_PATTERN.test(rawText)) return 'area-duration';
  // 18. Rage-charges
  if (RAGE_CHARGES_PATTERN.test(rawText)) return 'rage-charges';
  // 19. Meta-skills
  if (META_SKILLS_PATTERN.test(rawText)) return 'meta-skills';
  // 20. Buff-skills
  if (BUFF_SKILLS_PATTERN.test(rawText)) return 'buff-skills';
  // 21. Fallback
  return 'other';
}

// ─── Functional category map builder ───

/**
 * Normalize raw text for matching (same as in run-etl.ts).
 */
function normalizeRawTextForMatching(text: string): string {
  return text
    .replace(/\([+-]?\d+(?:\.\d+)?\s*[—–-]\s*[+-]?\d+(?:\.\d+)?\)/g, '##')
    .replace(/([+-]?\d+(?:\.\d+)?)/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Build a functionalCategoryMap by fetching the poe2db ModCalc pages.
 *
 * Strategy (mirrors buildJewelTypeMap):
 *  1. Fetch ModCalc pages for Ruby/Emerald/Sapphire jewels + jewellery
 *  2. For each mod on a ModCalc page, classify using tags + text
 *  3. Build modCode→functionalCategory + normalizedText→functionalCategory maps
 *  4. Match each jewel/jewellery mod by modCode first, then by normalizedText
 *
 * For jewellery categories (amulet/ring/belt), we also fetch their ModCalc pages
 * and classify mods directly from the richer tag data available there.
 *
 * Returns: Record<modId, FunctionalBlock> — maps token IDs to their functional category.
 */
export async function buildFunctionalCategoryMap(
  allJewelMods: NormalizedMod[],
  allJewelleryMods: NormalizedMod[] = [],
): Promise<Record<string, string>> {
  console.log('\n=== Building functional category map from ModCalc pages ===');

  const functionalCategoryMap: Record<string, string> = {};

  // ─── Jewel categories ───
  // Fetch ModCalc pages for each jewel type
  const modCalcPages: { url: string; type: JewelType }[] = [
    { url: 'https://poe2db.tw/ru/Ruby#ModifiersCalc', type: 'ruby' },
    { url: 'https://poe2db.tw/ru/Emerald#ModifiersCalc', type: 'emerald' },
    { url: 'https://poe2db.tw/ru/Sapphire#ModifiersCalc', type: 'sapphire' },
  ];

  // Build modCode→functionalCategory and normalizedText→functionalCategory maps
  const modCodeToCategory = new Map<string, string>();
  const normalizedTextToCategory = new Map<string, string>();

  for (const page of modCalcPages) {
    try {
      const html = await fetchPage(page.url);
      const groups = parseTypeBPage(html);

      for (const group of groups) {
        for (const tier of group.tiers) {
          if (tier.modCode) {
            // Classify using ModCalc tags + description text
            const segments = extractTextAndRanges(tier.descriptionHtml);
            const rawText = segments.length > 0 ? segments[0].rawText : '';
            const category = classifyModFunctionalBlock(tier.tags, rawText);

            // Only store if the category is not 'other' (other is the default anyway)
            modCodeToCategory.set(tier.modCode, category);

            // Also map normalizedText→category for text-based matching
            for (const seg of segments) {
              const normalizedKey = normalizeRawTextForMatching(seg.rawTextTemplate);
              if (normalizedKey && !normalizedTextToCategory.has(normalizedKey)) {
                normalizedTextToCategory.set(normalizedKey, category);
              }
            }
          }
        }
      }

      console.log(`  ${page.type} ModCalc: ${modCodeToCategory.size} modCode mappings, ${normalizedTextToCategory.size} text mappings`);
    } catch (err) {
      console.warn(`  WARNING: Failed to fetch ${page.url}:`, (err as Error).message);
    }
  }

  // Map jewel token IDs to functional categories
  let matchedByCode = 0;
  let matchedByText = 0;
  let unmatched = 0;

  for (const mod of allJewelMods) {
    // Try matching by modCode first
    const modCode = mod.modCode;
    if (modCode && modCodeToCategory.has(modCode)) {
      functionalCategoryMap[mod.id] = modCodeToCategory.get(modCode)!;
      matchedByCode++;
      continue;
    }

    // Fallback: match by normalized rawTextTemplate
    const normalizedKey = normalizeRawTextForMatching(mod.rawTextTemplate.ru);
    if (normalizedKey && normalizedTextToCategory.has(normalizedKey)) {
      functionalCategoryMap[mod.id] = normalizedTextToCategory.get(normalizedKey)!;
      matchedByText++;
      continue;
    }

    // Last resort: classify using token's own tags + rawText
    // (this handles mods not found in ModCalc pages, e.g., corrupted mods)
    const fallbackCategory = classifyModFunctionalBlock(mod.tags, mod.rawText.ru);
    functionalCategoryMap[mod.id] = fallbackCategory;
    unmatched++;
  }

  console.log(`  Jewel functional category map: ${matchedByCode} by modCode, ${matchedByText} by text, ${unmatched} by fallback out of ${allJewelMods.length} total`);

  // ─── Jewellery categories (amulet/ring/belt) ───
  // For jewellery, we classify directly from the token's own tags + rawText
  // (the ModCalc pages for these categories are already parsed during main ETL,
  //  and their tags are richer than jewel Type A table tags)
  if (allJewelleryMods.length > 0) {
    let jewelleryClassified = 0;
    for (const mod of allJewelleryMods) {
      const category = classifyModFunctionalBlock(mod.tags, mod.rawText.ru);
      functionalCategoryMap[mod.id] = category;
      jewelleryClassified++;
    }
    console.log(`  Jewellery functional category map: ${jewelleryClassified} mods classified`);
  }

  // Print summary by category
  const catCounts: Record<string, number> = {};
  for (const cat of Object.values(functionalCategoryMap)) {
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  console.log('  Functional category distribution:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }

  return functionalCategoryMap;
}
