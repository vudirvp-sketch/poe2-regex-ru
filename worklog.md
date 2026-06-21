# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 124
Agent: main
Task: iter 124 — cleanup stale `DELETIONS-iter123.txt` instruction file. iter 123 создал `DELETIONS-iter123.txt` (указание пользователю удалить `DELETIONS-iter{121,122}.txt` при применении архива iter 123). Список инструкций устарел: целевые файлы уже удалены в iter 123. iter 124 завершает cleanup, удаляя сам список инструкций (по аналогии с iter 121 → `DELETIONS-iter100.txt`, iter 123 → `DELETIONS-iter{121,122}.txt`).

Work Log:
- 1: Контекст загружен из STATUS.md (iter 123 = current, KI#7/KI#8 awaiting user visual verification, 1890/1890 tests), worklog.md (iter 123 section — cleanup DELETIONS файлов), AGENT_NAVIGATION.md. Репозиторий клонирован с GitHub.
- 2: Проверка ссылок на `DELETIONS-iter123.txt` — поиск по всем файлам репозитория. Результат: **0 активных ссылок**. Единственное упоминание строки `DELETIONS-iter123` — внутри самого файла. Stale instruction list, не код, не тесты, не конфиг. Безопасно удалить.
- 3: Cleanup — `DELETIONS-iter123.txt` удалён. Создан `DELETIONS-iter124.txt` для следующего агента (по установленной конвенции — указание удалить `DELETIONS-iter123.txt` при применении архива iter 124; сам `DELETIONS-iter124.txt` будет удалён в следующей cleanup-итерации).
- 4: Документация:
  - `STATUS.md` — актуализирован под iter 124. "Текущее состояние" переписано: cleanup `DELETIONS-iter123.txt`. Подраздел "НЕ сделано в iter 123" заменён на "НЕ сделано в iter 124 (перенос в iter 125+)". KI#7 (iter 121) и KI#8 (iter 122) — без изменений, awaiting user visual verification. Сортировка-блоки: "без изменений в iter 120/121/122/123" → ".../124". Проверки iter 124 (без изменений vs iter 123 — cleanup-only, код не затронут).
  - `worklog.md` — iter 124 подробно, iter 123 сжат до одной строки в "Предыдущие итерации".
  - `AGENT_NAVIGATION.md` — header summary обновлён: iter 124 = cleanup `DELETIONS-iter123.txt`, остальное без изменений.
- 5: Верификация — все 5 проверок зелёные (запущены для подтверждения, что cleanup не сломал ничего косвенно):
  - `npx tsc --noEmit` → **0 errors**.
  - `npx eslint .` → **0 errors, 0 warnings**.
  - `npx vitest run` → **1890/1890 tests passed** (37 test files, без изменений vs iter 123 — код не затронут).
  - `python3 scripts/audit_block_sort_coverage.py` → **18/18 blocks fully covered** (312 family-keys — без изменений).
  - `npx vite build` → **built successfully** (без изменений vs iter 123).

Stage Summary:
- **iter 124 COMPLETE.** Cleanup stale `DELETIONS-iter123.txt` instruction file. iter 123 удалил `DELETIONS-iter{121,122}.txt` после применения инструкций; iter 124 удаляет `DELETIONS-iter123.txt` по той же логике (его инструкции выполнены в iter 123).
- **Изменённые файлы (4):**
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — обновлены.
  - `DELETIONS-iter124.txt` — создан (instruction list для следующего агента).
- **Удалённые файлы (1):**
  - `DELETIONS-iter123.txt`
- **Тесты/типы/lint/build:** ✅ tsc 0 errors, vitest 1890/1890 (без изменений vs iter 123), eslint 0 problems, vite build OK, audit script 18/18 blocks.
- **НЕ сделано (перенос в iter 125+):**
  1. **Визуальная верификация пользователем** — UI в браузере:
     - KI#7 (iter 121 hero decorations): xl+ экран (≥1280px) — shaman слева у края, ива справа у края, оба full-body, головы у TopNav без обрезки, ноги плавно затухают в нижних 25%, inner edge плавно затухает к тексту. На <xl скрыты.
     - KI#8 (iter 122 SeoBlock atmosphere): lg+ экран (≥1024px), раскрыть SeoBlock `<details>` — тёплый тёмный арт виден позади SEO-текста, не отвлекает от чтения, плавно затухает к низу, текст читаем поверх, `hero-demon-blue.webp` правый край виден поверх backdrop'а.
     - При необходимости — tweak opacity/mask/blend values в `src/index.css` (`.home-seo-atmosphere` и/или `.hero-side-ghost`).
  2. Опционально (перенос из iter 111): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2 — не сделано (risky без визуальной верификации, low impact).
  3. Опционально (LOW): систематизация `other` block (27 family-keys) — heterogeneous, low priority.
  4. (cleanup) удалить `DELETIONS-iter124.txt` в следующей итерации (по аналогии с тем, как iter 124 удалил `DELETIONS-iter123.txt`).
- **Точка остановки:** iter 124 done. Cleanup `DELETIONS-iter123.txt` завершён. В iter 125 можно:
  1. Получить visual feedback от пользователя по KI#7 (hero) и KI#8 (SeoBlock atmosphere). При необходимости — tweak opacity/mask/blend values в `src/index.css`.
  2. Опционально: cleanup `--text-faint-val` alias / lift `--text-dim-val`.
  3. Опционально (LOW): систематизация `other` block.
- **Подсказка следующему агенту:** iter 124 = cleanup-only (`DELETIONS-iter123.txt`). Перед стартом iter 125 прочитай STATUS.md (актуальный статус + KI#7/KI#8 — awaiting user verification), worklog.md (этот раздел iter 124). Изменённые файлы в iter 124: только документация + создан `DELETIONS-iter124.txt`. Удалённые файлы: `DELETIONS-iter123.txt`. Код/тесты/UI — без изменений. Главное событие iter 125 — получить visual feedback от пользователя по KI#7 и KI#8. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 123**: cleanup stale `DELETIONS-iter{121,122}.txt` instruction files (оба — instruction lists от прошлых итераций, целевые файлы уже удалены).
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
