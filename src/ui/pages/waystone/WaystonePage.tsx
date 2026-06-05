/**
 * WaystonePage — Full working category page for Waystones.
 *
 * Waystones have specific features:
 * - Tier filter (min tier) → RANGE(tierMin, undefined, "р ")  (Cyrillic р for RU client "Тир")
 * - Corrupted → literal("оскверн")  (matches "Осквернено" in RU client)
 * - Uncorrupted → exclude(literal("оскверн"))
 * - Delirious → literal("делир")  (matches "Делириум" in RU client)
 * - Quantifiers (IIQ, IIR, Pack Size) with minimum value filters
 *
 * ⚠️ NOTE: The regex strings "оскверн", "делир", and suffix "р " are for the
 * Russian game client. These were derived from game text analysis and need
 * in-game verification. If they don't work, alternatives:
 *   - "оскверн" → "осквер" or full "Осквернено"
 *   - "делир" → "Делириу" or "Делириум"
 *   - "р " (Cyrillic) → "тир" if suffix matching doesn't work
 */
import { useState, useMemo } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { t } from '@shared/i18n';
import { literal, exclude, range } from '@core/ast';
import type { ASTNode } from '@shared/types';

export function WaystonePage() {
  // Waystone-specific state
  const [tierMin, setTierMin] = useState<number | null>(null);
  const [corrupted, setCorrupted] = useState(false);
  const [uncorrupted, setUncorrupted] = useState(false);
  const [delirious, setDelirious] = useState(false);

  // Build waystone-specific extra AST nodes from toggles
  const extraAstNodes = useMemo<ASTNode[]>(() => {
    const nodes: ASTNode[] = [];

    // Tier: RANGE(tierMin, undefined, "р ") — Cyrillic "р" + space
    // In the RU client, waystone tier is displayed as "Тир: N".
    // The suffix "р " matches the end of "тир" (case-insensitive search).
    if (tierMin !== null && tierMin > 0) {
      nodes.push(range(tierMin, undefined, 'р '));
    }

    // Corrupted → literal("оскверн")
    // Matches the red "Осквернено" text at the bottom of corrupted items in the RU client.
    // "оскверн" is the shortest unique substring that distinguishes "Осквернено"
    // from other item text. Needs in-game verification.
    if (corrupted) {
      nodes.push(literal('оскверн'));
    }

    // Uncorrupted → exclude(literal("оскверн"))
    if (uncorrupted) {
      nodes.push(exclude(literal('оскверн')));
    }

    // Delirious → literal("делир")
    // Matches the "Делириум" indicator on delirious waystones in the RU client.
    // "делир" is the shortest unique substring. Needs in-game verification.
    if (delirious) {
      nodes.push(literal('делир'));
    }

    return nodes;
  }, [tierMin, corrupted, uncorrupted, delirious]);

  const {
    data, loading, error,
    regex, isRegexOverflow,
    excludeMode, setExcludeMode,
    round10Enabled, setRound10Enabled,
    minValue, setMinValue,
    selectedIds, searchText, affixFilter, originFilter,
    toggleToken, setSearchText, setAffixFilter, setOriginFilter, clearSelections,
    categoryId, filterStore, restoreFilterState,
  } = useCategoryPage({ categoryId: 'waystone', extraAstNodes });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2" />
          <p className="text-sm">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-300 text-sm">
          Ошибка загрузки: {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-4 text-gray-500">Нет данных</div>;

  const selectedTokens = data.tokens.filter(tok => selectedIds.has(tok.id));
  const hasRangedTokens = selectedTokens.some(tok => tok.ranges.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
          {t('waystone.title')}
        </h2>
        <span className="text-xs text-gray-500">{data.tokens.length} модов</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div>
          <ModList
            tokens={data.tokens} selectedIds={selectedIds} searchText={searchText}
            affixFilter={affixFilter} originFilter={originFilter}
            onToggleToken={toggleToken} onSearchChange={setSearchText}
            onAffixFilterChange={setAffixFilter} onOriginFilterChange={setOriginFilter}
            onClearSelections={clearSelections}
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* Waystone Tier Filter */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Тир путевого камня</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Мин. тир:</span>
              <input
                type="number" min={1} max={16}
                value={tierMin ?? ''}
                onChange={(e) => setTierMin(e.target.value === '' ? null : parseInt(e.target.value, 10) || null)}
                placeholder="Любой"
                className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              {tierMin !== null && (
                <span className="text-[10px] text-gray-600">
                  ≥{tierMin} тир → "р " в regex
                </span>
              )}
            </div>
          </div>

          {/* State toggles */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Состояние</div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={corrupted}
                  onChange={(e) => { setCorrupted(e.target.checked); if (e.target.checked) setUncorrupted(false); }}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500" />
                <span className="text-xs text-gray-300">Осквернён <span className="text-gray-600">(оскверн)</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={uncorrupted}
                  onChange={(e) => { setUncorrupted(e.target.checked); if (e.target.checked) setCorrupted(false); }}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-green-500" />
                <span className="text-xs text-gray-300">Неосквернён <span className="text-gray-600">(!оскверн)</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={delirious}
                  onChange={(e) => setDelirious(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500" />
                <span className="text-xs text-gray-300">Делириум <span className="text-gray-600">(делир)</span></span>
              </label>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Режим выбора модов</div>
            <div className="flex gap-2">
              <button onClick={() => setExcludeMode(false)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${!excludeMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Хочу
              </button>
              <button onClick={() => setExcludeMode(true)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${excludeMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Не хочу
              </button>
            </div>
          </div>

          {/* Min value filter */}
          {hasRangedTokens && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-2">Мин. значение (≥N)</div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} value={minValue ?? ''}
                  onChange={(e) => setMinValue(e.target.value === '' ? null : parseInt(e.target.value, 10) || null)}
                  placeholder="Нет"
                  className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-gray-500">
                  {minValue !== null ? `Число ≥${minValue} + суффикс` : 'Только суффикс'}
                </span>
              </div>
            </div>
          )}

          {/* Round10 */}
          {hasRangedTokens && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={round10Enabled} onChange={(e) => setRound10Enabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500" />
                <span className="text-xs text-gray-300">{t('round10')}</span>
              </label>
            </div>
          )}

          <RegexOutput regex={regex} isOverflow={isRegexOverflow} filterStore={filterStore} />

          <ProfilePanel
            category={categoryId}
            currentFilterData={filterStore.serialize()}
            onRestore={restoreFilterState}
          />

          {(selectedTokens.length > 0 || tierMin !== null || corrupted || uncorrupted || delirious) && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">
                Выбрано: {selectedTokens.length} мод(ов)
                {tierMin !== null && ` + тир ≥${tierMin}`}
                {corrupted && ' + оскверн.'}
                {uncorrupted && ' + неоскверн.'}
                {delirious && ' + делириум'}
              </div>
              {selectedTokens.length > 0 && (
                <div className="text-[10px] text-gray-600">
                  {excludeMode ? 'Исключить' : 'Включить'}: {selectedTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
