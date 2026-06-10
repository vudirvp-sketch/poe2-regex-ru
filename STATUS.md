# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 761 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0
> **In-game верификация:** ✅ ЗАВЕРШЕНА (2026-06-10)

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Per-mod want/exclude toggle — каждый FilterChip имеет кнопку ✗/✓ для переключения в режим «не хочу»
- Budget-aware UI feedback — amber-предупреждение при 6+ модах и >180 chars, health bar
- Colon anchor — для non-% reversed модов с `: ##` шаблоном (верифицировано в игре)
- Real testing of optimizer — `pnpm etl:fresh` выполнен, FP=8224, FN=0, avgLen=18.7
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- **In-game верификация ЗАВЕРШЕНА** — все regex-паттерны проверены в RU клиенте PoE2

---

## In-game verified patterns

| Паттерн | Формат | Результат |
|---------|--------|-----------|
| Want + AND | `"A" "B"` | ✅ Предметы с A и B |
| Want + OR | `"A\|B"` | ✅ Предметы с A или B |
| Want + OR + Exclude | `"A\|B" "!C"` | ✅ Предметы с A или B, но без C |
| OR — none found | `"A\|B"` (нет совпадений) | ✅ 0 предметов |
| AND — one not found | `"A" "B"` (нет предмета с обоими) | ✅ 0 предметов |
| Want + Exclude | `"A" "!B"` | ✅ Предметы с A, но без B |
| Exclude (wrong) | `"A" !"B"` | ❌ Ничего не подсвечивает |
| Exclude OR | `"A" "!B\|C"` | ✅ Предметы с A, но без B и C |
| Colon anchor (non-%) | `"suffix.*: N"` | ✅ Предотвращает FP от range notation |
| ^ anchor | `"^(N).*suffix"` | ✅ Число в начале блока |
| % suffix anchor | `"(N)%.*suffix"` | ✅ % после числа |
| Enumerated range | `"(N1\|N2)%.*suffix"` | ✅ Значения вне диапазона не матчат |
| Dual-number prefix | `"От ([1-9][0-9]).*suffix"` | ✅ Число после «От» проверяется |
| Digit count filter | `"От ([1-9][0-9]).*suffix"` | ✅ 2-значное матчит, 1-значное нет |
| .* forward only | `"A.*B"` forward | ✅ Совпадает только в прямом порядке |
| .* block boundary | `"A.*B"` across blocks | ❌ НЕ пересекает блоки |

---

## Известные ограничения

Нет активных.

---

## Next Steps

1. **Поддержка** — обновлять ETL при изменении модов в новых лигах/патчах
2. **Расширение** — новые категории предметов при появлении в игре
