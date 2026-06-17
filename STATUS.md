# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 67 — vignette softened (0.55→0.40), gold dots hidden ≤380px, `.poe-panel-header--inline` CSS class added (not in JSX yet), new atmosphere assets added

---

## UI Redesign — план (9 фаз + polish + Phase 10-11 + cleanup + iter 67)

| Фаза | Статус | Что |
|------|--------|-----|
| 0-7 | ✅ iter 51-60 | CSS-токены → CategoryLayout → RegexOutput Level 1 → nav как «режимы» → HomePage compaction → StatusPanel → MobileRegexBar → iter 60 specificity fix |
| 8 | ✅ iter 61-62 | Полировка «дорогая тишина» |
| 9 | ✅ iter 62 | Финальная документация |
| polish | ✅ iter 63 | Palette consistency |
| 10 | ✅ iter 64 | Sidebar → TopNav |
| 11 | ✅ iter 65 | Атмосферная стилизация PoE2 |
| cleanup | ✅ iter 66 | Удалены неиспользуемые i18n ключи |
| 12 | ✅ iter 67 | Vignette softened 0.55→0.40; gold dots hidden ≤380px; `.poe-panel-header--inline` CSS (not in JSX); new atmosphere assets (`early-access-banner.webp`, `news-bg-center.webp`) |

---

## Known Issues

**Открытых Known Issues нет.**

---

## iter 68 Candidates (требуют in-browser visual review)

1. **`.poe-panel-header--inline` на category page `<h2>`** (8 страниц) — CSS класс готов, но не применён в JSX. Тест: добавить класс в DevTools на любой category page `<h2>`, проверить визуальное объединение TopNav + page-header. Риск: рамка вокруг inline-flex h2 с иконкой может выглядеть «коробочно».
2. **`.btn-cta` crimson glow на OLED** — проверить яркость. Если слишком яркий — снизить 0.40 alpha до 0.30 в `.btn-cta:hover`.
3. **Удаление `public/bg-forest.webp` + `public/bg-forest-mobile.webp`** — после 1 release cycle (сейчас оставлены для cached-URL backward-compat).
4. **Compact mode для TopNav tabs на md (768-1024px)** — проверить in-browser, помещаются ли все 9 табов без скролла. Если тесно — compact (icon-only) mode для md.
5. **Tab font size на < md** — text-[13px] → text-[14px] если позволяет ширина.
6. **Интеграция `early-access-banner.webp`** — декоративный баннер (1919×177), доступен в `/atmosphere/`. Кандидат для section divider или hero-декорации.
7. **Интеграция `news-bg-center.webp`** — готический фон с фигурой (1681×260), доступен в `/atmosphere/`. Кандидат для HomePage hero-секции.

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
