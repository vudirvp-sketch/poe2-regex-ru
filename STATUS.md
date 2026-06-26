# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 132
> **UI-документация:** `docs/UI_AUDIT.md` (v2) + `docs/UI_REFACTOR_PLAN.md` (план, Phase 1 DONE iter 132) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130 + iter 131 corrections)

---

## Текущее состояние

**iter 132: UI Refactor Phase 1 implementation — foundation готов.**

Phase 1 — это infrastructure-итерация: 5 новых полей `FilterState` + 13 actions
+ URL-сериализация (backward-compat) + 46 тестов. Код UI НЕ тронут (ModList /
FilterChip / CategoryLayout — без изменений). Цель — разблокировать Phases
2/2.5/3/5, которые теперь могут потреблять готовые поля из store.

**Сделано в iter 132:**

1. **`src/store/filter-store.ts` расширено** — добавлено 5 новых полей в
   `FilterState` (без удаления/изменения существующих полей):
   - `collapsedGroups: Set<string>` — top-level group keys currently COLLAPSED.
     Формат: `${categoryId}:${affix}` (e.g. `waystone:prefix`). Default empty
     = all top-level groups EXPANDED (per iter 131 §13.7 correction #4).
   - `expandedSubGroups: Set<string>` — sub-group keys currently EXPANDED.
     Формат: `${categoryId}:${affix}:${subBlockKey}`. Default empty = all
     sub-groups COLLAPSED (asymmetric default per §13.7 #4 — «Это даст
     намного более чистый первый экран»).
   - `showSelectedOnly: boolean` — hide non-selected chips. Default false.
   - `pinnedIds: Set<string>` — favorited token IDs (Phase 5 favorites).
   - `chipExpandState: Set<string>` — sub-group keys with chips fully
     expanded (Phase 2.5 «+N ещё»). Default empty = all sub-groups show
     truncated preview.

2. **`FilterActions` расширено 13 новыми action'ами:**
   - Top-level collapse: `toggleGroupCollapsed`, `setGroupCollapsed`,
     `expandAllGroups`, `collapseAllGroups(keys)`.
   - Sub-group expand: `toggleSubGroupExpanded`, `setSubGroupExpanded`,
     `expandAllSubGroups(keys)`, `collapseAllSubGroups`.
   - Show-selected-only: `setShowSelectedOnly(value)`.
   - Favorites: `togglePinned(id)`, `clearPinned`.
   - Chip expand (Phase 2.5): `toggleChipExpand(key)`, `setChipExpand(key, expanded)`,
     `expandAllChips(keys)`, `collapseAllChips`.

3. **URL-сериализация расширена (backward-compat):**
   - `serialize()` — добавлены 5 compact keys: `c` (collapsedGroups array),
     `es` (expandedSubGroups array), `so` (showSelectedOnly flag = 1),
     `pn` (pinnedIds array), `ce` (chipExpandState array). Каждый key
     OMITTED когда поле в default-состоянии — URL остаётся компактным.
   - `deserialize()` — backward-compat: отсутствующие keys → defaults
     (старые URLs из iter 0-131 работают без изменений). Defensive parsing:
     malformed/non-array values → empty set (no crash); non-string entries
     в array отфильтрованы; `so` принимает и `1` (compact), и `true`
     (verbose) — оба дают `showSelectedOnly=true`.
   - `resetFilters()` теперь сбрасывает и 5 новых полей к defaults.
   - `clearSelections()` НЕ трогает новые поля — это разные scope'ы
     (selections = transient, collapse/pinned/chipExpand = user prefs).

4. **`tests/store/filter-store.test.ts` (NEW, 46 тестов)** — 9 describe blocks:
   - Initial state (5 полей с correct defaults + smoke test на existing fields).
   - Asymmetric default state (iter 131 §13.7 #4): top EXPANDED + sub COLLAPSED.
   - Actions для каждого из 5 полей (toggle/set/expand-all/collapse-all,
     immutability checks).
   - Serialize → Deserialize round-trip для каждого поля individually + all 5
     вместе с existing fields.
   - Backward-compat: URL только со old keys → defaults (no crash), empty
     object → defaults, malformed values → defaults (defensive), non-string
     entries filtered, `so` accepts both `1` and `true`.
   - Compact serialization: 5 отдельных тестов что каждый key omitted когда
     default + 1 тест что default state = minimal object (no Phase 1 keys).
   - `resetFilters()` resets 5 new fields.
   - `clearSelections()` preserves Phase 1 fields (different scope).
   - Store isolation: two stores не делят Phase 1 state, deserializing one
     не влияет на другой.

5. **`docs/UI_REFACTOR_PLAN.md` обновлено** — header status, §11 How to Start,
   §12 Phase Status (Phase 1 → ✅ DONE iter 132), §13.6 Recommendation → iter 133.

6. **Документация актуализирована:** STATUS.md (этот файл), worklog.md,
   AGENT_NAVIGATION.md (header summary + Pitfall 42), README.md.

### Проверки (iter 132)

- **vitest:** 2034/2034 tests passed (42 test files). Was 1988 in iter 131 →
  **+46 new tests** (all in `tests/store/filter-store.test.ts`).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **UI код НЕ изменён** — только `src/store/filter-store.ts` (extended, no
  breaking changes) + 1 new test file.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай. Mitigation: расширить `distributeAlternation` при FP.

### Закрытые KI (краткая справка)

- **KI#7** (iter 121 → VERIFIED iter 129): HomePage hero decorations.
- **KI#8** (iter 122 → VERIFIED iter 129): SeoBlock atmosphere backdrop.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 → DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы в waystone-аффиксах.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone (вся quoted group) | ✅ | in-game verified (iter 15) |
| `prefix (A\|B\|C)%.*suffix` (`()` после literal+space) | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` (`()` после `^`) | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` (`()` ПОСЛЕ `.*` bridge) | ❌ | iter 125 — игнорируется in-game. Fix: Path D distribution |
| Ambiguous suffix → multi-implicit FP | ✅ | iter 126 VERIFIED iter 127. Fix: более specific suffix |
| `.*` cross-block/line boundaries | ✅ | iter 127 VERIFIED — `.*` НЕ пересекает lines/blocks |
| Single-`#` template → tier-hardcoded regex (FN) | ✅ | iter 127. Fix: explicit override |
| BTS-статы в waystone-аффиксах (FP clutter) | ✅ | iter 128. Fix: расширить `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` + добавить implicit `Редкость монстров` |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Next iteration (iter 133)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` end-to-end, особенно
§12 (Phase Status — Phase 1 ✅ DONE), §13 (iter 130 visualization audit)
AND §13.7 (iter 131 user feedback corrections). Затем
`docs/UI_VISUALIZATION_AUDIT.md` — user-approved visual target (note §8
iter 131 corrections).

**Рекомендованный старт:** Phase 2 (collapsible affix groups + sticky
search). Phase 2 потребляет `collapsedGroups` (top-level) +
`expandedSubGroups` (sub-group) — оба поля уже в store с toggle/set/
expand-all/collapse-all actions. Phase 2 wires UI в `ModList.tsx` +
`VirtualizedModList.tsx` + новый shared `GroupHeader.tsx`.

**Главные ограничения для iter 133:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Phase 2.5 зависит от Phase 2 — sub-group collapse должен существовать
  в UI до per-sub-group chip truncation. Но `chipExpandState` поле уже
  готово в store — Phase 2.5 не нуждается в дополнительной
  infrastructure-итерации.
- Phase 3: basket cap = 20 (was 12), 3-column 20%/60%/20% + collapsible
  right panel (§13.7 #2, #3). `showSelectedOnly` поле уже готово.
- Phase 5: left panel order Search → Favorites → Filters (§13.7 #1).
  `pinnedIds` поле уже готово.
- Phase 4 и Phase 4.5 — независимы от Phase 1, можно делать в любой
  итерации как «warmup» работу.

**Подсказка:** для Phase 2 — read `AGENT_NAVIGATION.md` Pitfall 42
(Phase 1 foundation) для понимания, какие actions доступны в store.
Затем смотри `ModList.tsx` / `VirtualizedModList.tsx` чтобы понять,
где рендерятся `AffixColumn` (top-level) и `ModSubGroupSection`
(sub-group) headers — туда добавится chevron + collapse logic.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**
