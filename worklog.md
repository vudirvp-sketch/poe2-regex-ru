# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 62
Agent: main
Task: Phase 8 (b)+(c) + Phase 9 (финальная документация).

Work Log:
- 1: Клон репо, `npm install`, baseline `npx tsc -b` clean + `npx vitest run` 1144/1144 passed.
- 2: Phase 8b — Features-секция на HomePage (3-card grid) обёрнута в `<details className="home-seo-details">` с новой i18n-ключом `home.features_summary`. Карточки внутри сохранены как есть (CSS reused). Логика: hero уже перечисляет те же факты как stat badges — Features-секция дублировала контент и доминировала над hub категорий. Контент остаётся в DOM (SEO-safe), визуально свёрнут.
- 3: Phase 8c — ModList: добавлен optional prop `hideLabel?: boolean` на `ModSubGroupSection`. Callers (`AffixColumn` для обоих режимов `showOriginSubSections` и semantic-only, плюс `renderJewelTypeSubGroups`) вычисляют `hideLabel = subGroups.length === 1`. Когда в scope (affix column / origin section / jewel-type-filtered list) ровно 1 sub-group, Level-3 badge подавляется — он повторяет контекст родительского header. Level-2 origin headers и Level-1 affix headers НЕ тронуты (всегда несут уникальную инфу).
- 4: Phase 9 — финальная документация:
  - `STATUS.md`: полностью переписан. Убран длинный iter-by-iter backlog, оставлены: текущая итерация (62), таблица 9 фаз со статусом, пустой Known Issues, подтверждённые ограничения PoE2, оптимальные стратегии.
  - `AGENT_NAVIGATION.md`: переписан. Заголовок iter 62. Pitfall 23 переписан — теперь описывает оба `<details>` блока на HomePage (Features iter 62 + SeoBlock iter 57). Pitfall 27 NEW — ModList Level-3 badge auto-suppression pattern. Pitfall 20 сохранён (range warnings). Все остальные pitfalls проверены и оставлены как есть.
  - `docs/ARCHITECTURE.md`: обновлена секция UI Conventions / CategoryControlPanel range warnings (iter 61 описание сохранено), HomePage compaction pattern — добавлено упоминание Features `<details>` (iter 62), ModList добавлено описание hideLabel pattern.
  - `docs/IN_GAME_TESTS.md`: удалён длинный «Older iterations summary» (4 строки про iter 15-41 — git history достаточно), оставлены актуальные VERIFIED-таблицы и iter 46 fix details.
  - `docs/SEO_PLAN.md`: проверен, не менялся (уже чистый).
  - `docs/ETL_GUIDE.md`: проверен, не менялся (уже чистый).
  - `docs/DATA_CONTRACTS.md`: проверен, не менялся (уже чистый).
  - `DELETIONS.md`: удалён (iter 47 cleanup note — давно неактуален, git history достаточно).
  - `worklog.md` (этот файл): iter 61 сжат в одну строку в «Предыдущие итерации», iter 62 — полный раздел выше.
- 5: Верификация: `npx tsc -b` clean, `npx vitest run` 1144/1144 passed.

Stage Summary:
- **iter 62 COMPLETE.** Phase 8 (polish) — COMPLETE. Phase 9 (финальная документация) — COMPLETE. Known Issues: открытыми нет.
- **Изменённые файлы (7):** `src/ui/pages/home/HomePage.tsx`, `src/shared/i18n.ts`, `src/ui/components/ModList.tsx`, `STATUS.md`, `AGENT_NAVIGATION.md`, `docs/ARCHITECTURE.md`, `docs/IN_GAME_TESTS.md`. Удалён: `DELETIONS.md`. Обновлён: `worklog.md`.
- **Tests:** 1144 passed. `tsc -b` clean.
- **Точка остановки:** Все 9 фаз UI redesign закрыты. Phase 9 (финальная документация) — выполнена. Дальше — только bug fixes / feature requests по мере поступления. План «9 фаз» завершён.

---

## Предыдущие итерации (кратко)

- **iter 61** (Phase 8a polish): убран always-on `⚠ Диапазон` badge в CategoryControlPanel, FP-warning перенесён в tooltip range-контейнера. Pitfall 20 sub-bullet + новое правило «никогда не показывай warning-badge, который срабатывает на каждый нормальный use фичи».
- **iter 60** (bug fix, Known Issue #7): `MobileRegexBar` visible on desktop — `.mobile-regex-bar { display: flex }` перекрывал `lg:hidden` (same specificity, source-order tie-break). Фикс: все `.mobile-regex-bar*` правила обёрнуты в `@media (max-width: 1023px)`. Pitfall 26 добавлен.
- **iter 59** (Фаза 7): `MobileRegexBar.tsx` mobile sticky bottom-bar на 8 страницах. HomePage cleanup. Vendor price-filter fix.
- **iter 58** (Фаза 6): `StatusPanel.tsx` — единая панель статусов для 8 страниц.
- **iter 57** (Фаза 5): HomePage compaction — SeoBlock в `<details>`, tighten отступов.
- **iter 56** (Фаза 4): Навигация как «режимы» — `.nav-mode-active`, mobile tabs заменяют hamburger.
- **iter 51-55** (Фазы 0-3): CSS-токены → тёплая dark-fantasy палитра; `CategoryLayout` 2-col/1-col; `RegexOutput` Level 1 gold frame.
- **iter 46-50**: `(?!…)` lookahead bidirectional fix; `regexPrefixContext` multi-LITERAL AND-in-OR; runtime split для over-limit regex (>250 chars).
- **iter ≤45**: legacy in-game tests, hypothesis patterns, FP prevention anchors, Path D. См. git history.
