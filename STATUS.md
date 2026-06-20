# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 108

---

## Текущее состояние

**iter 108: фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext`.**

**Симптом:** при выборе в OR-режиме токенов с `regexPrefixContext` (например, `tablet.mod_by2ufv` «...провал, вплоть до 100%» с regex=`вплоть`, prefixCtx=`провал,`) компилятор генерировал регекс с **вложенными кавычками** внутри внешней OR-группы: `"...\|"провал," "вплоть"\|..."`. PoE2-парсер по правилу B0 (zero matches between quoted groups) такие регексы не подсвечивает ничего.

**Root cause:** `normalizeAst` в `src/core/compiler.ts` transform-ил AND-in-OR только для случая с EXCLUDE (iter 49). Случай **без** EXCLUDE (`AND(LITERAL_ctx, LITERAL_regex)` — обычный shape для токенов с `regexPrefixContext` без `regexExclude`) не покрывался. opt-table Path D маскировал баг для full-family selection, но при partial subset opt-table skip-уется и регекс остаётся сломанным.

**Фикс:** `normalizeAst` расширен — добавлена ветка для `AND(LITERAL..., LITERAL...)` без EXCLUDE внутри OR. LITERALs мержатся через `.*` bridge в один `LITERAL("A.*B.*...")`. Семантически это **более корректно** чем было: same-block AND вместо cross-block AND — именно так и задумывался `regexPrefixContext`.

**Impact:** затронуты все токены с `regexPrefixContext` без `regexExclude` (tablet: 2, amulet/jewel/ring: minion-моды с `имеют`/`заканчиваются`/`воскрешаются`, relic: boss-моды с `Боссы получают`/`Боссы наносят`, waystone/jewel-desecrated).

**Метрики:** 1543/1543 тестов (было 1533, +10 регрессионных). TSC 0 errors. ESLint 0 problems. JSON не тронуты.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional.

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
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---

Контакты: Discord **woonderdad**
