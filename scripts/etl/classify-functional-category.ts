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
const MINIONS_PATTERN = /(?:приспешник|подношен|компаньон)/i;
const ATTRIBUTES_PATTERN = /(?:к силе|к ловк|к интелл|ко всем.*атрибут|ко всем.*характерист|силе.*ловкост|ловкост.*интеллект|силе.*интеллект|уменьшен.*требован.*характерист)/i;
// Penetration mods (iter 93): "Урон пробивает #% сопротивления <element>".
// Must be checked BEFORE RESISTANCES_PATTERN — penetration mods contain «сопротивления»
// but functionally they're offensive penetration, not defensive resistance.
const PENETRATION_PATTERN = /пробива.*сопротивлен/i;
const RESISTANCES_PATTERN = /(?:сопротивлен|добавлен.*свойств.*сопротивлен)/i;
const RESOURCES_PATTERN = /(?:максимум.*энергетическ.*щит|похищен.*виде.*здоров|похищен.*виде.*ман|скорост.*регенерац.*здоров|скорост.*регенерац.*ман|восстанавливает.*здоровь|восстанавливает.*ман|получен.*урон.*восполня|от получаемого урона.*берется.*из ман|Регенерац.*здоров|Дарует.*здоровь.*убит|Дарует.*ман.*убит)/i;
const DEFENCE_STATS_PATTERN = /(?:брон|уклонен|блок|порог.*оглушен|отклонен.*удар)/i;
const WEAPON_SPECIFIC_PATTERN = /(?:мечами|кинжалами|топорами|булавами|луками|самострелами|копьями|боевыми посохами|кистенями|без оружия)/i;
const CRIT_PATTERN = /крит/i;
const DAMAGE_TYPE_PATTERN = /урон/i;
const OFFENCE_SPEED_PATTERN = /скорост.*(атак|сотворени|передвижен|снаряд)/i;
const AILMENTS_PATTERN = /(?:поджог|шок|охлажден|заморозк|отравлен|отравить|кровотеч|оцепенен|парир|пригвожден|Разрез|ослеплен|ослепить|горючест|восприимчивост|истощен|накладыва.*состоян|наложен.*состоян|стихийн.*состоян)/i;
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
  // 9. Penetration (iter 93) — "Урон пробивает #% сопротивления <element>"
  //    Must be BEFORE resistances — penetration mods contain «сопротивления» but
  //    are functionally offensive penetration, not defensive resistance.
  if (PENETRATION_PATTERN.test(rawText)) return 'penetration';
  // 10. Resistances
  if (functionalTags.has('resistance') || RESISTANCES_PATTERN.test(rawText)) return 'resistances';
  // 11. Resources
  if (functionalTags.has('life') || functionalTags.has('mana') || RESOURCES_PATTERN.test(rawText)) return 'resources';
  // 12. Defence-stats
  if (functionalTags.has('armour') || functionalTags.has('evasion') || functionalTags.has('energy_shield') || functionalTags.has('charm') || DEFENCE_STATS_PATTERN.test(rawText)) return 'defence-stats';
  // 13. Weapon-specific
  if (WEAPON_SPECIFIC_PATTERN.test(rawText)) return 'weapon-specific';
  // 14. Crit
  if (functionalTags.has('critical') || CRIT_PATTERN.test(rawText)) return 'crit';
  // 15. Ailments (iter 94: moved BEFORE DAMAGE_TYPE; added `ailment` tag check).
  //    Rationale: mods with `ailment` tag (or matching AILMENTS_PATTERN text) are
  //    functionally about ailments — they should bucket as `ailments`, not `damage-type`.
  //    CRIT (step 14) still wins for crit-ailment mods (e.g., j05iep crit-ailment stays crit).
  //    Verified safe at iter 94: 26 reclassifications, all damage-type → ailments, 0 FPs.
  if (functionalTags.has('ailment') || AILMENTS_PATTERN.test(rawText)) return 'ailments';
  // 16. Damage-type (was step 15)
  if (functionalTags.has('damage') || functionalTags.has('physical') || functionalTags.has('elemental') || functionalTags.has('cold') || functionalTags.has('fire') || functionalTags.has('lightning') || functionalTags.has('chaos') || DAMAGE_TYPE_PATTERN.test(rawText)) return 'damage-type';
  // 17. Offence-speed
  if (functionalTags.has('speed') || OFFENCE_SPEED_PATTERN.test(rawText)) return 'offence-speed';
  // 18. Area / Duration
  if (AREA_DURATION_PATTERN.test(rawText)) return 'area-duration';
  // 19. Rage-charges
  if (RAGE_CHARGES_PATTERN.test(rawText)) return 'rage-charges';
  // 20. Meta-skills
  if (META_SKILLS_PATTERN.test(rawText)) return 'meta-skills';
  // 21. Buff-skills
  if (BUFF_SKILLS_PATTERN.test(rawText)) return 'buff-skills';
  // 22. Fallback
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

  // Two-pass approach (iter 92):
  // Pass 1: collect all tiers from all pages, split into single-segment and multi-segment.
  // Pass 2: process single-segment tiers first (with tier.tags, which are domain-specific
  //         for single-segment mods), then multi-segment tiers (text-only per segment).
  //         The `has()` check ensures single-segment entries (more authoritative because
  //         tier.tags is domain-specific) take precedence over multi-segment entries
  //         (where tier.tags is the union of all segments' tags, less reliable per-segment).
  interface TierContext {
    page: string;
    group: { origin: string; tags: string[] };
    tier: { modCode: string; descriptionHtml: string; tags: string[] };
  }
  const singleSegmentTiers: TierContext[] = [];
  const multiSegmentTiers: TierContext[] = [];

  for (const page of modCalcPages) {
    try {
      const html = await fetchPage(page.url);
      const groups = parseTypeBPage(html);

      for (const group of groups) {
        for (const tier of group.tiers) {
          if (!tier.modCode) continue;
          const segments = extractTextAndRanges(tier.descriptionHtml);
          if (segments.length === 0) continue;

          const ctx: TierContext = {
            page: page.type,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            group: { origin: (group as any).origin, tags: group.tags },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tier: tier as any,
          };

          if (segments.length === 1) {
            singleSegmentTiers.push(ctx);
          } else {
            multiSegmentTiers.push(ctx);
          }
        }
      }
    } catch (err) {
      console.warn(`  WARNING: Failed to fetch ${page.url}:`, (err as Error).message);
    }
  }

  // Pass 2a: process single-segment tiers first
  for (const ctx of singleSegmentTiers) {
    const tier = ctx.tier;
    const segments = extractTextAndRanges(tier.descriptionHtml);
    if (segments.length !== 1) continue;

    // Single-segment tier: tier.tags is domain-specific, safe to use
    const category = classifyModFunctionalBlock(tier.tags, segments[0].rawText);
    modCodeToCategory.set(tier.modCode, category);

    const normalizedKey = normalizeRawTextForMatching(segments[0].rawTextTemplate);
    if (normalizedKey && !normalizedTextToCategory.has(normalizedKey)) {
      normalizedTextToCategory.set(normalizedKey, category);
    }
  }

  // Pass 2b: process multi-segment tiers (text-only per segment, don't overwrite single-segment entries)
  for (const ctx of multiSegmentTiers) {
    const tier = ctx.tier;
    const segments = extractTextAndRanges(tier.descriptionHtml);

    // Multi-segment tier (iter 92 fix): classify EACH segment separately
    // using text-only classification (skip tier.tags).
    //
    // Rationale: tier.tags is the union of tags from ALL segments
    // (e.g., SpellDamageEvasion tier has tags=[evasion,damage,caster]
    // but segment 1 is about spell damage, segment 2 is about evasion).
    // Using tier.tags for any single segment causes false positives
    // on tag-based checks (e.g., DEFENCE_STATS for spell-damage segment).
    //
    // Text-only classification is more accurate per-segment.
    //
    // Skip modCodeToCategory for multi-segment tiers: the same modCode
    // would map to different categories for different segments, so
    // text-based lookup is the only correct path.
    //
    // Don't overwrite normalizedTextToCategory entries set by single-segment
    // tiers (those are more authoritative because their tier.tags is domain-specific).
    for (const seg of segments) {
      const segCategory = classifyModFunctionalBlock([], seg.rawText);
      const normalizedKey = normalizeRawTextForMatching(seg.rawTextTemplate);
      if (normalizedKey && !normalizedTextToCategory.has(normalizedKey)) {
        normalizedTextToCategory.set(normalizedKey, segCategory);
      }
    }
  }

  console.log(`  ModCalc totals: ${modCodeToCategory.size} modCode mappings, ${normalizedTextToCategory.size} text mappings`);

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
