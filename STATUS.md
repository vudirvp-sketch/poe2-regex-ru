# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 60 — Fix Known Issue #7 (MobileRegexBar visible on desktop due to CSS specificity)

---

## iter 60 — Fix: MobileRegexBar visible on desktop (Known Issue #7)

**Симптом:** Sticky-bottom `MobileRegexBar` дублировал основной `RegexOutput` на десктопе (≥1024px), хотя должен был быть скрыт через `lg:hidden`.

**Причина:** CSS-специфичность. `.mobile-regex-bar { display: flex; ... }` (custom CSS в конце `index.css`) и `.lg\:hidden { display: none }` (Tailwind, в начале файла внутри `@media (width>=64rem)`) имеют одинаковую специфичность (0,1,0). При равной специфичности побеждает позднее правило в source-order — custom `.mobile-regex-bar` перекрывал `lg:hidden` на десктопе.

**Фикс:** Все правила `.mobile-regex-bar*` обёрнуты в `@media (max-width: 1023px)`. На десктопе они больше не применяются, `lg:hidden` спокойно прячет элемент. См. Pitfall 26 в `AGENT_NAVIGATION.md`.

**Результат:** 1144 теста зелёные. `tsc -b` clean. Vite build OK (156 модулей, 9 prerendered HTML, CSS 42.87 KB / gzip 9.34 KB).

---

## Известные проблемы (Known Issues)

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
| 0-7 | ✅ iter 51-59 | CSS-токены → CategoryLayout → RegexOutput Level 1 → nav как «режимы» → HomePage compaction → StatusPanel → MobileRegexBar |
| 8 | ⏳ next | Полировка: снять шум, оставить «дорогую тишину» |
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
