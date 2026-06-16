# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 54 — cleanup `CategoryControlPanel` (удалена legacy ветка + неиспользуемые пропсы + мёртвый CSS)

---

## iter 54 — Cleanup CategoryControlPanel

**Что:** Удалена legacy ветка из `CategoryControlPanel` (которая рендерила `<RegexOutput>` + sticky wrapper). Все 8 категорийных страниц уже используют split mode через `<CategoryLayout>` (с iter 53), legacy была мёртвым кодом.

**Удалено из `CategoryControlPanel`:**
- Пропсы: `regex`, `isOverflow`, `regexParts`, `filterStore`, `hideRegexOutput` (никогда не использовались в split mode — split mode рендерит только controls row, без `<RegexOutput>`).
- Импорты: `RegexOutput` (больше не рендерится внутри), `FilterStoreApi` type (только для `filterStore`).
- Legacy `return`-блок с sticky wrapper + `<RegexOutput>`.
- `if (hideRegexOutput) {...}` ветвление — теперь всегда split mode.
- `mt-2` условный класс в controlsRow (нужен был только для spacing под RegexOutput в legacy mode).

**Сохранено:**
- `activeTokenCount` — используется в controls row (active tokens counter, строка `{activeTokenCount} {t('selected')}`).
- Все остальные пропсы (searchLogic, hasRangedTokens, range filter, round10, threshold, priorityFilter, extraControls, clearButton, excludedCount).

**Обновлено в 8 страницах:** `WaystonePage`, `RingPage`, `AmuletPage`, `BeltPage`, `RelicPage`, `JewelPage`, `TabletPage`, `VendorPage` — из каждой `<CategoryControlPanel>` invocation удалены `hideRegexOutput`, `regex`, `isOverflow`, `regexParts`, `filterStore`. `<RegexOutput>` остаётся в `regexOutput` slot `<CategoryLayout>` (правая колонка, sticky).

**Удалено мёртвого CSS из `index.css`:**
- `.control-panel-sticky` + `::before` pseudo (sticky gap fix для legacy mode).
- Mobile media query rules для `.control-panel-sticky, .sticky.top-0 { padding-bottom: 12px }`, `.sticky.top-0 button {...}`, `.sticky.top-0 .flex-wrap { gap: 4px }` — все ссылались только на legacy sticky wrapper.

**Результат:** 1144 теста зелёные. TypeScript clean. Vite build OK (9 prerendered HTML). Lint baseline 59 сохранён.

---

## Известные проблемы (Known Issues)

| # | Issue | Status |
|---|-------|--------|
| ~~1-5~~ | (см. git history) | ✅ CLOSED iter 46-50 |

**Открытых Known Issues нет.** Технического долга по CategoryControlPanel больше нет (закрыт iter 54).

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
| 3 | ⏳ next | Возвышение `RegexOutput` до Level 1 (gold border + glow) |
| 4 | ⏳ | Навигация как «режимы» (усиленный active-state, mobile tabs) |
| 5 | ⏳ | Компактизация HomePage (хаб категорий, SeoBlock в `<details>`) |
| 6 | ⏳ | Единая панель статусов (`StatusPanel.tsx`) |
| 7 | ⏳ | Mobile sticky copy bar (`MobileRegexBar.tsx`) — заодно переместит RegexOutput на mobile в sticky bottom-bar |
| 8 | ⏳ | Полировка: снять шум, оставить «дорогую тишину» |
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

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`.

---
Контакты: Discord **woonderdad**
