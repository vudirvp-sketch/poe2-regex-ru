# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 94

---

## Текущее состояние

**ETL-tagged functionalCategory — полностью в продакшене.** Все 4 категории (jewel/amulet/ring/belt) содержат `functionalCategory` на 100% токенов. Runtime `classifyFunctionalBlock()` использует Strategy 0 (ETL lookup) для всех 477 family-groups. Regex-паттерны сохранены как fallback для категорий без ETL данных.

iter 94: AILMENTS tag-priority refactor — AILMENTS_PATTERN (с `ailment` tag check) перемещён ПЕРЕД DAMAGE_TYPE. Теперь ailment tag выигрывает у damage tag (но critical tag всё ещё выигрывает — CRIT шаг 14, AILMENTS шаг 15). 26 модов реклассифицированы `damage-type → ailments` (jewel: 21, amulet: 1, ring: 1, belt: 3). 4 ailment-tagged группы остались в higher-priority buckets (crit/weapon-specific/resources/defence-stats) — ожидаемо.

### Метрики iter 94

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | ailments (iter94) | ailments (iter93) | damage-type (iter94) | damage-type (iter93) |
|-----------|---------|---------------|--------------------|--------------|-------------------|-------------------|----------------------|----------------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 29 | 8 | 24 | 45 |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 1 | 0 | 6 | 7 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 4 | 3 | 18 | 19 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 3 | 0 | 7 | 10 |

- **Strategy 0 coverage:** 477/477 (100%)
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors в изменённых файлах.
- **other-bucket:** без изменений (refactor перемещает моды между damage-type и ailments, не влияет на other).

### Архитектура functionalCategory

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`):
   - `classifyModFunctionalBlock(tags, rawText)` — standalone классификатор (22 шага)
   - `buildFunctionalCategoryMap()` — строит modId→category из ModCalc страниц
   - **iter 92:** двухпроходная обработка — single-segment tiers (с tier.tags) идут ПЕРЕД multi-segment tiers (text-only per segment)
   - **iter 93:** `PENETRATION_PATTERN` (`пробива.*сопротивлен`) — проверяется ПЕРЕД resistances
   - **iter 94:** AILMENTS (tag `ailment` + AILMENTS_PATTERN) перемещён ПЕРЕД DAMAGE_TYPE; CRIT (шаг 14) всё ещё выигрывает у AILMENTS (шаг 15) для crit-ailment модов
   - Jewellery (amulet/ring/belt): прямая классификация по tags+rawText

2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`):
   - **iter 92:** re-classify functionalCategory после патча rawText на русский

3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`):
   - Strategy 0: majority voting по `functionalCategory` с токенов (ETL данные)
   - Strategy 1-22: regex fallback (используется только если ETL данных нет)
   - **iter 93:** `PENETRATION_PATTERN` в regex fallback (зеркало ETL)
   - **iter 94:** AILMENTS regex fallback mirror — tag `ailment` + AILMENTS_PATTERN, BEFORE DAMAGE_TYPE
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()`

### iter 94: что изменилось

- AILMENTS_PATTERN (`scripts/etl/classify-functional-category.ts` + `src/shared/mod-classifier.ts`):
  - **MOVED** с шага 17 (после OFFENCE_SPEED) на шаг 15 (после CRIT, перед DAMAGE_TYPE)
  - **ADDED** `ailment` tag check: `if (functionalTags.has('ailment') || AILMENTS_PATTERN.test(rawText)) return 'ailments';`
- 3 target jewel мода проверены:
  - `jewel.mod_l1y0fl` «сила накладываемых вами состояний» (damage,ailment tags): damage-type → ailments ✓
  - `jewel.mod_40sol4` «Наносящие урон состояния наносят урон быстрее» (damage,ailment tags): damage-type → ailments ✓
  - `jewel.mod_j05iep` «сила наносящих урон состояний при крит» (damage,critical,ailment tags): stays crit (critical tag wins at step 14) ✓
- 4 ailment-tagged группы остались в higher-priority buckets (expected):
  - `jewel.mod_j05iep` → crit (critical tag wins)
  - `jewel.mod_nuzdb5` «скорость заморозки боевыми посохами» → weapon-specific (weapon name wins)
  - `jewel.mod_cgpq5s` «порог состояний в размере % от максимума щита» → resources (ES max wins)
  - `jewel.mod_knitv6` «порог оглушения при парировании» → defence-stats (stun threshold wins)
- Симуляция: `npx tsx scripts/simulate-iter94-impact.ts` — 26 reclassifications (all damage-type → ailments), 0 FPs.
- Верификация: `npx tsx scripts/verify-iter94-fixes.ts` — 3 target tokens + 0 cross-validation discrepancies.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15). Это intentional — critical tag семантически важнее. Если в будущем понадобится реклассифицировать — переместить AILMENTS перед CRIT (но это может сломать другие crit-ailment моды).

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
