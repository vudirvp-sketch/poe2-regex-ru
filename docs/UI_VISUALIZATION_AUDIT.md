# UI Visualization Audit — iter 130 + iter 131 corrections

> **Source:** User-provided mockup (`ChatGPT Image 26 июн. 2026 г., 22_39_08.png`).
> **Purpose:** Capture the user-approved visual target for the UI refactor so
> subsequent iterations (iter 131+) can implement against a single reference.
> **Status:** Reference document — supersedes conflicting recommendations in
> `docs/UI_AUDIT.md` §10 (TopNav) and `docs/UI_REFACTOR_PLAN.md` Phase 5
> (TopNav dropdowns + favorites placement). See plan §13 for delta.
>
> **iter 131 update:** User reviewed the iter 130 plan and provided 4
> corrections (approved at 8.5/10). These are recorded in §8 below and
> incorporated into `docs/UI_REFACTOR_PLAN.md` §13.7. The mockup itself
> remains the visual target; iter 131 corrections refine placement,
> proportions, and default state — not the visual identity.

---

## 1. Layout (3-column)

> **iter 131 corrections (see §8):** (a) Left panel order is
> **Search → Favorites → Filters** (mockup showed Favorites above Search;
> user reversed it because search is used more often). (b) 3-column
> proportions **20%/60%/20%** (mockup was ambiguous; user refined for
> laptop screens 1440×900). (c) Right `<aside>` gets a **collapse toggle**
> for laptop screens. (d) Default collapse state = top-level expanded,
> sub-groups collapsed (mockup showed all expanded; user refined for
> cleaner first screen).

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TopNav (flat — 9 items, no dropdowns)                                   │
├─────────────────────────┬──────────────────────────┬────────────────────┤
│  LEFT 20% (filters)     │  CENTER 60% (mod list)   │  RIGHT 20% (basket) │
│                         │                          │  [chevron collapse]│
│  • Category title       │  ▼ ИМПЛИСИТЫ (5)         │  Выбрано: 3        │
│    + total count        │    ▶ ДОБЫЧА (2)          │  Очистить все      │
│  • 🔍 Search + count    │      [⭐ chip ⓘ ✗]      │  ─────────────     │
│  • ⭐ Избранные (N)     │      [⭐ chip ⓘ ✗]      │  ИМПЛИСИТ chip     │
│    [⭐ chip ✗]          │    ▶ УСИЛЕНИЯ (3)        │  ПРЕФИКС  chip     │
│    [⭐ chip ✗]          │      (collapsed)         │  СУФФИКС  chip     │
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

