# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 92

---

## Текущее состояние

**ETL-tagged functionalCategory — полностью в продакшене.** Все 4 категории (jewel/amulet/ring/belt) содержат `functionalCategory` на 100% токенов. Runtime `classifyFunctionalBlock()` использует Strategy 0 (ETL lookup) для всех 477 family-groups. Regex-паттерны сохранены как fallback для категорий без ETL данных.

iter 92: исправлены 2 корневых бага ETL-классификации, все 11 расхождений ETL vs regex устранены.

### Метрики iter 92

| Категория | Токенов | Family-groups | functionalCategory | other-bucket |
|-----------|---------|---------------|--------------------|--------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) |
| amulet | 428 | 105 | 100% | 6.7% (7/105) — было 7.6% |
| ring | 369 | 94 | 100% | 3.2% (3/94) |
| belt | 298 | 85 | 100% | 4.7% (4/85) — было 5.9% |

- **Strategy 0 coverage:** 477/477 (100%)
- **Cross-validation:** 477/477 match (0 расхождений, было 11)
- **Тесты:** 1363/1363 passing. TSC: 0 errors.

### Архитектура functionalCategory

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`):
   - `classifyModFunctionalBlock(tags, rawText)` — standalone классификатор
   - `buildFunctionalCategoryMap()` — строит modId→category из ModCalc страниц
   - **iter 92:** двухпроходная обработка — single-segment tiers (с tier.tags) идут ПЕРЕД multi-segment tiers (text-only per segment)
   - **iter 92:** skip modCodeToCategory для multi-segment tiers (forces text lookup per segment)
   - Jewellery (amulet/ring/belt): прямая классификация по tags+rawText

2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`):
   - **iter 92:** re-classify functionalCategory после патча rawText на русский
   - До фикса: functionalCategory вычислялся по английскому тексту (poe2db breachborn tiers), что давало 'other' или 'damage-type' для русских модов

3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`):
   - Strategy 0: majority voting по `functionalCategory` с токенов (ETL данные)
   - Strategy 1-21: regex fallback (используется только если ETL данных нет)
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()`

---

## Known Issues

1. **Penetration-моды (открыто)** — 3 family-keys в jewel ("Урон пробивает ##% сопротивления ...") классифицируются в `resistances` после iter 92 fix (раньше были inconsistently `resistances`/`damage-type`). Нужен отдельный `penetration` блок — iter 93+.
2. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
3. **AILMENTS_PATTERN неполный** — не ловит "состояний" (для "увеличение силы накладываемых вами состояний"). Мод классифицируется как 'other'. Можно расширить паттерн — iter 93+.
4. **MINIONS_PATTERN неполный** — не ловит "компаньон" (только "приспешник"). Compagnon-моды классифицируются как 'minions' только через tier.tags. Если убрать tags — станут 'damage-type'. Можно расширить паттерн — iter 93+.

---

## Открытые долги

- **Penetration блок**: в `FUNCTIONAL_BLOCK_ORDER` есть `penetration`, но не активен. 3 family-keys в jewel сейчас в `resistances` (после iter 92 fix).
- **Wisps/Conversion блоки**: в `FUNCTIONAL_BLOCK_ORDER` есть, но 0 family-keys в текущих данных.
- **P1-P3**: sortKey, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression — не начаты.
- **Убрать regex-паттерны из classifyFunctionalBlock()** — оставить только Strategy 0 + 'other' fallback (regex больше не нужен для продакшена, но полезен для отладки).

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
