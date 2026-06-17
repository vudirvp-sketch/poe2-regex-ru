# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 71

---

## UI Redesign — план

| Фаза | Статус | Что |
|------|--------|-----|
| 0-13 | ✅ iter 51-68 | CSS-токены → CategoryLayout → nav «режимы» → TopNav → атмосферная стилизация → `.poe-panel-header--inline` на 8 страницах |
| 14 | ✅ iter 69 | HomePage hero decorations: 3 atmospheric images (bas-relief backdrop + 2 side ghosts) |
| 15 | ✅ iter 70 | Visual review lg+/xl+ — hero OK; filter contrast fix (text-dim→text-muted); `.btn-cta` OLED glow toned; `bg-forest.webp` deleted |
| 16 | ✅ iter 71 | Интеграция 3 оставшихся atmospheric WebP: `hero-demon-blue` (SeoBlock), `early-access-banner` (новый `.poe-divider--banner`), `news-bg-center` (mobile hero backdrop) |

---

## Known Issues

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

## Atmospheric Assets (public/atmosphere/)

Все WebP подключены (после iter 71). Чистых кандидатов на интеграцию больше нет.

| Asset | Использование |
|-------|---------------|
| `bg.webp` | Body background (desktop + mobile, iter 65) |
| `bg-2x.webp` | `.poe-divider--ornate` texture (iter 65) |
| `title-bg-4x.webp` | Visual reference only — `.poe-panel-header` reinterpret (iter 65) |
| `early-access-button-underlay.webp` | Visual reference only — `.btn-cta` reinterpret (iter 65) |
| `early-access-banner.webp` | `.poe-divider--banner` — HomePage section divider Features↔SeoBlock (iter 71) |
| `news-bg-center.webp` | Mobile-only (`<lg`) hero backdrop, замена невидимому bas-relief (iter 71) |
| `hero-bas-relief.webp` | lg+ hero backdrop, `mix-blend-screen` opacity 0.18 (iter 69) |
| `hero-horned-warrior.webp` | xl+ L side ghost, opacity 0.28 (iter 69) |
| `hero-monster-red.webp` | xl+ R side ghost, opacity 0.28 (iter 69) |
| `hero-demon-blue.webp` | SeoBlock right-edge decoration, visible only when `<details>` open, opacity 0.10, lg+ only (iter 71) |

---

## SEO-статус

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`.

---
Контакты: Discord **woonderdad**
