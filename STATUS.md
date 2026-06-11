# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ | **Cross-family FP:** 0
> **Тесты:** ✅ 761/761 | **Build:** ✅ | **!important:** 0

---

## Текущая итерация (5): !important → @theme

### Что сделано

| # | Задача | Результат |
|---|--------|-----------|
| E1 | Полное удаление `!important` | 71 `!important` → 0. Миграция на Tailwind v4 `@theme` + семантические CSS-переменные |
| E2 | Семантическая система токенов | 50+ CSS-переменных в обоих темах. `@theme` экспортирует их как utility-классы: `bg-surface`, `text-bright`, `border-edge` и т.д. |
| E3 | Миграция компонентов | Все 20+ компонентов переведены с Tailwind gray/color палитры на семантические классы |
| E4 | VendorCategoryData adapter | Создан `vendor-adapter.ts` — конвертация VendorProperty → GameToken. Интеграция в VendorPage отложена |

### Семантические токены (новые)

**Surfaces:** `surface`, `panel`, `raised`, `deep`, `chip`, `chip-hover`, `chip-active`, `tick`
**Text levels:** `bright`, `soft`, `muted`, `dim`, `faint`
**Borders:** `edge`, `edge-panel`, `edge-tick`
**Accents:** `accent-blue`, `accent-red`, `accent-yellow`, `accent-emerald`, `accent-violet`, `accent-purple`, `accent-cyan`, `accent-amber`, `accent-orange`, `accent-sky`, `accent-teal`, `accent-green-soft`, `accent-red-soft`, `accent-yellow-dim`
**Border-left:** `bl-blue`, `bl-red`, `bl-yellow`, `bl-gray`, `bl-green`, `bl-cyan`, `bl-amber`, `bl-purple`, `bl-sky`, `bl-teal`, `bl-emerald`, `bl-violet`, `bl-red-soft`, `bl-amber-soft`
**Buttons:** `btn-primary`, `btn-primary-hover`, `btn-danger`, `btn-success`
**Indicators:** `indicator-green`, `indicator-yellow`, `indicator-red`, `indicator-red-deep`
**Sections:** `section-yellow`, `section-red`, `section-emerald`, `section-violet`, `section-amber`, `section-blue`
**Section borders:** `sborder-emerald`, `sborder-violet`, `sborder-amber`, `sborder-red`
**Column borders:** `cborder-blue`, `cborder-orange`, `cborder-amber`
**Danger borders:** `danger`, `danger-strong`
**Placeholder:** `ghost`, `ghost-alt`

### Маппинг старых → новых классов

| Старый | Новый | Контекст |
|--------|-------|----------|
| `bg-gray-800` | `bg-surface` | Input/panel фон |
| `bg-gray-900` | `bg-panel` | Panel фон |
| `bg-gray-700` | `bg-raised` | Raised surface |
| `text-white` | `text-bright` | Primary текст |
| `text-gray-300` | `text-soft` | Secondary текст |
| `text-gray-400` | `text-muted` | Muted текст |
| `text-gray-500` | `text-dim` | Dim текст |
| `text-gray-600` | `text-faint` | Faint текст |
| `border-gray-600` | `border-edge` | Input border |
| `border-gray-700` | `border-edge-panel` | Panel border |
| `placeholder-gray-600` | `placeholder-ghost-alt` | Placeholder |
| `bg-blue-900/40` | `bg-chip-active` | Selected chip |
| `bg-gray-800/50` | `bg-chip` | Chip bg |
| `hover:bg-gray-700/50` | `hover:bg-chip-hover` | Chip hover |
| `bg-green-600` | `bg-btn-success` | Success button |
| `bg-blue-600` | `bg-btn-primary` | Primary button |
| `bg-red-600` | `bg-btn-danger` | Danger button |

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser doesn't extract modCode for jewels → `jewelType` always "shared" | Open | Low |
| 2 | Enumerated ranges can FP on range notation numbers | Mitigated | Edge case |

---

## Следующая итерация

| # | Задача | Описание |
|---|--------|----------|
| N1 | Интеграция VendorCategoryData | Подключить `vendor-adapter.ts` в VendorPage, заменить `useVendorPage` на `useCategoryPage`. Убрать оставшееся дублирование |
| N2 | Почистить FilterChip opacity-модификаторы | `text-amber-400/70`, `text-blue-400/70` и т.д. — перевести на семантические токены с opacity |
| N3 | Проверить визуальное соответствие тем | Пройтись по всем страницам в обеих темах, убедиться что нет регрессий |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
