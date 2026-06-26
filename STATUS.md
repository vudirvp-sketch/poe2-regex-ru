# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 128
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 128: фикс KI#13 — пропущен implicit `Редкость монстров` + BTS-статы в waystone-аффиксах.**

Пользователь сообщил: во вкладке путевых камней пропущен implicit `Редкость монстров: +х%`, а в суффиксах/префиксах "каша" — попали "за кулисами"-статы, которые не должны быть searchable. Пример: мод-аффикс из 4 `<br>`-сегментов — только первый виден игроку как аффикс, остальные плюсуются за кулисами к имплиситам (`Редкость монстров`, `Шанс выпадения`, `Эффективность`, `Размер групп`, `Редкость предметов`) и отображаются в приплюсованном виде в имплисетах.

**Root cause:**
1. `generateWaystoneImplicitTokens()` в `scripts/etl/normalize.ts` не включал `Редкость монстров: +##%`.
2. `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` (фильтр BTS-токенов) содержал только 4 ключа, не покрывая 6 других паттернов:
   - `На #% больше волшебных и редких монстров` → BTS для `Редкость монстров`
   - `На #% больше шанса появления свойств у редких монстров` → BTS (без прямого implicit)
   - `На #% больше эффективности монстров` → BTS для `Эффективность монстров` (второе wording)
   - `#% увеличение количества редких монстров` → BTS для `Редкость монстров`
   - `#% увеличение количества волшебных монстров` → BTS для `Редкость монстров` (только desecrated)
   - `#% увеличение количества путевых камней, находимых в области` → BTS для `Шанс выпадения` (второе wording)

**Фикс:**
1. Добавлен implicit `Редкость монстров: +##%` с regex `'едкость монстров'` (15 chars, literal space) — disambiguate от `'едкость предметов'` (iter 126).
2. Расширён `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` +6 ключей.
3. Patched `public/generated/waystone.json` (156 → 110 токенов: удалено 47 BTS, +1 implicit) и `waystone-desecrated.json` (32 → 28: удалено 5 BTS, +1 implicit).
4. Override в `scripts/etl/i18n-overrides.json` для обоих категорий.
5. Регрессионные тесты в `tests/core/iter128-ki13-monster-rarity.test.ts` (34 теста, 7 секций).
6. Обновлены `tests/etl/normalize.test.ts` (BTS-source-HTML тест — теперь проверяет normal+desecrated combined) и `tests/etl/cross-validation.test.ts` (расширен диапазон token count).

### Проверки (iter 128)

- **vitest:** 1992/1992 tests passed (41 test files) — +34 новых теста в `tests/core/iter128-ki13-monster-rarity.test.ts`.
- **tsc:** 0 errors.
- **eslint:** 0 problems.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **Сортировка внутри блоков: 6 functional blocks без явных правил** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Поведение: `computeSortKey` → `"999::<familyKey>"` (алфавитная сортировка).
4. **KI#7: HomePage hero decorations** (iter 121 — fixed, awaiting user visual verification).
5. **KI#8: SeoBlock atmosphere backdrop** (iter 122 — fixed, awaiting user visual verification).
6. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). MULTI_RANGE tokens с `(A|B|C)` numRegex в slot N>0 — та же проблема, что и reversed RANGE. Mitigation: расширить `distributeAlternation` при FP.

### Закрытые KI (для справки)

- **KI#10** (iter 126 — VERIFIED in-game iter 127): ambiguous suffix FP для `Редкость предметов` → regex `'едкость'` → `'едкость предметов'`.
- **KI#11** (iter 126 — DISPROVEN iter 127): cross-block `.*` hypothesis ОПРОВЕРГНУТА — `.*` НЕ пересекает lines/blocks.
- **KI#12** (iter 127 — FIXED): tier-hardcoded regex для 7 single-`#` relic tokens → explicit overrides в `i18n-overrides.json`.
- **KI#13** (iter 128 — FIXED): пропущен implicit `Редкость монстров` + BTS-статы в waystone-аффиксах. См. "Текущее состояние" выше.

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
| `prefix.*literal(A\|B\|C)` (`()` ПОСЛЕ `.*` bridge) | ❌ | iter 125 — игнорируется in-game. Fix: Path D distribution |
| Ambiguous suffix → multi-implicit FP | ✅ | iter 126 VERIFIED iter 127. Fix: более specific suffix (`едкость предметов`) |
| `.*` cross-block/line boundaries | ✅ | iter 127 VERIFIED — `.*` НЕ пересекает lines/blocks (Phase 7 в силе) |
| Single-`#` template → tier-hardcoded regex (FN) | ✅ | iter 127. Fix: explicit override |
| BTS-статы в waystone-аффиксах (FP clutter) | ✅ | iter 128. Fix: расширить `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` + добавить implicit `Редкость монстров` |
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
| Reversed RANGE с ambiguous suffix | Уникальный suffix (`едкость предметов` / `едкость монстров`) — explicit ETL override | ✅ iter 126/128 |
| Single-`#` template token | Explicit override с tier-agnostic regex (как у `##` siblings) | ✅ iter 127 (KI#12) |
| BTS-статы в waystone-аффиксах | Фильтр через `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` + новый implicit для суммированных статов | ✅ iter 128 (KI#13) |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |
| Range-like regexPrefixContext | ❌ не работает — фильтруем на ETL | ✅ iter 112 (fix) |

---

Контакты: Discord **woonderdad**
