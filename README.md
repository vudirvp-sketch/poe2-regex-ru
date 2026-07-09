# PoE2 Regex RU — генератор поисковых строк для Path of Exile 2 (русский клиент)

> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Исходники:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Баги и идеи:** Discord **woonderdad**

Бесплатный веб-генератор **регулярных выражений (regex) для PoE2** — собирает компактные поисковые строки для внутриигрового фильтра предметов Path of Exile 2 в русском клиенте. Выбираешь аффиксы — получаешь готовый регекс для вставки в поиск игры. Учитывает ёфикацию, числовые диапазоны, лимит 250 символов и диалект PoE2 (И/ИЛИ/NOT, quoted-группы, `.*`-мосты до 9 альтернатив).

Подходит для торговца, путевых камней, башен предтеч, реликвий, самоцветов (включая Вневременные самоцветы — Вечная ненависть и Трагедия героев), поясов, колец и амулетов.

---

## Для кого

- **Игроки PoE2 (русский клиент)**, которым надоело собирать регексы вручную для trade-поиска и фильтра предметов.
- **Трейдеры и крафтеры**, ищущие предметы с конкретными аффиксами на poe2db.tw и в игре.
- **AI-агенты и бот-разработчики**, которым нужен предсказуемый русский regex-движок для Path of Exile 2.
- **Контрибьюторы**, желающие расширить поддержку категорий или улучшить оптимизатор.

---

## Key features

- **9 категорий предметов** — путевые камни, башни предтеч, реликвии, самоцветы, вневременные самоцветы, торговец, пояса, кольца, амулеты.
- **Актуальные данные с poe2db.tw** — автоматический ETL-пайплайн тянет модификаторы и обновляет JSON.
- **Компактные регексы** — 4-фазовый оптимизатор: дедупликация OR-групп, opt-table, усечение суффиксов, устранение конфликтующих exclude-токенов.
- **Поддержка диалекта PoE2** — `|` (OR), `!` (NOT), `^` (anchor), quoted-группы, `.*`-мосты для multi-word OR (Path D, до 9 альтернатив).
- **Ёфикация** — автоматическое объединение `е`/`ё` в символьный класс `[её]` для надёжного совпадения.
- **MIXED-режим** — `MIXED_OR` AST с `anchorFirstAltOnly` для обхода KI#45 и `truncateMixedOrLiterals` для KI#46 (лимит 250 chars).
- **Atlas-семантика для /timeless-jewel** — отдельный regex-builder для подсветки нод древа атласа (multi-word OR ✅, AND/NOT ❌ — это ограничение PoE2).
- **URL-share** — выборки кодируются в hash, ссылка делится одним кликом.
- **Profile persistence** — сохранённые наборы аффиксов в localStorage, per-category.
- **Избранное (pinned)** — быстрые «пресеты» часто используемых аффиксов.
- **SEO + a11y** — prerendered HTML (10 routes), JSON-LD WebApplication schema, sitemap.xml, IndexNow, ARIA-роли, keyboard-nav, `prefers-reduced-motion`.
- **Чистый core** — regex-engine без единой npm-зависимости (pure TypeScript).

---

## Quick start (как пользоваться генератором)

1. Откройте **https://vudirvp-sketch.github.io/poe2-regex-ru/**.
2. Выберите категорию (например, «Путевые камни»).
3. Отметьте нужные аффиксы кликом по чипам. Используйте режим «Все (И)» для предметов со всеми свойствами или «Любой (ИЛИ)» для любого из них.
4. Для аффиксов с числами задайте диапазон (min/max).
5. Исключите ненужное — кнопка ✗ на чипе добавит `!token` в регекс.
6. Скопируйте результат (кнопка «Копировать» или `Ctrl+Shift+X`) и вставьте в поисковое окно PoE2.

Подробности — в SEO-блоке на главной странице сайта (раскрывающийся `<details>`).

---

## Поддерживаемые категории

