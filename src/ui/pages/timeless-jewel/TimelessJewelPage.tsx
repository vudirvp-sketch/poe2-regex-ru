/**
 * TimelessJewelPage — iter 176 — NEW. iter 178: icon + MobileRegexBar polish.
 * iter 183: state-features — URL-sync + ProfilePanel + AtlasSelectedBasket.
 *
 * Generates Atlas-tree search regexes for the 2 Timeless Jewels:
 *   - Вечная ненависть (Undying Hate) — 35 nodes
 *   - Трагедия героев (Heroic Tragedy) — 40 nodes
 *
 * ## Why a separate page (not /jewel)
 *
 *   Atlas tree search uses a different regex dialect than item search
 *   (verified in-game iter 175 — see STATUS.md "Atlas-семантика"):
 *     - multi-word OR `"А Б\|В Г"` ✅ (item search: ❌)
 *     - AND / NOT ❌ (item search: ✅)
 *
 *   Mixing the two in `/jewel` would force the existing regex engine to
 *   branch on category — high regression risk. A dedicated page with a
 *   trivial OR-only builder keeps `/jewel` untouched.
 *
 * ## iter 178 changes
 *
 *   - Header icon: `icons/jewel.png` → `icons/timeless-jewel.png` (dedicated
 *     icon — visually distinct from /jewel category; user-provided 128×128 RGBA).
 *   - MobileRegexBar integration: on mobile (< lg) the RegexOutput now
 *     renders in a sticky-bottom bar (same pattern as other category pages
 *     via `CategoryLayout`'s `mobileBar` slot). On desktop the layout is
 *     unchanged — RegexOutput stays in the right aside. RegexOutput is
 *     mounted in BOTH places (mobile bar + desktop aside); each instance
 *     has its own transient copy/share state but the rendered `regex`
 *     string is the same. This mirrors the MobileRegexBar tradeoff
 *     documented in `MobileRegexBar.tsx` header.
 *
 * ## iter 183 changes (state-features)
 *
 *   - **URL-sync**: selection (jewel + node ids) is now persisted in the
 *     URL hash via `#tj=<lz-string>` (see `src/store/atlas-state-sync.ts`).
 *     On mount, the page restores from the URL; on every state change, it
 *     writes back via `replaceState` (no history spam). The `#tj=` prefix
 *     is distinct from filter-store's `#q=` so the two systems don't
 *     misparse each other's hashes when navigating between pages.
 *   - **ProfilePanel**: reused as-is (props `category`, `currentFilterData`,
 *     `onRestore`). Profile data shape = `SerializedAtlasState` (`{ j, s }`).
 *     Saved per profile name in localStorage via `profile-store.ts`. The
 *     same ProfilePanel component as item-category pages — no adapter needed
 *     because ProfilePanel is generic over `currentFilterData` shape.
 *   - **AtlasSelectedBasket**: new minimal component (`AtlasSelectedBasket.tsx`)
 *     renders selected node names as chips above RegexOutput. Click a chip
 *     to deselect. Cap = 20 with «+N ещё» expander (mirrors `SelectedBasket`
 *     cap). Empty state placeholder.
 *
 *   The page still does NOT use `useCategoryPage`, `filter-store`, or any
 *     item-pipeline machinery — the Atlas pipeline stays self-contained
 *     per AGENT_NAVIGATION.md pitfall #28.
 *
 * ## UI shape (iter 183)
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [icon] Вневременные самоцветы   [Вечная ненависть] [Трагедия…]│
 *   │ N of M нод · ⟨info: Atlas OR-only⟩                          │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ AtlasNodeList (left)         │ AtlasSelectedBasket (right)    │
 *   │   search + checkboxes        │ RegexOutput (sticky)           │
 *   │   icon + name + description  │   "Name1|Name2|..."            │
 *   │                              │   250-char health bar          │
 *   │                              │   ⚠ Atlas semantics notice      │
 *   │                              │ ProfilePanel (collapsible)     │
 *   └──────────────────────────────────────────────────────────────┘
 *   Mobile (< lg): RegexOutput also rendered in MobileRegexBar (sticky bottom).
 *
 * ## What this page still does NOT do (deferred)
 *
 *   - Cross-tab persistence via localStorage (analog of `poe2:favorites:<cat>`
 *     / `poe2:uistate:<cat>`). When the user navigates to another tab, the
 *     URL hash gets overwritten by the new page — selection is lost. URL
 *     share still works (opening a `#tj=...` link restores). iter 184+.
 *   - Realtime multi-tab sync via `storage` event (analog of KI#30 favorites
 *     sync). iter 184+.
 *
 *   These are deliberate scope cuts to land iter 183 without regression.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAtlasJewelData, getJewelNodes } from '@data/atlas-jewel-loader';
import { AtlasNodeList } from '@ui/components/AtlasNodeList';
import { AtlasSelectedBasket } from '@ui/components/AtlasSelectedBasket';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { MobileRegexBar } from '@ui/components/MobileRegexBar';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { buildAtlasRegex } from '@core/atlas-regex-builder';
import { t } from '@shared/i18n';
import type { AtlasJewelCategoryData, AtlasJewelId } from '@shared/types';
import {
  DEFAULT_ATLAS_JEWEL,
  serializeAtlasState,
  deserializeAtlasState,
  syncAtlasStateToUrl,
  syncAtlasStateFromUrl,
} from '@store/atlas-state-sync';

const JEWEL_OPTIONS: Array<{ id: AtlasJewelId; labelKey: string }> = [
  { id: 'undying-hate', labelKey: 'timeless_jewel.undying_hate' },
  { id: 'heroic-tragedy', labelKey: 'timeless_jewel.heroic_tragedy' },
];

/** Category id used by ProfilePanel (`profile-store.ts` keys profiles by
 *  category — using a fixed string keeps timeless-jewel profiles separate
 *  from item-category profiles). */
