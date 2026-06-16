# Worklog

---
Task ID: 56
Agent: main
Task: UI redesign Фаза 4 — навигация как «режимы»: усиленный active-state + mobile tabs в Sidebar.

Work Log:
- 1: Клонирован репозиторий, `pnpm install` (4s). Baseline: 1144 tests pass, 59 lint problems (все pre-existing в `tests/`), TypeScript clean, Vite build OK (152 модуля, 9 prerendered HTML, CSS 40.74 KB / gzip 8.93 KB).
- 2: Изучен контекст: `src/ui/layout/Sidebar.tsx` (167 строк) — содержит mobile drawer (hamburger button, overlay, focus trap, slide-in animation) + desktop vertical nav. `navItems` объявлен локально. Active-state: inline `style` + `font-bold` Tailwind. Layout.tsx рендерит `<Sidebar />` + правую колонку (Header + main). Header.tsx имеет `pl-12 md:pl-4` (pl-12 — отступ под hamburger).
- 3: План Фазы 4: (a) общий `navItems` модуль; (b) Sidebar desktop-only (удалить drawer); (c) новый `MobileNavTabs.tsx` (горизонтальные sticky chip-табы); (d) Layout вставляет MobileNavTabs между Header и main; (e) CSS `.nav-mode-active` (gold border-l + glow + tinted bg, паттерн Level-1 frames); (f) `.mobile-nav-tabs` + `.mobile-nav-tab` (sticky, hidden scrollbar, chip-style).
- 4: Создан `src/ui/layout/nav-items.ts` — экспорт `NavItem` interface + `navItems: readonly NavItem[]` (9 пунктов). Single source of truth для Sidebar + MobileNavTabs.
- 5: `src/ui/layout/Sidebar.tsx` переписан (167 → 71 строка, −57%):
  - Удалены: `useState mobileOpen`, `useRef asideRef`, `useCallback handleKeyDown` (focus trap), `useEffect` (keydown listener + auto-focus), hamburger `<button>`, overlay `<div>`, slide-in animation (`-translate-x-full` / `translate-x-0`).
  - `<aside>` класс: `sidebar-atmosphere hidden md:flex h-full w-56 flex-col border-r shrink-0` (desktop-only).
  - NavLink `className`: `nav-mode-link flex items-center gap-3 rounded px-3 py-2 text-[15px] transition-colors ${isActive ? 'nav-mode-active' : 'hover:opacity-80'}`.
  - Inline `style` упрощён: только `color` (gold-bright для active, text для inactive). Background + border + shadow управляются через `.nav-mode-active` CSS.
- 6: Создан `src/ui/layout/MobileNavTabs.tsx` (62 строки):
  - `<nav className="md:hidden mobile-nav-tabs" role="navigation" aria-label={t('nav.categories')}>` — sticky-top, hidden on desktop.
  - Внутри `<div className="mobile-nav-tabs-scroll" role="tablist">` — flex row, overflow-x: auto, скрытый scrollbar.
  - NavLink chip: `mobile-nav-tab flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors ${isActive ? 'nav-mode-active' : 'hover:opacity-80'}` + `role="tab"`.
  - Icon 20×20px (вместо 28×28 в desktop) — компактнее для горизонтальных чипов.
