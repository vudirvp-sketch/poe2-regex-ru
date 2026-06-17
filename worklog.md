# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 69
Agent: main
Task: iter 69 — Интеграция 4 пользовательских картинок (Gemini bas-relief + 3 Photoroom PNG) как атмосферных декораций HomePage hero. Сохранить компактный мобильный layout iter 57.

Work Log:
- 1: Клон репо, чтение STATUS.md + worklog.md + HomePage.tsx + Layout.tsx + i18n.ts (home.* keys) + AGENT_NAVIGATION.md.
- 2: VLM-анализ 4 загруженных картинок через `z-ai vision`:
  - `Gemini_Generated_Image_q5x9uq5x9uq5x9uq-Photoroom.webp` — готический барельеф с hooded figure, 1376×768, прозрачный фон. Идеален как backdrop.
  - `1-Photoroom.png` — мифический монстр с красными глазами, 1259×738, прозрачный фон. Side ghost.
  - `2-Photoroom.png` — демон с синими светящимися глазами/венами, 1267×1020, прозрачный фон. Квадратный — отложен (iter 70 candidate).
  - `3-Photoroom.png` — персонаж с рогатым шлемом (зелёная патина), 1046×637, прозрачный фон. Side ghost.
- 3: Оптимизация PNG → WebP через Pillow (`scripts/optimize_hero_images.py`):
  - bas-relief: 1376×768 PNG 956KB → 1280×714 WebP q85 83KB (8.6%).
  - monster-red: 1259×738 PNG 649KB → 640×375 WebP q85 70KB (10.8%).
  - demon-blue: 1267×1020 PNG 1.4MB → 640×515 WebP q85 61KB (4.2%).
  - horned-warrior: 1046×637 PNG 542KB → 640×390 WebP q85 48KB (8.9%).
  - Total: 3.6MB → 262KB (7%). Source PNGs удалены из репо.
- 4: Реализация HomePage.tsx:
  - Hero-секция обёрнута в `relative isolate overflow-hidden` — `isolate` scope-ит `mix-blend-screen`, `overflow-hidden` защищает от горизонтального скролла.
  - **Backdrop** (`hero-bas-relief.webp`): `absolute left-1/2 top-1/2 -translate-x/y-1/2 max-w-[640px] w-2/3 opacity-[0.18] mix-blend-screen`, `hidden lg:block`. Лёгкий bas-relief «etch-ится» на тёмном body bg через screen-blend.
  - **Side ghost L** (`hero-horned-warrior.webp`): `absolute left-0 top-1/2 -translate-y-1/2 w-44 opacity-[0.28]`, `hidden xl:block`.
  - **Side ghost R** (`hero-monster-red.webp`): `absolute right-0 top-1/2 -translate-y-1/2 w-44 opacity-[0.28]`, `hidden xl:block`.
  - Все декорации: `aria-hidden="true"`, `pointer-events-none`. Текстовый контент hero обёрнут в `relative` чтобы подняться над absolute-декорациями внутри изолированного stacking context.
  - **Мобильный layout (< lg)**: декорации `hidden`, hero выглядит идентично iter 57.
  - `hero-demon-blue.webp` — добавлен в `/atmosphere/`, но НЕ подключён (3 декорации уже достаточно; iter 70 candidate для SeoBlock/404/category page).
- 5: Документация:
  - `STATUS.md`: почищены фазы 0-13 в одну строку, iter 69 добавлен как Phase 14, iter 70 candidates переписаны (4 новых пункта про hero decorations + blue-demon integration).
  - `worklog.md`: iter 68 сжат в одну строку, iter 69 — новый section.
  - `AGENT_NAVIGATION.md`: atmosphere/ list обновлён (4 новых hero-файла).
- 6: Верификация:
  - `npx tsc -b --noEmit` — 0 ошибок.
  - `npm run build` — Vite build OK (299ms), 9 prerendered HTML, все 3 активных hero-картинки найдены в JS-bundle и в `dist/atmosphere/`.
  - `npm test -- --run` — 35 files, 1144 tests pass.

Stage Summary:
- **iter 69 COMPLETE.** HomePage hero на lg+/xl+ получил атмосферные dark-fantasy декорации: bas-relief backdrop + 2 flanking silhouettes (horned warrior + red-eyed monster). Мобильный layout iter 57 сохранён без изменений.
- **Изменённые файлы (7):**
  - `public/atmosphere/hero-bas-relief.webp` (new, 83KB)
  - `public/atmosphere/hero-monster-red.webp` (new, 70KB)
  - `public/atmosphere/hero-demon-blue.webp` (new, 61KB, deferred)
  - `public/atmosphere/hero-horned-warrior.webp` (new, 48KB)
  - `src/ui/pages/home/HomePage.tsx` (hero wrapper + 3 decorative `<img>`s)
  - `STATUS.md` (Phase 14 + iter 70 candidates)
  - `worklog.md` (iter 69 section, iter 68 compressed)
  - `AGENT_NAVIGATION.md` (atmosphere/ list update)
- **Точка остановки:** iter 69 done. Открытых Known Issues нет. iter 70 candidates требуют in-browser visual review (см. STATUS.md — приоритет: hero decoration review + .btn-cta OLED glow + waystone filter contrast).

---

## Предыдущие итерации (кратко)

- **iter 68** (Phase 13): `.poe-panel-header--inline` применён в JSX на 8 category pages; TopNav tab font 13px→14px.
- **iter 67** (Phase 12): Vignette softened 0.55→0.40; gold dots hidden ≤380px; `.poe-panel-header--inline` CSS (not in JSX yet); new atmosphere assets.
- **iter 66** (cleanup): Удалены unused i18n ключи `home.header_title` и `app.title`.
- **iter 65** (Phase 11): Атмосферная стилизация PoE2 — `.poe-panel-header`; `.poe-divider` / `.poe-divider--ornate`; `.btn-cta`; фон `bg.webp` + vignette; Pitfall 28.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter 63** (polish): Palette consistency. README rewrite.
- **iter 62** (Phase 8b+c + 9 docs): Features в `<details>`; Level-3 badge auto-suppression.
- **iter ≤61**: iter 61 убран always-on Диапазон badge; iter 60 MobileRegexBar specificity fix; iter 59 MobileRegexBar; iter 58 StatusPanel; iter 57 HomePage compaction; iter 56 nav «режимы»; iter 51-55 CSS tokens + CategoryLayout + RegexOutput L1.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
