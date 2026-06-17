# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 61 — Phase 8 (polish): drop always-on `⚠ Диапазон` badge in CategoryControlPanel

---

## iter 61 — Phase 8 (polish): remove range-warning noise

**Симптом:** При активации range-фильтра в `CategoryControlPanel` могли стакаться до 3 warning-бейджей: `⚠ ≥40` + `⚠ Округл.` + `⚠ Диапазон`. Третий (`⚠ Диапазон` — notation FP warning) показывался **всегда** при любом min/max — это константа, не actionable warning, чистый шум.

**Фикс (principle «дорогая тишина»):**
- **Удалён** always-on `⚠ Диапазон` visible badge.
- FP-warning перенесён в `title` range-контейнера — ховер показывает предупреждение, info сохранён.
- Видимыми остались **только конкретные/actionable** warnings: `⚠ ≥40` (PoE2 boundary at 40) и `⚠ Округл.` (round10 + AND fallback when range >50 values).
- Когда ни одно из условий не выполняется — тишина, ни одного `⚠`.

**Результат:** 1144 теста зелёные. `tsc -b` clean. Vite build OK.

---

## Known Issues

| # | Issue | Status |
|---|-------|--------|
| ~~1-5~~ | (см. git history) | ✅ CLOSED iter 46-50 |
| ~~6~~ | `tsc -b` failing — 4 pages missing `t` import (iter 58 regression), JewelPage missing `groupTokensByFamily` | ✅ CLOSED iter 59 |
| ~~7~~ | `MobileRegexBar` visible on desktop — `.mobile-regex-bar { display: flex }` overrode `lg:hidden` (same specificity, source-order tie-break) | ✅ CLOSED iter 60 |

**Открытых Known Issues нет.**

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

## UI Redesign — план (9 фаз)

| Фаза | Статус | Что |
|------|--------|-----|
| 0-7 | ✅ iter 51-60 | CSS-токены → CategoryLayout → RegexOutput Level 1 → nav как «режимы» → HomePage compaction → StatusPanel → MobileRegexBar → iter 60 specificity fix |
| 8 | 🚧 in-progress | Полировка: снять шум, оставить «дорогую тишину». **iter 61:** убран always-on `⚠ Диапазон` badge в CategoryControlPanel. Pending: упростить Features-секцию на HomePage; пересмотреть плотность ModList. |
| 9 | ⏳ | Финальная документация |

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

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`. SeoBlock в `<details>` — контент остаётся в DOM, Google индексирует его даже в закрытом состоянии.

---
Контакты: Discord **woonderdad**