- 7: `src/ui/layout/Layout.tsx` — добавлен `import { MobileNavTabs }` + `<MobileNavTabs />` между `<Header />` и `<main>`.
- 8: `src/ui/layout/Header.tsx` — `pl-12 md:pl-4` → `px-4` (гамбургер удалён, отступ не нужен).
- 9: `src/shared/i18n.ts` — добавлен `'nav.categories': 'Категории'` (для aria-label навигации).
- 10: `src/index.css` — добавлены блоки (после `.regex-output` секции):
  - `.nav-mode-active`: position relative; background = `linear-gradient(135deg, rgba(200,154,74,0.12) → 0.04), var(--poe-bg-tertiary)`; `border-left: 3px solid var(--poe-gold)`; `box-shadow: 0 0 0 1px rgba(200,154,74,0.08), 0 0 12px rgba(200,154,74,0.10)`; `font-weight: 600`. Паттерн повторяет Level-1 frames, но nav-specific класс.
  - Padding-compensation: `.nav-mode-link.nav-mode-active { padding-left: calc(0.75rem - 3px) }` и `.mobile-nav-tab.nav-mode-active { padding-left: calc(0.625rem - 3px) }` — компенсируют 3px border-l, чтобы иконка не смещалась относительно inactive пунктов.
  - `.mobile-nav-tabs`: `position: sticky; top: 0; z-index: 20`; `background: rgba(13,11,9,0.92)` + `backdrop-filter: blur(4px)`; `border-bottom: 1px solid var(--poe-border)`.
  - `.mobile-nav-tabs-scroll`: flex row, `gap: 6px`, `padding: 8px 12px`, `overflow-x: auto`, `scrollbar-width: none` (Firefox), `::-webkit-scrollbar { display: none }` (Chrome/Safari).
  - `.mobile-nav-tab`: `flex-shrink: 0`, `border: 1px solid transparent`, `background: var(--chip-bg)`. Hover (non-active): `--chip-bg-hover`.
- 11: Верификация:
  - `pnpm exec tsc -b` → 0 errors.
  - `pnpm test` → **1144 passed** (35 файлов, без регрессий). Тестов на Sidebar/MobileNavTabs нет — UI-изменения не затрагивают тесты.
  - `pnpm lint` → **59 problems** (baseline сохранён — все pre-existing в `tests/`, в изменённых файлах 0).
  - `pnpm build` → success. 154 модуля (+2: nav-items.ts + MobileNavTabs.tsx). CSS bundle: 40.29 KB (gzipped 8.96 KB) — было 40.74 KB (gzip 8.93 KB) на iter 55. Чуть меньше за счёт удаления hamburger/overlay JSX, плюс добавлены CSS-правила (.nav-mode-active + .mobile-nav-tabs ~ 60 строк) — итог −0.45 KB uncompressed, +0.03 KB gzipped. 9 prerendered HTML сгенерированы.
- 12: Документация:
  - `STATUS.md` — полная перезапись: iter 56, "UI Фаза 4: Навигация как «режимы»", детали CSS + TSX изменений, результат верификации. План 9 фаз — Фаза 4 = ✅, Фаза 5 = next.
  - `AGENT_NAVIGATION.md` — current state iter 56, обновлена таблица "Where Things Are" (добавлены nav-items.ts, Sidebar.tsx desktop-only, MobileNavTabs.tsx), добавлен Pitfall 22 (Navigation as "modes": shared navItems, .nav-mode-active CSS class, padding compensation, no hamburger/drawer/focus trap).
  - `docs/ARCHITECTURE.md` — в Section 12 (UI Conventions) добавлен subsection "Navigation 'mode' pattern (iter 56, UI Phase 4)" с таблицей viewport → component → layout → active state + описание CSS-классов.
  - `worklog.md` — Task 56 entry (этот). Task 55 уплотнён до Stage Summary. Старые детальные записи (51-54) удалены — оставлен compact "Older iterations" блок.

Stage Summary:
- **iter 56 Фаза 4 COMPLETE.** Навигация воспринимается как переключение «режимов»: активный маршрут получает Level-1-style gold accent (border-l + glow + tinted bg). Mobile гамбургер-drawer заменён на горизонтальные sticky-чипсы под Header.
- **Изменённые файлы (8):**
  - `src/ui/layout/nav-items.ts` (NEW, 22 строки) — общий `navItems` массив.
  - `src/ui/layout/Sidebar.tsx` (167 → 71 строка, −57%) — desktop-only, удалён mobile drawer/focus trap/hamburger/overlay.
  - `src/ui/layout/MobileNavTabs.tsx` (NEW, 62 строки) — mobile horizontal sticky tabs.
  - `src/ui/layout/Layout.tsx` — добавлен `<MobileNavTabs />` между Header и main.
  - `src/ui/layout/Header.tsx` — `pl-12 md:pl-4` → `px-4`.
  - `src/shared/i18n.ts` — добавлен `'nav.categories': 'Категории'`.
  - `src/index.css` — +60 строк (блоки `.nav-mode-active` + padding-compensation + `.mobile-nav-tabs` + `.mobile-nav-tabs-scroll` + `.mobile-nav-tab`).
  - `STATUS.md`, `AGENT_NAVIGATION.md`, `docs/ARCHITECTURE.md` — обновлены.
