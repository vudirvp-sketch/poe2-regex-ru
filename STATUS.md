# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 68 — `.poe-panel-header--inline` applied to `<h2>` on 8 category pages; TopNav tab font 13px → 14px

---

## UI Redesign — план

| Фаза | Статус | Что |
|------|--------|-----|
| 0-9 | ✅ iter 51-62 | CSS-токены → CategoryLayout → RegexOutput Level 1 → nav «режимы» → HomePage compaction → StatusPanel → MobileRegexBar → polish → Phase 9 docs |
| polish | ✅ iter 63 | Palette consistency |
| 10 | ✅ iter 64 | Sidebar → TopNav |
| 11 | ✅ iter 65 | Атмосферная стилизация PoE2 |
| cleanup | ✅ iter 66 | Удалены неиспользуемые i18n ключи |
| 12 | ✅ iter 67 | Vignette softened 0.55→0.40; gold dots hidden ≤380px; `.poe-panel-header--inline` CSS; new atmosphere assets |
| 13 | ✅ iter 68 | `.poe-panel-header--inline` применён в JSX на 8 category pages; TopNav tab font 13px→14px |

---

## Known Issues

**Открытых Known Issues нет.**

---

## iter 69 Candidates (требуют in-browser visual review)

1. **`.btn-cta` crimson glow на OLED** — проверить яркость. Если слишком яркий — снизить 0.40 alpha до 0.30 в `.btn-cta:hover`.
2. **Удаление `public/bg-forest.webp` + `public/bg-forest-mobile.webp`** — после 1 release cycle (сейчас оставлены для cached-URL backward-compat).
3. **Интеграция `early-access-banner.webp`** — декоративный баннер (1919×177), доступен в `/atmosphere/`. Кандидат для section divider или hero-декорации. Визуальной проблемы не решает — низкий приоритет.
4. **Интеграция `news-bg-center.webp`** — готический фон с фигурой (1681×260), доступен в `/atmosphere/`. Кандидат для HomePage hero-секции. Визуальной проблемы не решает — низкий приоритет.
5. **Контраст мелкого текста в фильтрах на waystone page** — VLM отметил «низкий контраст мелкого текста в фильтрах». Проверить на широком viewport, при необходимости поднять opacity или размер.

### Закрытые кандидаты (iter 68)

- ~~Compact mode для TopNav tabs на md~~ — VLM подтвердил, что 9 табов помещаются без скролла даже на широких viewport. Закрыто.

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

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`.

---
Контакты: Discord **woonderdad**
