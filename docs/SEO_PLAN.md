# SEO-план: Индексация PoE2 Regex RU

> **Дата:** 2026-06-13 | **Статус:** Ручная верификация

## SEO-статус

| Элемент | Статус | Примечание |
|---------|--------|------------|
| `robots.txt` | ✅ | Allow /, ссылка на sitemap |
| `sitemap.xml` | ✅ | 9 URL (главная + 8 категорий) |
| Мета-теги | ✅ | Route-specific title, description, keywords |
| Open Graph | ✅ | Route-specific |
| Twitter Card | ✅ | Route-specific |
| Canonical URL | ✅ | Route-specific |
| JSON-LD | ✅ | WebApplication schema |
| SeoBlock | ✅ | FAQ-текст на главной |
| Shell-пререндеринг | ✅ | 9 HTML + `<noscript>` |
| Полный пререндеринг (Playwright) | ✅ | React-контент в `#root` |
| IndexNow при деплое | ✅ | GitHub Actions job автоматически |
| Google Search Console | ✅ Мета-тег | Ручная: подтвердить в GSC |
| Яндекс Вебмастер | ✅ Мета-тег + HTML-файл | Ручная: подтвердить |
| Bing Webmaster Tools | ✅ Мета-тег | Ручная: подтвердить |

## Верификация поисковых систем

### Google Search Console

Мета-тег в `index.html`:
```html
<meta name="google-site-verification" content="Y3FJLnFm7oinObEWZ4LpjVRlZgigJsRthhk_dv2FRng" />
```

1. Зайти на [search.google.com/search-console](https://search.google.com/search-console)
2. Добавить ресурс → Префикс URL → `https://vudirvp-sketch.github.io/poe2-regex-ru/`
3. Способ: HTML-тег → нажать «Подтвердить»
4. Отправить sitemap: `sitemap.xml`
5. **Не удалять** мета-тег после подтверждения

### Яндекс Вебмастер

Мета-тег в `index.html`:
```html
<meta name="yandex-verification" content="227088c0d89586c7" />
```

HTML-файл: `public/yandex_227088c0d89586c7.html`

**Важно:** добавлять сайт нужно с полным путём — **`https://vudirvp-sketch.github.io/poe2-regex-ru/`**, а не `https://vudirvp-sketch.github.io/`. Корневой URL не содержит метатега.

1. Зайти на [webmaster.yandex.ru](https://webmaster.yandex.ru)
2. Добавить сайт: `https://vudirvp-sketch.github.io/poe2-regex-ru/`
3. Выбрать способ: HTML-тег → нажать «Подтвердить»
4. Добавить sitemap → Указать регион: Россия
5. **Не удалять** мета-тег после подтверждения

### Bing Webmaster Tools

Мета-тег в `index.html`:
```html
<meta name="msvalidate.01" content="00214E3CD35D8ED3C98A16701C202966" />
```

1. Зайти на [bing.com/webmasters](https://www.bing.com/webmasters)
2. Импорт из GSC (если GSC уже подтверждён) или ручная верификация
3. Нажать «Подтвердить» — мета-тег уже в коде
4. Отправить sitemap
5. **Не удалять** мета-тег после подтверждения

---

## Чеклист

- [x] Расширить sitemap.xml (9 URL)
- [x] Создать IndexNow API ключ
- [x] Добавить google-site-verification мета-тег
- [x] Добавить yandex-verification мета-тег
- [x] Реализовать shell-пререндеринг
- [x] Реализовать полный Playwright-пререндеринг
- [x] GitHub Actions: Playwright + build:full + IndexNow
- [x] Добавить Bing Webmaster мета-тег (msvalidate.01)
- [ ] **ВРУЧНАЯ:** Подтвердить GSC
- [ ] **ВРУЧНАЯ:** Отправить sitemap в GSC
- [ ] **ВРУЧНАЯ:** Подтвердить Яндекс Вебмастер (URL: `https://vudirvp-sketch.github.io/poe2-regex-ru/`)
- [ ] **ВРУЧНАЯ:** Подтвердить Bing Webmaster
