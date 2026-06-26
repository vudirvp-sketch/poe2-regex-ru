# UI Visualization Audit — iter 130

> **Source:** User-provided mockup (`ChatGPT Image 26 июн. 2026 г., 22_39_08.png`).
> **Purpose:** Capture the user-approved visual target for the UI refactor so
> subsequent iterations (iter 131+) can implement against a single reference.
> **Status:** Reference document — supersedes conflicting recommendations in
> `docs/UI_AUDIT.md` §10 (TopNav) and `docs/UI_REFACTOR_PLAN.md` Phase 5
> (TopNav dropdowns + favorites placement). See plan §13 for delta.

---

## 1. Layout (3-column)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TopNav (flat — 9 items, no dropdowns)                                   │
├─────────────────────────┬──────────────────────────┬────────────────────┤
│  LEFT (filters)         │  CENTER (mod list)       │  RIGHT (basket)    │
│                         │                          │                    │
│  • Category title       │  ▼ ИМПЛИСИТЫ (5)         │  Выбрано: 3        │
│    + total count        │    ▼ ДОБЫЧА (2)          │  Очистить все      │
│  • 🔍 Search + count    │      [⭐ chip ⓘ ✗]      │  ─────────────     │
│  • ⭐ Избранные (N)     │      [⭐ chip ⓘ ✗]      │  ИМПЛИСИТ chip     │
│    [⭐ chip ✗]          │    ▼ УСИЛЕНИЯ (3)        │  ПРЕФИКС  chip     │
│    [⭐ chip ✗]          │      [⭐ chip ⓘ ✗]      │  СУФФИКС  chip     │
│    Очистить             │  ▼ ПРЕФИКСЫ (34)         │  ─────────────     │
│  • Все / Любой (ИЛИ)    │    ▶ ДОБЫЧА (3)          │  [Все] [Только     │
│  • Приоритет: ▼         │    ▼ МЕХАНИКИ (13)       │       выбранные    │
│  • Сортировка: ▼        │      [chip] +10 ещё      │       (3)]         │
│  • ☐ Осквернён          │    ▼ РАЗМЕР ГРУПП (7)    │  ─────────────     │
│  • ☐ Неосквернён        │      [⭐ chip ⓘ ✗]      │  Регулярное        │
│  • ☐ Делириум           │        +4 ещё            │  выражение         │
│                         │  ▼ СУФФИКСЫ (34)         │  [Авто] [Копировать]│
│                         │    ...                   │  ─────────────     │
│                         │                          │  ▼ Профиль         │
│                         │                          │  ─────────────     │
│                         │                          │  Обозначения:      │
│                         │                          │   ★ — в избранное  │
│                         │                          │   — — добавить     │
│                         │                          │   ⓘ — подсказка    │
└─────────────────────────┴──────────────────────────┴────────────────────┘
```

---

## 2. Element Inventory

### Left panel (filters)
| Element | Notes |
|---------|-------|
| Category title + total count | e.g. «Путевые камни / 188 аффиксов» — preserve existing |
| Search input | placeholder «Поиск аффиксов...» + 🔍 + «Найдено: N» |
| **⭐ Избранные аффиксы (N)** | Section ABOVE search; chips with ⭐ + ✗; «Очистить» button |
| Filter type buttons | «Все (N)» / «Любой (ИЛИ)» — already exists |
| Приоритет dropdown | «Все» / «S+A» / «S» — already exists (`priorityFilter`) |
| Сортировка dropdown | «По алфавиту» / «По приоритету» — already exists (`sortMode`) |
| Checkboxes | Осквернён / Неосквернён / Делириум — already exists |

### Center (mod list)
| Element | Notes |
|---------|-------|
| **ИМПЛИСИТЫ (5)** collapsible header | Brown bg, chevron ▼/▶, count in parentheses |
| **ПРЕФИКСЫ (34)** collapsible header | Blue bg, chevron, count |
| **СУФФИКСЫ (34)** collapsible header | Red bg, chevron, count |
| Sub-group headers (ДОБЫЧА, УСИЛЕНИЯ, МЕХАНИКИ, ...) | Green text, chevron, count |
| **Chip pattern: `⭐ text ⓘ ✗`** | Star pin (left) + text + info tooltip + exclude (right) |
| **`+N ещё` expander** | Per sub-group: shows first chip + button to expand remaining N |

### Right panel (basket + output)
| Element | Notes |
|---------|-------|
| «Выбрано: N» header + «Очистить все» link | Above basket list |
| Selected chips with affix-type badges | Each chip prefixed with colored «ИМПЛИСИТ» / «ПРЕФИКС» / «СУФФИКС» label |
| Toggle: «Все аффиксы» / «Только выбранные (N)» | Above regex output |
| Regex output with «Авто» + «Копировать» | Already exists |
| «Профиль» collapsible | Already exists (ProfilePanel) |
| **«Обозначения»** legend section | ★ / — / ⓘ icon meanings |

### TopNav
**FLAT list — no dropdowns.** 9 items: Главная / Путевые камни / Башни Предтеч / Реликвии / Самоцветы / Торговец / Пояса / Кольца / Амулеты. Discord link on right.

---

## 3. Color Coding (categories)

| Category | Background | Border | Text accent |
|----------|-----------|--------|-------------|
| Implicit | Dark brown / amber-orange | Orange | Orange |
| Prefix | Dark blue | Blue | Blue |
| Suffix | Dark red / burgundy | Red | Red |
| Sub-group header | — | — | Green text |
| Selected chip | `bg-chip-active` (existing token) | tier or affix color | Bright |
| Star icon (favorited) | — | — | Gold (★) |

**Existing tokens that align:** `--accent-blue` (prefix), `--accent-cyan`, `--accent-orange` (suffix), `--poe-gold` (implicit/star), `--bl-*` family. Plan Phase 4 specifies `rgba(37,99,235,0.06)` / `rgba(194,65,12,0.06)` / `rgba(245,158,11,0.08)` tints — matches visualization.

---

## 4. Key UX Patterns

1. **Progressive disclosure:** Category → Sub-group → Chip → "+N ещё" — four-level progressive disclosure. User expands only what they're working on.
2. **Selection state is persistent:** Selected chips appear in three places simultaneously — in the mod list (highlighted), in the basket (with affix-type label), and in the regex output. No hidden state.
3. **Favorites are a shortcut, not a filter:** ⭐ doesn't hide non-favorited items; it surfaces them at the top of the left panel for quick re-selection.
4. **Beginner discoverability:** «Обозначения» legend + ⓘ tooltips explain semantics without modal help.

---

## 5. Conflicts with `docs/UI_AUDIT.md` (v2)

| Audit point | Recommendation | Visualization | Resolution |
|-------------|----------------|---------------|------------|
| §10 TopNav dropdowns | Group 9 items into 3 dropdowns | Flat nav preserved | **Visualization wins** — drop TopNav dropdowns from plan |
| §9 Weight (S/A/B/C) | Add stars or S/A/B/C badges | Uses existing priority dropdown + tier-colored borders | **Already implemented** — no new work |
| §3 Favorites placement | "Block at top of page" | Top of LEFT panel, above search | **Visualization wins** — move Phase 5 favorites to left panel |

---

## 6. Files Touched by Visualization (cross-ref)

| Visualization feature | Plan phase | Files |
|------------------------|-----------|-------|
| Collapsible category headers (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) | Phase 2 | `ModList.tsx`, `VirtualizedModList.tsx`, `GroupHeader.tsx` (NEW) |
| Collapsible sub-group headers (ДОБЫЧА/УСИЛЕНИЯ/...) | Phase 2 | same as above |
| **`+N ещё` per sub-group** | **NEW Phase 2.5** | `ModList.tsx`, `VirtualizedModList.tsx`, `filter-store.ts` (`chipExpandState: Set<string>`) |
| Sticky search | Phase 2 | `ModList.tsx`, `VirtualizedModList.tsx`, `index.css` |
| Selected basket with affix-type badges | Phase 3 | `SelectedBasket.tsx` (NEW) |
| «Все / Только выбранные» toggle | Phase 3 | `CategoryControlPanel.tsx`, `filter-store.ts` |
| Stronger color tints | Phase 4 | `index.css` `.affix-header-*` |
| Compact chips with ⭐ⓘ✗ layout | Phase 4 | `FilterChip.tsx`, `index.css` `.filter-chip` |
| **⭐ favorites in LEFT panel** | Phase 5 (revised) | `LeftPanelFavorites.tsx` (NEW), `CategoryLayout.tsx`, `filter-store.ts` |
| **«Обозначения» legend** | **NEW Phase 4.5** | `IconLegend.tsx` (NEW), `CategoryLayout.tsx` |
| ~~TopNav dropdowns~~ | **REMOVED** | — (visualization keeps flat nav) |

---

## 7. Next Steps (for iter 131+)

1. Read this document + `docs/UI_REFACTOR_PLAN.md` §13 (delta vs visualization).
2. Start with **Phase 1** (foundation: `FilterState` extension with `collapsedGroups`, `showSelectedOnly`, `pinnedIds`, **plus `chipExpandState` for "+N ещё"**).
3. Phase 2 implementation must include the "+N ещё" per-sub-group chip expander.
4. Phase 3 SelectedBasket must render affix-type badges (ИМПЛИСИТ/ПРЕФИКС/СУФФИКС).
5. Phase 5 favorites must render in the LEFT panel above search, NOT in the mod list.
6. TopNav dropdowns — DO NOT IMPLEMENT (visualization keeps flat nav).
