# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 71
Agent: main
Task: iter 71 — Интеграция 3 оставшихся atmospheric WebP (hero-demon-blue, early-access-banner, news-bg-center). Низкий приоритет, минимальные изменения.

Work Log:
- 1: Клон репо, чтение STATUS.md + worklog.md + AGENT_NAVIGATION.md (Pitfall 29 + атмосферные примитивы).
- 2: Чтение HomePage.tsx, SeoBlock.tsx, CategoryLayout.tsx, 404.html, index.css (атмосферная секция + .home-seo-*).
- 3: Проверка `public/atmosphere/*.webp` — все 3 целевых ассета присутствуют (hero-demon-blue 60 KB 639×514, early-access-banner 47 KB 1919×177, news-bg-center 121 KB 1681×260).
- 4: Реализация Change 1 — `hero-demon-blue.webp` в SeoBlock:
  - `SeoBlock.tsx`: добавлен `<img className="home-seo-demon ...">` после `<summary>`, внутри `<details>`. `aria-hidden`, `pointer-events-none`, `lg:block hidden` (lg+ only), `mix-blend-screen`, `max-w-[280px]`, positioned absolute right/top.
  - `index.css`: `.home-seo-details` → `position: relative; overflow: hidden`. Новый класс `.home-seo-demon` (opacity 0 → 0.10 при `[open]`, transition 0.25s). `.home-seo-content` → `position: relative; z-index: 1` (поднимает контент над декорацией).
- 5: Реализация Change 2 — `early-access-banner.webp` как `.poe-divider--banner`:
  - `index.css`: новый класс `.poe-divider--banner` (height 24px, `background: url('early-access-banner.webp') center / auto 100% no-repeat`, opacity 0.35, без `mask-image` — у WebP уже есть alpha).
  - `HomePage.tsx`: добавлен `<hr className="poe-divider--banner my-4" aria-hidden="true" />` между Features `<details>` и SeoBlock `<details>`.
- 6: Реализация Change 3 — `news-bg-center.webp` как mobile hero backdrop:
  - `HomePage.tsx`: добавлен `<img>` внутри hero-контейнера (после `hero-bas-relief.webp`). `lg:hidden` (mobile only), `opacity-[0.14]`, `mix-blend-screen`, `max-w-[640px]`. На <lg заменяет скрытый bas-relief, на lg+ не показывается (избегаем двойной декорации).
- 7: Верификация:
  - `npm install` (node_modules отсутствовал, package-lock.json не коммитим — `.gitignore` явно исключает).
  - `npm run build` — OK (311 ms, 9 prerendered HTML). Vite-лог показывает `early-access-banner.webp referenced ... will remain unchanged to be resolved at runtime` — ожидаемо (CSS-asset в `/poe2-regex-ru/` префиксе, рантайм-резолв).
  - `npx tsc -b` — без ошибок.
  - `npx eslint HomePage.tsx SeoBlock.tsx` — без ошибок.
- 8: `git checkout package-lock.json` — откат side-effect от `npm install` (проект использует pnpm).
- 9: Документация:
  - `STATUS.md` — iter 71 added, секция Atmospheric Assets со всеми WebP-ассетами.
  - `AGENT_NAVIGATION.md` — header updated to iter 71; Pitfall 29 expanded (4 primitives + .poe-divider--banner); iter 71 leftover integration paragraph.
  - `worklog.md` — iter 71 section, старые итерации сжаты до 1-строчного списка.

Stage Summary:
- **iter 71 COMPLETE.** Все 3 leftover atmospheric WebP интегрированы минимально-инвазивно (1 новый `<hr>`, 2 новых `<img>`, 3 новых CSS-правила, 1 расширение существующего правила). Сборка зелёная, lint чистый.
- **Изменённые файлы (6):**
  - `src/ui/pages/home/HomePage.tsx` (+ news-bg-center mobile backdrop `<img>`; + `.poe-divider--banner` `<hr>`)
  - `src/ui/pages/home/SeoBlock.tsx` (+ hero-demon-blue decoration `<img>`)
  - `src/index.css` (+ `.poe-divider--banner`; + `.home-seo-demon` + `[open]` fade; `.home-seo-details` → `relative; overflow: hidden`; `.home-seo-content` → `relative; z-index: 1`)
  - `STATUS.md` (iter 71, Atmospheric Assets table)
  - `AGENT_NAVIGATION.md` (header + `public/atmosphere/` row + Pitfall 29)
  - `worklog.md` (iter 71 section)
- **Точка остановки:** iter 71 done. Открытых Known Issues нет. Чистых кандидатов на интеграцию атмосферных WebP больше нет. Следующая итерация — на усмотрение владельца (возможные направления: visual review новых декораций на live-странице, оптимизация bundle size (index.js 503 KB), либо функциональные задачи).

---

## Предыдущие итерации (кратко)

- **iter 70** (Phase 15): Visual review lg+/xl+; filter contrast fix (text-dim→text-muted); `.btn-cta` OLED glow toned; `bg-forest.webp` deleted.
- **iter 69** (Phase 14): HomePage hero decorations — bas-relief backdrop + 2 side ghosts на lg+/xl+.
- **iter 68** (Phase 13): `.poe-panel-header--inline` применён в JSX на 8 category pages; TopNav tab font 13px→14px.
- **iter 67** (Phase 12): Vignette softened 0.55→0.40; gold dots hidden ≤380px; `.poe-panel-header--inline` CSS; new atmosphere assets.
- **iter 65-66** (Phase 11 + cleanup): Атмосферная стилизация PoE2 — `.poe-panel-header`; `.poe-divider` / `.poe-divider--ornate`; `.btn-cta`; фон `bg.webp` + vignette. Cleanup unused i18n ключи.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter 62-63**: Features в `<details>`; palette consistency; README rewrite.
- **iter ≤61**: MobileRegexBar; StatusPanel; HomePage compaction; nav «режимы»; CSS tokens + CategoryLayout + RegexOutput.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
