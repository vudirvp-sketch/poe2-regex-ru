# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 60
Agent: main
Task: Fix bug — `MobileRegexBar` дублировал основной `RegexOutput` на десктопе.

Work Log:
- 1: Клон репо, `npm install`, baseline `npm run build` OK (1144 теста зелёные).
- 2: Анализ HTML пользователя: `<div class="mobile-regex-bar lg:hidden">` виден на десктопе несмотря на `lg:hidden`.
- 3: Проверил скомпилированный CSS. Tailwind `@media (width>=64rem){.lg\:hidden{display:none}}` присутствует. Custom `.mobile-regex-bar{display:flex;...}` присутствует как БАЗОВОЕ правило (без media query).
- 4: Диагноз: оба правила имеют специфичность (0,1,0). Tailwind-утилиты эмittyся в начале CSS, custom CSS — в конце. При равной специфичности source-order побеждает позднее правило → `display: flex` перекрывал `display: none` на десктопе.
- 5: Документировал в `STATUS.md` как Known Issue #7, затем применил фикс.
- 6: Фикс в `src/index.css`: все правила `.mobile-regex-bar*` обёрнуты в один блок `@media (max-width: 1023px)`. На десктопе эти правила больше не применяются → `lg:hidden` работает штатно. Подробный комментарий добавлен в CSS.
- 7: Верификация: `npx tsc -b` clean, `npx vitest run` 1144/1144 passed, `npm run build` OK (156 модулей, 9 prerendered HTML, CSS 42.87 KB / gzip 9.34 KB). Проверил скомпилированный CSS: `.mobile-regex-bar` теперь ТОЛЬКО внутри `@media (width<=1023px)`, bare правил нет.
- 8: Документация: `STATUS.md` (iter 60 + #7 CLOSED), `AGENT_NAVIGATION.md` (Pitfall 26, header, раздел 1), `worklog.md` (этот раздел + сжатие старой истории).

Stage Summary:
- **iter 60 COMPLETE.** Known Issue #7 CLOSED. `MobileRegexBar` больше не виден на десktop.
- **Изменённые файлы (4):** `src/index.css`, `STATUS.md`, `AGENT_NAVIGATION.md`, `worklog.md`.
- **Tests:** 1144 passed. `tsc -b` clean. Vite build OK.
- **Точка остановки:** iter 60 bug fix COMPLETE. Следующая задача — Фаза 8 (полировка: снять шум, оставить «дорогую тишину»).

---

## Предыдущие итерации (кратко)

- **iter 59** (Фаза 7): `MobileRegexBar.tsx` mobile sticky bottom-bar на 8 страницах. HomePage cleanup (убраны описания категорий, 8 i18n-ключей удалено). Vendor price-filter fix (`hasRangedTokens={false}` — глобальные min/max были no-op). Known Issue #6 (tsc -b failing) CLOSED.
- **iter 58** (Фаза 6): `StatusPanel.tsx` — единая панель статусов для 8 страниц. Regression: удалены импорты `t` из 4 страниц + `groupTokensByFamily` из JewelPage (исправлено в iter 59).
- **iter 57** (Фаза 5): HomePage compaction — SeoBlock в `<details>`, tighten отступов.
- **iter 56** (Фаза 4): Навигация как «режимы» — `.nav-mode-active`, mobile tabs заменяют hamburger. **Не возвращать** hamburger/drawer/focus-trap.
- **iter 51-55** (Фазы 0-3): CSS-токены → тёплая dark-fantasy палитра; `CategoryLayout` 2-col/1-col; `RegexOutput` Level 1 gold frame.
- **iter 46-50**: `(?!…)` lookahead bidirectional fix; `regexPrefixContext` multi-LITERAL AND-in-OR; runtime split для over-limit regex (>250 chars).
- **iter ≤45**: legacy in-game tests, hypothesis patterns, FP prevention anchors, Path D. См. git history.
