# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 111
Agent: main
Task: Закрыть Known Issues #3, #4, частично #5 из UI-аудита v2 (точка остановки iter 110 → iter 111).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 110 — все 13 пунктов аудита v2 закрыты), docs/UI_AUDIT.md (полный аудит с приоритизированным планом + секция 8 «точка остановки iter 110»), worklog.md (iter 110 подробно), src/index.css (1223 строки — `:root`/`@theme`/body), ProfilePanel.tsx, StatusPanel.tsx, CategoryControlPanel.tsx, RegexOutput.tsx. Полное понимание задач iter 111.
- 2: Анализ 3 Known Issues и принятие решений:
   - **KI#3** (`--placeholder-secondary: #4b5563` FAIL APCA Lc=-21.3): consolidated с `--text-dim-val`. Также lift `--placeholder-primary` (#6b7280, тоже FAIL) → #7A8494. Оба placeholder-токена теперь WCAG AA PASS на `--input-bg`.
   - **KI#4** (text-dim/text-faint перцептивно идентичны): выбрана опция (b) — консолидация. `--text-faint-val: var(--text-dim-val)` (alias), все 4 `text-faint` Tailwind-класса заменены на `text-dim`. `--color-faint` в `@theme` сохранён как backwards-compat.
   - **KI#5** (APCA Lc≥90 для small text): partial fix — `font-medium` (weight 500) на 2 критичных 12px text-dim лейблах в RegexOutput (part_label + auto-copy toggle). Threshold 90→75, gap FAIL сокращён с 46.4 до 31.4 Lc. Остальные 12px text-dim оставлены weight 400 (дизайн-выбор). KI#5 реклассифицирован как "accepted design tradeoff" — фундаментальный лимит: APCA Lc≥75 для visibly-dim текста математически невозможен без осветления до text-soft уровня.
- 3: Написан `scripts/apca_validate_iter111.py` (APCA 0.0.98G canonical, polarity-aware, soft-clamp ±108). 19 пар проверено, включая BEFORE/AFTER сравнения для KI#3/KI#4. Результаты:
   - KI#3 placeholder-secondary: WCAG 2.32:1→4.64:1, APCA Lc -16.6→-43.6 (FAIL WCAG→PASS WCAG, улучшение +27.0 Lc).
   - KI#3 placeholder-primary: WCAG 3.63:1→4.64:1, APCA Lc -32.5→-43.6 (FAIL WCAG→PASS WCAG, улучшение +11.1 Lc).
   - KI#4 text-faint iter110→iter111: WCAG 5.23:1→5.20:1, APCA Lc -43.9→-43.6 (Δ <1%, подтверждает consolidation).
   - KI#5 text-dim w400 vs w500: APCA Lc=-43.6 в обоих случаях (Lc не зависит от weight), но threshold 90→75, gap 46.4→31.4.
- 4: Реализация правок:
   - `src/index.css` (3 правки): `--placeholder-primary: #6b7280 → #7A8494`, `--placeholder-secondary: #4b5563 → #7A8494`, `--text-faint-val: #7C8494 → var(--text-dim-val)` (alias). Все 3 правки снабжены подробными CSS-комментариями (история + обоснование решения).
   - `src/ui/components/ProfilePanel.tsx` (2 правки): `text-xs text-faint` → `text-xs text-dim` (collapse arrow); `text-[12px] text-faint` → `text-[12px] text-dim` (empty profile label).
   - `src/ui/components/StatusPanel.tsx` (1 правка): `text-[12px] text-faint` → `text-[12px] text-dim` (token list summary).
   - `src/ui/components/CategoryControlPanel.tsx` (1 правка): `text-[12px] text-faint` → `text-[12px] text-dim` (ranged suffixes label).
   - `src/ui/components/RegexOutput.tsx` (2 правки): `text-[12px] text-dim` → `text-[12px] text-dim font-medium` (PartCopyButton part_label + char count; auto-copy toggle label).
- 5: Верификация — все три проверки зелёные:
   - `npx tsc -b` → **0 errors**
   - `npx vitest run` → **1543/1543 tests passed** (36 test files, 5.87s)
   - `npx eslint .` → **0 problems**
   - Правки **только визуальные** (CSS values, Tailwind utility class substitutions, alias). Логика компонентов не тронута. Регрессий нет.
