# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 72

---

## Known Issues

### KI-1: `?` tokenizer mismatch (симулятор vs игра)

**Симптом:** `src/core/poe2-regex-matcher.ts:111-113` парсит `?` как `optional` quantifier и успешно матчит его в симуляторе. PoE2 in-game **НЕ поддерживает** `?` (verified Phase 7). Любой regex с `?` (вне `(?!…)` lookahead) пройдёт Oracle-валидацию, но **не сработает в игре**.

**Где проявляется:** Oracle (`regex-oracle.ts`) использует matcher для валидации — принимает `?`-regex как валидный. ETL `iterative-optimizer` опирается на Oracle → может пропустить дефектный regex.

**Mitigation:** Generator (compiler/factorizer) `?` НЕ производит — паттерн `?` в generated JSON не появляется. Тесты в `tests/core/poe2-regex-matcher.test.ts:169-183, 932-940` явно залочивают tokenizer-поведение с комментарием "PoE2 does NOT support, but tokenizer should not break".

**Фикс (отложен):** Добавить runtime-warning в `matchPoE2Regex`/`matchQuotedGroup` при обнаружении `?` вне `(?!` контекста. Не ломая существующие тесты (тесты переделать на `expect(warn).toHaveBeenCalled()` вместо `expect(matched).toBe(true)`).

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
| `?` optional | ❌ | **не работает в игре** (см. KI-1) |
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
