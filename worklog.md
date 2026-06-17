# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 65
Agent: main
Task: UI Phase 11 — атмосферная стилизация PoE2 по ассет-паку пользователя (3 шага из ТЗ: title-bg-4x + bg-2x → early-access-button-underlay → bg.webp) + Pitfall 28 фикс на .skip-link.

Work Log:
- 1: Клон репо + npm install. Baseline: `npx tsc -b` clean, `npx vitest run` 1144/1144 passed, `npx vite build` OK (154 modules, 502 KB JS / 42.87 KB CSS).
- 2: Анализ брифа пользователя — 3 шага:
  - **Step 1 (Структура):** title-bg-4x → gold filigree рамка для заголовков/TopNav; bg-2x → декоративные разделители.
  - **Step 2 (Интерактив):** early-access-button-underlay → багровое свечение для CTA-кнопки Copy (заменить холодный `bg-btn-primary` #2563eb — Pitfall 28 нарушение).
  - **Step 3 (Атмосфера):** bg.webp → текстурированный фон с виньеткой (вместо плоского bg-forest).
- 3: Скопировано 4 ассета в `public/atmosphere/`: `bg.webp`, `bg-2x.webp`, `title-bg-4x.webp`, `early-access-button-underlay.webp`. Остальные 5 (banner_0.5.0, early-access-banner, logo-2x, news-bg-center, return-of-the-ancients-logo-en) НЕ копировались — не упоминаются в ТЗ. Решение по принципу "lean docs" (не плодить неиспользуемые ассеты в репо).
- 4: CSS — добавлен новый блок `/* ─── PoE2 atmospheric decorative elements (iter 65, UI Phase 11) ─── */` в `src/index.css` (перед TopNav overlay):
  - `.poe-panel-header` — `box-shadow: inset 0 1px 0 / inset 0 -1px 0` для gold rim (top brighter, bottom dimmer) на тёмном warm-tinted bg. `::before` / `::after` — по 6px золотой точке на левом/правом краю. Rim = box-shadow, не border — layout-box не меняется.
  - `.poe-divider` — 1px fading line (transparent → gold → transparent). `margin: 0` (родительский flex gap предоставляет spacing).
  - `.poe-divider--ornate` — 8px вариант с `bg-2x.webp` текстурой, замаскированной с обоих концов через `mask-image: linear-gradient(transparent 0%, #000 12%, #000 88%, transparent 100%)`.
  - `.btn-cta` / `.btn-cta-success` / `.btn-cta-error` / `.btn-cta:disabled` — dark metallic base + gold rim + crimson radial glow на hover (`0 0 14px rgba(196,78,78,0.40)`). Replaces `bg-btn-primary` (#2563eb, cold blue, Pitfall 28 violation).
- 5: CSS — body background swap:
  - Старый: `bg-forest.webp` + `linear-gradient(rgba(13,11,9,0.40))` dim.
  - Новый: `bg.webp` + `linear-gradient(rgba(13,11,9,0.78) → rgba(7,5,3,0.92))` сильный warm dim + `radial-gradient(ellipse at center, transparent 35%, rgba(7,5,3,0.55) 100%)` vignette.
  - Mobile: тот же стек, но `background-attachment: scroll` (не fixed) — избегать iOS repaint-jank.
- 6: CSS — Pitfall 28 фикс на `.skip-link`: `#2563eb` (cold blue) → `var(--poe-gold)`, text color → `#1F1812` (dark warm для контраста на gold bg).
- 7: JSX изменения:
  - `src/ui/layout/TopNav.tsx`: добавлен `poe-panel-header` класс к `<header className="topnav poe-panel-header">`. Добавлен `title="PoE2 Regex — Главная"` к brand `<Link>` для tooltip fallback на маленьких экранах (где brand-text скрыт).
  - `src/ui/layout/CategoryLayout.tsx`: добавлен `<hr className="poe-divider--ornate" aria-hidden="true" />` между `{header}` и `grid` (между шапкой и 2-колонным контентом).
  - `src/ui/pages/home/HomePage.tsx`: добавлен `<hr className="poe-divider--ornate my-2" aria-hidden="true" />` между hero и category cards grid.
  - `src/ui/components/RegexOutput.tsx`: Copy-кнопки (основная + PartCopyButton) — `bg-btn-primary/success/danger` Tailwind utility → `.btn-cta` / `.btn-cta-success` / `.btn-cta-error` классы. `transition-colors` → `transition-all` (для box-shadow animation). Disabled-состояние теперь обрабатывается в `.btn-cta:disabled` CSS — больше не нужно условие `isOverflow || !regex ? 'bg-raised text-dim' : ...` в JSX.
- 8: Верификация:
  - `npx tsc -b` — clean (0 ошибок).
  - `npx vitest run` — 1144/1144 passed (35 test files).
  - `npx eslint src/` — 15 problems (12 errors + 3 warnings) — все pre-existing (baseline совпадает до stash).
  - `npx vite build` — OK: 154 modules, dist/assets/index-*.css 45.01 KB (gzip 9.93 KB), dist/assets/index-*.js 501.97 KB (gzip 144.67 KB). CSS вырос на ~2.14 KB (новые .poe-* + .btn-cta* правила) — в пределах нормы. Vite warns о 2 webp URL ("didn't resolve at build time, will remain unchanged to be resolved at runtime") — это ожидаемо, файлы в `public/` и resolve-ятся браузером по абсолютному пути `/poe2-regex-ru/atmosphere/*.webp`.
  - `npx tsx scripts/prerender.ts` — OK: 9 route-specific HTML файлов сгенерированы.
- 9: Документация:
  - `STATUS.md`: iter 65 в шапке. Phase 11 row добавлен в таблицу фаз. Known Issues пополнен закрытым iter 65 (Pitfall 28 фикс + bg-btn-primary removed).
  - `AGENT_NAVIGATION.md`: header updated на iter 65. Раздел 1 (Where Things Are) — добавлена строка для `public/atmosphere/`. Pitfall 29 (новый) — полностью описывает 3 атмосферных примитива + body background swap + do/don't для `.btn-cta` (не применять к non-CTA).
  - `worklog.md`: iter 64 сжат в одну строку, iter 65 — полный раздел выше.

Stage Summary:
- **iter 65 COMPLETE.** Все 3 шага из брифа пользователя реализованы + Pitfall 28 фикс на .skip-link. Открытых Known Issues нет.
- **Изменённые файлы (8):**
  - НОВЫЕ: `public/atmosphere/bg.webp`, `public/atmosphere/bg-2x.webp`, `public/atmosphere/title-bg-4x.webp`, `public/atmosphere/early-access-button-underlay.webp` (4 файла)
  - ИЗМЕНЁН: `src/index.css` (+~130 строк: 3 новых CSS-примитива + body bg swap + .skip-link Pitfall 28 фикс)
  - ИЗМЕНЁН: `src/ui/layout/TopNav.tsx` (+ `poe-panel-header` класс на header + `title` атрибут на brand link)
  - ИЗМЕНЁН: `src/ui/layout/CategoryLayout.tsx` (+ `<hr className="poe-divider--ornate">` между header и grid)
  - ИЗМЕНЁН: `src/ui/pages/home/HomePage.tsx` (+ `<hr className="poe-divider--ornate">` между hero и cards grid)
  - ИЗМЕНЁН: `src/ui/components/RegexOutput.tsx` (Copy buttons: `bg-btn-primary/success/danger` → `.btn-cta`/`-success`/`-error`/`:disabled`)
  - ИЗМЕНЁН: `STATUS.md`, `AGENT_NAVIGATION.md`, `worklog.md`
- **Tests:** 1144 passed. `tsc -b` clean. `vite build` OK. `prerender` OK. CSS gzip grew ~0.5 KB.
- **Точка остановки:** Phase 11 (атмосферная стилизация) выполнена. Открытых Known Issues нет. Возможные кандидаты для следующего polish-итерации:
  - **In-browser visual review** bg.webp текстуры при разных viewport sizes (mobile / 768-1024 / 1440+). Если vignette слишком давит — ослабить `rgba(7,5,3,0.55)` до `0.40`.
  - **In-browser check** `.poe-panel-header` 6px gold dot accents на TopNav — не перекрывают ли они brand-logo на 320-360px viewport? Если да — скрыть dots через `@media (max-width: 380px) { .topnav.poe-panel-header::before, .topnav.poe-panel-header::after { display: none } }`.
  - **In-browser check** `.btn-cta` crimson glow — не слишком ли яркий на OLED? Если да — снизить `0.40` alpha до `0.30` на hover.
  - **Кандидат на следующую итерацию:** применить `.poe-panel-header` к category page `<h2>` заголовкам (8 страниц) — визуально объединит TopNav + page-header под один filigree-стиль. Сейчас `<h2>` используют только gold text color без рамки. Делать отдельной итерацией с in-browser review.
  - **Кандидат на следующую итерацию:** удалить `public/bg-forest.webp` + `public/bg-forest-mobile.webp` (старые background-ассеты) после как минимум 1 release cycle — сейчас оставлены для cached-URL backward-compat.
  - **Cleanup:** удалить unused i18n ключи `home.header_title` и `app.title` (iter 64 stopping point candidate, всё ещё не сделано).

---

## Предыдущие итерации (кратко)

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
