# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 66 — cleanup: удалены неиспользуемые i18n ключи `home.header_title` и `app.title` (iter 64 stopping-point candidate, harm-less мусор)

---

## UI Redesign — план (9 фаз + polish + Phase 10-11 + cleanup)

| Фаза | Статус | Что |
|------|--------|-----|
| 0-7 | ✅ iter 51-60 | CSS-токены → CategoryLayout → RegexOutput Level 1 → nav как «режимы» → HomePage compaction → StatusPanel → MobileRegexBar → iter 60 specificity fix |
| 8 | ✅ iter 61-62 | Полировка «дорогая тишина». iter 61: убран always-on `⚠ Диапазон` badge. iter 62: Features в `<details>`; ModList Level-3 badges auto-suppression |
| 9 | ✅ iter 62 | Финальная документация |
| polish | ✅ iter 63 | Palette consistency: все холодные tailwind-цвета заменены на тёплые палитровые токены. README переписан |
| 10 | ✅ iter 64 | Sidebar → TopNav: вертикальный сайдбар (224px слева) + Header + MobileNavTabs объединены в единый горизонтальный `TopNav`. Освобождено ~224px под аффиксы на десктопе |
| 11 | ✅ iter 65 | Атмосферная стилизация PoE2: `.poe-panel-header` (gold filigree rim) на TopNav; `.poe-divider` / `.poe-divider--ornate` на CategoryLayout + HomePage; `.btn-cta` (warm metallic + crimson glow) заменяет `bg-btn-primary` на Copy-кнопках; фон `bg-forest.webp` → `bg.webp` + vignette; Pitfall 28 фикс на `.skip-link` |
| cleanup | ✅ iter 66 | Удалены неиспользуемые i18n ключи `home.header_title` (был у удалённого `<Header>`) и `app.title` (никогда не использовался). Документация почищена от упоминаний об этих ключах |

---

## Known Issues

**Открытых Known Issues нет.**

Закрытые (см. git history): iter 46-50 lookahead/context/char-limit; iter 59 `tsc -b` missing imports; iter 60 MobileRegexBar desktop visibility; iter 63 palette consistency; iter 64 Sidebar/Header/MobileNavTabs удалены; iter 65 `bg-btn-primary` удалён + `.skip-link` Pitfall 28 фикс; iter 66 unused i18n keys removed.

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
