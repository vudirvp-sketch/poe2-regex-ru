# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 74

---

## Known Issues

### KI-2 (open, iter 74) — stale hardcoded implicit-set family keys

`WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` (4 ключа) и `TABLET_IMPLICIT_SET_FAMILY_KEYS` (1 ключ) в `scripts/etl/normalize.ts:380-390` **не матчат** ни один `familyKey.ru` в текущем сгенерированном JSON. Фильтр `isImplicitSetBonus()` молча no-op'ит → implicit-set bonus токены НЕ выфильтровываются из mod-списка (хотя должны — они не searchable как mod text in-game).

**Симптом:** 0 совпадений по всем 5 ключам в `waystone.json` / `waystone-desecrated.json` / `tablet.json`.

**Root cause:** poe2db переформулировал тексты (например, было `#% увеличение эффективности монстров` → стало `На #% больше эффективности монстров`).

**Тесты:** 3 `it.fails` в `tests/etl/normalize.test.ts` (Bug #15 / KI-2 блок). Тесты проходят (expected-fail), пока ключи не матчат. Когда ключи обновят — тесты начнут проходить нормально, `it.fails` сообщит об этом (нужно будет конвертировать в обычный `it`).

**Фикс** (отдельная итерация): обновить хардкод-ключи по актуальным `familyKey.ru` из JSON, запустить ETL. Проверить, что implicit-set bonus токены действительно исчезают из mod-списков.

---

### История закрытых KI

- **KI-1 (? tokenizer mismatch)** — закрыт iter 73. `hasUnsupportedOptional()` detector + runtime `console.warn` в `matchQuotedGroup` (dedup Set) + `OracleResult.unsupportedSyntax: string[]` field + ETL `iterative-optimizer.oracleValidateChange` reject. Generator `?` НЕ производит — defensive guard.

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
