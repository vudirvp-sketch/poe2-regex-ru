# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 66
Agent: main
Task: Cleanup pass — удалить неиспользуемые i18n ключи `home.header_title` и `app.title` (iter 64 stopping-point candidate, harm-less мусор). Документация почищена от упоминаний об этих ключах.

Work Log:
- 1: Клон репо + `npm install`. Baseline совпадает с iter 65: `npx tsc -b` clean, `npx vitest run` 1144/1144 passed, `npx eslint src/` 15 problems (12 errors + 3 warnings, все pre-existing).
- 2: Verification — поиск `home.header_title` и `app.title` по всему репо:
  - `src/shared/i18n.ts` — определения (строки 5 и 58)
  - `AGENT_NAVIGATION.md` — 2 упоминания в разделе 22 (Pitfall) и разделе 12 (Design principle)
  - `worklog.md` — iter 65 stop-point candidate
  - В `src/`, `tests/`, `scripts/`, `docs/`, `index.html` — НЕТ потребительского кода (`t('home.header_title')` / `t('app.title')` не найдены). Ключи полностью unused.
- 3: `src/shared/i18n.ts` — удалены 2 строки:
  - `'app.title': 'PoE2 Regex — Русский',` (строка 5)
  - `'home.header_title': 'PoE2 Regex',` (строка 58)
- 4: `AGENT_NAVIGATION.md`:
  - Header (current state): iter 65 → iter 66, добавлена фраза про cleanup.
  - Раздел 22 (Pitfall 22) — i18n key rename bullet: удалена фраза "`home.header_title` is now UNUSED... kept in `i18n.ts` for backward-compat only", заменена на "(iter 66 cleanup: unused `home.header_title` key removed from `i18n.ts`)".
  - Раздел 12 (i18n Keys for Home Page) — Design principle: удалена фраза про `home.header_title` being unused, заменена на "(iter 66: unused `home.header_title` and `app.title` keys removed — neither was consumed by any component.)"
- 5: `STATUS.md`:
  - Header: iter 65 → iter 66.
  - Phase table — добавлен новый row `cleanup | ✅ iter 66 | Удалены неиспользуемые i18n ключи...`.
  - Known Issues — закрытые пополнились iter 66 unused i18n keys removed.
- 6: `worklog.md`: iter 65 сжат в одну строку (см. ниже), iter 66 — этот раздел.
- 7: Верификация:
  - `npx tsc -b` — clean (0 ошибок).
  - `npx vitest run` — 1144/1144 passed (35 test files). Байт-в-байт с baseline.
  - `npx eslint src/` — 15 problems (12 errors + 3 warnings), baseline совпадает.
  - `npx vite build` — OK: 154 modules, dist/assets/index-*.css 45.07 KB (gzip 9.94 KB), dist/assets/index-*.js 501.89 KB (gzip 144.65 KB). CSS/JS размеры идентичны iter 65 (в пределах 0.06 KB rounding).
  - `npx tsx scripts/prerender.ts` — OK: 9 route-specific HTML файлов сгенерированы.

Stage Summary:
- **iter 66 COMPLETE.** Cleanup pass выполнен. Открытых Known Issues нет.
- **Изменённые файлы (4):**
  - `src/shared/i18n.ts` (−2 строки: удалены `app.title` и `home.header_title`)
  - `STATUS.md` (iter 66 в шапке + новый row в phase table)
  - `AGENT_NAVIGATION.md` (header iter → 66, Pitfall 22 + Section 12 почищены от упоминаний неиспользуемых ключей)
  - `worklog.md` (iter 65 сжат в 1 строку, iter 66 — этот раздел)
- **Tests:** 1144 passed. `tsc -b` clean. `vite build` OK. `prerender` OK. ESLint baseline unchanged.
- **Точка остановки:** Cleanup завершён. Все остальные iter 65 candidates (in-browser visual review bg.webp / .poe-panel-header dots / .btn-cta glow; .poe-panel-header на category h2; удаление bg-forest.webp после 1 release cycle; compact mode TopNav на md; tab font size на <md) требуют ручного in-browser review и НЕ могут быть выполнены агентом без визуальной проверки. Передаются в iter 67.

---

## Предыдущие итерации (кратко)

- **iter 65** (Phase 11): Атмосферная стилизация PoE2 — `.poe-panel-header` (gold filigree rim) на TopNav; `.poe-divider` / `.poe-divider--ornate` (bg-2x texture); `.btn-cta` (warm metallic + crimson glow) заменил холодный `bg-btn-primary` на Copy-кнопках; фон `bg-forest.webp` → `bg.webp` + vignette; Pitfall 28 фикс на `.skip-link`. 4 новых webp-ассета в `public/atmosphere/`. Pitfall 29.
- **iter 64** (Phase 10): Sidebar (224px слева) + Header + MobileNavTabs → единый горизонтальный `TopNav`. Освобождено ~224px под аффиксы на десктопе. TopNav.tsx новый, Layout.tsx обновлён, Sidebar/Header/MobileNavTabs.tsx удалены. `.nav-mode-active` стал `::after` border-bottom (был border-left).
- **iter 63** (polish): Palette consistency — все холодные tailwind-цвета (indigo/gray-600/blue-500) заменены на тёплые палитровые токены (amber/raised/chip-hover/accent-*). README переписан (SEO + clarity). Pitfall 28.
- **iter 62** (Phase 8b+c + Phase 9 docs): HomePage Features в `<details>`; ModList Level-3 badge auto-suppression через `hideLabel` prop; STATUS/AGENT_NAVIGATION/ARCHITECTURE/IN_GAME_TESTS почищены; DELETIONS.md удалён. Pitfall 27.
- **iter 61** (Phase 8a polish): убран always-on `⚠ Диапазон` badge в CategoryControlPanel, FP-warning перенесён в tooltip range-контейнера. Pitfall 20 sub-bullet.
- **iter 60** (bug fix, Known Issue #7): `MobileRegexBar` visible on desktop — specificity tie-break. Фикс: `.mobile-regex-bar*` правила обёрнуты в `@media (max-width: 1023px)`. Pitfall 26.
- **iter 59** (Фаза 7): `MobileRegexBar.tsx` mobile sticky bottom-bar на 8 страницах. Vendor price-filter fix.
- **iter 58** (Фаза 6): `StatusPanel.tsx` — единая панель статусов для 8 страниц.
- **iter 57** (Фаза 5): HomePage compaction — SeoBlock в `<details>`, tighten отступов.
- **iter 56** (Фаза 4): Навигация как «режимы» — `.nav-mode-active`, mobile tabs заменяют hamburger.
- **iter 51-55** (Фазы 0-3): CSS-токены → тёплая dark-fantasy палитра; `CategoryLayout` 2-col/1-col; `RegexOutput` Level 1 gold frame.
- **iter 46-50**: `(?!…)` lookahead bidirectional fix; `regexPrefixContext` multi-LITERAL AND-in-OR; runtime split для over-limit regex (>250 chars).
- **iter ≤45**: legacy in-game tests, hypothesis patterns, FP prevention anchors, Path D. См. git history.
