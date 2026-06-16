# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 59 — UI Фаза 7 (`MobileRegexBar.tsx` mobile sticky bottom-bar) + cleanup

---

## iter 59 — UI Фаза 7: Mobile sticky bottom-bar + HomePage cleanup + Vendor price-filter fix

**Что:**
1. **Фаза 7 — `MobileRegexBar.tsx`**: на mobile (< lg) `RegexOutput` перемещён из правой колонки в sticky bottom-bar. StatusPanel alerts (Jewel hidden-mods warning, Vendor verification note) следуют за ним в тот же bar. Desktop (lg+) не изменился — `RegexOutput` + `StatusPanel` остаются в правой колонке `aside`.
2. **HomePage cleanup**: убраны многословные описания категорий («Полное покрытие префиксов и суффиксов» и пр.) — карточки теперь содержат только иконку + название + количество аффиксов. Удалены 8 неиспользуемых i18n-ключей `home.*_desc`.
3. **Vendor price-filter fix**: глобальные min/max inputs на VendorPage были no-op (setMinValue/setMaxValue — пустые функции). Скрыты через `hasRangedTokens={false}`. Per-chip range inputs в `FilterChip` уже работали и остаются основным UX для vendor.

**Изменения:**

- **NEW** `src/ui/components/MobileRegexBar.tsx` — sticky-bottom контейнер (`position: sticky; bottom: 0`) для mobile. Props: `regexOutput` (ReactNode), `alerts` (ReactNode[]). `lg:hidden`.
- **MODIFIED** `src/ui/layout/CategoryLayout.tsx` — добавлен `mobileBar?: ReactNode` slot. Когда передан, `aside` получает `hidden lg:flex` (десктоп-only), а `status` + `sidebar` рендерятся в отдельной mobile-only секции над sticky-bar. Backward compat: без `mobileBar` `aside` виден на всех viewport.
- **MODIFIED** все 8 страниц категорий — передают `mobileBar={<MobileRegexBar regexOutput={...} alerts={...} />}`. Jewel и Vendor дополнительно прокидывают `alerts` (повторно из StatusPanel) в MobileRegexBar.
- **MODIFIED** `src/ui/pages/home/HomePage.tsx` — убран `<p>{t(cat.descKey)}</p>` из карточек категорий. Поле `descKey` удалено из массива `categories`.
- **MODIFIED** `src/ui/pages/vendor/VendorPage.tsx` — `hasRangedTokens={false}` (hide no-op global min/max). `showRound10` prop удалён (тоже не нужен для vendor).
- **MODIFIED** `src/shared/i18n.ts` — удалены 8 ключей `home.{waystone,tablet,relic,jewel,vendor,belt,ring,amulet}_desc`.
- **MODIFIED** `src/index.css` — добавлен `.mobile-regex-bar` блок (sticky bottom, backdrop-blur, max-h 60vh, safe-area-inset-bottom).
- **FIX** (pre-existing bug closed): 4 страницы (Belt/Amulet/Ring/Relic) не импортировали `t` (regression из iter 58 — импорт был удалён как «неиспользуемый», но `t()` вызывается в `header`). JewelPage не импортировал `groupTokensByFamily`. `tsc --noEmit` молчал, но `tsc -b` падал. Импорты восстановлены.

**Результат:** 1144 теста зелёные. `tsc -b` clean (исправлен pre-existing bug). Vite build OK. Lint baseline 59 сохранён.

---

## Известные проблемы (Known Issues)

| # | Issue | Status |
|---|-------|--------|
| ~~1-5~~ | (см. git history) | ✅ CLOSED iter 46-50 |
| ~~6~~ | `tsc -b` failing — 4 pages missing `t` import (iter 58 regression), JewelPage missing `groupTokensByFamily` | ✅ CLOSED iter 59 |

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
| 0 | ✅ iter 51 | Аудит CSS-токенов, таблица маппинга |
| 1 | ✅ iter 51 | Миграция design tokens (тёплая палитра, удаление light-темы, приглушение bg-forest) |
| 2 | ✅ iter 52-53 | `CategoryLayout` — 2 колонки desktop / 1 mobile. **Все 8 страниц мигрированы** |
| 3 | ✅ iter 55 | Возвышение `RegexOutput` до Level 1 (gold border + glow) |
| 4 | ✅ iter 56 | Навигация как «режимы» (усиленный active-state, mobile tabs в Sidebar) |
| 5 | ✅ iter 57 | Компактизация HomePage (хаб категорий, SeoBlock в `<details>`) |
| 6 | ✅ iter 58 | Единая панель статусов (`StatusPanel.tsx`) |
| 7 | ✅ iter 59 | Mobile sticky copy bar (`MobileRegexBar.tsx`) — RegexOutput + alerts в sticky bottom-bar на mobile |
| 8 | ⏳ next | Полировка: снять шум, оставить «дорогую тишину» |
| 9 | ⏳ | Документация финальная |

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
