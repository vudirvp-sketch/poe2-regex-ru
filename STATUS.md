# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Тесты:** 986 | **Build:** OK | **TypeScript:** OK

---

## Текущая итерация: 32 — Bing мета-тег активирован

### Что сделано

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `index.html` | Bing `msvalidate.01` раскомментирован, код `00214E3CD35D8ED3C98A16701C202966` |
| 2 | `docs/SEO_PLAN.md` | Обновлён: Bing статус → ✅ мета-тег, убрана заглушка |
| 3 | `STATUS.md` | Очищен, актуализирован |
| 4 | `AGENT_NAVIGATION.md` | Обновлён до v20 |

### SEO-статус

| Элемент | Статус | Примечание |
|---------|--------|------------|
| robots.txt | ✅ | Allow /, ссылка на sitemap |
| sitemap.xml (9 URL) | ✅ | Главная + 8 категорий |
| Мета-теги (title, description, keywords) | ✅ | Route-specific |
| Open Graph + Twitter Card | ✅ | Route-specific |
| Canonical URL | ✅ | Route-specific |
| JSON-LD Structured Data | ✅ | WebApplication schema |
| SeoBlock (FAQ-текст) | ✅ | На главной |
| Shell-пререндеринг | ✅ | 9 HTML + `<noscript>` fallback |
| Полный пререндеринг (Playwright) | ✅ | React-контент в `<div id="root">` |
| IndexNow при деплое | ✅ | GitHub Actions job |
| Google Search Console | ✅ Мета-тег | **Ручная:** нажать «Подтвердить» в GSC |
| Яндекс Вебмастер | ✅ Мета-тег + HTML-файл | **Ручная:** подтвердить (URL: `https://vudirvp-sketch.github.io/poe2-regex-ru/`) |
| Bing Webmaster Tools | ✅ Мета-тег | **Ручная:** подтвердить после деплоя |

### Ручные действия (после пуша и деплоя)

1. **GSC** — [search.google.com/search-console](https://search.google.com/search-console)
   - Добавить ресурс: `https://vudirvp-sketch.github.io/poe2-regex-ru/` (префикс URL)
   - Способ: HTML-тег → нажать «Подтвердить»
   - Отправить sitemap: `sitemap.xml`

2. **Яндекс Вебмастер** — [webmaster.yandex.ru](https://webmaster.yandex.ru)
   - Добавить сайт: **`https://vudirvp-sketch.github.io/poe2-regex-ru/`** (НЕ корневой URL!)
   - Нажать «Подтвердить» — мета-тег уже в коде
   - Добавить sitemap → Указать регион: Россия

3. **Bing Webmaster Tools** — [bing.com/webmasters](https://www.bing.com/webmasters)
   - Импорт из GSC или ручная верификация
   - Нажать «Подтвердить» — мета-тег уже в коде
   - Отправить sitemap

---

## Известные проблемы

| # | Issue | Impact |
|---|-------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа (mitigated: `^`/`%` anchors + threshold) | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
