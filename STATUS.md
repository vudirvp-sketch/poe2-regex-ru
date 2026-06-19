# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 93

---

## Текущее состояние

**ETL-tagged functionalCategory — полностью в продакшене.** Все 4 категории (jewel/amulet/ring/belt) содержат `functionalCategory` на 100% токенов. Runtime `classifyFunctionalBlock()` использует Strategy 0 (ETL lookup) для всех 477 family-groups. Regex-паттерны сохранены как fallback для категорий без ETL данных.

iter 93: активирован `penetration` блок (3 family-keys в jewel, ранее в `resistances`). Расширены `AILMENTS_PATTERN` (добавлено `накладыва.*состоян`) и `MINIONS_PATTERN` (добавлено `компаньон`) — defensive, без смены классификации текущих модов.

### Метрики iter 93

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | penetration |
|-----------|---------|---------------|--------------------|--------------|-------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 3 (NEW) |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 0 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 0 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 0 |

- **Strategy 0 coverage:** 477/477 (100%)
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors в изменённых файлах.

### Архитектура functionalCategory

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`):
   - `classifyModFunctionalBlock(tags, rawText)` — standalone классификатор (22 шага)
   - `buildFunctionalCategoryMap()` — строит modId→category из ModCalc страниц
   - **iter 92:** двухпроходная обработка — single-segment tiers (с tier.tags) идут ПЕРЕД multi-segment tiers (text-only per segment)
   - **iter 93:** добавлен `PENETRATION_PATTERN` (`пробива.*сопротивлен`) — проверяется ПЕРЕД resistances (pen mods содержат «сопротивления», но функционально это offensive penetration)
   - Jewellery (amulet/ring/belt): прямая классификация по tags+rawText

2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`):
   - **iter 92:** re-classify functionalCategory после патча rawText на русский

3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`):
   - Strategy 0: majority voting по `functionalCategory` с токенов (ETL данные)
   - Strategy 1-22: regex fallback (используется только если ETL данных нет)
   - **iter 93:** добавлен `PENETRATION_PATTERN` в regex fallback (зеркало ETL классификатора)
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()`

### iter 93: что изменилось

- `PENETRATION_PATTERN = /пробива.*сопротивлен/i` — добавлен в **оба** классификатора (ETL + runtime), размещён ПЕРЕД resistances.
- 3 family-keys в jewel перемещены `resistances` → `penetration`:
  - `jewel.mod_5rcjkz` — Урон пробивает (5—10)% сопротивления холоду
  - `jewel.mod_hpfzjc` — Урон пробивает (5—10)% сопротивления огню
  - `jewel.mod_ss8pp2` — Урон пробивает (5—10)% сопротивления молнии
- `MINIONS_PATTERN`: добавлен `компаньон` (defensive — текущие companion-моды уже классифицируются через `minion` tag).
- `AILMENTS_PATTERN`: добавлен `накладыва.*состоян` (defensive — ловит «накладываемых вами состояний»; текущий мод с этим текстом имеет `damage` tag и остаётся в `damage-type`).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **AILMENTS tag-priority**: мод «(5—15)% увеличение силы накладываемых вами состояний» имеет tags `[damage, ailment]` и попадает в `damage-type` (tag `damage` выигрывает у AILMENTS_PATTERN). Для реклассификации нужен tag-priority refactor (ailment tag BEFORE damage-type) — iter 94+.

---

## Открытые долги

- **Wisps/Conversion блоки**: в `FUNCTIONAL_BLOCK_ORDER` есть, но 0 family-keys в текущих данных.
- **Убрать regex-паттерны из classifyFunctionalBlock()** — оставить только Strategy 0 + 'other' fallback (regex больше не нужен для продакшена, но полезен для отладки).
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
