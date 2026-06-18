# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 79

---

## Known Issues

На данный момент открытых KI нет. Все Known Issues (KI-1, KI-2, KI-3) закрыты.

---

## Открытые долги (отдельные итерации)

| Приоритет | Что | Сложность | Риск |
|-----------|-----|-----------|------|
| 🟢 низкий | Bug #13 — `iterative-optimizer.ts:470` skip `.*[0-9][1-9]` — ranged-regexes не валидируются Oracle. **Analysis iter 78:** skip не 1-line fix — removing condition изменяет ETL output (public/generated/*.json). Требует careful analysis Oracle behavior с number patterns + ETL rerun. | низкая | средний (ETL behavior) |
| 🟢 низкий | Bug #16 — `IMPLICIT_RANGE_UNRESTRICTED = [0, 350]` magic number → `[0, 999]` или динамически | низкая | средний (ETL behavior) |
| 🟢 низкий | Bug #17 — `poe2-regex-matcher.ts:141` negated char class `from: -1, to: -1` хак → `negated: boolean` флаг | низкая | низкий (engine-internal) |
| 🟢 низкий | Lint cleanup остаток — 2 problems (2 library warnings unfixable: `useVirtualizer` returns non-memoizable functions). **iter 79 closed** все 3 setState-in-effect errors. | — | — |

---

## История закрытых KI

### KI-3 (resolved iter 76) — poe2db.tw reverted text forms
Между 16 и 17 июня 2025 poe2db.tw откатил формулировки текстов модов waystone/tablet к OLD-формам. iter 75 обнаружил это и заблокировал data-level фикс KI-2 (ETL rerun). **Решение iter 76:** OLD forms стабильны > 1 года, ETL запущен с исходными (pre-iter-75) хардкод-ключами.

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

## UI Redesign — итог
Атмосферная стилизация PoE2 завершена (iter 51-71). Все WebP из `public/atmosphere/` подключены. 4 CSS-примитива: `.poe-panel-header` / `.poe-divider` / `.poe-divider--banner` / `.btn-cta`. Топовая навигация — единый `TopNav` (iter 64).

---
Контакты: Discord **woonderdad**
