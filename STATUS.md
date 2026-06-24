# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 126
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 126: фикс KI#10 — ambiguous suffix FP для `Редкость предметов` (disambiguate от возможной `Редкость монстров`).**

Пользователь сообщил: iter 125 fixed regex `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` подсвечивал путевой камень с имплисетом `Редкость предметов: +11%` (значение < 20, FP). По гипотезе пользователя, на путевом камне обычно 2-4 имплисета, и `едкость` совпадает с несколькими типами редкости (предметов / монстров).

**Root cause:** Токен `waystone.implicit.item_rarity` использовал regex `'едкость'` (7 chars) — слишком общий, матчит любой текст с подстрокой `едкость`, включая гипотетическую `Редкость монстров: +##%` (если такая implicit существует в игре, но не в нашей БД). Когда на waystone есть несколько implicits с `едкость` + `+XX%` ≥20, регекс `едкость.*\+[2-9][0-9]%` матчит любой из них, вызывая FP.

**Фикс:** Заменить regex с `'едкость'` на `'едкость предметов'` (12 chars, literal space) — уникально идентифицирует `Редкость предметов` и НЕ матчит `Редкость монстров` (если такая есть в игре). Применено через `scripts/etl/i18n-overrides.json` + прямой patch `public/generated/waystone.json` + `waystone-desecrated.json` (ETL override mechanism).

**After fix:** `"едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` — уникально матчит `Редкость предметов: +XX%` (XX ≥ 20), НЕ матчит `Редкость монстров: +XX%` (если существует). Длина 107 chars ≤ 250 ✅.

**Ограничение фикса:** Если FP вызван cross-block `.*` (т.е. in-game `.*` пересекает block boundaries, contrary to Phase 7 verification), фикс НЕ поможет — потребуется более invasive fix (literal bridge в compiler). См. KI#11 (NEW) — мониторить.

### Проверки (iter 126)

- **vitest:** 1939/1939 tests passed (39 test files) — +24 новых тестов в `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (5 секций: compile output / disambiguation / JSON data verification / old vs new regex / KI#11 simulator model).
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
8. **KI#10: Ambiguous suffix FP для `Редкость предметов`** (iter 126 — FIXED):
   - **Симптом:** iter 125 fixed regex `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%"` подсвечивал waystone с `Редкость предметов: +11%` (FP). Пользователь сообщило, что `едкость` совпадает с несколькими типами редкости на waystone (предметов + монстров).
   - **Root cause:** Токен `waystone.implicit.item_rarity` использовал regex `'едкость'` (7 chars) — слишком общий, матчит любой текст с `едкость`, включая гипотетическую `Редкость монстров` (если есть в игре).
   - **Фикс iter 126:** Заменить regex с `'едкость'` на `'едкость предметов'` (12 chars, literal space) — уникально идентифицирует `Редкость предметов`. Применено через `scripts/etl/i18n-overrides.json` + patch `public/generated/waystone.json` + `waystone-desecrated.json`.
   - **Regression tests:** `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (NEW).
   - **Awaiting:** in-game verification пользователем — подтвердить, что новый регекс НЕ подсвечивает waystone с `Редкость предметов: +11%` + `Эффективность монстров: +25%`.
9. **KI#11: Cross-block `.*` hypothesis** (iter 126 — NEW, MONITORING):
   - **Гипотеза:** Если in-game `.*` пересекает block boundaries (contrary to Phase 7 verification), то любой reversed RANGE regex вида `suffix.*\+XX%` подвержен FP — `.*` может перейти на другой блок и найти `+XX%` там.
   - **Симптом (если гипотеза верна):** KI#10 фикс (`'едкость предметов'`) НЕ уберёт FP — пользователь продолжит видеть waystone с `Редкость предметов: +11%` в подсветке.
   - **Mitigation plan (если KI#11 подтвердится):** Добавить `literalBridge` поле в AST + использовать literal text между suffix и numRegex вместо `.*` (напр., `едкость предметов: \+XX%` — без `.*`). Требует compiler changes.
   - **Action:** Ждать user verification по KI#10. Если FP сохранится — эскалировать до KI#11 fix.

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
| Ambiguous suffix → multi-implicit FP | ⚠️ | **iter 126** — слишком общий suffix (`едкость`) матчит несколько implicit-типов. Fix: использовать более specific suffix (`едкость предметов`) |
| `.*` cross-block boundaries | ⚠️ | **KI#11 (unverified)** — Phase 7 говорит `.*` не пересекает blocks, но iter 126 FP может быть из-за cross-block `.*`. Ждёт in-game verification. |
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
| Reversed RANGE с ambiguous suffix | Уникальный suffix (`едкость предметов` вместо `едкость`) — explicit ETL override | ✅ iter 126 |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |
| Range-like regexPrefixContext | ❌ не работает — фильтруем на ETL | ✅ iter 112 (fix) |

---

Контакты: Discord **woonderdad**
