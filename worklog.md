# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 121
Agent: main
Task: iter 121 — ре-фикс HomePage hero decorations. Пользователь проверил результат iter 120 и дал feedback: "ты обрезал все" — видна только средняя часть (торс), голова и ноги обрезаны. Пользователь хотел "по краям экрана во весь рост, лица с головой без обрезки, плавно мягко обрезать, на фоне". Анализ показал 2 бага в iter 120 fix.

Work Log:
- 1: Контекст загружен из STATUS.md (iter 120 = current, KI#6/#7 marked as fixed, 1890/1890 tests) + worklog.md (iter 120 section — agent claim "shaman/iva full-body с плавным затуханием ног" оказался неверным). Репозиторий клонирован с GitHub.
- 2: Анализ бага iter 120 — прочитан `src/ui/pages/home/HomePage.tsx` + `src/index.css` + `src/ui/layout/Layout.tsx`. Найдены 2 root cause:
  - **(a) Head cropping:** Hero block (`<div className="relative mb-6 isolate overflow-hidden text-center">`) имел `overflow-hidden`. Side ghosts внутри имели `absolute left-0 top-1/2 -translate-y-1/2 h-[500px] w-auto`. Hero block высотой ~165px (текст h1+p+p+badges). Image 500px → image top на -167px (ВЫШЕ блока), image bottom на +332px (НИЖЕ блока). `overflow-hidden` обрезал до видимой средней части (~33%–66% image height = original y=268-532 of 800) → ГОЛОВА ПОЛНОСТЬЮ ОБРЕЗАНА, ноги тоже. Виден только торс. Полная противоположность "full body".
  - **(b) Images trapped in max-w-4xl:** HomePage root был `<div className="mx-auto max-w-4xl">` (896px max). Side ghosts внутри на `left-0`/`right-0` этого 896px контейнера → на wide-экранах у краёв 896px-колонки, НЕ у краёв экрана. Пользователь хотел "по краям экрана".
- 3: Дополнительно найден 3-й баг в CSS iter 120 — horizontal fade был на OUTER edge (у viewport edge), а не на INNER edge (к тексту). CSS: `linear-gradient(to right, transparent 0%, #000 18%, #000 100%)` для left-side image → 0% (left, viewport edge) = transparent (faded), 100% (right, toward text) = #000 (visible). Это BACKWARDS — fade должен быть на inner edge (toward text), не на outer edge (viewport edge). Comment в CSS говорил "fade on inner edge" — но CSS делал обратное.
- 4: Документирование багов в STATUS.md — KI#7 обновлён (iter 120 marked as incomplete, iter 121 truly fixes), ПЕРЕД фиксом согласно инструкции пользователя "Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий".
- 5: Фикс Layout.tsx — `<main>` получил `relative` className. Это делает main positioning context для absolute children. Side ghosts на `top-0 left-0`/`right-0` теперь anchored к main's padding box = viewport edges (минус padding 24px) ниже TopNav (56px). Без `relative` на main, absolute children fallback к layout-shell div (full viewport, включая TopNav) — side ghosts were visible behind TopNav.
- 6: Фикс HomePage.tsx — реструктуризация:
  - Root changed с `<div className="mx-auto max-w-4xl">` на Fragment `<>` с side ghosts + content wrapper.
  - 2 `<img>` side ghosts вынесены ИЗ hero block И ИЗ max-w-4xl — теперь siblings в Fragment.
  - Side ghosts classes: `pointer-events-none absolute left-0 top-0` (shaman) / `absolute right-0 top-0` (iva) — anchor к top-0 of main (ниже TopNav), left-0/right-0 of main (viewport edges).
  - Height: `h-[80vh] max-h-[720px]` (вместо `h-[500px]`) — 90% от natural 800px portrait, full body visible. На 1080p viewport: h=864px capped at 720px. На 900p: h=720px.
  - Удалён `-translate-y-1/2` (больше не center-anchored).
  - Opacity: `opacity-[0.20]` (вместо 0.22) — slightly lower, т.к. larger image size делает их more prominent.
  - Content обёрнут в `<div className="relative z-10 mx-auto max-w-4xl">` — z-10 поднимает content выше side ghosts (z-auto). Без z-10, painting order (CSS stacking context rules): non-positioned blocks (cards, SEO, footer — painted at step 3) были бы BEHIND positioned side ghosts (painted at step 6) → cards' backgrounds спрятаны behind ghosts. z-10 на wrapper создаёт stacking context, поднимающий all descendants выше side ghosts.
  - Hero block: удалены `isolate` и `overflow-hidden` (side ghosts больше не внутри, эти классы не нужны). Остался `relative mb-6 text-center`.
  - Обновлён comment block над hero section: iter 121 — что изменилось, почему.
- 7: Фикс src/index.css — `.hero-side-ghost` и `.hero-side-ghost--right`:
  - Bottom fade: `linear-gradient(to bottom, #000 0%, #000 75%, transparent 100%)` (вместо `#000 55%`) — fade только нижние 25% (ноги/ступни), вместо 45% (большая часть ног). Body полностью visible.
  - Horizontal fade ПОЧИНЕН: `linear-gradient(to right, #000 0%, #000 75%, transparent 100%)` для left-side image (`.hero-side-ghost`) — fade правого 25% (inner edge, toward text). Было `transparent 0%, #000 18%, #000 100%` — fade левого (outer edge, viewport edge) — БАГ.
  - Mirror: `linear-gradient(to left, #000 0%, #000 75%, transparent 100%)` для right-side image (`.hero-side-ghost--right`) — fade левого 25% (inner edge, toward text).
  - `mask-composite: intersect` комбинирует bottom + horizontal fades.
  - WebKit prefix для Safari.
  - Обновлён comment block: iter 121 — что изменилось, почему, ссылка на KI#7.
- 8: Верификация — все 5 проверок зелёные:
  - `npx tsc --noEmit` → **0 errors**.
  - `npx eslint .` → **0 errors, 0 warnings**.
  - `npx vitest run` → **1890/1890 tests passed** (37 test files, без изменений vs iter 120 — UI-only fix).
  - `python3 scripts/audit_block_sort_coverage.py` → **18/18 blocks fully covered** (312 family-keys — без изменений).
  - `npx vite build` → **built successfully** (156 modules, 564 KB JS / 49 KB CSS). Built CSS проверен: `.hero-side-ghost` содержит новые gradient stops `#000 0% 75%, #0000 100%` + `90deg` (right) для left-side, `270deg` (left) для right-side.
- 9: Структурная проверка через Python regex — Fragment open/close OK, оба `<img>` с новыми classes OK, content wrapper с z-10 OK, hero block без `isolate`/`overflow-hidden` в className (только в comments) OK, Layout main с `relative` OK.
- 10: Документация:
  - `STATUS.md` — KI#7 обновлён (iter 120 incomplete, iter 121 truly fixes, 2 бага описаны). "Текущее состояние" переписано под iter 121. Проверки iter 121 (без изменений vs iter 120 — UI-only fix).
  - `worklog.md` — iter 121 подробно, iter 120 сжат до одной строки в "Предыдущие итерации".

Stage Summary:
- **iter 121 COMPLETE.** HomePage hero decorations — ре-фикс. iter 120 fix был неполным (2 бага: head cropping из-за `overflow-hidden` + center-anchor, и images trapped в max-w-4xl). iter 121:
  1. **Layout.tsx** — `<main>` получил `relative` (positioning context для side ghosts).
  2. **HomePage.tsx** — side ghosts вынесены в Fragment (siblings max-w-4xl). Anchor: `absolute top-0 left-0`/`right-0` (viewport edges ниже TopNav). Height `h-[80vh] max-h-[720px]` (90% natural). Opacity 0.20. Content в `relative z-10`. Hero block без `isolate`/`overflow-hidden`.
  3. **src/index.css** — bottom fade `#000 75%` (вместо 55% — softer). Horizontal fade ПОЧИНЕН: на INNER edge (был на OUTER — баг). `.hero-side-ghost` fade right (inner), `--right` fade left (inner).
- **Изменённые файлы (3):**
  - `src/ui/layout/Layout.tsx` — +`relative` на `<main>` className + comment.
  - `src/ui/pages/home/HomePage.tsx` — реструктуризация: Fragment с 2 imgs + content wrapper (relative z-10). Hero block без isolate/overflow-hidden. Comments обновлены.
  - `src/index.css` — `.hero-side-ghost` + `.hero-side-ghost--right`: bottom fade 75% (вместо 55%), horizontal fade на inner edge (вместо outer — bug fix). Comments обновлены.
  - `STATUS.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint/build:** ✅ tsc 0 errors, vitest 1890/1890 (без изменений vs iter 120), eslint 0 problems, vite build OK, audit script 18/18 blocks.
- **НЕ пристроено (перенос из iter 120):** `faf.png` (1672×941, landscape) — пользователь не определил место. Cleanup неиспользуемых atmosphere images (`hero-horned-warrior.webp`, `hero-monster-red.webp`, `hero-bas-relief.webp`, `news-bg-center.webp`) — не сделано (в HomePage они больше не ссылаются, но могут ссылаются в других местах — нужна проверка). Cleanup `--text-faint-val` alias / lift `--text-dim-val` — перенос из iter 111.
- **Точка остановки:** iter 121 done. UI-баг из запроса пользователя исправлен. В iter 122 можно:
  1. **Визуальная верификация пользователем** — UI в браузере на xl+ экране (≥1280px): shaman слева у края экрана, ива справа у края экрана, оба full-body (от головы до ног), головы видны у TopNav, ноги плавно затухают в нижних 25%, inner edge плавно затухает к тексту. На <xl (меньше 1280px) изображения скрыты.
  2. Опционально: cleanup неиспользуемых atmosphere images (`hero-horned-warrior.webp`, `hero-monster-red.webp`, `hero-bas-relief.webp`, `news-bg-center.webp`) — проверить, что нигде больше не ссылаются, удалить с диска.
  3. Опционально: пристроить `faf.png` (если пользователь определит место).
  4. Опционально (перенос из iter 111): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
  5. Опционально: систематизация `other` block (27 family-keys) — LOW priority, heterogeneous.
- **Подсказка следующему агенту:** iter 121 = ре-фикс hero decorations (KI#7 — iter 120 был неполным). Перед стартом iter 122 прочитай STATUS.md (актуальный статус + KI#7 — fixed в iter 121), worklog.md (этот раздел iter 121). Изменённые файлы: `src/ui/layout/Layout.tsx`, `src/ui/pages/home/HomePage.tsx`, `src/index.css`. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 120**: фикс UI-багов — scroll jump-to-top + jitter в VirtualizedModList (KI#6, корректный фикс — остаётся в силе) + HomePage hero decorations (KI#7, фикс был неполным — голова и ноги обрезаны из-за `overflow-hidden` + center-anchor, изображения заперты в max-w-4xl — ре-фикс в iter 121).
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
