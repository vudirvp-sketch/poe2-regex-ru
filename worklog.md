# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 120
Agent: main
Task: iter 120 — фикс UI-багов, выявленных пользователем: (1) scroll jump-to-top + jitter в VirtualizedModList (на вкладке самоцветов и других), (2) HomePage hero decorations (bas-relief скрывает текст, news-bg-center не виден, заменить horned-warrior на shaman full-body + добавить иву full-body с плавным затуханием ног). Пользователь также приложил 3 PNG: шаманка полный рост.png, ива.png, faf.png (последний — без указания места).

Work Log:
- 1: Контекст загружен из STATUS.md (iter 119 = current state, все priority-блоки закрыты, 1890/1890 tests) + worklog.md (iter 119 section) + docs/UI_AUDIT.md (актуальный аудит) + AGENT_NAVIGATION.md. Репозиторий клонирован с GitHub.
- 2: Анализ scroll-bug — прочитан `src/ui/components/VirtualizedModList.tsx` (844 строки). Найден root cause: `useLayoutEffect` в `VirtualizedColumn` (строки ~369-414) и в single-column mode (строки ~650-692) вызывал `virtualizer.measure()` 3 раза (immediate + RAF + setTimeout(0)) при каждом изменении `selectedIds`/`perTokenRanges`. `measure()` инвалидирует ВЕСЬ кэш измерений TanStack Virtual → все rows возвращаются к estimate-размерам (120px для `subgroup`, тогда как actual 40-80px) → `paddingTop`/`paddingBottom` дрейфуют → visible items смещаются → "jump to top". Jitter при скролле — та же причина: новые rows используют estimate 120px, после ResizeObserver actual размер меньше → `totalSize` уменьшается → padding дрейфует → "дрожание".
- 3: Анализ hero decorations — прочитан `src/ui/pages/home/HomePage.tsx`. Найдены 4 проблемы:
  - `hero-bas-relief.webp` (lg+, opacity 0.18, mix-blend-screen, w-2/3 max-w-[640px]) — "полностью скрывает текст, мал, странно расположен". Image 1280×714 (landscape), при w-640 → h-357px. С mix-blend-screen bright parts осветляют bg, конкурируя с текстом.
  - `news-bg-center.webp` (mobile, opacity 0.14, mix-blend-screen, w-full max-w-[640px]) — "вообще не вижу нигде". Image 1682×261 (очень wide, short), при w-640 → h-99px. С opacity 0.14 + mix-blend-screen — слишком subtle чтобы быть видимым.
  - `hero-horned-warrior.webp` (xl+, opacity 0.28, w-44 = 176px) — landscape 640×390, upper body bust. Нужно заменить на full-body portrait.
  - `hero-monster-red.webp` (xl+, opacity 0.28, w-44) — landscape 640×375, upper body. Нужно заменить на full-body portrait.
- 4: Документирование багов в STATUS.md как Known Issues #6 (scroll) и #7 (hero decorations) — ПЕРЕД фиксом (согласно инструкции пользователя).
- 5: Фикс scroll-bug в `src/ui/components/VirtualizedModList.tsx`:
  - Удалён `useLayoutEffect` import (больше не используется).
  - `ROW_ESTIMATES.subgroup` снижен 120 → 60 (ближе к actual average для 1-3 chip subgroups без range inputs).
  - Удалён ВЕСЬ блок `useLayoutEffect` в `VirtualizedColumn` (строки ~342-414): `scrollTopRef`, scroll listener `useEffect`, `prevSelectedSizeRef`/`prevRangesSizeRef`/`rafIdRef`/`timeoutIdRef`, `restore()`, 3× `virtualizer.measure()` calls. Заменён комментарием с объяснением root cause и ссылкой на STATUS.md KI#6.
  - Удалён ВЕСЬ блок `useLayoutEffect` в single-column mode (строки ~633-692): `singleScrollTopRef`, scroll listener, `singlePrevSelRef`/`singlePrevRngRef`/`singleRafIdRef`/`singleTimeoutIdRef`, `restore()`, 3× `singleVirtualizer.measure()` calls. Заменён комментарием.
  - Обновлён header комментарий файла: добавлено объяснение iter 120 (dynamic row measurement через `measureElement` ref + ResizeObserver, без manual `virtualizer.measure()`).
- 6: Подготовка изображений — написан Python-скрипт `/home/z/my-project/scripts/convert_iter120_hero_images.py` (зеркало существующего `scripts/optimize_hero_images.py`). Конвертация:
  - `шаманка полный рост.png` (1024×1536, RGBA, 3.0 MB) → `public/atmosphere/hero-shaman.webp` (533×800, 126 KB, 4.2% от original) — quality=85, method=6, alpha preserved.
  - `ива.png` (816×1304, RGBA, 1.0 MB) → `public/atmosphere/hero-iva.webp` (501×800, 78 KB, 7.7% от original).
  - Max side 800px (preserves 2x retina для `h-[500px]` display at portrait aspect → ~333px actual width, 666px @ 2x).
- 7: Обновление `src/ui/pages/home/HomePage.tsx`:
  - Удалён `<img hero-bas-relief.webp>` (lg+ backdrop).
  - Удалён `<img news-bg-center.webp>` (mobile backdrop).
  - Заменён `<img hero-horned-warrior.webp>` (xl+, w-44, opacity 0.28) → `<img hero-shaman.webp>` (xl+, h-[500px] w-auto, opacity 0.22, class `hero-side-ghost`).
  - Заменён `<img hero-monster-red.webp>` (xl+, w-44, opacity 0.28) → `<img hero-iva.webp>` (xl+, h-[500px] w-auto, opacity 0.22, class `hero-side-ghost hero-side-ghost--right`).
  - Обновлён comment block над hero section: iter 120 — что удалено, что заменено, почему.
