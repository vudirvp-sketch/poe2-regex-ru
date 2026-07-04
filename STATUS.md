# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 157 (Mixed AND+OR verified — UI MIXED ready to implement)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 157: Mixed AND+OR логика verified in-game.** 10 тестов (T1–T10) на 3 путевых камнях подтвердили полную механику combined-режима:
- ✅ `"MUST1" "MUST2" "OPT1|OPT2"` — работает (T1, T2, T3)
- ✅ Две OR-группы + AND между ними — работает (T6)
- ✅ `!` item-wide negation в combined-режиме — работает (T7)
- ✅ Truncation длинных имён для экономии длины — работает (T8)
- ✅ Пороговые паттерны в OPT (прямая форма `N%.*suffix`) — работают (T9)
- ✅ OR-группа без матчей → все предметы скрыты (T10)
- ❌ `^` на второй ALT ломает матч (T4) → KI#45
- ❌ Лимит 250 chars жёсткий (T5) → KI#46

Готов к реализации UI-режима «MIXED» в iter 158.

**iter 155: KI#43 deploy retry fix.** `actions/deploy-pages@v4` обёрнут в `Wandalen/wretry.action@v3`. Ожидает подтверждения на следующем push.

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на второй/третьей ALT в OR ломает матч (iter 157).**

**Симптом:** регекс `"X" "^A.*P1|^B.*P2"` matчит только предметы, где первая ALT срабатывает. Вторая ALT НЕ matчит даже если блок содержит B...P2, потому что `^B` требует блок, начинающийся с B.

**Test (T4):** `"бонусу критического урона монстров" "^Монстры имеют.*порога состояний|^сопротивлений стихиям"`. W3 (блок «Урон монстров пробивает 13% сопротивлений стихиям») — ❌ НЕ matчит, хотя блок содержит «сопротивлений стихиям».

**Для UI-режима MIXED:** `^` только на первую ALT в OPT-группе.

**KI#46 — Лимит 250 chars в combined-режиме (iter 157).**

**Симптом:** регекс 268 chars — игра НЕ принимает (T5).

**Для UI-режима MIXED:**
- Счётчик длины в реальном времени, предупреждение при >240 chars.
- Авто-truncation длинных affix names (verified T8 — работает в combined-режиме).
- Ограничение количества mandatory и OPT-альтернатив в UI.

**KI#43 — Transient `actions/deploy-pages` failures (iter 155).**

`Build + Deploy` workflow завершается `failure` при `Deploy to Pages` step (~6s), хотя Build — `success`. Fix: deploy step обёрнут в `Wandalen/wretry.action@v3` (3 attempts, 30s delay). Ожидает подтверждения на следующем push.

### Фоновые (low-priority)

1. **APCA Lc<75 для small text weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
2. **MobileRegexBar chunk 158 KB** — отдельный chunk для mobile-only компонента.
3. **`scripts/patch-ki10-ki12-overrides.ts`** — iter 153 one-shot, удалить после ETL refresh.
4. **`_local-tools/browser-test-iter153.sh`** — iter 153 one-shot, удалить или перенести в `docs/`.

### Закрытые

- ✅ **iter 157:** KI#44 — Mixed AND+OR verified (10 in-game tests T1–T10 PASS).
- ✅ **iter 154:** KI#38 scroll jitter, KI#31 mobile UX, KI#41 ⓘ glyph — user-verified. Repo cleanup.
- ✅ **iter 153:** KI#10/KI#12 — `manualOverride` flag. Bundle 603→342 KB.
- ✅ **iter 152:** KI#42 search focus loss fix.
- ✅ **iter 150:** KI#40 ⭐ pin, KI#41 ⓘ in-box layout.
- ✅ **iter 149:** PriorityFilter removal.
- ✅ **iter 148:** toolbar UX refactor.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND (cross-block + same-block) | ✅ | |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | **только на первой ALT в OR** (iter 46 + iter 157 T4) |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `prefix (A\|B\|C)%.*suffix` | ✅ | iter 15 |
| `^(A\|B\|C).*suffix` | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` | ❌ | Fix: Path D |
| **`"A" "B" "C\|D"` (AND + OR combined)** | ✅ iter 157 | T1/T2/T3 |
| **`"A" "ctx.*X\|ctx2.*Y"` (Path D + AND)** | ✅ iter 157 | T3 |
| **`"A" "OPT1\|OPT2" "OPT3\|OPT4"` (несколько OR)** | ✅ iter 157 | T6 |
| **`"!BAD" "MUST" "OPT1\|OPT2"` (`!` + AND + OR)** | ✅ iter 157 | T7 |
| **Truncation в combined-режиме** | ✅ iter 157 | T8 |
| **Пороги в OPT (прямая `N%.*suffix`)** | ✅ iter 157 | T9 |
| **Пороги в OPT (reversed `suffix.*N%`)** | ⚠️ нужен reversed паттерн | T9 (W3 не matчит — pierce reversed) |
| **OR без матчей → предмет скрыт** | ✅ iter 157 | T10 |
| **`"A" "^X\|^Y"` (`^` на нескольких ALT)** | ❌ iter 157 KI#45 | T4: вторая ALT ломается |
| Regex char limit ≈ 250 chars | ✅ | **жёсткий в combined-режиме** (iter 157 T5) |

---

## Next iteration (iter 157 → iter 158)

**iter 157 завершён: Mixed AND+OR verified (10 тестов). Готов к push.**

**Приоритеты для iter 158:**

1. **Реализовать UI-режим «MIXED»** на основе verified-шаблонов:
   - UI: чекбоксы «обязательный» (MUST) vs «опциональный» (OPT) для каждого аффикса.
   - Генератор: `"MUST1" "MUST2" "OPT1|OPT2|OPT3"` (базовый, T1–T3).
   - Поддержка нескольких OPT-групп: `"MUST" "OPT1|OPT2" "OPT3|OPT4"` (T6).
   - Поле «исключить аффикс» → `!` item-wide (T7).
   - Счётчик длины с предупреждением при >240 chars (KI#46).
   - Авто-truncation длинных affix names (T8 verified).
   - `^`-anchor только на первой OPT-alt (KI#45).
   - Path D (`ctx.*suffix`) разрешён внутри OPT-alt (T3 verified).
   - Пороговые паттерны в OPT: прямая `N%.*suffix` (T9 verified) + reversed `suffix.*N%` (через `reversed` флаг в AST).

2. **Новые баги** (если найдены) — сначала STATUS.md, потом фикс.

3. **Фоновые задачи (опционально):** APCA, MobileRegexBar split, удаление one-shot скриптов.

---

Контакты: Discord **woonderdad**