- 6: Документация:
   - `STATUS.md` — полный rewrite: iter 111 как текущее состояние. Таблица 3 правок (KI#3/#4/#5). APCA-метрики секция (PASS body / PASS WCAG+FAIL APCA small-text / weight-500 impact). Known Issues: оставлены #1-2 (старые), #3 реклассифицирован в "accepted design tradeoff" (бывший KI#5). Удалены устаревшие KI#3 (placeholder fix), KI#4 (consolidation fix).
   - `docs/UI_AUDIT.md` — header обновлён «iter 110 + KI#3/#4 closed, #5 reclassified — ✅ iter 111». Секция 8 переписана под iter 111 (что сделано, изменённые файлы, тесты, план iter 112).
   - `worklog.md` — iter 111 подробно, iter 110 сжат до одной строки.

Stage Summary:
- **iter 111 COMPLETE.** Known Issues #3 (placeholder FAIL), #4 (text-dim/text-faint идентичность), #5 (APCA small-text) частично закрыты.
- **Изменённые файлы (5 в репозитории):**
  - `src/index.css` — 3 правки: `--placeholder-primary` (#6b7280→#7A8494), `--placeholder-secondary` (#4b5563→#7A8494), `--text-faint-val` (alias of `--text-dim-val`).
  - `src/ui/components/ProfilePanel.tsx` — 2 правки: `text-faint` → `text-dim`.
  - `src/ui/components/StatusPanel.tsx` — 1 правка: `text-faint` → `text-dim`.
  - `src/ui/components/CategoryControlPanel.tsx` — 1 правка: `text-faint` → `text-dim`.
  - `src/ui/components/RegexOutput.tsx` — 2 правки: `font-medium` к 12px text-dim лейблам (part_label, auto-copy).
  - `STATUS.md`, `docs/UI_AUDIT.md`, `worklog.md` — обновлены.
- **Новые файлы (вне репозитория, в архиве):**
  - `scripts/apca_validate_iter111.py` (APCA 0.0.98G canonical, 19 пар)
  - `scripts/apca_iter111_results.txt` (сохранённый вывод)
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1543/1543, eslint 0 problems.
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (бывший KI#5, реклассифицирован) — APCA Lc<75 для small text — accepted design tradeoff. WCAG AA PASS. Weight 500 на критичных лейблах как частичная компенсация.
- **Точка остановки:** iter 111 done. Все 13 пунктов аудита v2 + 3 Known Issues обработаны. В iter 112 можно:
  1. **Визуальная верификация пользователем** — UI в браузере: контрасты, читаемость 12px, рендеринг Noto Sans (Linux), отсутствие артефактов от letter-spacing/line-height/tnum. Особое внимание: placeholder-текст в chip-inputs теперь #7A8494 (раньше #4b5563) — может выглядеть ярче ожидаемого.
  2. При неудовлетворительности dim-текста: опции (a) lift `--text-dim-val` до #8A92A2; (b) расширить `font-medium` на 8 page mod-counters; (c) принять текущее состояние.
- **Подсказка следующему агенту:** iter 111 = чистовые CSS/JSX правки (KI#3 placeholder consolidation, KI#4 dim/faint consolidation, KI#5 partial font-medium fix). Перед стартом iter 112 прочитай STATUS.md (актуальный статус + Known Issues), docs/UI_AUDIT.md (полный аудит + статус реализации), worklog.md (этот раздел). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

## Предыдущие итерации (кратко)

- **iter 110**: Приоритет 2.7–2.9 + 3.10–3.13 UI-аудита v2 (5 правок CSS/JSX + APCA-валидация). Все 13 пунктов аудита v2 закрыты. 1543/1543 tests. Найдены KI#4 (dim/faint идентичны) и KI#5 (APCA small-text false pass).
- **iter 109**: Приоритет 1 UI-аудита v2 (5 правок CSS/JSX) + Приоритет 2.6 (Noto Sans self-hosted woff2 400/500/600). 1543/1543 tests.
- **iter 108**: фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext` без `regexExclude` — `normalizeAst` в `src/core/compiler.ts` расширен. 1543/1543 tests, +10 regression tests.
- **iter 108-audit**: exhaustive audit iter 108 fix scope. 0 критических нарушений по 10 категориям × 1697 токенов + 543 opt-table entries.
- **iter 107**: UX-полировка P4 — tier-colored left border для 4 tier'ов в tier-first режиме. 1533/1533 tests.
- **iter 106**: P4 — tier-aware sort toggle (alpha vs tier-first). 1522/1522 tests.
- **iter 105**: P2 second half — tablet sub-blocks (19 sub-blocks). 1500/1500 tests.
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix (9 sub-blocks). 1472/1472 tests.
- **iter 103**: подавление 2 TanStack library-level ESLint warnings. 1431/1431 tests.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline (17 тестов). 1431/1431 tests.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other`. 1414/1414 tests.
- **iter 99**: alphabetical within-block sort. 1411/1411 tests.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys). 1392/1392 tests.
- **iter 96**: удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`. 1363/1363 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
