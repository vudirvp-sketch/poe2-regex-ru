# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 53 — UI redesign Фаза 2 COMPLETE: все 8 категорийных страниц на `<CategoryLayout>`

---

## iter 53 — Фаза 2 COMPLETE: мигрированы оставшиеся 7 страниц

**Что:** Мигрированы RingPage, AmuletPage, BeltPage, RelicPage, JewelPage, TabletPage, VendorPage на `<CategoryLayout>`. Все 8 категорийных страниц теперь используют единый 2-колоночный desktop / 1-колоночный mobile layout.

**Layout (desktop ≥1024px):**
```
┌──────────────────────────────────────┐
│ Header (icon + title + count)         │
├─────────────────────┬────────────────┤
│ Controls            │ RegexOutput    │ ← sticky (lg:sticky lg:top-0)
│ (CategoryControl-   │                │
│  Panel, no regex)   │ Status block   │
│                     │                │
│ ModList             │ ProfilePanel   │
│ (scrolls naturally) │ (vendor: — )   │
└─────────────────────┴────────────────┘
       1fr                  380px
```

**Layout (mobile <1024px):** grid collapses to 1 column. DOM order: header → controls → ModList → RegexOutput → status → ProfilePanel. **Phase 7** will move RegexOutput to a sticky bottom-bar on mobile.

**Особенности по страницам:**
- **Ring/Amulet/Belt** — `VirtualizedModList` + `priorityFilter`. Стандартный status block.
- **Relic** — `ModList` (affix-only grouping). Без `priorityFilter`. Стандартный status.
- **Jewel** — `VirtualizedModList` + `extraControls` (jewel type filter: All/Ruby/Emerald/Sapphire). Hidden mods warning (alert + Deselect button) — остаётся в левой колонке между controls и ModList.
- **Tablet** — `ModList` + `extraControls` (тип: Бездна/Делириум/Ритуал/Ваал/Экспедиция, редкость: Обычный/Волшебный/Редкий, использования: ≥N input). Кастомный status block с инфо о типах/редкости/использованиях.
- **Vendor** — `FilterChip` группы. БЕЗ `PageStateWrapper` (данные синхронные через `buildVendorCategoryData()`). БЕЗ `ProfilePanel` (sidebar пустой). `clearButton` slot внутри `CategoryControlPanel`. Verification note — в конце левой колонки.

**Sticky behavior preserved:**
- Правый `<aside>` имеет `lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-1rem)] lg:overflow-auto`. RegexOutput остаётся видимым при скролле ModList.
- Mobile: нет sticky (Phase 7).

**Результат:** 1144 теста зелёные. TypeScript clean. Vite build OK (152 modules, 9 prerendered HTML). Lint baseline 59 сохранён.

---

## Известные проблемы (Known Issues)

| # | Issue | Status |
|---|-------|--------|
| ~~1-5~~ | (см. git history) | ✅ CLOSED iter 46-50 |

**Открытых Known Issues нет.**

**Технический долг (НЕ баги, на следующую итерацию):**
- `CategoryControlPanel` имеет две ветки (legacy + split). Все 8 страниц используют split mode (`hideRegexOutput=true`). Legacy ветка и неиспользуемые в split mode пропсы (`regex`, `isOverflow`, `regexParts`, `filterStore`, `activeTokenCount`) могут быть удалены в отдельной cleanup-итерации.

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
