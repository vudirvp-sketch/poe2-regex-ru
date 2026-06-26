# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 129
Agent: main
Task: Cleanup + stabilisation — подготовка к UI-рефакторингу. Пользователь: «в этой итерации чисто приведение всего в порядок и устаканивание для дальнейшей работы. пока ничего не реализуем». Также: продумать план UI-улучшений (без реализации) и закрыть KI#7/KI#8.

Work Log:
- 1: Репозиторий клонирован. Контекст загружен из STATUS.md (iter 128 = current, KI#13 FIXED, KI#7/KI#8 awaiting user visual verification, KI#9 monitoring), worklog.md (iter 128 подробно), AGENT_NAVIGATION.md (Pitfall 39 = BTS-фильтр + missing implicit). Baseline проверки: vitest 1992/1992, tsc 0 errors, eslint 0 problems — состояние чистое.
- 2: Cleanup dead patterns в `src/shared/mod-classifier.ts` (теперь обязательно per user instruction "не можно а нужно!"). Цель: удалить BTS-related regex patterns, которые матчат только токены, отфильтрованные на ETL в iter 128 (KI#13). Верификация через Python-скрипт: 0 токенов в `waystone.json` (110 tokens) и `waystone-desecrated.json` (28 tokens) содержат BTS-паттерны — patterns действительно dead. Удалено:
  - `больше.*волшебн.*редк.*монстр` из `POSITIVE_KEYWORDS` (Bug #2 fix iter 84)
  - `шанса появления свойств.*редк.*монстр` и `больше.*эффективн.*монстр` из `NEGATIVE_KEYWORDS` (Bug #2 fix iter 84)
  - `количеств.*редк.*монстр`, `количеств.*волшебн.*монстр`, `больше.*волшебн.*редк.*монстр` из `POSITIVE_LOOT_PATTERNS`
  - `шанса появления свойств.*редк.*монстр` из `NEGATIVE_MONSTER_MODIFIERS_PATTERNS` (kept `Дополнительных свойств у редких монстр` — REAL mod)
  - `волшебн.*монстр|редк.*монстр` из `WAYSTONE_A_PREFIX` (kept `опыт|волшебн.*сундук|редк.*сундук`)
  Comments обновлены с пометкой "iter 129 cleanup: removed ... (BTS, filtered at ETL iter 128 KI#13)". Bug #2 fix comment обновлён: 3 of 4 patterns removed (BTS-only), 1 kept (`бонус.*крит.*урон.*монстр` — REAL mod).
- 3: Тесты обновлены в `tests/shared/mod-classifier.test.ts`:
  - Удалён тест "classifies more magic+rarer monsters as positive (Bug #2 fix)" (BTS pattern).
  - Удалён тест "classifies more rare monster properties as negative (Bug #2 fix)" (BTS pattern).
  - Удалён тест "classifies more monster effectiveness as negative (Bug #2 fix)" (BTS pattern).
  - Удалён тест "classifies more magic+rarer monsters as positive-loot" (BTS sub-block test).
  - Модифицирован тест "classifies rare-monster extra properties as negative-monster-modifiers": оставлена 1-я assertion (REAL mod `Дополнительных свойств у редких монстров: #`), удалена 2-я assertion (BTS `На #% больше шанса появления свойств у редких монстров`).
  Bug #2 fix header comment обновлён: "iter 129 cleanup: 3 of 4 Bug #2 patterns removed (BTS-only, filtered at ETL iter 128 KI#13). Only the real 'бонус.*крит.*урон.*монстр' pattern remains — tested below."
- 4: Верификация после cleanup: `npx vitest run` → 1988/1988 passed (41 test files, -4 vs iter 128). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems. `npx vite build` → succeeds (472ms, 156 modules, 49.43 kB CSS gzip 10.75 kB) — подтверждает что KI#7 (hero-side-ghost CSS) и KI#8 (home-seo-atmosphere CSS) интактны и компилируются.
- 5: KI#7 (HomePage hero decorations, iter 121) → VERIFIED. Реализация проверена: `src/ui/pages/home/HomePage.tsx:87-98` рендерит 2 `<img>` (shaman left + iva right) с `hero-side-ghost` / `hero-side-ghost--right` CSS classes. CSS в `src/index.css:609-662` — mask-image gradients (bottom 25% fade + inner-edge 25% fade, `mask-composite: intersect`). Assets exist: `public/atmosphere/hero-shaman.webp` (128 KB), `public/atmosphere/hero-iva.webp` (77 KB). Build verification: vite build succeeds. Закрыто в STATUS.md.
- 6: KI#8 (SeoBlock atmosphere, iter 122) → VERIFIED. Реализация проверена: `src/ui/pages/home/SeoBlock.tsx:46-63` рендерит 2 `<img>` (`seo-atmosphere.webp` wide backdrop + `hero-demon-blue.webp` right-edge accent) с `home-seo-atmosphere` / `home-seo-demon` CSS classes. CSS в `src/index.css:1077-1126` — opacity 0 → 0.18 (atmosphere) / 0.10 (demon) на `[open]`, `mix-blend-mode: screen`, `mask-image` bottom fade. Assets exist: `public/atmosphere/seo-atmosphere.webp` (146 KB), `public/atmosphere/hero-demon-blue.webp` (61 KB). Build verification: vite build succeeds. Закрыто в STATUS.md.
- 7: UI Refactor Plan написан в `docs/UI_REFACTOR_PLAN.md` (~530 строк, 12 секций). План:
  - **Executive summary** — 10 audit recommendations + 6 user priorities decomposed into 5 phases.
  - **Current state assessment** — что существует (4-level mod list hierarchy, TanStack Virtual, priority tier system, CSS tokens) vs чего нет (collapse, sticky search, basket, show-selected-only, favorites, React Tooltip, TopNav dropdowns).
  - **Goals & non-goals** — explicit: no new dependencies, no light theme, no re-skin, no backend, no i18n overhaul, no regex engine changes.
  - **5 phases** (each = 1 iteration):
    - Phase 1 (foundation): `FilterState` extension (`collapsedGroups`, `showSelectedOnly`, `pinnedIds`) + URL sync backward-compat. No UI yet.
    - Phase 2 (collapse + sticky search): `GroupHeader` component + chevron toggles + sticky search bar. Both `ModList` + `VirtualizedModList`.
    - Phase 3 (selected only + basket): `SelectedBasket` component + "Все / Выбранные" toggle + right-aside restructure.
    - Phase 4 (colors + compact + tooltips): stronger `.affix-header-*` tints + `.filter-chip` class token + `Tooltip` component + compact density (px-2.5 py-1.5 → px-2 py-1, text-[13px] → text-[12px]).
    - Phase 5 (favorites + topnav): `⭐` pin toggle + "Избранные" section + TopNav dropdowns (3 groups).
  - **Phase dependencies** — Phase 1 unblocks 2/3/5; Phase 4 independent.
  - **Risk register** — 8 risks with mitigations (TanStack Virtual scroll position, URL bloat, basket perf, WCAG touch target, etc.).
  - **Open questions** — 6 decisions for user/next agent (collapse default, mobile basket, favorites scope, tooltip trigger, TopNav click behavior, chip density).
  - **Test strategy** — per-phase unit + integration + visual regression + manual verification.
  - **Estimate** — 28 files touched, 5 new files, 52-78 new tests, 5 iterations sequential (3 parallel).
  - **How to start** — recommended Phase 1 first.
- 8: Документация актуализирована:
  - `STATUS.md` — переписан под iter 129: «Текущее состояние» описывает cleanup + KI#7/KI#8 verification + UI plan. KI#7, KI#8 → VERIFIED. "Закрытые KI" сжаты до 6 строк (KI#7/KI#8/KI#10/KI#11/KI#12/KI#13). Добавлен "Next iteration (iter 130)" блок с указанием на `docs/UI_REFACTOR_PLAN.md`.
  - `worklog.md` — iter 129 подробно (этот раздел), iter 128 сжат до одной строки (перенесён в "Предыдущие итерации").
  - `AGENT_NAVIGATION.md` — header summary обновлён под iter 129; Pitfall 40 (dead patterns cleanup) добавлен.

Stage Summary:
- **iter 129 COMPLETE.** Cleanup + stabilisation — подготовка к UI-рефакторингу.
- **Изменённые файлы (6):**
  - `src/shared/mod-classifier.ts` — удалены 6 dead BTS-related patterns из 5 regex констант. Comments обновлены.
  - `tests/shared/mod-classifier.test.ts` — удалены 4 dead-pattern tests, 1 test модифицирован (вторая assertion удалена).
  - `docs/UI_REFACTOR_PLAN.md` — NEW файл, ~530 строк, детальный план на 5 фаз.
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы.
- **Тесты/типы/lint/build:** ✅ vitest 1988/1988 (41 test files; -4 vs iter 128), tsc 0 errors, eslint 0 problems, vite build succeeds (472ms).
- **KI статус:** KI#7 → VERIFIED (iter 129), KI#8 → VERIFIED (iter 129), KI#9 — monitoring (не фиксировано), KI#10-KI#13 — закрыты.
- **НЕ сделано (перенос в iter 130+):**
  1. **In-game verification пользователем KI#13 fix** — проверить, что (a) фильтр `Редкость монстров ≥ +25%` подсвечивает путевые камни с `Редкость монстров: +25%` в имплиситах; (b) фильтры для аффиксов, имевших BTS-сегменты, продолжают работать.
  2. **UI Refactor implementation** — план в `docs/UI_REFACTOR_PLAN.md`, 5 фаз. Рекомендованный старт — Phase 1 (foundation: filter-store + URL sync).
  3. **KI#9 (MULTI_RANGE slot N>0)** — monitoring, не фиксировано.
- **Точка остановки:** iter 129 done. Cleanup завершён, KI#7/KI#8 закрыты, UI план написан. В iter 130:
  1. Читать `docs/UI_REFACTOR_PLAN.md` end-to-end.
  2. Стартовать с Phase 1 (foundation: `FilterState` extension + URL sync для `collapsedGroups`, `showSelectedOnly`, `pinnedIds`).
  3. Получить in-game верификацию KI#13 от пользователя (если возможно).
  4. Если найден новый FP/FN баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.
- **Подсказка следующему агенту:** iter 129 почитал dead patterns (6 BTS-related regex удалены из `src/shared/mod-classifier.ts`, 4 теста удалены). KI#7/KI#8 закрыты (реализация iter 121/122 интактна, build проходит). UI Refactor Plan в `docs/UI_REFACTOR_PLAN.md` — 5 фаз, начать с Phase 1. Перед стартом прочитай STATUS.md (актуальный статус iter 129 + KI#9 monitoring + закрытые KI#7/KI#8/KI#10-KI#13), worklog.md (этот раздел iter 129), Pitfall 40 (dead patterns cleanup) в AGENT_NAVIGATION.md. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 128**: фикс KI#13 — пропущен implicit `Редкость монстров: +##%` + BTS-статы в waystone-аффиксах. Расширен `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` с 4 до 10 ключей, patch `waystone.json` (156→110 tokens) + `waystone-desecrated.json` (32→28). 1992/1992 tests.
- **iter 127**: аудит KI#10-pattern + фикс KI#12 (tier-hardcoded regex для 7 single-# relic tokens). KI#11 ОПРОВЕРГНУТА. 1958/1958 tests.
- **iter 126**: фикс KI#10 — ambiguous suffix FP для `Редкость предметов`. VERIFIED in-game iter 127. 1939/1939 tests.
- **iter 125**: фикс in-game FP `(A|B|C) after .* bridge` для reversed RANGE через `distributeAlternation()` (Path D). 1915/1915 tests.
- **iter 124**: cleanup stale `DELETIONS-iter123.txt`.
- **iter 123**: cleanup stale `DELETIONS-iter{121,122}.txt`.
- **iter 122**: cleanup atmosphere webp + `seo-atmosphere.webp` integration (KI#8).
- **iter 121**: ре-фикс HomePage hero decorations (KI#7 — iter 120 был неполным).
- **iter 120**: фикс scroll jump-to-top + jitter в VirtualizedModList (KI#6) + HomePage hero (KI#7, неполный → ре-фикс iter 121).
- **iter 119**: rage-charges + runes-barrier + penetration block rules. 18 блоков правил, 100% coverage.
- **iter 118**: skill-levels + area-duration + meta-skills block rules.
- **iter 117**: offence-speed + crit + buff-skills block rules.
- **iter 116**: weapon-specific + flasks block rules.
- **iter 115**: resources block rules (29 family-keys).
- **iter 114**: defence-stats block rules (28 family-keys).
- **iter 113**: damage-type block rules (47 family-keys).
- **iter 112**: фикс «Истощения Бездны» regex-баг + sortKey infrastructure (4 блока правил).
- **iter 111**: KI#3/#4/#5 из UI-аудита v2.
- **iter 110**: Приоритет 2.7–2.9 + 3.10–3.13 UI-аудита v2.
- **iter 109**: Приоритет 1 UI-аудита v2 + Noto Sans self-hosted woff2.
- **iter 108**: фикс вложенных кавычек в OR-регексах для `regexPrefixContext` без `regexExclude`.
- **iter 107**: P4 — tier-colored left border.
- **iter 106**: P4 — tier-aware sort toggle.
- **iter 105**: P2 second half — tablet sub-blocks (19 sub-blocks).
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix.
- **iter 103**: подавление 2 TanStack library-level ESLint warnings.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory`.
- **iter 99**: alphabetical within-block sort.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий).
- **iter 96**: удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
