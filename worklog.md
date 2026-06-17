# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 64
Agent: main
Task: UI Phase 10 — перенести левый sidebar наверх как горизонтальную навигацию (TopNav). Освободить ~224px под аффиксы на десктопе.

Work Log:
- 1: Клон репо (git clone), `npm install`, baseline `npx tsc -b` clean + `npx vitest run` 1144/1144 passed.
- 2: Анализ текущей архитектуры навигации:
  - `Layout.tsx`: 3-элементный chrome — `<Sidebar>` (desktop-only vertical, w-56 = 224px) + `<Header>` (h-12 page-title bar) + `<MobileNavTabs>` (mobile-only horizontal scrollable).
  - 9 nav-пунктов определены в `nav-items.ts`, делятся между Sidebar (desktop) и MobileNavTabs (mobile).
  - `.nav-mode-active` (CSS) использовал `border-left: 3px` — для вертикальной навигации.
  - Греп показал: CSS-классы `sidebar-atmosphere`/`header-atmosphere`/`mobile-nav-tab*` используются ТОЛЬКО в Sidebar/Header/MobileNavTabs. Тесты НЕ ссылаются на эти 3 компонента → безопасно удалять.
- 3: Решение дизайна — да, перенос стоит. Выгоды: +224px под аффиксы на десктопе; унификация паттерна навигации (было вертикаль/горизонталь split — стало единый горизонтальный TopNav на всех breakpoints); устранение избыточного `<Header>` (заголовок страницы уже есть в `CategoryLayout`'s `header` slot на category pages + в hero `<h1>` на HomePage).
- 4: Создан `src/ui/layout/TopNav.tsx` (~120 строк с комментами):
  - `<header role="banner">` → `.topnav-bar` (flex row, h-52 / md:h-56).
  - Brand (logo 36px + "PoE2 Regex" / "Русский клиент" stack, title `hidden < sm`).
  - `<nav role="navigation" aria-label>` → `.topnav-tabs` (flex:1, overflow-x:auto, scrollbar hidden).
  - Feedback hint (`hidden lg:block`).
  - Бренд-ссылка использует `<Link>` (не `<NavLink>`) — чтобы не получать `.nav-mode-active` на `/` для двух элементов одновременно (бренд + Home tab).
- 5: Обновлён `Layout.tsx`: удалены импорты Sidebar/Header/MobileNavTabs, добавлен импорт TopNav. Структура: `flex flex-col h-screen` → skip-link + `<TopNav>` + `<main>`. `data-theme="dark"` side-effect перенесён из Header.tsx в Layout.tsx (useEffect).
- 6: Удалены файлы: `src/ui/layout/Sidebar.tsx`, `src/ui/layout/MobileNavTabs.tsx`, `src/ui/layout/Header.tsx`.
- 7: Обновлён `src/index.css`:
  - Блок «Sidebar & Header: uniform semi-transparent warm overlay» (`.sidebar-atmosphere` / `.header-atmosphere`) → заменён на `.topnav` (та же rgba(13,11,9,0.82) + backdrop-filter blur(4px)).
  - Блок «Navigation "mode" active-state (iter 56)» + «Mobile horizontal tabs (iter 56)» (строки 541-602) → заменён на новый блок `/* ─── TopNav (iter 64, UI Phase 10) ─── */` с правилами `.topnav`, `.topnav-bar` (md media query), `.topnav-brand*` (sm media query для text), `.topnav-tabs` (scroll), `.topnav-tab`, и обновлённая `.nav-mode-active` с `::after` pseudo-element (border-bottom 3px gold, overlaps `.topnav`'s bottom border).
  - Удалены: `.nav-mode-link.nav-mode-active` и `.mobile-nav-tab.nav-mode-active` padding-compensation rules (больше не нужны — `::after` не влияет на layout).
- 8: Обновлён `src/shared/i18n.ts`: ключ `sidebar.feedback` → `nav.feedback` (namespace `sidebar.*` упразднён вместе с компонентом). Ключи `home.header_title` и `app.title` оставлены как unused для backward-compat (никто не читает, harm-less).
- 9: Верификация:
  - `npx tsc -b` — clean (0 ошибок).
  - `npx vitest run` — 1144/1144 passed (35 test files).
  - `npx vite build` — OK: 154 modules transformed, dist/assets/index-*.css 42.87 KB (gzip 9.44 KB), dist/assets/index-*.js 501.95 KB (gzip 144.59 KB). CSS вырос на ~1.8 KB (новые topnav правила) — в пределах нормы.
- 10: Документация:
  - `STATUS.md`: iter 64 в шапке. Добавлен Phase 10 row в таблицу фаз. Known Issues пополнен закрытым iter 64.
  - `AGENT_NAVIGATION.md`: заголовок iter 64. Раздел 1 (Where Things Are) — добавлены строки для TopNav.tsx и Layout.tsx, обновлена nav-items.ts строка. Pitfall 22 ПОЛНОСТЬЮ переписан под TopNav (старое описание Sidebar/MobileNavTabs устарело). Раздел 12 (i18n keys) — обновлён: `home.header_title` помечен как unused, добавлены `nav.feedback` и `nav.categories`.
  - `worklog.md`: iter 63 сжат в одну строку, iter 64 — полный раздел выше.

Stage Summary:
- **iter 64 COMPLETE.** Sidebar (224px слева) + Header (48px сверху) + MobileNavTabs (мобильная полоса) — все 3 компонента объединены в единый горизонтальный `TopNav`. На десктопе освободилось ~224px горизонтального места под ModList + правую колонку. Единый паттерн навигации на всех breakpoints.
- **Изменённые файлы (7):**
  - НОВЫЙ: `src/ui/layout/TopNav.tsx`
  - ИЗМЕНЁН: `src/ui/layout/Layout.tsx`
  - УДАЛЕНЫ: `src/ui/layout/Sidebar.tsx`, `src/ui/layout/MobileNavTabs.tsx`, `src/ui/layout/Header.tsx`
  - ИЗМЕНЁН: `src/index.css` (замена sidebar/header/mobile-nav правил на topnav)
  - ИЗМЕНЁН: `src/shared/i18n.ts` (rename `sidebar.feedback` → `nav.feedback`)
  - ИЗМЕНЁН: `STATUS.md`, `AGENT_NAVIGATION.md`, `worklog.md`
- **Tests:** 1144 passed. `tsc -b` clean. `vite build` OK (154 modules, 502 KB JS / 43 KB CSS).
- **Точка остановки:** Phase 10 (Sidebar → TopNav) выполнена. Открытых Known Issues нет. Возможные кандидаты для следующего polish-итерации (если пользователь вернётся с замечаниями):
  - `.skip-link` всё ещё использует холодный `#2563eb` (Pitfall 28 нарушение) — заменить на тёплый accent-amber или brand-gold.
  - Шрифт табов на < md = `text-[13px]` — можно увеличить до `text-[14px]` если позволяет ширина.
  - На средних экранах (768-1024px) все 9 табов могут не помещаться в одну строку без скролла — стоит проверить in-browser и, возможно, добавить wrap или compact (icon-only) mode.

---

## Предыдущие итерации (кратко)

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
