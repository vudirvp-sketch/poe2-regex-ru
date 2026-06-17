# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 70

---

## UI Redesign — план

| Фаза | Статус | Что |
|------|--------|-----|
| 0-13 | ✅ iter 51-68 | CSS-токены → CategoryLayout → nav «режимы» → TopNav → атмосферная стилизация → `.poe-panel-header--inline` на 8 страницах |
| 14 | ✅ iter 69 | HomePage hero decorations: 3 atmospheric images (bas-relief backdrop + 2 side ghosts) |
| 15 | ✅ iter 70 | Visual review lg+/xl+ — hero OK; filter contrast fix (text-dim→text-muted); .btn-cta OLED glow toned; bg-forest.webp deleted |

---

## Known Issues

**Открытых Known Issues нет.**

---

## iter 71+ Candidates

1. **Интеграция `hero-demon-blue.webp`** — синий демон с лицом-черепом. В `/atmosphere/`, НЕ подключена. Кандидаты: декорация SeoBlock, accent на 404, background category page. Низкий приоритет.
2. **Интеграция `early-access-banner.webp`** (1919×177) — декоративный баннер, кандидат для section divider. Низкий приоритет.
3. **Интеграция `news-bg-center.webp`** (1681×260) — готический фон, кандидат для hero-секции. Низкий приоритет.

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
