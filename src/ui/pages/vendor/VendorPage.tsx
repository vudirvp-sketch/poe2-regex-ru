/**
 * VendorPage — Vendor regex filter for the Russian game client.
 *
 * Layout v4 (iter 59): Uses <CategoryLayout> with mobileBar slot —
 * 2-column desktop (controls + FilterChip groups on left, sticky RegexOutput
 * on right), 1-column mobile (status below ModList, RegexOutput + verification
 * alert in sticky bottom-bar via <MobileRegexBar>).
 *
 * Vendor-specific notes:
 * - No <PageStateWrapper>: vendor data is built synchronously via
 *   buildVendorCategoryData() (no async loading/error state).
 * - No <ProfilePanel>: vendor has no profile system. `sidebar` slot is
 *   left empty — RegexOutput is the only right-column content.
 * - clearButton slot: a "Clear (N)" button is rendered inside
 *   <CategoryControlPanel> when tokens are selected.
 * - Verification note: rendered in StatusPanel (desktop) and inside
 *   MobileRegexBar (mobile) — a final in-game verification reminder.
 *
 * The hardcoded Russian regex strings in VENDOR_PROPERTIES are OK —
 * vendor properties are NOT mod-based and don't come from ETL data.
 * The plan's invariant I4 targets mod strings from ETL, not vendor labels.
 */
import { useMemo, useCallback } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { buildVendorCategoryData } from '@data/vendor-adapter';
import { FilterChip } from '@ui/components/FilterChip';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { RegexOutput } from '@ui/components/RegexOutput';
import { StatusPanel } from '@ui/components/StatusPanel';
import { MobileRegexBar } from '@ui/components/MobileRegexBar';
import { CategoryLayout } from '@ui/layout/CategoryLayout';
// iter 144 (KI#33): FavoritesIndicator + ⭐ pin slot support for vendor page.
// VendorPage previously used custom FilterChip without ⭐ pin slot — favorites
// gap was known since iter 136 (Phase 5), deferred. KI#33 closes this gap by
// reusing the same FavoritesIndicator + KI#30 localStorage wiring as the
// other 7 category pages.
import { FavoritesIndicator } from '@ui/components/FavoritesIndicator';
import { groupTokensByFamily } from '@shared/family-grouper';
import { t } from '@shared/i18n';
import type { FamilyGroup } from '@shared/types';

// ─── Group order for consistent display ───

const GROUP_ORDER = [
  'Свойства предмета',
  'Скорость',
  'Скорость передвижения',
  'Сопротивления',
  'Модификаторы',
  'Умения',
  'Характеристики',
  'Уровень',
  'Редкость предмета',
  'Класс — Украшения',
  'Класс — Оружие 1H',
  'Класс — Оружие 2H',
  'Класс — Экипировка',
  'Класс — Оффхэнд',
];

// ─── Group color config for visual differentiation ───
// Derived from the group tag on each token (tags: [group:${groupName}])

const GROUP_COLORS: Record<string, { header: string; border: string }> = {
  'Свойства предмета':    { header: 'text-muted',          border: 'border-l-bl-gray' },
  'Скорость':             { header: 'text-accent-yellow',   border: 'border-l-bl-yellow' },
  'Скорость передвижения':{ header: 'text-accent-yellow',   border: 'border-l-bl-yellow' },
  'Сопротивления':        { header: 'text-accent-blue',     border: 'border-l-bl-blue' },
  'Модификаторы':         { header: 'text-accent-red',      border: 'border-l-bl-red' },
  'Умения':               { header: 'text-accent-purple',   border: 'border-l-bl-purple' },
  'Характеристики':       { header: 'text-accent-teal',     border: 'border-l-bl-green' },
  'Уровень':              { header: 'text-accent-cyan',     border: 'border-l-bl-cyan' },
  'Редкость предмета':    { header: 'text-accent-orange',   border: 'border-l-bl-orange' },
  'Класс — Украшения':    { header: 'text-accent-amber',    border: 'border-l-bl-amber' },
  'Класс — Оружие 1H':   { header: 'text-accent-red',      border: 'border-l-bl-red' },
  'Класс — Оружие 2H':   { header: 'text-accent-red',      border: 'border-l-bl-red' },
  'Класс — Экипировка':  { header: 'text-accent-sky',      border: 'border-l-bl-sky' },
  'Класс — Оффхэнд':     { header: 'text-accent-teal',     border: 'border-l-bl-teal' },
};

/** Extract the group name from a FamilyGroup's member tokens' tags */
function getGroupName(group: FamilyGroup): string {
  const tag = group.members[0]?.tags?.find(t => t.startsWith('group:'));
  return tag ? tag.slice(6) : 'Другое';
}

