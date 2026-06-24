# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 127
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 127: аудит KI#10-pattern в других категориях + фикс KI#12 (tier-hardcoded regex для single-# relic tokens).**

Пользователь подтвердил: iter 126 fix работает корректно. Regex `"едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` матчит нужное, FP устранён. **KI#11 (cross-block .* hypothesis) ОПРОВЕРГНУТА** — `.*` НЕ пересекает line boundaries в PoE2 (per Phase 7 verification остаётся в силе).

iter 127 аудит других категорий (tabs/optimizer/generator) на KI#10-pattern:
- **Waystone implicits** (`падения`, `р групп`, `ивность`, `оступно`) — SAFE. Каждое implicit на отдельной line в PoE2, `.*` не пересекает lines.
- **Explicits (amulet/belt/ring/jewel)** — SAFE. Cross-family FP уже обрабатываются через `regexExclude` / `regexPrefixContext` в ETL.
- **Relic tokens** — **KI#12 найден**: 7 tokens с single-`#` template имеют tier-hardcoded regex (содержит конкретную digit: `4`, `5`, `6`, `2`). Их `##` siblings имеют tier-agnostic regex. Семейные optimization entries используют первый (alphabetically) regex → tier-hardcoded → **FN для tiers 2+**.

**iter 126 (completed, VERIFIED in-game):** фикс KI#10 — ambiguous suffix FP для `Редкость предметов`.

Пользователь сообщил: iter 125 fixed regex `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` подсвечивал путевой камень с имплисетом `Редкость предметов: +11%` (значение < 20, FP). По гипотезе пользователя, на путевом камне обычно 2-4 имплисета, и `едкость` совпадает с несколькими типами редкости (предметов / монстров).

**Root cause:** Токен `waystone.implicit.item_rarity` использовал regex `'едкость'` (7 chars) — слишком общий, матчит любой текст с подстрокой `едкость`, включая гипотетическую `Редкость монстров: +##%` (если такая implicit существует в игре, но не в нашей БД). Когда на waystone есть несколько implicits с `едкость` + `+XX%` ≥20, регекс `едкость.*\+[2-9][0-9]%` матчит любой из них, вызывая FP.

**Фикс:** Заменить regex с `'едкость'` на `'едкость предметов'` (12 chars, literal space) — уникально идентифицирует `Редкость предметов` и НЕ матчит `Редкость монстров` (если такая есть в игре). Применено через `scripts/etl/i18n-overrides.json` + прямой patch `public/generated/waystone.json` + `waystone-desecrated.json` (ETL override mechanism).

**After fix:** `"едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` — уникально матчит `Редкость предметов: +XX%` (XX ≥ 20), НЕ матчит `Редкость монстров: +XX%` (если существует). Длина 107 chars ≤ 250 ✅.

### Проверки (iter 127)

- **vitest:** 1958/1958 tests passed (40 test files) — +19 новых тестов в `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (7 секций: per-token regex / family-level opt entries / compile-time AND-logic / FN regression / KI#11 disprove / audit / i18n-overrides verification).
- **tsc:** 0 errors.
- **eslint:** 0 problems.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 6 functional blocks без явных правил** (iter 119):
   - Блоки БЕЗ правил: `other` (27), `magic-find` (1), `breach` (1), `spirit` (1), `wisps` (0), `conversion` (0).
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка.
5. **KI#7: HomePage hero decorations** (iter 121 — fixed, awaiting user visual verification): shaman слева + ива справа, full-body, xl+ only.
6. **KI#8: SeoBlock atmosphere backdrop** (iter 122 — fixed, awaiting user visual verification): `seo-atmosphere.webp` 1600×900, lg+ only, opacity 0.18, mix-blend-screen.
7. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING):
   - **Симптом:** MULTI_RANGE токены с двумя+ placeholders, где slot N>0 содержит `(A|B|C)` numRegex — та же проблема, что и reversed RANGE (iter 125 фиксит только reversed RANGE).
   - **Mitigation:** на практике MULTI_RANGE tokens используют простые char-class numRegexes, `()` встречается редко. Если возникнет FP — расширить `distributeAlternation` до MULTI_RANGE (combinatorial, до 3×3=9 альтернатив).
8. **KI#10: Ambiguous suffix FP для `Редкость предметов`** (iter 126 — FIXED, **VERIFIED in-game iter 127**):
   - **Симптом:** iter 125 fixed regex `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%"` подсвечивал waystone с `Редкость предметов: +11%` (FP).
   - **Root cause:** Токен `waystone.implicit.item_rarity` использовал regex `'едкость'` (7 chars) — слишком общий, матчит любой текст с `едкость`, включая гипотетическую `Редкость монстров` (если есть в игре).
   - **Фикс iter 126:** Заменить regex с `'едкость'` на `'едкость предметов'` (12 chars, literal space).
   - **iter 127 VERIFIED:** Пользователь подтвердил — новый регекс работает корректно. KI#11 hypothesis ОПРОВЕРГНУТА.
