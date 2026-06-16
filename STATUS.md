# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 56 — UI Фаза 4 (навигация как «режимы»: усиленный active-state + mobile tabs)

---

## iter 56 — UI Фаза 4: Навигация как «режимы»

**Что:** Навигация воспринимается как переключение «режимов» — активный маршрут получает визуальный Level-1-style акцент (gold border-l + glow + tinted bg), а на mobile гамбургер-drawer заменён на горизонтальные sticky-чипсы.

**Изменения:**

- `src/ui/layout/nav-items.ts` (NEW) — общий массив `navItems` для desktop и mobile (источник истины: 9 пунктов: Главная + 8 категорий).
- `src/ui/layout/Sidebar.tsx` — упрощён до desktop-only (`hidden md:flex`). Удалены: `mobileOpen` state, focus trap (useEffect/keydown), overlay, hamburger `<button>`, slide-in animation. Активный NavLink получает классы `nav-mode-link nav-mode-active` вместо inline style.
- `src/ui/layout/MobileNavTabs.tsx` (NEW) — mobile-only (`md:hidden`) горизонтальные scrollable chip-табы. Sticky под Header. Chip = icon (20×20) + label. Использует те же `navItems` + `nav-mode-active` для active-state.
- `src/ui/layout/Layout.tsx` — добавлен `<MobileNavTabs />` между Header и main.
- `src/ui/layout/Header.tsx` — убран `pl-12 md:pl-4` → `px-4` (гамбургер удалён, отступ больше не нужен).
- `src/shared/i18n.ts` — добавлен ключ `'nav.categories': 'Категории'` для aria-label навигации.
- `src/index.css` — добавлены блоки:
  - `.nav-mode-active` — gold border-l (3px) + tinted bg (gold gradient поверх `--poe-bg-tertiary`) + box-shadow glow (`0 0 0 1px rgba(200,154,74,0.08), 0 0 12px rgba(200,154,74,0.10)`) + font-weight 600. Паттерн повторяет Level-1 frames (`.regex-output`, `.affix-header-*`).
  - Padding-compensation: `.nav-mode-link.nav-mode-active` (`padding-left: calc(0.75rem - 3px)`) и `.mobile-nav-tab.nav-mode-active` (`padding-left: calc(0.625rem - 3px)`) — компенсируют 3px border-l, чтобы иконка не смещалась.
  - `.mobile-nav-tabs` — sticky-top (z-20), semi-transparent warm bg (`rgba(13,11,9,0.92)`), `backdrop-filter: blur(4px)`, border-bottom.
  - `.mobile-nav-tabs-scroll` — flex row, `overflow-x: auto`, скрытый scrollbar (cross-browser: `scrollbar-width: none`, `::-webkit-scrollbar { display: none }`).
  - `.mobile-nav-tab` — chip-style (flex-shrink: 0, transparent border, `--chip-bg`).

**Результат:** 1144 теста зелёные. TypeScript clean. Vite build OK (154 модуля, 9 prerendered HTML, CSS 40.29 KB / gzip 8.96 KB). Lint baseline 59 сохранён.

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
| 2 | ✅ iter 52-53 | `CategoryLayout` — 2 колонки desktop / 1 mobile. **Все 8 страниц мигрированы** |
| 3 | ✅ iter 55 | Возвышение `RegexOutput` до Level 1 (gold border + glow) |
| 4 | ✅ iter 56 | Навигация как «режимы» (усиленный active-state, mobile tabs в Sidebar) |
| 5 | ⏳ next | Компактизация HomePage (хаб категорий, SeoBlock в `<details>`) |
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