/** Group FamilyGroups by their group tag, preserving GROUP_ORDER */
function groupFamiliesByGroup(families: FamilyGroup[]): Map<string, FamilyGroup[]> {
  const groups = new Map<string, FamilyGroup[]>();
  for (const family of families) {
    const groupName = getGroupName(family);
    const list = groups.get(groupName) || [];
    list.push(family);
    groups.set(groupName, list);
  }
  // Sort groups by GROUP_ORDER
  const sorted = new Map<string, FamilyGroup[]>();
  for (const groupName of GROUP_ORDER) {
    const list = groups.get(groupName);
    if (list) sorted.set(groupName, list);
  }
  // Add any groups not in GROUP_ORDER
  for (const [groupName, list] of groups) {
    if (!sorted.has(groupName)) sorted.set(groupName, list);
  }
  return sorted;
}

export function VendorPage() {
  const vendorData = useMemo(() => buildVendorCategoryData(), []);
  const state = useCategoryPage({ categoryId: 'vendor', customData: vendorData });

  const {
    data,
    regex, isRegexOverflow, regexParts,
    selectedIds, excludedIds, toggleExclude,
    round10Enabled, setRound10Enabled,
    searchLogic, setSearchLogic,
    thresholdEnabled, setThresholdEnabled,
    toggleTokens, clearSelections,
    perTokenRanges, setTokenRange, clearTokenRange,
    collapsedTokenIds, filterStore,
    // iter 144 (KI#33): favorites (pinned) state + actions — same pattern as
    // other 7 category pages. VendorPage previously didn't wire these — the
    // custom FilterChip (used inline below) had no ⭐ pin slot.
    categoryId,
    pinnedIds, togglePinned,
  } = state;

  // iter 144 (KI#33): Family-level pinned toggle for vendor FilterChip.
  // Same pattern as other 7 pages — toggle ONLY the first member ID per
  // family (iter 141 KI#28 convention: 1 click = 1 favorite).
  // Stable reference via useCallback so React.memo on FilterChip doesn't
  // re-render on every page render.
  const handleTogglePinned = useCallback((ids: string[]) => {
    if (ids.length > 0) togglePinned(ids[0]);
  }, [togglePinned]);

  // Group tokens into FamilyGroups, then sub-group by vendor property group
  // Post-process: for numeric vendor chips, override displayText to avoid
  // duplicate range display (inline range + range badge). Use the raw label
  // (e.g., "Ур. предмета ≥N") instead of the generated text with inline range
  // (e.g., "Ур. предмета ≥(0—1000)").
  // When a min value is set via perTokenRange, replace "≥N" with "≥{value}"
  // in displayText so the chip reflects the actual threshold.
  const groupedFamilies = useMemo(() => {
    if (!data) return new Map<string, FamilyGroup[]>();
    const families = groupTokensByFamily(data.tokens, 'vendor').map(family => {
      if (family.rangeSlots.length > 0 && family.members[0]) {
        const baseText = family.members[0].rawText.ru;
        const memberId = family.members[0].id;
        const rangeOverride = perTokenRanges[memberId];
        const minValue = rangeOverride?.min;
        // Replace ≥N with the actual min value if set
        const displayText = minValue !== undefined && minValue > 0
          ? baseText.replace('≥N', `≥${minValue}`)
          : baseText;
        return {
          ...family,
          displayText,
        };
      }
      return family;
    });
    return groupFamiliesByGroup(families);
  }, [data, perTokenRanges]);

  // Count active tokens
  const allActiveTokens = data?.tokens.filter(tok => selectedIds.has(tok.id) || excludedIds.has(tok.id)) ?? [];
  const excludeCount = data?.tokens.filter(tok => excludedIds.has(tok.id)).length ?? 0;
  /* hasRangedTokens removed in iter 59: global min/max is hidden for vendor
     (no-op setters were misleading). Per-chip range inputs in FilterChip work. */

  // Ranged suffixes for CategoryControlPanel
  const rangedSuffixes = [...new Set(
    allActiveTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
  )];

  return (
    <CategoryLayout
      header={
        <div className="flex items-center justify-between">
          <h2 className="poe-panel-header--inline text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
            <img src={`${import.meta.env.BASE_URL}icons/vendor.png`} alt="" width={24} height={24} className="object-contain" />
            {t('vendor.title')}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dim">
              {selectedIds.size} {t('selected')}
            </span>
            {/* iter 144 (KI#33): FavoritesIndicator for vendor page — same
                pattern as other 7 category pages. ⭐ pin slot on vendor
                FilterChip (below) writes to pinnedIds; this badge opens the
                FavoritesQuickSelectPanel (KI#31 variant d). */}
            {data && (
              <FavoritesIndicator
                pinnedIds={pinnedIds}
                data={data}
                categoryId={categoryId}
                perTokenRanges={perTokenRanges}
                onToggleTokens={toggleTokens}
                onTogglePinned={togglePinned}
                onSetTokenRange={setTokenRange}
              />
            )}
          </div>
        </div>
      }
      controls={
        <CategoryControlPanel
          /* iter 59: hide global min/max inputs — they were no-ops (setMinValue/
             setMaxValue were empty functions). Per-chip range inputs (FilterChip)
             already work for vendor: each "Ур. предмета ≥N" / "Треб. уровень ≥N"
             chip has its own min input. Global slider is misleading UX for vendor
             since each property is semantically different (level vs req-level). */
          hasRangedTokens={false}
          minValue={null}
          setMinValue={() => {}}
          maxValue={null}
          setMaxValue={() => {}}
          rangedSuffixes={rangedSuffixes}
          round10Enabled={round10Enabled}
          setRound10Enabled={setRound10Enabled}
          thresholdEnabled={thresholdEnabled}
          setThresholdEnabled={setThresholdEnabled}
          searchLogic={searchLogic}
          setSearchLogic={setSearchLogic}
          excludedCount={excludeCount}
          activeTokenCount={allActiveTokens.length}
          clearButton={
            selectedIds.size > 0 ? (
              <button
                onClick={clearSelections}
                className="px-2 py-1 bg-raised border border-edge rounded text-xs text-soft hover:bg-chip-hover transition-colors"
              >
                {t('filter.clear')} ({selectedIds.size})
              </button>
            ) : undefined
          }
        />
      }
      regexOutput={
        <RegexOutput
          regex={regex}
          isOverflow={isRegexOverflow}
          regexParts={regexParts}
          filterStore={filterStore}
          activeTokenCount={allActiveTokens.length}
        />
      }
      status={
        <StatusPanel
          wantTokens={data?.tokens.filter(tok => selectedIds.has(tok.id)) ?? []}
          excludeTokens={data?.tokens.filter(tok => excludedIds.has(tok.id)) ?? []}
          allActiveTokens={allActiveTokens}
          alerts={[
            <div className="bg-section-yellow border border-aborder-yellow rounded p-3 text-xs text-accent-yellow-dim" role="alert">
              <strong>{t('vendor.verification')}</strong>
            </div>
          ]}
        />
      }
      mobileBar={
        <MobileRegexBar
          regexOutput={
            <RegexOutput
              regex={regex}
              isOverflow={isRegexOverflow}
              regexParts={regexParts}
              filterStore={filterStore}
              activeTokenCount={allActiveTokens.length}
            />
          }
          alerts={[
            <div className="bg-section-yellow border border-aborder-yellow rounded p-3 text-xs text-accent-yellow-dim" role="alert">
              <strong>{t('vendor.verification')}</strong>
            </div>
          ]}
        />
      }
    >
      {/* Chip-based property groups */}
      <div className="flex flex-col gap-3">
        {Array.from(groupedFamilies.entries()).map(([groupName, families]) => {
          const colors = GROUP_COLORS[groupName] ?? { header: 'text-muted', border: 'border-l-bl-gray' };
          return (
            <div key={groupName}>
              <div className={`text-[12px] font-semibold uppercase tracking-wider mb-1 ${colors.header}`}>
                ── {groupName} ({families.length}) ──
              </div>
              <div className="flex flex-wrap gap-1.5">
                {families.map(family => (
                  <FilterChip
                    key={family.familyKey}
                    group={family}
                    selectedIds={selectedIds}
                    excludedIds={excludedIds}
                    onToggleTokens={toggleTokens}
                    onToggleExclude={toggleExclude}
                    perTokenRanges={perTokenRanges}
                    onSetTokenRange={setTokenRange}
                    onClearTokenRange={clearTokenRange}
                    collapsedTokenIds={collapsedTokenIds}
                    // iter 144 (KI#33): ⭐ pin slot — same Phase 5 wiring as
                    // other 7 category pages. VendorPage previously didn't
                    // pass these props, so FilterChip rendered WITHOUT the
                    // ⭐ icon button (Phase 5 backward-compat: omitted props
                    // = no ⭐ slot).
                    pinnedIds={pinnedIds}
                    onTogglePinned={handleTogglePinned}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification note is now rendered via StatusPanel alerts slot */}
    </CategoryLayout>
  );
}
