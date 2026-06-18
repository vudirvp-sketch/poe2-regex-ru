# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 81

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

Нет активных долгов. iter 81 закрыл последние три низкоприоритетных бага (#16, #17, useUrlSync-extract).

---

## История закрытых багов (последние)

### Bug #17 (closed iter 81) — negated char class sentinel hack
`src/core/poe2-regex-matcher.ts` кодировал negated char class `[^...]` через sentinel `{from: -1, to: -1}`, prepended к `ranges` — это работало, но было хрупким хаком. iter 81 заменил sentinel на явное поле `negated: boolean` в типах `Token` и `PoE2Regex` для `charClass`. Добавлен тест `tests/core/poe2-regex-matcher.test.ts:175-182` на `[^0-9]` и `[^а-я]` паттерны. Engine-internal feature — PoE2 regex generator никогда не эмитит `[^...]`, но matcher должен корректно парсить и матчить для engine completeness.

### Bug #16 (closed iter 81) — IMPLICIT_RANGE_UNRESTRICTED magic number
`scripts/etl/normalize.ts:440` имел `IMPLICIT_RANGE_UNRESTRICTED = [0, 350] as const` — 350 было произвольным magic number, которое могло клиппать высокоуровневые waystone-имплициты (top-tier waystones могут роллить implicits >350 через implicit-set bonus stacking). iter 81 поднял upper bound до 999 (safe 3-digit ceiling). ETL rerun подтверждает: только 4 implicit-range значения в waystone.json и 4 в waystone-desecrated.json изменились (`350` → `999`), остальной JSON идентичен.

### Bug useUrlSync extract (closed iter 81 — won't fix)
Анализ iter 79 показал, что extract URL-sync effect в отдельный `useUrlSync` хук не оправдан: effect tightly coupled к 13 значениям (6 useState + 7 store-side values), extract не упростит lint rule и не уменьшит coupling. iter 81 формально закрыл этот долг как "won't fix" с обновлённым комментарием в `src/ui/hooks/useCategoryPage.ts:517-523`.

### Bug #13 (closed iter 80) — iterative-optimizer skip `.*[0-9][1-9]`
Skip условие `regex.includes('.*') || regex.includes('[0-9]') || regex.includes('[1-9]')` было dead code — 0 из 1697 token.regex.ru содержат эти паттерны (все regex — literal suffix, number patterns генерируются runtime compiler из RANGE AST). Skip удалён из 4 мест (iterative-optimizer.ts ×2, run-etl.ts, analyze-fn.ts). ETL rerun подтверждает: JSON output идентичен (отличается только version timestamp).

### KI-3 (resolved iter 76) — poe2db.tw reverted text forms
Между 16 и 17 июня 2025 poe2db.tw откатил формулировки текстов модов waystone/tablet к OLD-формам. iter 76 подтвердил, что OLD-формы стабильны >1 года, и завершил фикс ETL rerun с исходными (pre-iter-75) хардкод-ключами.

### KI-2 (closed iter 76) — stale hardcoded implicit-set family keys
`WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` и `TABLET_IMPLICIT_SET_FAMILY_KEYS` в `scripts/etl/normalize.ts` были stale. iter 76 reverted к original OLD-form set + ETL rerun: 160 waystone + 3 tablet implicit-set bonus токенов отфильтровано, 5+5 implicit tokens добавлено.

### KI-1 (closed iter 73) — `?` tokenizer mismatch
`src/core/poe2-regex-matcher.ts` парсил `?` как optional quantifier; PoE2 in-game `?` НЕ поддерживается. Fix: `hasUnsupportedOptional()` detector + runtime warn (dedup Set) + `OracleResult.unsupportedSyntax` flag + ETL `iterative-optimizer` reject.

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
Контакты: Discord **woonderdad**