const PROFILE_CATEGORY = 'timeless-jewel';

export function TimelessJewelPage() {
  const [data, setData] = useState<AtlasJewelCategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── iter 183: URL-restore on mount (synchronous, before effects) ───
  // Restore jewel + selection from `#tj=...` URL hash. Falls back to defaults
  // when URL has no hash or hash is invalid. Uses useState lazy initializer
  // so the FIRST render shows the restored state (no flash of empty selection).
  const [selectedJewel, setSelectedJewel] = useState<AtlasJewelId>(() => {
    const restored = syncAtlasStateFromUrl();
    return restored?.jewel ?? DEFAULT_ATLAS_JEWEL;
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const restored = syncAtlasStateFromUrl();
    return restored?.ids ?? new Set<string>();
  });

  // ─── Data loading effect (unchanged from iter 178) ───
  useEffect(() => {
    let cancelled = false;
    // Initial state already has loading=true / error=null, so we don't
    // call setLoading/setError synchronously here (avoids the React
    // "set-state-in-effect" lint). The effect runs once on mount; the
    // async resolver calls setLoading(false) on success / failure.
    loadAtlasJewelData()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── iter 183: URL-sync effect ───
  // Skip the first render to avoid overwriting URL-restored values (mirrors
  // the `syncReadyRef` pattern from `useCategoryPage.ts`). On subsequent
  // state changes, serialize + write to URL hash via `replaceState`.
  const syncReadyRef = useRef(false);
  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    syncAtlasStateToUrl(serializeAtlasState(selectedJewel, selectedIds));
  }, [selectedJewel, selectedIds]);

  // Reset selection when switching jewels — ids are namespaced per jewel,
  // so cross-jewel selection would be silently invisible. Clear is the
  // honest UX. (Same behaviour as iter 178 — preserved in iter 183.)
  const handleJewelChange = (jewel: AtlasJewelId) => {
    if (jewel === selectedJewel) return;
    setSelectedJewel(jewel);
    setSelectedIds(new Set());
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!data) return;
    const all = getJewelNodes(data, selectedJewel);
    setSelectedIds(new Set(all.map((n) => n.id)));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  // The visible node list for the currently-selected jewel.
  const nodes = useMemo(
    () => (data ? getJewelNodes(data, selectedJewel) : []),
    [data, selectedJewel],
  );

  // Build the regex from the selected nodes' names.
  const regexResult = useMemo(() => {
    if (!data) return { regex: '', isOverflow: false, regexParts: [] as string[] };
    const selectedNames = nodes
      .filter((n) => selectedIds.has(n.id))
      .map((n) => n.name.ru);
    return buildAtlasRegex(selectedNames);
  }, [data, nodes, selectedIds]);

  const selectedCount = selectedIds.size;

  // ─── iter 183: ProfilePanel integration ───
  // ProfilePanel is generic over `currentFilterData: Record<string, unknown>`
  // and `onRestore: (filterData) => void`. We pass the serialized atlas state
  // (which is `{ j, s }` — a plain JSON object) as currentFilterData, and
  // restore by deserializing on onRestore. No adapter needed.
  const currentFilterData = useMemo(
    () => serializeAtlasState(selectedJewel, selectedIds) as unknown as Record<string, unknown>,
    [selectedJewel, selectedIds],
  );

  const handleRestoreProfile = (filterData: Record<string, unknown>) => {
    const restored = deserializeAtlasState(filterData);
    if (!restored) return;
    setSelectedJewel(restored.jewel);
    setSelectedIds(restored.ids);
  };

  return (
    <PageStateWrapper loading={loading} error={error} data={data}>
      {(data) => (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2
              className="poe-panel-header--inline text-xl font-bold flex items-center gap-2"
              style={{ color: 'var(--poe-gold)' }}
            >
              <img
                src={`${import.meta.env.BASE_URL}icons/timeless-jewel.png`}
                alt=""
                width={24}
                height={24}
                className="object-contain"
              />
              {t('timeless_jewel.title')}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-dim">
                {selectedCount}/{nodes.length} {t('timeless_jewel.nodes_word')}
              </span>
            </div>
          </div>

          {/* Jewel selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-dim">
              {t('timeless_jewel.selector_label')}
            </span>
            {JEWEL_OPTIONS.map((opt) => {
              const jewelData = data.jewels.find((j) => j.id === opt.id);
              const count = jewelData?.nodes.length ?? 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleJewelChange(opt.id)}
                  className={`px-3 py-1 text-sm rounded font-medium transition-colors border ${
                    selectedJewel === opt.id
                      ? 'bg-raised border-accent-amber text-bright'
                      : 'bg-surface border-edge text-soft hover:border-edge-strong hover:text-bright'
                  }`}
                  aria-pressed={selectedJewel === opt.id}
                >
                  {t(opt.labelKey)}
                  <span className="ml-1.5 text-[11px] text-dim">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <hr className="poe-divider--ornate" aria-hidden="true" />

          {/* 2-column grid: list left, regex output right (desktop only).
              iter 178: RegexOutput rendered in two places (desktop aside +
              mobile MobileRegexBar) — same pattern as other category pages
              (see BeltPage.tsx, etc.). Each instance has its own transient
              copy/share state; autoCopy is persisted to localStorage so
              both stay in sync.
              iter 183: AtlasSelectedBasket + ProfilePanel added to the
              right aside (and to the mobile section below). */}
          <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:items-start">
            <div className="flex flex-col gap-2 min-w-0">
              <AtlasNodeList
                nodes={nodes}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
              />
            </div>

            {/* Desktop aside — hidden on mobile via `hidden lg:flex`.
                Mobile gets its own RegexOutput in MobileRegexBar below
                (sticky-bottom). Two separate instances — intentional. */}
            <aside className="hidden lg:flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-1rem)] lg:overflow-auto">
              <AtlasSelectedBasket
                nodes={nodes}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onClear={handleClearAll}
              />
              <RegexOutput
                regex={regexResult.regex}
                isOverflow={regexResult.isOverflow}
                regexParts={regexResult.regexParts}
                filterStore={null}
                activeTokenCount={selectedCount}
              />
              <div
                className="text-[12px] text-dim bg-surface border border-edge rounded p-2 leading-snug"
                role="note"
              >
                <strong className="text-soft">
                  {t('timeless_jewel.atlas_semantics_title')}
                </strong>
                <br />
                {t('timeless_jewel.atlas_semantics_notice')}
              </div>
              <ProfilePanel
                category={PROFILE_CATEGORY}
                currentFilterData={currentFilterData}
                onRestore={handleRestoreProfile}
              />
            </aside>
          </div>

          {/* iter 183: mobile-only section for AtlasSelectedBasket + ProfilePanel
              (kept accessible when aside is hidden on mobile). Same pattern
              as CategoryLayout's mobile section for item-category pages. */}
          <div className="flex flex-col gap-3 lg:hidden">
            <AtlasSelectedBasket
              nodes={nodes}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onClear={handleClearAll}
            />
            <ProfilePanel
              category={PROFILE_CATEGORY}
              currentFilterData={currentFilterData}
              onRestore={handleRestoreProfile}
            />
          </div>

          {/* MobileRegexBar — sticky-bottom on mobile (< lg), hidden on
              desktop. Atlas-semantics notice included as an alert above
              the regex output so mobile users see the OR-only caveat. */}
          <MobileRegexBar
            regexOutput={
              <RegexOutput
                regex={regexResult.regex}
                isOverflow={regexResult.isOverflow}
                regexParts={regexResult.regexParts}
                filterStore={null}
                activeTokenCount={selectedCount}
              />
            }
            alerts={[
              <div
                key="atlas-notice"
                className="text-[12px] text-dim bg-surface border border-edge rounded p-2 leading-snug"
                role="note"
              >
                <strong className="text-soft">
                  {t('timeless_jewel.atlas_semantics_title')}
                </strong>
                <br />
                {t('timeless_jewel.atlas_semantics_notice')}
              </div>,
            ]}
          />
        </div>
      )}
    </PageStateWrapper>
  );
}
