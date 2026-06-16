# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 52 — UI redesign Фаза 2: `CategoryLayout` (2-col desktop / 1-col mobile) + пилот на WaystonePage

---

## iter 52 — CategoryLayout + WaystonePage pilot (Фаза 2 из 9)

**Что:** Создан `src/ui/layout/CategoryLayout.tsx` — 2-колоночный desktop / 1-колоночный mobile shell для категорийных страниц. `CategoryControlPanel` получил non-breaking опциональный проп `hideRegexOutput` (default `false`) для split-mode. `WaystonePage` мигрирован на новый layout (пилот). Остальные 7 страниц не тронуты — мигрируют в следующей итерации.

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
│ (scrolls naturally) │                │
└─────────────────────┴────────────────┘
       1fr                  380px
```

**Layout (mobile <1024px):** grid collapses to 1 column. DOM order: header → controls → ModList → RegexOutput → status → ProfilePanel. **Phase 7** will move RegexOutput to a sticky bottom-bar on mobile.

**Non-breaking API change:**
- `CategoryControlPanel` добавлен optional prop `hideRegexOutput?: boolean` (default `false`).
- При `hideRegexOutput=true`: рендерит ТОЛЬКО controls row (без `<RegexOutput>`, без sticky-обёртки `control-panel-sticky`). Страница передаёт `<RegexOutput>` отдельно в `CategoryLayout`'s `regexOutput` slot.
- 7 старых страниц продолжают работать без изменений (`hideRegexOutput=false` = legacy behavior).

**Sticky behavior preserved:**
- Legacy (7 страниц): `CategoryControlPanel` имеет `sticky top-0 z-10` wrapper.
- Split (Waystone): правый `<aside>` имеет `lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-1rem)] lg:overflow-auto`. RegexOutput остаётся видимым при скролле ModList.
- Mobile: нет sticky (Phase 7).

**Риски, что НЕ случилось:**
- `extraControls` (waystone corrupted/uncorrupted/delirious) работает — проп передаётся в `CategoryControlPanel` как раньше.
- Тесты `RegexOutput.test.tsx` (17 штук) зелёные — компонент не тронут, тестируется в изоляции.
- `CategoryControlPanel` API обратно совместим — 7 старых страниц не сломаны.
- Lint baseline 59 сохранён.

**Результат:** 1144 теста зелёные. TypeScript clean. Vite build OK. Lint baseline сохранён (59).

---

## Известные проблемы (Known Issues)

| # | Issue | Status |
|---|-------|--------|
| ~~1-5~~ | (см. git history) | ✅ CLOSED iter 46-50 |

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
| 2 | 🚧 iter 52 | `CategoryLayout` — 2 колонки desktop / 1 mobile. **Пилот: WaystonePage готов. Осталось мигрировать 7 страниц** |
| 3 | ⏳ next | Возвышение `RegexOutput` до Level 1 (gold border + glow) |
| 4 | ⏳ | Навигация как «режимы» (усиленный active-state, mobile tabs) |
| 5 | ⏳ | Компактизация HomePage (хаб категорий, SeoBlock в `<details>`) |
| 6 | ⏳ | Единая панель статусов (`StatusPanel.tsx`) |
| 7 | ⏳ | Mobile sticky copy bar (`MobileRegexBar.tsx`) — заодно переместит RegexOutput на mobile в sticky bottom-bar |
| 8 | ⏳ | Полировка: снять шум, оставить «дорогую тишину» |
| 9 | ⏳ | Документация финальная |

**Фаза 2 — что осталось мигрировать (после WaystonePage):**
1. `RingPage.tsx` (использует `VirtualizedModList`)
2. `AmuletPage.tsx`
3. `BeltPage.tsx`
4. `RelicPage.tsx`
5. `JewelPage.tsx` (есть jewelTypeFilter extraControls)
6. `TabletPage.tsx`
7. `VendorPage.tsx` (использует `FilterChip` + `clearButton`, БЕЗ ProfilePanel)

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