9. **KI#11: Cross-block `.*` hypothesis** (iter 126 — DISPROVEN iter 127):
   - **Гипотеза была:** in-game `.*` пересекает block boundaries, вызывая FP.
   - **Status:** ОПРОВЕРГНУТА. iter 126 fix работает → `.*` НЕ пересекает lines/blocks. Phase 7 verification остаётся в силе.
10. **KI#12: Tier-hardcoded regex для single-# relic tokens** (iter 127 — FIXED):
    - **Симптом:** 7 relic tokens с single-`#` template (одна digit, не `##` range) получили regex, содержащий конкретную digit: `'на 6%'`, `'на 4%'`, `'а на 5'`, `'ат: 2'`, `'ат: 4'`, `'ры наносят уменьшенный на 5'`, `'сы наносят уменьшенный на 5'`. Их `##` siblings имеют tier-agnostic regex.
    - **Root cause:** ETL auto-compute для single-`#` templates падает через все suffix strategies (suffix too short) в substring search, который находит shortest unique substring — и эта substring часто включает сам digit. Family-level optimization entry использует первый (alphabetically) regex → tier-hardcoded → **FN для tiers 2+** (фильтр матчит только tier 1).
    - **Фикс iter 127:** Explicit regex overrides в `i18n-overrides.json` для всех 7 tokens, используя tier-agnostic regex от их `##` siblings. Patch `public/generated/relic.json` (7 token regexes + 4 family-level optimization entries + delete 3 broken cross-family entries).
    - **Regression tests:** `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (NEW) + audit script `scripts/audit-tier-hardcoded-regex.py` (NEW).

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone (вся quoted group) | ✅ | in-game verified (iter 15) |
| `(A\|B\|C)%.*suffix` (`()` в НАЧАЛЕ quoted group) | ✅ | Threshold pattern, iter 15 T2 |
| `prefix (A\|B\|C)%.*suffix` (`()` после literal+space) | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` (`()` после `^`) | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` (`()` ПОСЛЕ `.*` bridge) | ❌ | **iter 125** — игнорируется in-game, матчит prefix broadly. Fix: Path D distribution |
| Ambiguous suffix → multi-implicit FP | ⚠️ → ✅ | **iter 126 VERIFIED iter 127** — слишком общий suffix (`едкость`) матчит несколько implicit-типов. Fix: более specific suffix (`едкость предметов`). KI#10 закрыт. |
| `.*` cross-block/line boundaries | ✅ | **iter 127 VERIFIED** — `.*` НЕ пересекает lines/blocks (Phase 7 в силе). KI#11 опровергнута. |
| Single-`#` template → tier-hardcoded regex (FN) | ⚠️ → ✅ | **iter 127** — ETL auto-compute для single-`#` templates производит tier-hardcoded regex (FN для tiers 2+). Fix: explicit override. KI#12 закрыт. |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE (≥min) | `^N.*suffix` (Phase 9b) | ✅ |
| Reversed RANGE (implicits, `suffix.*N`) | `suffix.*A\|suffix.*B\|...` (Path D distribution) | ✅ iter 125 |
| Reversed RANGE с ambiguous suffix | Уникальный suffix (`едкость предметов` вместо `едкости`) — explicit ETL override | ✅ iter 126 VERIFIED iter 127 |
| Single-`#` template token | Explicit override с tier-agnostic regex (как у `##` siblings) | ✅ iter 127 (KI#12) |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |
| Range-like regexPrefixContext | ❌ не работает — фильтруем на ETL | ✅ iter 112 (fix) |

---

Контакты: Discord **woonderdad**
