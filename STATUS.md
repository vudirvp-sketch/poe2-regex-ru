# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 76

---

## Known Issues

На данный момент открытых KI нет. Все Known Issues (KI-1, KI-2, KI-3) закрыты.

---

## История закрытых KI

### KI-3 (resolved iter 76) — poe2db.tw reverted text forms

Между 16 и 17 июня 2025 poe2db.tw откатил формулировки текстов модов waystone/tablet к OLD-формам. iter 75 обнаружил это и заблокировал data-level фикс KI-2 (ETL rerun), потому что OLD-формы сломали бы тесты.

**Решение iter 76 (17 июня 2026):** проверка `curl https://poe2db.tw/ru/Waystones | grep -c "находимых в области"` подтвердила 107 matches (= OLD forms). OLD forms стабильны уже > 1 года. Решено: OLD forms правильные, ETL запущен с исходными (pre-iter-75) хардкод-ключами.

**Что сделано iter 76:**
- `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` reverted к original 4 ключам (pre-iter-75)
- `TABLET_IMPLICIT_SET_FAMILY_KEYS` reverted к `% увеличение количества находимых на карте путевых камней` (с typo `%` — матч с source HTML verbatim)
- ETL rerun: waystone 302 raw → 156 final (filtered 160 implicit-set bonus + added 5 implicit), tablet 86 raw → 84 final (filtered 3 + added 5)
- Test threshold: waystone `150-200` → `140-200` (commented: OLD ~147, NEW ~156)
- Tests restructured: проверяют что (a) хардкод-ключи присутствуют в source HTML и (b) post-ETL JSON НЕ содержит implicit-set bonus familyKeys (filter сработал)

### KI-2 (closed iter 76) — stale hardcoded implicit-set family keys

`WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` и `TABLET_IMPLICIT_SET_FAMILY_KEYS` в `scripts/etl/normalize.ts` были stale (не матчили actual `familyKey.ru` в source HTML). Как результат, `isImplicitSetBonus` был no-op, и implicit-set bonus токены не фильтровались.

**iter 76 fix (data-level):** ключи reverted к original OLD-form set. ETL rerun применил фильтр корректно — 160 waystone + 3 tablet implicit-set bonus токенов удалено, заменено 5 + 5 implicit tokens с reversed regex format. Tests в `tests/etl/normalize.test.ts` (5 тестов в KI-2 блоке) подтверждают и key correctness (vs source HTML) и filter execution (vs generated JSON).

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
