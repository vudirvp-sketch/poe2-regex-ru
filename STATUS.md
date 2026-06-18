# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 91

---

## Текущее состояние

**ETL-tagged functionalCategory — полностью в продакшене.** Все 4 категории (jewel/amulet/ring/belt) содержат `functionalCategory` на 100% токенов. Runtime `classifyFunctionalBlock()` использует Strategy 0 (ETL lookup) для всех 477 family-groups. Regex-паттерны сохранены как fallback для категорий без ETL данных.

### Метрики iter 91

| Категория | Токенов | Family-groups | functionalCategory | other-bucket |
|-----------|---------|---------------|--------------------|--------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) |
| amulet | 428 | 105 | 100% | 7.6% (8/105) |
| ring | 369 | 94 | 100% | 3.2% (3/94) |
| belt | 298 | 85 | 100% | 5.9% (5/85) |

- **Strategy 0 coverage:** 477/477 (100%) — все family-groups используют ETL lookup
- **Cross-validation:** 466 match, 11 расхождений ETL vs regex (ETL точнее в большинстве случаев)
- **Тесты:** 1363/1363 passing. TSC: 0 errors.

### Архитектура functionalCategory

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`):
   - `classifyModFunctionalBlock(tags, rawText)` — standalone классификатор
   - `buildFunctionalCategoryMap()` — строит modId→category из ModCalc страниц
   - Jewel: match по modCode → normalizedText → fallback classifier
   - Jewellery (amulet/ring/belt): прямая классификация по tags+rawText

2. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`):
   - Strategy 0: majority voting по `functionalCategory` с токенов (ETL данные)
   - Strategy 1-21: regex fallback (используется только если ETL данных нет)
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()` (другие режимы группировки)

---

## Known Issues

1. **11 расхождений ETL vs regex classifier** — ETL классификация использует ModCalc tags, которые отличаются от токенных tags. В большинстве случаев ETL точнее, но есть исключения:
   - `jewel.mod_764thg` ("сила умений аур"): ETL=`area-duration`, regex=`buff-skills`. Regex корректнее — мод про ауры.
   - Penetration-моды ("Урон пробивает сопротивления"): ETL даёт `resistances`/`damage-type` inconsistently. Нужен `penetration` блок.
   - Flask-conditional моды: ETL=`flasks`, regex=`damage-type`/`offence-speed`. ETL точнее для UX.
2. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.

---

## Открытые долги

- **OP-1**: перегруппировка аффиксов. iter 85-91 — 20 активных блоков + ETL-tagged functionalCategory в продакшене.
- **Penetration блок**: в `FUNCTIONAL_BLOCK_ORDER` есть `penetration`, но не активен. 2-3 family-keys в jewel.
- **Wisps/Conversion блоки**: в `FUNCTIONAL_BLOCK_ORDER` есть, но 0 family-keys в текущих данных.
- **P1-P3**: sortKey, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression — не начаты.

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
| `?` optional | ❌ | не работает в игре |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

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
Контакты: Discord **woonderdad**
