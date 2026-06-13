# SEO-план: Индексация PoE2 Regex RU

> **Дата:** 2026-06-13 | **Статус:** В процессе

## Текущий SEO-статус

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
| Пререндеринг (shell pages) | ✅ | 9 route-specific HTML + `<noscript>` fallback |
| Yandex Webmaster | ✅ | Мета-тег + HTML-файл |
| Google Search Console | ✅ Мета-тег | Подтвердить в GSC |
| IndexNow API | ✅ | Ключ `7cf0e35e568e2791d08835cdbd1d8a97` |
| Bing Webmaster Tools | ❌ | Требует ручной верификации |

## Пререндеринг — реализовано (итерация 29)

**Скрипт:** `scripts/prerender.ts` (запускается автоматически после `vite build`)

**Что делает:**
1. Читает `dist/index.html` (стандартный Vite-билд)
2. Для каждого из 9 маршрутов генерирует отдельный `index.html`:
   - `dist/index.html` — главная (обновлённая с `<noscript>`)
   - `dist/waystone/index.html` — с уникальным `<title>`, `<meta>`, `og:*`, `twitter:*`, canonical
   - и т.д. для всех 8 категорий
3. Добавляет `<noscript>` блок с навигацией и описанием категории

**Что получает краулер:**
- Route-specific `<title>` и `<meta description>` — самый важный фактор для индексации
- Route-specific Open Graph / Twitter Card — для шаринга
- Route-specific canonical URL — предотвращает дубли
- `<noscript>` навигация — Яндекс/Bing видят ссылки на все страницы

**Как это работает с SPA:**
1. Краулер заходит на `/poe2-regex-ru/waystone` → GitHub Pages отдаёт `dist/waystone/index.html`
2. Краулер видит route-specific мета-теги и `<noscript>` контент
3. Браузер загружает тот же HTML → React инициализируется → BrowserRouter читает URL → рендерит WaystonePage
4. SPA работает как раньше — клиентская навигация, гидратация

---

## Ручные действия

### 1. Google Search Console — верификация

Мета-тег уже добавлен в `index.html`:
```html
<meta name="google-site-verification" content="Y3FJLnFm7oinObEWZ4LpjVRlZgigJsRthhk_dv2FRng" />
```

1. Зайти на [search.google.com/search-console](https://search.google.com/search-console)
2. Добавить ресурс → Префикс URL → `https://vudirvp-sketch.github.io/poe2-regex-ru/`
3. Выбрать способ: HTML-тег → код уже добавлен → сделать push → нажать «Подтвердить»
4. **Не удалять** мета-тег после подтверждения

### 2. Google Search Console — sitemap

1. GSC → Sitemaps → ввести `sitemap.xml` → Отправить

### 3. Яндекс Вебмастер — проверка

Мета-тег уже добавлен:
```html
<meta name="yandex-verification" content="227088c0d89586c7" />
```

1. Зайти на [webmaster.yandex.ru](https://webmaster.yandex.ru)
2. Проверить верификацию → Добавить sitemap → Указать регион: Россия

### 4. Bing Webmaster Tools

1. Зайти на [bing.com/webmasters](https://www.bing.com/webmasters)
2. Импорт из GSC (проще) или ручная верификация
3. Отправить sitemap

### 5. IndexNow — отправить URL после деплоя

```bash
curl -X POST "https://api.indexnow.org/IndexNow" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "vudirvp-sketch.github.io",
    "key": "7cf0e35e568e2791d08835cdbd1d8a97",
    "urlList": [
      "https://vudirvp-sketch.github.io/poe2-regex-ru/",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/waystone",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/tablet",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/relic",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/jewel",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/vendor",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/belt",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/ring",
      "https://vudirvp-sketch.github.io/poe2-regex-ru/amulet"
    ]
  }'
```

---

## Будущие улучшения

### Полный пререндеринг с Puppeteer (итерация 30+)

Текущий shell-подход создаёт route-specific мета-теги и `<noscript>`, но не рендерит полный контент React-компонентов (списки аффиксов, числа и т.д.). Для полного пререндеринга нужен Puppeteer/Playwright, который:
- Запустит headless Chrome после билда
- Откроет каждый маршрут, дождётся загрузки данных
- Сохранит полностью отрендеренный HTML

Это даст максимальный SEO-эффект, но требует:
- Установки Puppeteer (~200MB Chromium)
- Настройки GitHub Actions (Chrome уже есть на ubuntu-latest)
- Обработки таймаутов и ошибок рендеринга

### GitHub Actions: автоматический IndexNow (итерация 31)

Workflow для автоматической отправки IndexNow при каждом деплое.

---

## Чеклист

- [x] Расширить sitemap.xml (9 URL)
- [x] Создать IndexNow API ключ
- [x] Добавить google-site-verification мета-тег
- [x] Добавить yandex-verification мета-тег
- [x] Переместить файлы верификации в `public/`
- [x] Реализовать пререндеринг (shell pages + `<noscript>`)
- [ ] **ВРУЧНАЯ:** Подтвердить GSC
- [ ] **ВРУЧНАЯ:** Отправить sitemap в GSC
- [ ] **ВРУЧНАЯ:** Проверить Яндекс Вебмастер
- [ ] **ВРУЧНАЯ:** Верифицировать Bing Webmaster Tools
- [ ] **ВРУЧНАЯ:** Отправить URL через IndexNow
- [ ] **БУДУЩЕЕ:** Полный пререндеринг с Puppeteer
- [ ] **БУДУЩЕЕ:** GitHub Actions для IndexNow