**Legend:** ▼ = expanded (default for top-level); ▶ = collapsed (default
for sub-groups, per iter 131 §8 correction #4).

---

## 2. Element Inventory

### Left panel (filters)
| Element | Notes |
|---------|-------|
| Category title + total count | e.g. «Путевые камни / 188 аффиксов» — preserve existing |
| **🔍 Search input** | placeholder «Поиск аффиксов...» + 🔍 + «Найдено: N». **iter 131 §8 #1:** renders FIRST (top of left panel) — user: «Поиск используется в разы чаще» |
| **⭐ Избранные аффиксы (N)** | Section BELOW search, ABOVE filters (iter 131 §8 #1). Chips with ⭐ + ✗; «Очистить» button |
| Filter type buttons | «Все (N)» / «Любой (ИЛИ)» — already exists |
| Приоритет dropdown | «Все» / «S+A» / «S» — already exists (`priorityFilter`) |
| Сортировка dropdown | «По алфавиту» / «По приоритету» — already exists (`sortMode`) |
| Checkboxes | Осквернён / Неосквернён / Делириум — already exists |

**iter 131 §8 #1 final left panel order:** Search → Favorites → Filters.

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
| **Basket chip cap = 20** | iter 131 §8 #3: was 12, raised per user feedback («У вас легко собираются regex на 15–30 модов»). Above 20 → "N more..." expander. |
| **Right `<aside>` collapse toggle** | iter 131 §8 #2: chevron in panel header; collapses to chip-count badge on laptop screens (1440×900 and below). See `UI_REFACTOR_PLAN.md` §7 Q#8 for collapse behavior. |
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
| §3 Favorites placement | "Block at top of page" | Top of LEFT panel (iter 131 refined: BELOW search) | **Visualization wins** (iter 130) — move Phase 5 favorites to left panel. **iter 131 refined:** Search → Favorites → Filters order (user: «Поиск используется в разы чаще»). |

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

## 7. Next Steps (for iter 132+)

1. Read this document (including §8 iter 131 corrections) +
   `docs/UI_REFACTOR_PLAN.md` §13 (iter 130 delta) AND §13.7 (iter 131
   user feedback corrections).
2. Start with **Phase 1** (foundation: `FilterState` extension with 5
   fields — `collapsedGroups`, `expandedSubGroups`, `showSelectedOnly`,
   `pinnedIds`, `chipExpandState`).
3. Phase 2 implementation: default collapse state = top-level expanded,
   sub-groups collapsed (iter 131 §8 #4).
4. Phase 2 implementation must include the "+N ещё" per-sub-group chip
   expander (Phase 2.5).
5. Phase 3 SelectedBasket: cap = 20 (iter 131 §8 #3); 3-column layout
   20%/60%/20% + collapsible right panel (iter 131 §8 #2); affix-type
   badges (ИМПЛИСИТ/ПРЕФИКС/СУФФИКС).
6. Phase 5 favorites: render in LEFT panel BELOW search, ABOVE filters
   (iter 131 §8 #1). NOT in the mod list.
7. TopNav dropdowns — DO NOT IMPLEMENT (visualization keeps flat nav).

---

## 8. User Feedback iter 131 (4 corrections)

> **Trigger:** User reviewed the iter 130 plan and approved it at 8.5/10
> with 4 specific corrections. These are now incorporated into the plan
> (`docs/UI_REFACTOR_PLAN.md` §13.7) and into the layout diagram + element
> inventory above. This section records the corrections for traceability.

| # | Correction | Rationale (user quote) | Affected sections |
|---|------------|------------------------|-------------------|
| 1 | **Left panel order:** Search → Favorites → Filters (was Favorites → Search → Filters). | «Поиск используется в разы чаще» — search is the most-used control, deserves top placement. | §1 layout diagram; §2 Left panel inventory; Phase 5 in plan. |
| 2 | **3-column layout:** 20%/60%/20% (was 25%/50%/25%) + collapsible right `<aside>` for laptop screens (1440×900 and below). | «На 1440×900 или ноутбуках ... может съесть слишком много места. Я бы сделал правую панель уже ... или позволил её сворачивать». | §1 layout diagram; §2 Right panel inventory; Phase 3 in plan; new §7 Q#8 in plan. |
| 3 | **Basket chip cap:** 20 (was 12). | «У вас легко собираются regex на 15–30 модов». | §2 Right panel inventory; Phase 3 in plan; Risk Register. |
| 4 | **Default collapse state:** top-level expanded, sub-groups collapsed (was ALL EXPANDED). | «Имплиситы — открыты, Префиксы — открыты, Суффиксы — открыты. Подгруппы внутри — свернуты. Это даст намного более чистый первый экран». | §1 layout diagram (▼ vs ▶); Phase 1 + Phase 2 in plan; §7 Q#1 RESOLVED. |

**User overall verdict:** «Если оценивать как roadmap для репозитория —
8.5/10. Главное: план уже не выглядит как набор косметических правок. Он
реально решает проблему перегруженности интерфейса и хорошо совпадает с
утверждённой визуализацией».

**What did NOT change in iter 131:** visual identity (PoE2 dark-fantasy
palette), TopNav (flat — no dropdowns), chip pattern (⭐ text ⓘ ✗),
"+N ещё" progressive disclosure, «Обозначения» legend, affix-type badges
on basket chips. iter 131 only refined placement, proportions, defaults.
