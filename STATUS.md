# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Тесты:** ✅ 986 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 30 — SEO: полный пререндеринг + IndexNow

### Изменения

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `scripts/prerender-full.ts` | Playwright-пререндеринг — рендерит React-контент в статический HTML через headless Chromium |
| 2 | `package.json` | Добавлен `playwright` (devDep), скрипты `build:full` и `prerender:full` |
| 3 | `.npmrc` | `playwright_skip_browser_download=true` — браузер ставится отдельно в CI |
| 4 | `.github/workflows/deploy.yml` | Playwright setup в build job; новый `indexnow` job после деплоя |

### SEO-статус

| Элемент | Статус |
|---------|--------|
| robots.txt | ✅ |
| sitemap.xml (9 URL) | ✅ |
| Open Graph + Twitter Card | ✅ Route-specific для каждой страницы |
| JSON-LD Structured Data | ✅ |
| SeoBlock (FAQ-текст) | ✅ |
| Пререндеринг (shell pages) | ✅ 9 route-specific HTML + `<noscript>` fallback |
| Полный пререндеринг (Playwright) | ✅ React-контент в `<div id="root">` — для краулеров без JS |
| IndexNow при деплое | ✅ GitHub Actions job автоматически отправляет URL |
| Yandex Webmaster | ✅ Верифицирован |
| Google Search Console | ✅ Мета-тег добавлен |
| IndexNow API key | ✅ |
| Bing Webmaster Tools | ❌ Требует ручной верификации |

### Как работает полный пререндеринг

**CI flow (`pnpm build:full`):**
1. `tsc -b` — TypeScript проверка
2. `vite build` — сборка SPA → `dist/`
3. `tsx scripts/prerender.ts` — 9 shell HTML файлов (мета-теги + `<noscript>`)
4. `tsx scripts/prerender-full.ts` — Playwright рендерит React-контент:
   - Запускает HTTP-сервер на `dist/`
   - Открывает каждый маршрут в headless Chromium
   - Ждёт загрузки данных (networkidle + ожидание контента)
   - Извлекает HTML из `#root` и инжектирует в HTML файлы

**Локальная сборка (`pnpm build`):** использует только shell-пререндеринг (без Playwright).

**Что видит краулер без JS:**
- Route-specific `<title>` и `<meta description>`
- Полный отрендеренный контент в `<div id="root">` (списки аффиксов, числа, навигация)
- `<noscript>` fallback (дублирует навигацию для самых простых ботов)

**Что видит браузер:**
- React монтируется и заменяет пререндеренный контент на интерактивный SPA

### Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак
2. **`!` item-wide** — `!молнии|хаосу` исключает предмет целиком
3. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min
4. **`.*` does NOT cross block boundaries** — cross-block → AND
5. **Substring search** — truncation only at END of suffix
6. **MULTI_RANGE** — dual-number → одна quoted group
7. **`()` = grouping** — literal parens → битый regex
8. **regexExclude suppression** — excludes подавляются при конфликте
9. **regexPrefixContext** — AND-контекст для minion-модов
10. **getValueKey RANGE** — полный набор полей предотвращает неверную дедупликацию

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
