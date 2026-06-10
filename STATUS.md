# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 761 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Per-mod want/exclude toggle — каждый FilterChip имеет кнопку ✗/✓ для переключения в режим «не хочу»
- Budget-aware UI feedback — amber-предупреждение при 6+ модах и >180 chars, health bar
- In-game verification: want + exclude pattern — `"want" "!dontwant"` подтверждён
- Colon anchor — для non-% reversed модов с `: ##` шаблоном (верифицировано в игре)
- Real testing of optimizer — `pnpm etl:fresh` выполнен, FP=8224, FN=0, avgLen=18.7
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- Block model VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- In-game test plan — one-tab формат, 6 неверифицированных тестов (регис/плитки для теста в игре.md)

---

## In-game verified patterns

| Паттерн | Формат | Результат |
|---------|--------|-----------|
| Want + AND | `"A" "B"` | ✅ Предметы с A и B |
| Want + OR | `"A\|B"` | ✅ Предметы с A или B |
| Want + Exclude | `"A" "!B"` | ✅ Предметы с A, но без B |
| Exclude (wrong) | `"A" !"B"` | ❌ Ничего не подсвечивает |
| Exclude OR | `"A" "!B\|C"` | ✅ Предметы с A, но без B и C |
| Colon anchor (non-%) | `"suffix.*: N"` | ✅ Предотвращает FP от range notation |
| ^ anchor | `"^(N).*suffix"` | ✅ Число в начале блока |
| % suffix anchor | `"(N)%.*suffix"` | ✅ % после числа |
| .* forward only | `"A.*B"` forward | ✅ Совпадает только в прямом порядке |
| .* block boundary | `"A.*B"` across blocks | ❌ НЕ пересекает блоки |

---

## Известные ограничения

Нет активных.

---

## Next Steps

1. **In-game тестирование** — выполнить 6 тестов из `регис/плитки для теста в игре.md` (T1-T6, one-tab формат)
2. **Обновить IN_GAME_TESTS.md** — внести результаты тестирования
