# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ | **Cross-family FP:** 0
> **Тесты:** ✅ 761/761 | **Build:** ✅ | **!important:** 0

---

## Текущая итерация (6): Семантические opacity-токены + VendorAdapter

### Что сделано

| # | Задача | Результат |
|---|--------|-----------|
| E1 | FilterChip/VendorChip opacity → семантические токены | Все `text-amber-400/70`, `text-blue-400/80` и т.д. заменены на `text-accent-amber-soft`, `text-accent-blue-mid` и др. Оба dark/light варианта |
| E2 | Alert border/bg/text → семантические токены | `border-yellow-700/50`, `text-amber-300`, `bg-amber-800/50` → `border-aborder-yellow`, `text-atext-amber`, `bg-abg-amber` |
| E3 | VendorChip exclude button → семантические токены | `bg-red-700/60` → `bg-exclude-active`, `bg-raised/60` → `bg-exclude-idle` + i18n для title/aria |
| E4 | vendor-adapter.ts исправлен | GameToken маппинг корректен (ранее были `exclusions` вместо `regexExclude`, отсутствовали `genderForms`, `hasYofication`, `level`). Добавлен `tags: [group:${group}]` для GROUP_COLORS |
| E5 | useCategoryPage: customData support | Новый `customData?: CategoryData` в CategoryPageConfig — позволяет передать предзагруженные данные без async fetch. Инфраструктура для N1 готова |
| E6 | --lt-* переменные проверены | Нет ссылок на `--lt-*` в коде — уже удалены ранее |

### Новые семантические токены (opacity)

**Accent text с opacity:** `accent-amber-soft` (/70), `accent-amber-mid` (/80), `accent-blue-soft` (/70), `accent-blue-mid` (/80), `accent-orange-mid` (/80), `accent-amber-dimmer` (/60), `accent-amber-warn` (/80), `accent-red-dim` (/60)

**Exclude button:** `exclude-active`, `exclude-active-hover`, `exclude-idle`, `exclude-idle-hover`, `exclude-text`

**Alert borders:** `aborder-yellow`, `aborder-amber`, `aborder-amber-strong`

**Alert text:** `atext-amber`, `atext-amber-light`

**Alert badge:** `abg-amber`, `abg-amber-hover`, `aborder-amber-badge`

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
| N1 | Интеграция VendorCategoryData — финальный switch | Переключить VendorPage с `useVendorPage` на `useCategoryPage({ customData: buildVendorCategoryData() })`. Заменить VendorChip на FilterChip. Перенести GROUP_COLORS. Требует визуальной проверки |
| N2 | Визуальная проверка обеих тем | Пройтись по всем страницам в dark/light теме: chip-состояния, indicator-фоны, form-элементы, alert-блоки, новые opacity-токены |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
