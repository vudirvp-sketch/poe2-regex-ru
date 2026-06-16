# Worklog

---
Task ID: 59
Agent: main
Task: UI redesign Фаза 7 — `MobileRegexBar.tsx` mobile sticky bottom-bar + HomePage cleanup + Vendor price-filter fix.

Work Log:
- 1: Клонирован репозиторий, `npm install`. Baseline: 1144 tests pass. При проверке `tsc -b` обнаружен pre-existing bug: 4 страницы (Belt/Amulet/Ring/Relic) не импортировали `t`, JewelPage не импортировал `groupTokensByFamily`. `tsc --noEmit` молчал, но `tsc -b` падал. Задокументирован как Known Issue #6, затем исправлен.
- 2: Task C (HomePage cleanup): удалены многословные описания категорий из карточек HomePage. Удалены 8 неиспользуемых i18n-ключей `home.{waystone,tablet,relic,jewel,vendor,belt,ring,amulet}_desc`. Поле `descKey` удалено из массива `categories` в HomePage.tsx. Карточки теперь содержат только иконку + название + тег с количеством аффиксов.
- 3: Task B (Vendor price-filter fix): на VendorPage глобальные min/max inputs были no-op (setMinValue/setMaxValue — пустые функции, но `hasRangedTokens={hasRangedTokens}` показывал их). Установлен `hasRangedTokens={false}` — global min/max скрыты. Per-chip range inputs в FilterChip остаются основным UX для vendor. Удалён неиспользуемый `showRound10` prop.
- 4: Task A (Phase 7 — MobileRegexBar):
  - Создан `src/ui/components/MobileRegexBar.tsx` — sticky-bottom контейнер (`lg:hidden`, `position: sticky; bottom: 0`). Props: `regexOutput` (ReactNode), `alerts` (ReactNode[]).
  - Обновлён `src/ui/layout/CategoryLayout.tsx` — добавлен `mobileBar?: ReactNode` slot. Когда передан: aside получает `hidden lg:flex` (desktop-only); `status` + `sidebar` рендерятся в отдельной mobile-only секции над sticky-bar. Backward compat: без `mobileBar` aside виден на всех viewport.
  - Все 8 страниц категорий мигрированы — передают `mobileBar={<MobileRegexBar regexOutput={...} />}`. Jewel и Vendor дополнительно прокидывают `alerts` в MobileRegexBar (повторно из StatusPanel).
  - CSS: добавлен `.mobile-regex-bar` блок в `index.css` (sticky bottom, backdrop-blur 6px, max-h 60vh, safe-area-inset-bottom, padding-bottom для iPhone notch).
