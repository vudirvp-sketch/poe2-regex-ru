# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 122
Agent: main
Task: iter 122 — cleanup неиспользуемых atmosphere assets + интеграция faf.png (1672×941, landscape) в SeoBlock как широкий landscape backdrop. Пользователь дал faf.png без указания места, попросил "пристроить органично". Также выполнить cleanup 4 stale atmosphere webp, отмеченных в iter 121 worklog как "перенос в iter 122+".

Work Log:
- 1: Контекст загружен из STATUS.md (iter 121 = current, KI#7 fixed, 1890/1890 tests), worklog.md (iter 121 section — ре-фикс hero decorations), AGENT_NAVIGATION.md (структура проекта). Репозиторий клонирован с GitHub. faf.png загружен в /home/z/my-project/upload/faf.png.
- 2: Проверка ссылок на 4 candidate'а на удаление (`hero-horned-warrior.webp`, `hero-monster-red.webp`, `hero-bas-relief.webp`, `news-bg-center.webp`) — поиск по `*.tsx, *.ts, *.css, *.html` файлам. Результат: **0 активных ссылок**. Единственное упоминание — в comment в HomePage.tsx (line 113) про iter 120 REMOVED — stale comment, не src=.
- 3: Анализ faf.png через PIL + VLM. Свойства: 1672×941, RGB, 8-bit, ~81% пикселей чёрные (RGB~0,0,0), средняя яркость 18.8/255, std 20.8, тёплые акценты (R>B в 57.5% ярких пикселей). VLM: dark-fantasy арт — воительница + череп/демоническая структура, фон чёрный с тёплыми highlight'ами. Подходит для атмосферного backdrop'а в тёмной теме проекта.
- 4: Решение по размещению faf.png. Рассмотрены варианты: (A) backdrop в SeoBlock — ландшафтный формат подходит для широкого контейнера, SeoBlock уже имеет `hero-demon-blue.webp` как right-edge акцент, можно добавить второй слой backdrop'а. (B) hero backdrop на HomePage — слишком заметно, конкурирует с side ghosts. (C) новый section — слишком структурно для одного изображения. (D) замена `.poe-divider--banner` — не подходит формат. **Выбран вариант A**: ADD (не replace) как широкий backdrop в SeoBlock, lg+ only, opacity 0.18, mix-blend-screen. Существующий `hero-demon-blue.webp` остаётся как right-edge акцент поверх backdrop'а.
- 5: Cleanup — удалены 4 неиспользуемых webp + 1 dead script:
  - `public/atmosphere/hero-horned-warrior.webp` — iter 69 side ghost, iter 120 removed from JSX.
  - `public/atmosphere/hero-monster-red.webp` — iter 69 side ghost, iter 120 removed from JSX.
  - `public/atmosphere/hero-bas-relief.webp` — iter 69 backdrop, iter 120 removed from JSX.
  - `public/atmosphere/news-bg-center.webp` — iter 71 mobile backdrop, iter 120 removed from JSX.
  - `scripts/optimize_hero_images.py` — one-off iter 69 script, ссылается на отсутствующие `.png` исходники + устаревший путь `/home/z/my-project/repo/public/atmosphere`. Dead code.
- 6: HomePage.tsx — обновлён comment над hero section. Старый comment (12 строк) описывал iter 57/69/120/121 историю с упоминанием удалённых файлов. Новый comment (7 строк) — кратко: text-only block, iter 121 вынес side ghosts в root, iter 122 удалил 4 leftover backdrop images.
- 7: Конвертация faf.png → seo-atmosphere.webp. Скрипт `/home/z/my-project/scripts/convert_faf_to_webp.py` сохранён (persisted, не inline) для воспроизводимости. Параметры: max side 1600px (source 1672 → rescale to 1600×900, aspect preserved), WebP q85 method=6, RGBA mode. Результат: 2,166,048 → 145,928 bytes (6.7% от исходного). Целевой файл: `public/atmosphere/seo-atmosphere.webp`.
- 8: SeoBlock.tsx — добавлен новый `<img>` элемент ПЕРВЫМ ребёнком после `<summary>` (перед `hero-demon-blue.webp`). Classes: `home-seo-atmosphere pointer-events-none absolute inset-0 hidden h-full w-full object-cover lg:block`. DOM order: atmosphere → demon → content → так demon (right-edge accent) рисуется поверх atmosphere (wide backdrop), оба под content (z-index: 1). Docstring обновлён с описанием iter 122.
- 9: index.css — новый класс `.home-seo-atmosphere` (рядом с `.home-seo-demon`). Паттерн как у `.home-seo-demon`: opacity 0 → 0.18 на `.home-seo-details[open]`, transition 0.25s, z-index: 0, `pointer-events-none` (в JSX). Дополнительно: `mix-blend-mode: screen` (dark areas blend with bg, highlights etch onto bg — same as demon), `mask-image: linear-gradient(to bottom, #000 60%, transparent 100%)` (fade bottom 40% — top 60% fully visible, bottom 40% fades into bg). Подробный comment (32 строки) описывает: источник, параметры конвертации, DOM order, blend mode rationale, mask rationale, mobile handling.
- 10: Верификация — все 5 проверок зелёные:
  - `npx tsc --noEmit` → **0 errors**.
  - `npx eslint .` → **0 errors, 0 warnings**.
  - `npx vitest run` → **1890/1890 tests passed** (37 test files, без изменений vs iter 121 — UI/cleanup-only).
  - `python3 scripts/audit_block_sort_coverage.py` → **18/18 blocks fully covered** (312 family-keys — без изменений).
  - `npx vite build` → **built successfully** (156 modules, 564 KB JS / 49 KB CSS). `dist/atmosphere/seo-atmosphere.webp` присутствует (146 KB), 4 удалённых webp отсутствуют. Built CSS содержит `.home-seo-atmosphere` с правильными gradient stops.
- 11: Документация:
  - `STATUS.md` — актуализирован под iter 122. "Текущее состояние" переписано: cleanup + faf интеграция. KI#5 (Истощения Бездны, closed iter 112) и KI#6 (scroll jitter, closed iter 120) — удалены из Known Issues (closed, ancient, не нужны следующему агенту). KI#7 (hero decorations, fixed iter 121) — переименован в "awaiting user visual verification", сжат до 4 строк. KI#8 (NEW) — SeoBlock atmosphere backdrop, awaiting user visual verification. Проверки iter 122 (без изменений vs iter 121). Таблицы confirmed limitations и optimal strategies — без изменений.
  - `worklog.md` — iter 122 подробно, iter 121 сжат до одной строки в "Предыдущие итерации". Старые итерации (iter 111-120) уже сжаты — оставлены как есть (история для контекста, не мусор).

Stage Summary:
- **iter 122 COMPLETE.** Cleanup + faf интеграция. 2 из 5 опциональных задач iter 121 закрыты:
  1. **Cleanup** — 4 неиспользуемых atmosphere webp удалены с диска + 1 dead script (`optimize_hero_images.py`). Все 4 файла были помечены как "no longer referenced" ещё в iter 120, но не удалены с диска. iter 122 завершает cleanup.
  2. **faf.png интеграция** — новый `seo-atmosphere.webp` (1600×900, 146 KB) добавлен как широкий landscape backdrop в SeoBlock, lg+ only, opacity 0.18, mix-blend-screen, fade bottom 40%. DOM order: atmosphere → demon → content. Не заменяет `hero-demon-blue.webp` (right-edge accent), а дополняет его (atmosphere позади, demon поверх).
- **Изменённые файлы (5):**
  - `src/ui/pages/home/HomePage.tsx` — обновлён comment над hero section (стал короче, без упоминания удалённых файлов).
  - `src/ui/pages/home/SeoBlock.tsx` — добавлен `<img className="home-seo-atmosphere ...">` + обновлён docstring.
  - `src/index.css` — новый класс `.home-seo-atmosphere` (32 строки + comment).
  - `STATUS.md`, `worklog.md` — обновлены.
- **Удалённые файлы (5):**
  - `public/atmosphere/hero-horned-warrior.webp`
  - `public/atmosphere/hero-monster-red.webp`
  - `public/atmosphere/hero-bas-relief.webp`
  - `public/atmosphere/news-bg-center.webp`
  - `scripts/optimize_hero_images.py`
- **Новые файлы (2):**
  - `public/atmosphere/seo-atmosphere.webp` (146 KB, конвертирован из faf.png).
  - (вне репозитория) `/home/z/my-project/scripts/convert_faf_to_webp.py` — скрипт конвертации для воспроизводимости.
- **Тесты/типы/lint/build:** ✅ tsc 0 errors, vitest 1890/1890 (без изменений vs iter 121), eslint 0 problems, vite build OK (146 KB seo-atmosphere.webp в dist/), audit script 18/18 blocks.
- **НЕ сделано (перенос в iter 123+):**
  1. **Визуальная верификация пользователем** — UI в браузере:
     - KI#7 (iter 121 hero decorations): xl+ экран (≥1280px) — shaman слева у края, ива справа у края, оба full-body, головы у TopNav, ноги плавно затухают в нижних 25%, inner edge плавно затухает к тексту. На <xl скрыты.
     - KI#8 (iter 122 SeoBlock atmosphere): lg+ экран (≥1024px), раскрыть SeoBlock `<details>` — тёплый тёмный арт виден позади SEO-текста, не отвлекает, плавно затухает к низу, текст читаем поверх, `hero-demon-blue.webp` правый край виден поверх backdrop'а.
  2. Опционально (перенос из iter 111): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2 — не сделано (risky без визуальной верификации, low impact).
  3. Опционально (LOW): систематизация `other` block (27 family-keys) — heterogeneous, low priority.
- **Точка остановки:** iter 122 done. Cleanup + faf интеграция завершены. В iter 123 можно:
  1. Получить visual feedback от пользователя по KI#7 (hero) и KI#8 (SeoBlock atmosphere). При необходимости — tweak opacity/mask/blend values.
  2. Опционально: cleanup `--text-faint-val` alias / lift `--text-dim-val`.
  3. Опционально (LOW): систематизация `other` block.
- **Подсказка следующему агенту:** iter 122 = cleanup + faf интеграция. Перед стартом iter 123 прочитай STATUS.md (актуальный статус + KI#7/KI#8 — awaiting user verification), worklog.md (этот раздел iter 122). Изменённые файлы: `src/ui/pages/home/HomePage.tsx`, `src/ui/pages/home/SeoBlock.tsx`, `src/index.css`. Удалённые файлы: 4 webp + `optimize_hero_images.py`. Новый файл: `public/atmosphere/seo-atmosphere.webp`. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 121**: ре-фикс HomePage hero decorations (KI#7 — iter 120 был неполным: 2 бага — `overflow-hidden`+center-anchor обрезали голову/ноги, изображения заперты в max-w-4xl). iter 121: Layout.tsx — `<main>` получил `relative`; HomePage.tsx — side ghosts вынесены в Fragment, anchored к viewport edges, `h-[80vh] max-h-[720px]`, opacity 0.20, content в `relative z-10`; index.css — bottom fade 75%, horizontal fade на INNER edge (баг iter 120 fixed).
- **iter 120**: фикс UI-багов — scroll jump-to-top + jitter в VirtualizedModList (KI#6, корректный фикс — остаётся в силе) + HomePage hero decorations (KI#7, фикс был неполным — ре-фикс в iter 121).
- **iter 119**: rage-charges (4) + runes-barrier (4) + penetration (3) block rules — все priority-блоки закрыты. 18 блоков правил, 312 family-keys, 100% coverage. 1890/1890 tests.
- **iter 118**: skill-levels (10) + area-duration (8) + meta-skills (6) block rules, 100% coverage each. Canonical orders: Levels→Quality→Duration→Cooldown, Area→Radius→Duration, Energy→Archon→Sealed. 1862/1862 tests.
- **iter 117**: offence-speed (12) + crit (9) + buff-skills (7) block rules, 100% coverage each. Canonical orders: 12 speed buckets (attack→...→skill), 9 crit buckets (chance%→...→ailment), 7 buff-skill buckets (Ауры→...→Метки). 1820/1820 tests.
- **iter 116**: weapon-specific (24) + flasks (16) block rules, 100% coverage each. Canonical orders: 10 weapon buckets (Мечи→...→Без оружия), 4 flask buckets (Health→Mana→Any→Buffs). 1774/1774 tests.
- **iter 115**: resources block rules (29 family-keys, 100% coverage). Canonical order: Здоровье → Мана → ES → Конверсия → Тотем → Прочее. 1721/1721 tests.
- **iter 114**: defence-stats block rules (28 family-keys, 100% coverage). Canonical order: Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони. 1687/1687 tests.
- **iter 113**: damage-type block rules (47 family-keys, 100% coverage). Canonical order: физический → огонь → холод → молния → хаос → стихийный → generic/by-source → conditional → by-target → special. 1654/1654 tests.
- **iter 112**: фикс regex-бага «Истощения Бездны» (data patch + ETL algorithm filter + 2 regression tests) + внедрение sortKey infrastructure (FamilyGroup.sortKey + computeSortKey + 4 блока правил: resistances/attributes/minions/ailments, 105 family-keys, 100% coverage). 1602/1602 tests.
- **iter 111**: KI#3/#4/#5 из аудита v2 (CSS/JSX правки для placeholder consolidation, dim/faint consolidation, partial font-medium fix). 1543/1543 tests.
- **iter 110**: Приоритет 2.7–2.9 + 3.10–3.13 UI-аудита v2 (5 правок CSS/JSX + APCA-валидация). Все 13 пунктов аудита v2 закрыты. 1543/1543 tests.
- **iter 109**: Приоритет 1 UI-аудита v2 (5 правок CSS/JSX) + Noto Sans self-hosted woff2 400/500/600. 1543/1543 tests.
- **iter 108**: фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext` без `regexExclude` — `normalizeAst` в `src/core/compiler.ts` расширен. 1543/1543 tests, +10 regression tests.
- **iter 107**: UX-полировка P4 — tier-colored left border для 4 tier'ов в tier-first режиме.
- **iter 106**: P4 — tier-aware sort toggle (alpha vs tier-first).
- **iter 105**: P2 second half — tablet sub-blocks (19 sub-blocks).
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix (9 sub-blocks).
- **iter 103**: подавление 2 TanStack library-level ESLint warnings.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other`.
- **iter 99**: alphabetical within-block sort.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys).
- **iter 96**: удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
