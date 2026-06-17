# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 73

---

## Known Issues

Нет открытых Known Issues. KI-1 закрыт в iter 73 (см. ниже историю).

### История закрытых KI (для контекста агентов)

- **KI-1 (? tokenizer mismatch)** — закрыт iter 73. Симулятор парсит `?` как `optional` quantifier для engine-completeness, но:
  - Добавлен `hasUnsupportedOptional(pattern)` detector (exported из `src/core/poe2-regex-matcher.ts`).
  - `matchQuotedGroup` эмитит `console.warn` (одноразово per pattern, dedup через `Set`) при обнаружении `?` вне `(?!…)`.
  - Oracle (`validateRegex` / `validateRegexItem`) форсит `valid = false` + `unsupportedSyntax: ['? optional']`.
  - ETL `iterative-optimizer.oracleValidateChange` отклоняет candidate regex с `?`.
  - Generator (compiler / factorizer) `?` НЕ производит — это defensive guard против регрессий.

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
