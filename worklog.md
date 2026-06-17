# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 61
Agent: main
Task: Phase 8 (polish) — убрать шум в CategoryControlPanel: always-on `⚠ Диапазон` badge.

Work Log:
- 1: Клон репо, `npm install`, baseline `npx tsc -b` clean + `npx vitest run` 1144/1144 passed.
- 2: Анализ `CategoryControlPanel.tsx`: при активации range-фильтра стакаются до 3 warning-бейджей (`⚠ ≥40` + `⚠ Округл.` + `⚠ Диапазон`). Худший — `⚠ Диапазон` (notation FP warning): показывается **всегда** при любом min/max, не actionable, чистый шум.
- 3: Проверил — нет тестов, завязанных на visible `⚠ Диапазон` (поиск `notation_fp_warning|Диапазон` по `tests/` пусто). Ссылки только в `CategoryControlPanel.tsx`, `i18n.ts`, `docs/ARCHITECTURE.md` line 300.
- 4: Фикс: удалил always-on `⚠ Диапазон` visible badge, перенёс FP-warning в `title` range-контейнера (ховер показывает). Видимыми оставил только `⚠ ≥40` и `⚠ Округл.` (specific + actionable). Когда ни одно условие не выполняется — тишина, ни одного `⚠`.
- 5: Документация: `STATUS.md` (iter 61 entry + Phase 8 in-progress), `AGENT_NAVIGATION.md` (header marker + pitfall 20 sub-bullet «Range warnings pattern»), `docs/ARCHITECTURE.md` line 300 (новое описание warnings), `worklog.md` (этот раздел + сжатие iter 60 в одну строку).
- 6: Верификация: `npx tsc -b` clean, `npx vitest run` 1144/1144 passed, `npm run build` OK.

Stage Summary:
- **iter 61 COMPLETE.** Phase 8 — одна направленность сделана (CategoryControlPanel warning noise). Known Issues: открытыми нет.
- **Изменённые файлы (5):** `src/ui/components/CategoryControlPanel.tsx`, `docs/ARCHITECTURE.md`, `STATUS.md`, `AGENT_NAVIGATION.md`, `worklog.md`.
- **Tests:** 1144 passed. `tsc -b` clean. Vite build OK.
- **Точка остановки:** Phase 8 — Partial. Pending: (a) упростить Features-секцию на HomePage; (b) пересмотреть плотность ModList. Phase 9 (финальная документация) — не начата.

---

## Предыдущие итерации (кратко)

- **iter 60** (bug fix, Known Issue #7): `MobileRegexBar` visible on desktop — `.mobile-regex-bar { display: flex }` перекрывал `lg:hidden` (same specificity, source-order tie-break). Фикс: все `.mobile-regex-bar*` правила обёрнуты в `@media (max-width: 1023px)`. Pitfall 26 добавлен.
- **iter 59** (Фаза 7): `MobileRegexBar.tsx` mobile sticky bottom-bar на 8 страницах. HomePage cleanup. Vendor price-filter fix. Known Issue #6 CLOSED.
- **iter 58** (Фаза 6): `StatusPanel.tsx` — единая панель статусов для 8 страниц. Regression: удалены импорты `t` из 4 страниц (исправлено в iter 59).
- **iter 57** (Фаза 5): HomePage compaction — SeoBlock в `<details>`, tighten отступов.
- **iter 56** (Фаза 4): Навигация как «режимы» — `.nav-mode-active`, mobile tabs заменяют hamburger.
- **iter 51-55** (Фазы 0-3): CSS-токены → тёплая dark-fantasy палитра; `CategoryLayout` 2-col/1-col; `RegexOutput` Level 1 gold frame.
- **iter 46-50**: `(?!…)` lookahead bidirectional fix; `regexPrefixContext` multi-LITERAL AND-in-OR; runtime split для over-limit regex (>250 chars).
- **iter ≤45**: legacy in-game tests, hypothesis patterns, FP prevention anchors, Path D. См. git history.
