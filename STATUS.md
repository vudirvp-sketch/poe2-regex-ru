# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 75

---

## Known Issues

### KI-3 (open, iter 75) — poe2db.tw reverted text forms

Между 16 и 17 июня poe2db.tw откатил формулировки текстов модов к старым формам. Current `public/generated/*.json` (от 16 июня, `pnpm etl:fresh`) содержит NEW-формы, актуальный poe2db.tw — OLD-формы.

**Симптом:** `npx tsx scripts/run-etl.ts` (даже с `--fresh`) производит waystone.json с 302 токенами (vs 156 в current JSON) и OLD-формами familyKey (`На #% больше находимых в области путевых камней` вместо `#% увеличение количества путевых камней, находимых в области`).

**Влияние:** нельзя запустить ETL для применения KI-2 фикса (фильтрации implicit-set bonus токенов) — ETL перегенерирует JSON с OLD-формами, что сломает ~40 тестов (cross-validation thresholds, regex content).

**Решение** (отдельная итерация): либо (a) обновить хардкод-ключи KI-2 к OLD-формам + перегенерировать JSON + обновить test thresholds, либо (b) дождаться пока poe2db.tw снова вернёт NEW-формы. Требует анализа что правильнее: OLD или NEW формы.

---

### KI-2 (code-fixed, iter 75) — stale hardcoded implicit-set family keys

`WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` и `TABLET_IMPLICIT_SET_FAMILY_KEYS` в `scripts/etl/normalize.ts` обновлены по актуальным `familyKey.ru` из current JSON (NEW-формы, итерация 16 июня). Тесты конвертированы `it.fails` → `it` (3 теста в `tests/etl/normalize.test.ts`).

**Что сделано:** ключи обновлены (4→2 waystone ключа, 1 tablet ключ с typo-фиксом `%` → `#%`), тесты проходят, документация актуальна.

**Что осталось (blocked by KI-3):** запустить ETL для применения фильтра. Current JSON всё ещё содержит implicit-set bonus токены (15 в waystone, 1 в tablet), потому что ETL не запускался. Когда KI-3 будет решён, ETL перегенерирует JSON и токены исчезнут.

**Старые ключи (для справки):** `На #% больше находимых в области путевых камней`, `#% увеличение эффективности монстров`, `На #% больше редкости находимых в этой области предметов`, `На #% больше размера групп монстров`, `% увеличение количества находимых на карте путевых камней` (typo).

---

### История закрытых KI

- **KI-1 (? tokenizer mismatch)** — закрыт iter 73. `hasUnsupportedOptional()` detector + runtime `console.warn` в `matchQuotedGroup` (dedup Set) + `OracleResult.unsupportedSyntax: string[]` field + ETL `iterative-optimizer.oracleValidateChange` reject.
- **KI-2 (stale implicit-set family keys)** — code-fixed iter 75 (ключи обновлены, тесты конвертированы). Data-level фикс blocked by KI-3.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре (defensive guard в Oracle — iter 73) |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts (iter 50) |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---

## UI Redesign — итог

Атмосферная стилизация PoE2 завершена (iter 51-71). Все WebP из `public/atmosphere/` подключены. 4 CSS-примитива: `.poe-panel-header` / `.poe-divider` / `.poe-divider--banner` / `.btn-cta`. Топовая навигация — единый `TopNav` (iter 64).

---
Контакты: Discord **woonderdad**
