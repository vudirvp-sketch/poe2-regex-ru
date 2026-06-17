# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 62 — Phase 8 (polish) COMPLETE; Phase 9 (docs) COMPLETE

---

## UI Redesign — план (9 фаз)

| Фаза | Статус | Что |
|------|--------|-----|
| 0-7 | ✅ iter 51-60 | CSS-токены → CategoryLayout → RegexOutput Level 1 → nav как «режимы» → HomePage compaction → StatusPanel → MobileRegexBar → iter 60 specificity fix |
| 8 | ✅ iter 61-62 | Полировка «дорогая тишина». iter 61: убран always-on `⚠ Диапазон` badge (tooltip instead). iter 62: Features на HomePage в `<details>`; ModList Level-3 badges скрываются когда в scope ровно 1 sub-group |
| 9 | ✅ iter 62 | Финальная документация: STATUS/AGENT_NAVIGATION/ARCHITECTURE/ETL_GUIDE/IN_GAME_TESTS/SEO_PLAN/DATA_CONTRACTS почищены от устаревших секций, оставлены только актуальные pitfalls и контракты |

---

## Known Issues

**Открытых Known Issues нет.**

Закрытые (см. git history): iter 46-50 lookahead/context/char-limit; iter 59 `tsc -b` missing imports; iter 60 MobileRegexBar desktop visibility.

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

## SEO-статус

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`. SeoBlock и Features в `<details>` — контент остаётся в DOM, Google индексирует его даже в закрытом состоянии.

---
Контакты: Discord **woonderdad**