- 5: Исправлены pre-existing TypeScript ошибки — восстановлены импорты `t` в Belt/Amulet/Ring/Relic и `groupTokensByFamily` в JewelPage (iter 58 regression).
- 6: Верификация: `tsc -b` clean (0 errors — впервые с iter 58), `npx vitest run` 1144/1144 passed, `npm run build` OK (156 модулей, 9 prerendered HTML, CSS 42.27 KB / gzip 9.32 KB). Lint baseline 59 сохранён (все 59 проблем в tests/, не в src/).
- 7: Документация обновлена: STATUS.md (iter 59 section, Known Issue #6 closed, Phase 7 marked complete), AGENT_NAVIGATION.md (Pitfall 25, обновлён раздел 1 + раздел 4 с tsc -b warning), worklog.md.

Stage Summary:
- **iter 59 Фаза 7 COMPLETE.** Mobile sticky bottom-bar создан и интегрирован на всех 8 страницах. HomePage очищен от многословных описаний. Vendor price-filter исправлен (no-op global min/max скрыты). Pre-existing `tsc -b` bug исправлен.
- **Изменённые файлы (15):**
  - NEW: `src/ui/components/MobileRegexBar.tsx`
  - Modified: `src/ui/layout/CategoryLayout.tsx` (+mobileBar slot)
  - Modified: 8 page files (Belt, Amulet, Ring, Relic, Jewel, Waystone, Tablet, Vendor)
  - Modified: `src/ui/pages/home/HomePage.tsx` (убраны описания категорий)
  - Modified: `src/shared/i18n.ts` (удалены 8 `home.*_desc` ключей)
  - Modified: `src/index.css` (+`.mobile-regex-bar` block, ~30 строк)
  - Documentation: `STATUS.md`, `AGENT_NAVIGATION.md`, `worklog.md`
- **Tests:** 1144 passed. `tsc -b` clean. Vite build OK (156 модулей, 9 prerendered HTML, CSS 42.27 KB / gzip 9.32 KB). Lint baseline 59.
- **Known Issues:** Known Issue #6 (tsc -b failing) CLOSED. Открытых Known Issues нет.
- **Точка остановки:** iter 59 Фаза 7 COMPLETE. Следующая итерация — Фаза 8 (полировка: снять шум, оставить «дорогую тишину»).

---

Task ID: 58
Agent: main
Task: UI redesign Фаза 6 — единая панель статусов `StatusPanel.tsx`.

Stage Summary:
- **iter 58 Фаза 6 COMPLETE.** Единый компонент `StatusPanel.tsx` заменяет ~15-20 строк дублирующегося inline JSX на каждой из 8 страниц. Поддерживает расширение через `badges` и `alerts` слоты.
- **Изменённые файлы (11):** NEW `StatusPanel.tsx`, Modified 8 page files, `STATUS.md`, `AGENT_NAVIGATION.md`, `docs/ARCHITECTURE.md`.
- **Tests:** 1144 passed. Lint 59.
- **Note (added iter 59):** iter 58 regression — `t` import was incorrectly removed from 4 standard pages, `groupTokensByFamily` from JewelPage. Fixed in iter 59.

---

Task ID: 57
Agent: main
Task: UI redesign Фаза 5 — компактизация HomePage: SeoBlock в `<details>` + tighten вертикальных отступов.

Stage Summary:
- **iter 57 Фаза 5 COMPLETE.** HomePage стал плотнее: вертикальные отступы сокращены, карточки сжаты, SeoBlock свёрнут в `<details>`. 7 файлов изменено. 1144 tests. Lint 59.

---

Task ID: 56
Agent: main
Task: UI redesign Фаза 4 — навигация как «режимы»: усиленный active-state + mobile tabs в Sidebar.

Stage Summary:
- **iter 56 Фаза 4 COMPLETE.** Навигация воспринимается как переключение «режимов»: активный маршрут получает Level-1-style gold accent. Mobile гамбургер-drawer заменён на горизонтальные sticky-чипсы под Header.
- **Pitfall 22:** Navigation as "modes" — shared `navItems`, `.nav-mode-active` CSS class, **no hamburger/drawer/focus trap** (do NOT re-add).

---

## Older iterations (55 and before)

- **iter 55**: Фаза 3 — `RegexOutput` Level 1 frame (gold border + glow).
- **iter 54**: Cleanup `CategoryControlPanel` — удалена legacy ветка + 5 неиспользуемых пропсов + мёртвый CSS.
- **iter 53**: Фаза 2 — мигрированы 7 страниц на `<CategoryLayout>`.
- **iter 52**: Фаза 2 (пилот) — создан `CategoryLayout` + `WaystonePage` мигрирован.
- **iter 51**: Фаза 0+1 — аудит CSS-токенов + миграция на тёплую dark-fantasy палитру + удаление light-темы.
- **iter 50**: Known Issue #5 CLOSED — runtime split для over-limit regex.
- **iter 49**: Known Issue #4 CLOSED — `normalizeAst` extended for multi-LITERAL AND-in-OR with EXCLUDE.
- **iter 48**: Known Issue #2 CLOSED — explicit `(?!…)` lookahead tokenizer.
- **iter 47**: Docs cleanup (−20%).
- **iter 46**: `(?!…)` forward-only FP FIXED via `^(?!…).*Z`. Known Issue #1/#3 CLOSED.
- **iter 44-45**: FP-bug analysis + 3 surgical fixes.
- **iter 41-43**: D5 production-verified, D3 pre-analysis, ETL char-limit diagnostic.
- **iter 15-40**: legacy in-game tests, hypothesis patterns, FP prevention anchors, Path D D1-D7. See git history.