| Категория | Что покрывает |
|-----------|---------------|
| Путевые камни | Аффиксы карт, включая осквернённые и очернённые |
| Плитки предтеч | Свойства плиток: ритуал, бездна, делириум, ваал, экспедиция |
| Реликвии | Префиксы и суффиксы реликвий |
| Самоцветы | Характеристики самоцветов (рубин/изумруд/сапфир), осквернённые/очернённые |
| Вневременные самоцветы | 75 нод древа атласа: Вечная ненависть (35) + Трагедия героев (40) |
| Торговец | Фильтр товаров торговца по свойствам и ценам |
| Пояса | Атакующие, защитные, универсальные свойства |
| Кольца | Аффиксы колец всех типов и источников |
| Амулеты | Полное покрытие префиксов и суффиксов |

---

## Стек

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS 4** + **Zustand 5** + **Zod 4**
- **Vitest 4** (тесты) + **Playwright 1.52** (prerender)
- `@tanstack/react-virtual` для виртуализации длинных списков аффиксов

## Структура

```
src/
├── core/        # Regex engine — ZERO npm deps, pure TS (AST, compiler, optimizer, oracle)
├── shared/      # Types, i18n, schemas, family-grouper, mod-classifier
├── strategies/  # Locale strategy (Russian dialect: ёфикация, ю/я)
├── store/       # Zustand stores — filter/profile/url-sync/local-settings
├── data/        # Zod-validated JSON loaders + atlas-jewel-loader
└── ui/          # React — pages, layout, components, hooks
public/
├── generated/   # ETL output (belt/ring/amulet/jewel/waystone/tablet/relic/timeless-jewel JSON)
├── icons/       # Nav icons + atlas-node icons (self-hosted .webp)
└── atmosphere/  # PoE2-themed textures (bg, hero portraits)
scripts/
└── etl/         # ETL pipeline poe2db.tw → generated JSON
tests/           # Vitest — core/, shared/, etl/, ui/, integration/
```

---

## Разработка

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm test         # Vitest (2405 passing + 5 KI#53-skipped)
pnpm build        # tsc -b + vite build + shell prerender (10 routes)
pnpm build:full   # + Playwright full prerender (React content in #root)
pnpm etl          # Full ETL with optimizer (poe2db.tw → generated JSON)
pnpm etl:fresh    # ETL without cache (regenerate all)

# Timeless Jewel parser — отдельный скрипт (iter 176).
# Запускать только когда GGG добавляет новый timeless jewel.
npx tsx scripts/etl/parse-timeless-jewel.ts
```

> Если `pnpm` не установлен — `npm run <script>` работает как drop-in.

---

## Документация

| Файл | Назначение |
|------|-----------|
| `STATUS.md` | Текущее состояние проекта + Known Issues + Atlas regex-семантика |
| `AGENT_NAVIGATION.md` | Entry-документ для AI-агента — структура, pitfalls, итерации |
| `worklog.md` | История итераций (последняя — подробно, старые — одной строкой) |
| `docs/ARCHITECTURE.md` | Архитектура core/regex-движка |
| `docs/ATLAS_JEWEL_PLAN.md` | iter 175–178 — план + реализация категории `/timeless-jewel` |
| `docs/ETL_GUIDE.md` | ETL-пайплайн: poe2db.tw → `public/generated/*.json` |
| `docs/DATA_CONTRACTS.md` | Контракты типов данных |
| `docs/IN_GAME_TESTS.md` | In-game верификация regex-семантики |
| `docs/SEO_PLAN.md` | SEO-план: индексация, sitemap, meta-теги (технические шаги) |
| `docs/SEO_GROWTH_PLAN.md` | iter 180 — единый план роста: внешние сигналы, контент, дистрибуция |
| `docs/UI_AUDIT.md` | UI-аудит v2 (iter 110) — reference |
| `docs/UI_REFACTOR_PLAN.md` | iter 137 — 7 фаз UI-рефакторинга. All DONE. |
| `docs/REDESIGN_CONCEPT_v4.md` | iter 165–170 — концепт-спецификация редизайна (реализован) |
| `docs/UI_VISUALIZATION_AUDIT.md` | iter 130–131 — visual reference для UI-рефакторинга |
| `docs/AFFIXES_GROUPING_ANALYSIS.md` | Анализ группировки/сортировки аффиксов |
| `docs/MIXED_MODE_UI_TESTS.md` | Тест-план MIXED-режима (T1–T10) |
| `регис/` | Пользовательские in-game данные (списки модов, тесты) |

---

## Контакты

- **Discord:** woonderdad
- **GitHub issues:** https://github.com/vudirvp-sketch/poe2-regex-ru/issues
