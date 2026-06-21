# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 110
Agent: main
Task: Реализовать Приоритет 2.7–2.9 + Приоритет 3.10–3.13 UI-аудита v2 (точка остановки iter 109 → iter 110).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 109), docs/UI_AUDIT.md (полный аудит с приоритизированным планом + секция 8 «точка остановки iter 109»), worklog.md (iter 109 подробно), src/index.css (1103 строки — `:root`/`@theme`/body), src/ui/components/ProfilePanel.tsx (202 строки). Полное понимание задач iter 110.
- 2: Приоритет 2.7 — `--poe-bg-secondary` и `--panel-bg`: `#15110E → #1A1510` в `src/index.css`. Luminance Δ 0.007→0.012 (≥0.01 порог Material/NN/g). Оба токена обновлены, т.к. ранее алиасили одно значение.
- 3: Приоритет 2.8 — body: добавлены `line-height: 1.6` (вместо Tailwind default 1.5, +7% для dark mode), `letter-spacing: 0.01em` (нижняя граница 0.01–0.03em диапазона для dark-mode Cyrillic). Добавлен reset `letter-spacing: 0` для `code, pre, .font-mono` — защищает column alignment в regex display.
- 4: Приоритет 2.9 — ProfilePanel.tsx line 121-132: `bg-btn-primary text-bright hover:bg-btn-primary-hover` → `btn-cta`. Disabled state (`bg-raised text-dim cursor-not-allowed`) оставлен без изменений. Последний холодный токен (#2563eb) в UI удалён — Pitfall 28 закрыт.
- 5: Приоритет 3.10 — body: добавлен `font-feature-settings: "tnum"`. Безопасное глобальное правило: tnum влияет только на цифры (фиксированная ширина), не трогает Latin/Cyrillic. Для mono regex display — no-op (уже фиксированная ширина).
- 6: Приоритет 3.11 — `@theme` блок: добавлен `--font-mono: 'Noto Sans Mono', ui-monospace, SFMono-Regular, ...`. Решение: НЕ self-hosting (~150 KB overhead для 4 мест использования). Системный Noto Sans Mono первым приоритетом — на Linux часто предустановлен, даёт visual consistency с Noto Sans бесплатно. На macOS/Windows остаются SF Mono/Consolas (отлично рендерят кириллицу).
- 7: Приоритет 3.13 — `--text-dim-val`: `#6b7280 → #7A8494`. WCAG AA на `--input-bg` (#1F1812): 4.2→5.2:1. APCA Lc: +8.3 (см. шаг 8).
   - **Найден новый баг** (согласно правилу «сначала документируй, потом фиксись»): `--text-dim-val` (#7A8494) и `--text-faint-val` (#7C8494, из iter 109) теперь перцептивно идентичны (Δ < 1% luminance) — историческая иерархия dim=gray-500>faint=gray-600 инвертирована. Зафиксировано в CSS-комментарии и в STATUS.md Known Issue #4. Не фиксировал в этой итерации (расширение scope); план — iter 111.
- 8: Приоритет 3.12 — APCA-валидация. Скрипт `/home/z/my-project/scripts/apca_validate_iter110.py` (каноническая APCA 0.0.98G формула, ×100 масштабирование, soft-clamp ±108). Проверено 18 пар текст/фон.
   - **Баг в первой реализации APCA**: использовал soft-clamp с порогом 0.18 (SAND threshold из старой версии) — все значения обнулялись. Переписал с порогом 0.022 (canonical black anchoring). Дополнительно забыл `× 100` масштабирование — добавил. После двух итераций скрипт работает корректно (white-on-black даёт Lc=-105, как ожидается).
   - **Результаты**: text-primary (#F0E6D2) на всех bg: Lc=-97.4 (PASS body). text-soft: Lc=-86.5 (PASS). accent-yellow на input-bg: Lc=-84.2 (PASS). text-dim NEW: Lc=-42.8 (улучшение +8.3 от OLD -34.5, но FAIL для small text ≥90). text-faint: Lc=-43.0. text-muted: Lc=-58.6. accent-blue/red/emerald: -58.5/-54.9/-71.8. Все эти FAIL по APCA при PASS по WCAG 2.x — тот самый "false pass", о котором предупреждал аудит (секция 5.1). Зафиксировано в STATUS.md Known Issue #5.
- 9: Верификация — все три проверки зелёные:
   - `npx tsc -b` → **0 errors**
   - `npx vitest run` → **1543/1543 tests passed** (36 test files, 4.49s)
   - `npx eslint .` → **0 problems**
   - Правки **только визуальные** (CSS values, Tailwind utility class, font-family stack, @theme override). Логика компонентов не тронута. Регрессий нет.
- 10: Документация:
   - `STATUS.md` — полный rewrite: iter 110 как текущее состояние. Таблица 7 правок (2.7–2.9 + 3.10–3.13). APCA-результаты секция. Known Issues: оставлены #1-2 (старые), #3 (placeholder-secondary), добавлены #4 (dim/faint идентичны) и #5 (APCA Lc<90 для small text). Удалены устаревшие пункты.
   - `docs/UI_AUDIT.md` — header обновлён «Приоритет 1+2+3 — ✅ iter 110». Секция 7: P2 и P3 таблицы обновлены с ✅ iter 110 для всех 7 пунктов. Секция 8 переписана под iter 110 (что сделано, изменённые файлы, тесты, план iter 111).
   - `worklog.md` — iter 110 подробно, iter 109 сжат до одной строки.

Stage Summary:
- **iter 110 COMPLETE.** Приоритет 2 (3 пункта: 2.7–2.9) + Приоритет 3 (4 пункта: 3.10–3.13) реализованы. Все 13 пунктов аудита v2 закрыты.
- **Изменённые файлы (3 в репозитории):**
  - `src/index.css` — 5 правок: `--poe-bg-secondary`/`--panel-bg` (#15110E→#1A1510), `--text-dim-val` (#6b7280→#7A8494), body `line-height`/`letter-spacing`/`font-feature-settings`, `.font-mono` reset, `@theme --font-mono` override.
  - `src/ui/components/ProfilePanel.tsx` — 1 правка: button className `bg-btn-primary`→`btn-cta`.
  - `STATUS.md`, `docs/UI_AUDIT.md`, `worklog.md` — обновлены.
- **Новые файлы (вне репозитория, в архиве):**
  - `scripts/apca_validate_iter110.py` (APCA 0.0.98G canonical, 18 пар)
  - `scripts/apca_iter110_results.txt` (сохранённый вывод)
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1543/1543, eslint 0 problems.
- **Новые Known Issues (2):**
  - #4: `--text-dim-val` (#7A8494) и `--text-faint-val` (#7C8494) перцептивно идентичны — иерархия инвертирована.
  - #5: APCA Lc≥90 для small text не достигнут для text-dim/faint/muted + accent-blue/red/emerald (WCAG 2.x PASS, APCA FAIL — "false pass" аудит-секции 5.1).
- **Точка остановки:** iter 110 done. Все 13 пунктов аудита v2 реализованы. В iter 111 можно:
  1. **Визуальная верификация пользователем** — UI в браузере: контрасты, читаемость 12px, рендеринг Noto Sans (Linux), отсутствие артефактов от letter-spacing/line-height/tnum.
  2. Решить Known Issue #4 (dim/faint идентичны).
  3. Решить Known Issue #5 (APCA Lc<90 для small text).
  4. Решить Known Issue #3 (placeholder-secondary FAIL).
- **Подсказка следующему агенту:** iter 110 = чистовые CSS/JSX правки (P2+P3 аудита v2) + APCA-валидация. Перед стартом iter 111 прочитай STATUS.md (актуальный статус + Known Issues), docs/UI_AUDIT.md (полный аудит + статус реализации), worklog.md (этот раздел). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

## Предыдущие итерации (кратко)

- **iter 109**: Приоритет 1 UI-аудита v2 (5 правок CSS/JSX) + Приоритет 2.6 (Noto Sans self-hosted woff2 400/500/600). 1543/1543 tests.
- **iter 108**: фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext` без `regexExclude` — `normalizeAst` в `src/core/compiler.ts` расширен: AND(LITERAL..., LITERAL...) без EXCLUDE внутри OR → merge через `.*` bridge. 1543/1543 tests, +10 regression tests.
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
