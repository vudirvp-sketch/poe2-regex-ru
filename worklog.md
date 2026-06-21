# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 123
Agent: main
Task: iter 123 — cleanup stale `DELETIONS-iter{121,122}.txt` instruction files. iter 121 создал `DELETIONS-iter121.txt` (указание удалить `README_ITER120.md` + `DELETIONS-iter100.txt`), iter 122 создал `DELETIONS-iter122.txt` (указание удалить 4 stale atmosphere webp + `optimize_hero_images.py`). Оба списка инструкций устарели: целевые файлы уже удалены в соответствующих итерациях. iter 123 завершает cleanup, удаляя сами списки инструкций (по аналогии с тем, как iter 121 удалил `DELETIONS-iter100.txt` после его применения).

Work Log:
- 1: Контекст загружен из STATUS.md (iter 122 = current, KI#7/KI#8 awaiting user verification, 1890/1890 tests), worklog.md (iter 122 section — cleanup + faf интеграция), AGENT_NAVIGATION.md. Репозиторий клонирован с GitHub.
- 2: Проверка ссылок на `DELETIONS-iter121.txt` и `DELETIONS-iter122.txt` — поиск по всем файлам репозитория. Результат: **0 активных ссылок**. Единственное упоминание `DELETIONS-iter` строки — внутри самого `DELETIONS-iter121.txt` (refers to `DELETIONS-iter100.txt` как к файлу для удаления — уже выполнено в iter 121). Оба файла — stale instruction lists, не код, не тесты, не конфиги. Безопасно удалить.
- 3: Cleanup — оба файла удалены:
  - `DELETIONS-iter121.txt` — instruction list от iter 121 (требовал удалить `README_ITER120.md` + `DELETIONS-iter100.txt` — оба уже удалены в iter 121).
  - `DELETIONS-iter122.txt` — instruction list от iter 122 (требовал удалить 4 webp + `optimize_hero_images.py` — все уже удалены в iter 122).
- 4: Документация:
  - `STATUS.md` — актуализирован под iter 123. "Текущее состояние" переписано: cleanup DELETIONS файлов. Подраздел "НЕ сделано в iter 122 (перенос в iter 123+)" удалён (заменён на "НЕ сделано в iter 123 (перенос в iter 124+)"). KI#7 (iter 121) и KI#8 (iter 122) — без изменений, awaiting user visual verification. Проверки iter 123 (без изменений vs iter 122 — cleanup-only, код не затронут).
  - `worklog.md` — iter 123 подробно, iter 122 сжат до одной строки в "Предыдущие итерации".
  - `AGENT_NAVIGATION.md` — header summary обновлён: iter 123 = cleanup DELETIONS файлов, остальное без изменений.
- 5: Верификация — все 5 проверок зелёные (запущены для подтверждения, что cleanup не сломал ничего косвенно):
  - `npx tsc --noEmit` → **0 errors**.
  - `npx eslint .` → **0 errors, 0 warnings**.
  - `npx vitest run` → **1890/1890 tests passed** (37 test files, без изменений vs iter 122 — код не затронут).
  - `python3 scripts/audit_block_sort_coverage.py` → **18/18 blocks fully covered** (312 family-keys — без изменений).
  - `npx vite build` → **built successfully** (без изменений vs iter 122).

Stage Summary:
- **iter 123 COMPLETE.** Cleanup stale DELETIONS instruction files. iter 121 удалил `DELETIONS-iter100.txt` после применения инструкций; iter 123 удаляет `DELETIONS-iter121.txt` и `DELETIONS-iter122.txt` по той же логике (их инструкции выполнены в соответствующих итерациях).
- **Изменённые файлы (3):**
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — обновлены.
- **Удалённые файлы (2):**
  - `DELETIONS-iter121.txt`
  - `DELETIONS-iter122.txt`
- **Тесты/типы/lint/build:** ✅ tsc 0 errors, vitest 1890/1890 (без изменений vs iter 122), eslint 0 problems, vite build OK, audit script 18/18 blocks.
- **НЕ сделано (перенос в iter 124+):**
  1. **Визуальная верификация пользователем** — UI в браузере:
     - KI#7 (iter 121 hero decorations): xl+ экран (≥1280px) — shaman слева у края, ива справа у края, оба full-body, головы у TopNav, ноги плавно затухают в нижних 25%, inner edge плавно затухает к тексту. На <xl скрыты.
     - KI#8 (iter 122 SeoBlock atmosphere): lg+ экран (≥1024px), раскрыть SeoBlock `<details>` — тёплый тёмный арт виден позади SEO-текста, не отвлекает, плавно затухает к низу, текст читаем поверх, `hero-demon-blue.webp` правый край виден поверх backdrop'а.
  2. Опционально (перенос из iter 111): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2 — не сделано (risky без визуальной верификации, low impact).
  3. Опционально (LOW): систематизация `other` block (27 family-keys) — heterogeneous, low priority.
- **Точка остановки:** iter 123 done. Cleanup DELETIONS файлов завершён. В iter 124 можно:
  1. Получить visual feedback от пользователя по KI#7 (hero) и KI#8 (SeoBlock atmosphere). При необходимости — tweak opacity/mask/blend values в `src/index.css` (`.home-seo-atmosphere` и/или `.hero-side-ghost`).
  2. Опционально: cleanup `--text-faint-val` alias / lift `--text-dim-val`.
  3. Опционально (LOW): систематизация `other` block.
- **Подсказка следующему агенту:** iter 123 = cleanup DELETIONS файлов. Перед стартом iter 124 прочитай STATUS.md (актуальный статус + KI#7/KI#8 — awaiting user verification), worklog.md (этот раздел iter 123). Изменённые файлы: только документация (`STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`). Удалённые файлы: `DELETIONS-iter121.txt`, `DELETIONS-iter122.txt`. Код/тесты/UI — без изменений. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 122**: cleanup 4 неиспользуемых atmosphere webp (`hero-horned-warrior`, `hero-monster-red`, `hero-bas-relief`, `news-bg-center`) + dead script `optimize_hero_images.py` + интеграция `faf.png` как `seo-atmosphere.webp` (1600×900, 146 KB) — широкий landscape backdrop в SeoBlock, lg+ only, opacity 0.18, mix-blend-screen, fade bottom 40%. DOM order: atmosphere → demon → content.
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
