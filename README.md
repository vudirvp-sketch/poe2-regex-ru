# PoE2 Regex RU — генератор регексов для Path of Exile 2 (русский клиент)

> Онлайн-сервис: **[vudirvp-sketch.github.io/poe2-regex-ru](https://vudirvp-sketch.github.io/poe2-regex-ru/)**

Бесплатный генератор поисковых строк (регулярных выражений) для фильтра предметов в Path of Exile 2. Заметили нужный аффикс — отметьте его в списке, получите готовую строку для вставки в поисковое окно игры. Поддерживаются все основные категории предметов русского клиента PoE2: путевые камни, башни предтеч, реликвии, самоцветы, торговец, пояса, кольца, амулеты.

Сервис автоматически учитывает особенности игрового движка поиска: лимит 250 символов, ёфикацию (`[её]`), русские склонения, числовые диапазоны, отрицание и группировку. Никаких ручных правок — оптимизированная строка генерируется за миллисекунды и сразу готова к вставке в игру.

---

## Возможности

- **8 категорий предметов** — путевые камни (включая осквернённые и очернённые), башни предтеч, реликвии, самоцветы (с осквернёнными и очернёнными вариантами), торговец, пояса, кольца, амулеты.
- **1647 токенов** аффиксов и имплицитов, агрегированных с `poe2db.tw` и нормализованных под русский клиент.
- **Оптимизатор regex** — дедупликация OR-групп, усечение суффиксов, факторизация общих префиксов (trie + DP), группировка однофамильных модов в семейства.
- **Лимит 250 символов** — автоматический split длинных regex на несколько поисковых строк, которые игрок вставляет по очереди.
- **Ёфикация** — автоматическое объединение `е` и `ё` в символьный класс `[её]`, чтобы регекс матчил оба написания.
- **Числовые диапазоны** — генерация компактных числовых классов (`\d{2,}`, `[1-9]`, перечисления) под конкретный min/max аффикса.
- **Логика И/ИЛИ** — выберите несколько аффиксов, чтобы найти предмет со всеми свойствами (И), или хотя бы с одним (ИЛИ).
- **Исключение модов** — отметьте чип как «исключить», чтобы отфильтровать предметы с нежелательным аффиксом (генератор добавит `(?!...)` negative lookahead).
- **Ссылки на конфигурацию** — состояние фильтров кодируется в URL hash (lz-string), можно поделиться настроенным запросом одной ссылкой.
- **Пререндеринг** — 9 route-specific HTML с уникальными мета-тегами + Playwright-рендер React-контента для поисковых ботов.
- **SEO-оптимизация** — JSON-LD `WebApplication` schema, Open Graph, Twitter Card, canonical URL, sitemap, robots.txt, IndexNow, верификация в Google Search Console / Яндекс Вебмастере / Bing Webmaster.

---

## Как это работает (высокоуровнево)

ETL-пайплайн (`scripts/etl/`) раз в итерацию тянет свежие данные с `poe2db.tw`, парсит HTML через `cheerio`, нормализует формулировки модов, генерирует для каждого токена regex-стратегию и прогоняет её через итеративный оптимизатор. Результат сохраняется в `public/generated/*.json` — именно эти JSON загружаются в браузер пользователем.

В рантайме (в браузере) React-приложение:

1. Загружает JSON нужной категории.
2. Рендерит список аффиксов с поиском и фильтрами (Zustand store).
3. По выделенным чипам строит AST (`src/core/ast.ts`) — это абстракция над PoE2 regex-диалектом.
4. Прогоняет AST через 4-фазный оптимизатор (`src/core/optimizer.ts`).
5. Компилирует AST в финальную regex-строку (`src/core/compiler.ts`) с учётом лимита 250 символов.
6. Показывает результат в `RegexOutput` с кнопкой «Копировать» (или разбивает на несколько частей при переполнении).

Regex-движок (`src/core/`) написан на чистом TypeScript **без единой npm-зависимости** — это критично для тестирования in-game диалекта в условиях, отличных от стандартных JS regex.

---

## PoE2 regex-диалект (поддерживается / не поддерживается)

| Синтаксис | Статус | Пример |
|-----------|--------|--------|
| Подстрока | ✅ | `"сопротивление"` |
| `\|` (top-level в одной кавычке) | ✅ | `"Бездн\|Делир"` |
| `\|` + `.*` мосты (Path D, до 9 альтернатив) | ✅ | `"префикс.*A\|префикс.*B"` |
| `\|` между кавычками `"X"\|"Y"` | ❌ | zero matches в игре |
| Пробел = AND (cross-block) | ✅ | `"X" "Y"` |
| `.*` внутри одного блока | ✅ | не пересекает границы модов |
| `^` anchor | ✅ | `"^+#% редкость"` |
| `!` NOT (внутри кавычек) | ✅ | `"!A\|B"` |
| `[]` символьный класс | ✅ | `"[её]"`, `"[5-9]"` |
| `\d`, `\d{N,}` | ✅ | `"\d{2,}"` |
| `(?!...)` negative lookahead | ✅ | `"^(?!.*X).*Z"` (bidirectional exclude) |
| `?` optional | ❌ | не работает в игре |
| `$` end-anchor | ❌ | ненадёжный |
| Лимит ≈ 250 символов | ⚠️ | автоматический split при превышении |

Полная спецификация диалекта — в [`AGENT_NAVIGATION.md`](./AGENT_NAVIGATION.md), секция 6 «PoE2 Regex Dialect».

---

## Технологии

| Слой | Технологии |
|------|-----------|
| UI | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Zustand 5, React Router 7, TanStack Virtual |
| Regex-движок | Чистый TypeScript (0 npm-зависимостей) — AST, компилятор, 4-фазный оптимизатор, trie/DP факторизатор, oracle-валидатор, in-game matcher |
| Валидация | Zod 4 (схемы для `public/generated/*.json` + runtime-валидация в `src/data/loader.ts`) |
| ETL | `tsx`, `cheerio` (HTML-парсинг poe2db.tw), итеративный оптимизатор, Oracle-валидатор (FN/FP анализ) |
| Тестирование | Vitest 4 (1988 тестов), проверено в реальной игре (`docs/IN_GAME_TESTS.md`) |
| Пререндеринг | Shell-level (string manipulation) + Playwright (полный React-рендер для поисковых ботов) |
| Деплой | GitHub Pages + GitHub Actions (build:full + IndexNow) |

---

## Структура проекта

```
src/
├── core/          # Regex engine — AST, compiler, optimizer, oracle, matcher (0 deps)
├── shared/        # Types, i18n, mod-classifier, family-grouper, constants, Zod schemas
├── strategies/    # Locale strategy (Russian dialect: ёфикация, ю/я)
├── store/         # Zustand stores (filter-store, profile-store, url-sync)
├── data/          # Runtime JSON loader (Zod-validated) + vendor properties
└── ui/            # React components — pages, layout, hooks
scripts/
├── etl/           # ETL pipeline (fetch poe2db → normalize → compute regex → optimize)
├── prerender.ts   # Shell-level prerendering (9 HTML files with unique meta)
└── prerender-full.ts  # Playwright prerendering
public/
├── generated/     # 10 JSON files (ETL output, git-tracked)
└── atmosphere/    # PoE2-themed WebP assets
tests/             # 41 test file (core/, shared/, etl/, ui/, integration/)
docs/              # ARCHITECTURE, ETL_GUIDE, DATA_CONTRACTS, IN_GAME_TESTS, SEO_PLAN
```

---

## Локальный запуск

```bash
# Установка (pnpm или npm)
pnpm install           # или: npm install

# Dev-сервер
pnpm dev               # http://localhost:5173

# Production-сборка (tsc + vite + shell prerender)
pnpm build

# Полная сборка с Playwright-пререндерингом
pnpm build:full

# Тесты
pnpm test              # 1988/1988 должно пройти

# ETL (обновить public/generated/*.json из poe2db.tw)
pnpm etl               # инкрементально (с кешем)
pnpm etl:fresh         # с нуля (без кеша)
```

---

## Документация

| Файл | Назначение |
|------|-----------|
| [`AGENT_NAVIGATION.md`](./AGENT_NAVIGATION.md) | **Entry document для AI-агентов** — где что лежит, path aliases, dependency rules, 40 pitfall-паттернов |
| [`STATUS.md`](./STATUS.md) | Текущий статус итерации, Known Issues, подтверждённые ограничения PoE2 |
| [`worklog.md`](./worklog.md) | Лог последних итераций |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Архитектура regex-движка и ETL-пайплайна |
| [`docs/ETL_GUIDE.md`](./docs/ETL_GUIDE.md) | Описание ETL: fetch → parse → normalize → compute → optimize → write |
| [`docs/DATA_CONTRACTS.md`](./docs/DATA_CONTRACTS.md) | Контракты `public/generated/*.json` (Zod-схемы, форматы полей) |
| [`docs/IN_GAME_TESTS.md`](./docs/IN_GAME_TESTS.md) | Логи тестов regex-диалекта в реальной игре |
| [`docs/SEO_PLAN.md`](./docs/SEO_PLAN.md) | SEO-стратегия: sitemap, meta-теги, пререндеринг, верификация в поисковиках |
| [`docs/UI_AUDIT.md`](./docs/UI_AUDIT.md) | UI-аудит v2 — исходные рекомендации для UI-рефакторинга (§10 TopNav dropdowns SUPERSEDED iter 130) |
| [`docs/UI_REFACTOR_PLAN.md`](./docs/UI_REFACTOR_PLAN.md) | План UI-рефакторинга на 7 фаз (iter 129 + review iter 130 + user feedback iter 131 + **Phase 1 DONE iter 132** + **Phase 2 DONE iter 133**: collapsible affix groups + sticky search). Phase 1+2 готовы — 5 полей `FilterState` + 13 actions + URL sync + GroupHeader + sticky search + expand/collapse-all кнопки. |
| [`docs/UI_VISUALIZATION_AUDIT.md`](./docs/UI_VISUALIZATION_AUDIT.md) | Эталон визуализации UI (iter 130 + iter 131 §8 corrections) — layout, element inventory, color coding |

---

## Контакты

- Баги, идеи, пожелания → Discord: **woonderdad**
- Issues/PR: [github.com/vudirvp-sketch/poe2-regex-ru/issues](https://github.com/vudirvp-sketch/poe2-regex-ru/issues)

## Лицензия

Исходный код распространяется без явной лицензии — это личный fan-project для русскоязычного сообщества PoE2. Торговые марки Path of Exile 2 принадлежат Grinding Gear Games.
