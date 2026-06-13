# SEO-план: Индексация PoE2 Regex RU

> **Дата:** 2026-06-13 | **Статус:** В процессе

## SEO-статус

| Элемент | Статус | Примечание |
|---------|--------|------------|
| `robots.txt` | ✅ | Allow /, ссылка на sitemap |
| `sitemap.xml` | ✅ | 9 URL (главная + 8 категорий) |
| Мета-теги (title, description, keywords) | ✅ | Route-specific для каждой страницы |
| Open Graph (og:*) | ✅ | Route-specific: title, description, url, image |
| Twitter Card | ✅ | Route-specific |
| Canonical URL | ✅ | Route-specific для каждой страницы |
| JSON-LD Structured Data | ✅ | WebApplication schema |
| SeoBlock (FAQ-текст) | ✅ | На главной странице |
| Shell-пререндеринг | ✅ | 9 route-specific HTML + `<noscript>` fallback |
| Полный пререндеринг (Playwright) | ✅ | React-контент в `<div id="root">` — для краулеров без JS |
| IndexNow при деплое | ✅ | GitHub Actions job автоматически после deploy |
| Yandex Webmaster | ✅ | Мета-тег + HTML-файл |
| Google Search Console | ✅ Мета-тег | Подтвердить в GSC |
| IndexNow API | ✅ | Ключ `7cf0e35e568e2791d08835cdbd1d8a97` |
| Bing Webmaster Tools | ❌ | Требует ручной верификации |

## Двухуровневый пререндеринг

### Level 1: Shell (`scripts/prerender.ts`)
- Генерирует 9 HTML файлов с route-specific мета-тегами + `<noscript>` навигация
- Работает без браузера — чистая строковая манипуляция
- Всегда доступен — часть `pnpm build`

### Level 2: Full Playwright (`scripts/prerender-full.ts`)
- Рендерит React-компоненты через headless Chromium в `<div id="root">`
- Краулеры без JS видят полные списки аффиксов и числовые диапазоны
- Требует: `playwright` + Chromium (устанавливается в CI)
- Если Playwright не установлен → graceful exit, используется Level 1
- CI: `pnpm build:full` | Локально: `pnpm build` (только Level 1)

**Как это работает с SPA:**
1. Краулер без JS заходит на `/waystone/` → видит полностью отрендеренный HTML
2. Краулер с JS (Google) → React монтируется, заменяет пререндеренный контент
3. Пользователь → SPA работает как раньше — клиентская навигация, гидратация

---

## Ручные действия

### 1. Google Search Console — верификация

Мета-тег в `index.html`:
```html
<meta name="google-site-verification" content="Y3FJLnFm7oinObEWZ4LpjVRlZgigJsRthhk_dv2FRng" />
```

1. Зайти на [search.google.com/search-console](https://search.google.com/search-console)
2. Добавить ресурс → Префикс URL → `https://vudirvp-sketch.github.io/poe2-regex-ru/`
3. Выбрать способ: HTML-тег → нажать «Подтвердить»
4. Отправить sitemap: `sitemap.xml`
5. **Не удалять** мета-тег после подтверждения

### 2. Яндекс Вебмастер — проверка

1. Зайти на [webmaster.yandex.ru](https://webmaster.yandex.ru)
2. Проверить верификацию → Добавить sitemap → Указать регион: Россия

### 3. Bing Webmaster Tools

1. Зайти на [bing.com/webmasters](https://www.bing.com/webmasters)
2. Импорт из GSC или ручная верификация
3. Отправить sitemap

---

## Чеклист

- [x] Расширить sitemap.xml (9 URL)
- [x] Создать IndexNow API ключ
- [x] Добавить google-site-verification мета-тег
- [x] Добавить yandex-verification мета-тег
- [x] Реализовать shell-пререндеринг (мета-теги + `<noscript>`)
- [x] Реализовать полный Playwright-пререндеринг (React-контент в `#root`)
- [x] GitHub Actions: Playwright setup + build:full
- [x] GitHub Actions: автоматическая отправка IndexNow при деплое
- [ ] **ВРУЧНАЯ:** Подтвердить GSC
- [ ] **ВРУЧНАЯ:** Отправить sitemap в GSC
- [ ] **ВРУЧНАЯ:** Проверить Яндекс Вебмастер
- [ ] **ВРУЧНАЯ:** Верифицировать Bing Webmaster Tools