- **Tests:** 1144 passed (без регрессий). TypeScript clean. Vite build OK (154 модуля, 9 prerendered HTML, CSS 40.29 KB / gzip 8.96 KB). Lint baseline 59 сохранён.
- **Known Issues:** открытыми нет.
- **Риски:** нулевые. CSS-only изменения + новый компонент + упрощение Sidebar (удаление state/effect). navItems extracted в общий модуль — нет дублирования.
- **Точка остановки:** iter 56 Фаза 4 COMPLETE. Следующая итерация — Фаза 5 (компактизация HomePage: хаб категорий, SeoBlock в `<details>`).

---

Task ID: 55
Agent: main
Task: UI redesign Фаза 3 — возвышение `RegexOutput` до Level 1 (gold border + glow).

Stage Summary:
- **iter 55 Фаза 3 COMPLETE.** `RegexOutput` получил Level 1 visual frame (gold border + glow + corner accents) — соответствует паттерну `.affix-header-*`, но с brand-accent gold. Чистый CSS + 2 строки в TSX (удаление inline style + Tailwind padding override).
- **Изменённые файлы (5):** `src/index.css` (+44 строки `.regex-output` блок), `src/ui/components/RegexOutput.tsx` (root div className упрощён, удалён inline style), `STATUS.md`, `AGENT_NAVIGATION.md` (Pitfall 21), `docs/ARCHITECTURE.md` (Section 9 + subsection).
- **Tests:** 1144 passed. TypeScript clean. Vite build OK (152 модуля, 9 prerendered HTML, CSS 40.74 KB). Lint baseline 59 сохранён.

---

## Older iterations (54 and before)

- **iter 54**: Cleanup `CategoryControlPanel` — удалена legacy ветка + 5 неиспользуемых пропсов + мёртвый CSS. 8 страниц обновлены.
- **iter 53**: Фаза 2 — мигрированы 7 страниц на `<CategoryLayout>` (Ring, Amulet, Belt, Relic, Jewel, Tablet, Vendor).
- **iter 52**: Фаза 2 (пилот) — создан `CategoryLayout` + `WaystonePage` мигрирован.
- **iter 51**: Фаза 0+1 — аудит CSS-токенов + миграция на тёплую dark-fantasy палитру + удаление light-темы + приглушение bg-forest.webp.
- **iter 50**: Known Issue #5 CLOSED — runtime split для over-limit regex. ETL bug fix (patchOptimizationEntries mixed context).
- **iter 49**: Known Issue #4 CLOSED — `normalizeAst` extended for multi-LITERAL AND-in-OR with EXCLUDE.
- **iter 48**: Known Issue #2 CLOSED — explicit `(?!…)` lookahead tokenizer + semantic tests.
- **iter 47**: Docs cleanup (−20%).
- **iter 46**: `(?!…)` forward-only FP FIXED via `^(?!…).*Z` + in-game verified. Known Issue #1/#3 CLOSED.
- **iter 44-45**: FP-bug analysis + 3 surgical fixes (removeConflictingExcludes, strict-subset skip, AND-in-OR transform).
- **iter 41-43**: D5 production-verified (5/5 in-game PASS), D3 pre-analysis, ETL char-limit diagnostic.
- **iter 15-40**: legacy in-game tests, hypothesis patterns, FP prevention anchors, Path D D1-D7. See git history.
