# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 69 — HomePage hero получил 3 атмосферных декорации (bas-relief backdrop на lg+, 2 side ghosts на xl+), мобильный layout iter 57 сохранён.

---

## UI Redesign — план

| Фаза | Статус | Что |
|------|--------|-----|
| 0-13 | ✅ iter 51-68 | CSS-токены → CategoryLayout → nav «режимы» → TopNav → атмосферная стилизация → `.poe-panel-header--inline` на 8 страницах |
| 14 | ✅ iter 69 | HomePage hero decorations: 3 atmospheric images (bas-relief backdrop + 2 side ghosts) |

---

## Known Issues

**Открытых Known Issues нет.**

---

## iter 70 Candidates (требуют in-browser visual review)

1. **`.btn-cta` crimson glow на OLED** — проверить яркость. Если слишком яркий — снизить 0.40 alpha до 0.30 в `.btn-cta:hover`.
2. **Удаление `public/bg-forest.webp` + `public/bg-forest-mobile.webp`** — после 1 release cycle (сейчас оставлены для cached-URL backward-compat).
3. **Контраст мелкого текста в фильтрах на waystone page** — VLM отметил «низкий контраст мелкого текста в фильтрах». Проверить на широком viewport, при необходимости поднять opacity или размер.
4. **HomePage hero decorations — визуальный review** (iter 69):
   - Backdrop `hero-bas-relief.webp` с `mix-blend-screen` + `opacity-0.18` — проверить, не снижает ли читаемость `<h1>` / `<p>` на lg+ viewport. При конфликте: либо опустить opacity до 0.12, либо ограничить backdrop только верхней половиной hero (через `top-0` вместо `top-1/2`).
   - Side ghosts `hero-horned-warrior.webp` (L) + `hero-monster-red.webp` (R) на xl+ — проверить, не «съедают» ли они фокус у заголовка. При конфликте: уменьшить `w-44` → `w-36`, либо опустить opacity 0.28 → 0.20.
   - Если композиция перегружена — отключить side ghosts, оставить только backdrop.
5. **Интеграция `hero-demon-blue.webp`** — 4-я картинка из iter 69 batch (синий демон с лицом-черепом). Доступна в `/atmosphere/`, в HomePage НЕ подключена (3 декорации уже достаточно). Кандидаты для использования: декорация SeoBlock-секции, accent на 404 page, либо фоновый элемент category page (с очень низким opacity). Низкий приоритет — визуальной проблемы не решает.
6. **Интеграция `early-access-banner.webp`** (1919×177) — декоративный баннер, кандидат для section divider. Низкий приоритет.
7. **Интеграция `news-bg-center.webp`** (1681×260) — готический фон с фигурой, кандидат для HomePage hero-секции (альтернатива bas-relief). Низкий приоритет.

### Закрытые кандидаты (iter 68)

- ~~Compact mode для TopNav tabs на md~~ — VLM подтвердил, что 9 табов помещаются без скролла. Закрыто.

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