- 8: Добавлены CSS-классы в `src/index.css` (после `.poe-divider--banner`):
  - `.hero-side-ghost` — `mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)` для плавного затухания ног + `linear-gradient(to right, transparent 0%, #000 18%, #000 100%)` для horizontal fade на inner edge (сторона к тексту). `mask-composite: intersect` комбинирует оба fade. WebKit prefix добавлен для Safari.
  - `.hero-side-ghost--right` — mirror variant: horizontal fade с `to left` вместо `to right` (для right-side ghost, чтобы fade был на inner edge — слева от изображения).
- 9: Верификация — все 4 проверки зелёные:
  - `npx tsc --noEmit` → **0 errors** (после удаления `useLayoutEffect` из imports).
  - `npx eslint .` → **0 errors, 0 warnings** (lint проходит чисто).
  - `npx vitest run` → **1890/1890 tests passed** (37 test files, без изменений vs iter 119 — тесты не затронуты).
  - `python3 scripts/audit_block_sort_coverage.py` → **18/18 blocks fully covered** (312 family-keys — без изменений).
  - `npx vite build` → **built successfully** (156 modules, 564 KB JS / 49 KB CSS).
- 10: Документация:
  - `STATUS.md` — полный rewrite верха: iter 120 как текущее состояние. 2 новых Known Issues (#6 scroll, #7 hero). iter 119 canonical orders перенесены в краткую ссылку "без изменений в iter 120". Проверки iter 120 обновлены (1890/1890, без изменений vs iter 119).
  - `worklog.md` — iter 120 подробно, iter 119 сжат до одной строки в "Предыдущие итерации".
  - `AGENT_NAVIGATION.md` — обновлён header: iter 120 = current state.

Stage Summary:
- **iter 120 COMPLETE.** Два UI-бага исправлены:
  1. **Scroll jump-to-top + jitter** — удалён `useLayoutEffect` с `virtualizer.measure()` + `restore()` (оба: two-column и single-column). `measureElement` ref + ResizeObserver обрабатывают dynamic measurement. `ROW_ESTIMATES.subgroup` снижен 120 → 60.
  2. **HomePage hero decorations** — удалены backdrop'ы (`hero-bas-relief.webp` lg+, `news-bg-center.webp` mobile). Side ghosts заменены: horned-warrior → `hero-shaman.webp` (533×800 portrait), monster-red → `hero-iva.webp` (501×800 portrait). Высота `h-[500px]` (вместо `w-44`), CSS mask-image для плавного затухания ног + horizontal fade на inner edge.
- **Изменённые файлы (5 в репозитории + 2 новых изображения):**
  - `src/ui/components/VirtualizedModList.tsx` — −103 строки: удалены оба `useLayoutEffect` блока + `useLayoutEffect` import. `ROW_ESTIMATES.subgroup` 120 → 60. Header comment обновлён.
  - `src/ui/pages/home/HomePage.tsx` — заменены 4 `<img>` (2 удалены, 2 заменены на portrait full-body). Comment block обновлён.
  - `src/index.css` — +42 строки: 2 новых CSS-класса `.hero-side-ghost` + `.hero-side-ghost--right` с mask-image gradient fades (bottom + inner edge).
  - `public/atmosphere/hero-shaman.webp` — NEW (126 KB, 533×800, конвертирован из `шаманка полный рост.png`).
  - `public/atmosphere/hero-iva.webp` — NEW (78 KB, 501×800, конвертирован из `ива.png`).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — обновлены.
- **Тесты/типы/lint/build:** ✅ tsc 0 errors, vitest 1890/1890 (без изменений vs iter 119), eslint 0 problems, vite build OK, audit script 18/18 blocks.
- **НЕ пристроено:** `faf.png` (1672×941, landscape) — пользователь сказал "не знаю куда можно пристроить и нужно ли". Оставлено на усмотрение пользователя. Если захочет — можно использовать как backdrop для SeoBlock или как декоративный divider.
- **Удалённые, но НЕ стёртые с диска images:** `hero-horned-warrior.webp`, `hero-monster-red.webp`, `hero-bas-relief.webp`, `news-bg-center.webp` — остаются в `public/atmosphere/` (не удалял, чтобы не сломать возможные другие ссылки; в HomePage они больше не используются). Если следующая итерация подтвердит, что они нигде больше не нужны — можно удалить.
- **Точка остановки:** iter 120 done. UI-баги из запроса пользователя исправлены. В iter 121 можно:
  1. **Визуальная верификация пользователем** — UI в браузере: (а) scroll на вкладке самоцветов (и других) — не должно быть jump-to-top при выборе аффикса, не должно быть jitter при скролле; (б) HomePage hero — shaman слева, ива справа, оба full-body с плавным затуханием ног, текст не перекрыт backdrop'ами.
  2. Опционально: cleanup неиспользуемых atmosphere images (`hero-horned-warrior.webp`, `hero-monster-red.webp`, `hero-bas-relief.webp`, `news-bg-center.webp`) — удалить с диска если нигде больше не ссылаются.
  3. Опционально: пристроить `faf.png` (если пользователь определит место).
  4. Опционально (перенос из iter 111): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
  5. Опционально: систематизация `other` block (27 family-keys) — LOW priority, heterogeneous.
- **Подсказка следующему агенту:** iter 120 = фикс scroll-bug (KI#6) + hero decorations (KI#7). Перед стартом iter 121 прочитай STATUS.md (актуальный статус + Known Issues #6/#7 — fixed), worklog.md (этот раздел iter 120). Изменённые файлы: `src/ui/components/VirtualizedModList.tsx`, `src/ui/pages/home/HomePage.tsx`, `src/index.css`, 2 новых WebP в `public/atmosphere/`. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

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
