# SEO-план: Индексация PoE2 Regex RU в поисковых системах

> **Дата:** 2026-06-13 | **Статус:** В процессе

## Текущий SEO-статус проекта

| Элемент | Статус | Примечание |
|---------|--------|------------|
| `robots.txt` | ✅ Есть | Allow /, ссылка на sitemap |
| `sitemap.xml` | ✅ Расширен | 9 URL (главная + 8 категорий) |
| Мета-теги (title, description, keywords) | ✅ Есть | В index.html |
| Open Graph (og:*) | ✅ Есть | title, description, image, locale |
| Twitter Card | ✅ Есть | summary_large_image |
| Canonical URL | ✅ Есть | `<link rel="canonical">` |
| JSON-LD Structured Data | ✅ Есть | WebApplication schema |
| SeoBlock (FAQ-текст) | ✅ Есть | Рендерится при первом проходе React |
| Yandex Webmaster | ✅ Верифицирован | Файл `yandex_227088c0d89586c7.html` |
| Google Search Console | ❌ Не верифицирован | Заглушка мета-тега добавлена |
| Bing Webmaster Tools | ❌ Не верифицирован | — |
| IndexNow API | ✅ Ключ создан | `7cf0e35e568e2791d08835cdbd1d8a97.txt` |
| Пререндеринг (SSR/SSG) | ❌ Нет | SPA — критическая проблема |

## Главная проблема: SPA + GitHub Pages

Проект — React SPA с клиентской маршрутизацией (`react-router-dom` `BrowserRouter`).
Все URL вида `/waystone`, `/tablet` и т.д. обслуживаются **одним** `index.html`.

### Как это работает сейчас

1. Пользователь заходит на `/poe2-regex-ru/waystone` → GitHub Pages не находит файл → возвращает `404.html`
2. `404.html` сохраняет путь в `sessionStorage` и редиректит на `/poe2-regex-ru/`
3. `index.html` загружает React, React считывает `sessionStorage` и восстанавливает маршрут
4. Контент рендерится **только после выполнения JavaScript**

### Почему это плохо для SEO

- **Google** умеет рендерить JS, но с задержкой (недели-месяцы), и не всегда корректно
- **Яндекс** значительно хуже рендерит JS — контент может вообще не проиндексироваться
- **Bing** практически не рендерит JS
- `sessionStorage` не доступен краулерам → SPA-роутинг не работает для ботов

---

## Пошаговый план индексации

### Шаг 1. Верификация в Google Search Console (ВРУЧНУЮ)

**Действие:** Добавить сайт в GSC и получить код верификации.

1. Зайти на [search.google.com/search-console](https://search.google.com/search-console)
2. Нажать «Добавить ресурс» → выбрать «Префикс URL»
3. Ввести: `https://vudirvp-sketch.github.io/poe2-regex-ru/`
4. Выбрать способ верификации: **HTML-тег**
5. Скопировать мета-тег вида `<meta name="google-site-verification" content="XXXXX" />`
6. Раскомментировать и вставить код в `index.html` (строка с заглушкой)
7. Сделать `git push` → дождаться деплоя
8. Нажать «Подтвердить» в GSC

### Шаг 2. Отправить sitemap в Google Search Console (ВРУЧНУЮ)

1. В GSC перейти в «Sitemaps» (в левом меню)
2. Ввести: `sitemap.xml`
3. Нажать «Отправить»

### Шаг 3. Запросить индексацию главной страницы (ВРУЧНУЮ)

1. В GSC в верхней строке поиска ввести: `https://vudirvp-sketch.github.io/poe2-regex-ru/`
2. Нажать «Проверить URL»
3. Нажать «Запросить индексацию»

### Шаг 4. Верификация в Яндекс Вебмастер (УЖЕ СДЕЛАНО)

Файл `yandex_227088c0d89586c7.html` уже присутствует. Если верификация не пройдена:
1. Зайти на [webmaster.yandex.ru](https://webmaster.yandex.ru)
2. Добавить сайт `https://vudirvp-sketch.github.io/poe2-regex-ru/`
3. Способ верификации: HTML-файл — файл уже есть в репозитории

После верификации:
1. Добавить sitemap: `https://vudirvp-sketch.github.io/poe2-regex-ru/sitemap.xml`
2. Указать регион: Россия

### Шаг 5. Верификация в Bing Webmaster Tools (ВРУЧНУЮ)

1. Зайти на [bing.com/webmasters](https://www.bing.com/webmasters)
2. Вариант A: Импорт из Google Search Console (самый простой)
3. Вариант B: Добавить вручную → верификация через мета-тег или XML-файл
4. После верификации: отправить sitemap

### Шаг 6. IndexNow — мгновенная индексация Bing/Яндекс

IndexNow — протокол мгновенного уведомления поисковиков об изменениях. Поддерживается Bing, Яндекс, DuckDuckGo, Naver.

**Ключ API уже создан:** `7cf0e35e568e2791d08835cdbd1d8a97`
**Файл ключа:** `/public/7cf0e35e568e2791d08835cdbd1d8a97.txt`

**Отправка URL вручную (после деплоя):**

```bash
# Однократная отправка всех URL
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

Альтернативно — через Яндекс API:
```bash
curl "https://yandex.com/indexnow?key=7cf0e35e568e2791d08835cdbd1d8a97&url=https://vudirvp-sketch.github.io/poe2-regex-ru/"
```

### Шаг 7. Пререндеринг — КРИТИЧЕСКОЕ УЛУЧШЕНИЕ (СЛЕДУЮЩАЯ ИТЕРАЦИЯ)

**Проблема:** SPA рендерит контент через JS → поисковики не видят текст страниц категорий.

**Решение:** Добавить `vite-plugin-prerender` для генерации статического HTML при сборке.

Это самое важное улучшение для SEO. Без пререндеринга:
- Главная страница: Google проиндексирует (есть SeoBlock + мета-теги в HTML), но с задержкой
- Страницы категорий: почти гарантированно не будут проиндексированы Яндексом и Bing

**План реализации (итерация 2):**
1. Установить `vite-plugin-prerender`
2. Настроить пререндеринг для 9 маршрутов (/ + 8 категорий)
3. Каждый маршрут будет иметь свой статический HTML с полным мета-контентом
4. Это позволит поисковикам читать контент без выполнения JS

### Шаг 8. Автоматизация IndexNow через GitHub Actions (БУДУЩЕЕ)

Создать workflow, который после каждого деплоя отправляет URL через IndexNow API.

---

## Ожидаемые сроки индексации

| Поисковик | Без действий | С GSC + IndexNow | С пререндерингом |
|-----------|-------------|-------------------|------------------|
| Google | 1–3 месяца | 1–2 недели | 3–7 дней |
| Яндекс | 2–6 месяцев | 1–4 недели | 1–2 недели |
| Bing | 1–6 месяцев | 1–3 дня (IndexNow) | 1–3 дня |

## Чеклист действий (пошагово)

- [x] Расширить sitemap.xml (9 URL вместо 1)
- [x] Создать IndexNow API ключ
- [x] Добавить комментарий-заглушку для google-site-verification в index.html
- [x] Улучшить 404.html (meta robots noindex)
- [ ] **ВРУЧНАЯ:** Верифицировать сайт в Google Search Console
- [ ] **ВРУЧНАЯ:** Отправить sitemap в GSC
- [ ] **ВРУЧНАЯ:** Запросить индексацию главной страницы
- [ ] **ВРУЧНАЯ:** Проверить верификацию Яндекс Вебмастер
- [ ] **ВРУЧНАЯ:** Верифицировать в Bing Webmaster Tools
- [ ] **ВРУЧНАЯ:** Отправить URL через IndexNow API
- [ ] **СЛЕДУЮЩАЯ ИТЕРАЦИЯ:** Добавить пререндеринг (vite-plugin-prerender)
- [ ] **БУДУЩЕЕ:** GitHub Actions для автоматической отправки IndexNow

## FAQ

**Q: Гарантирует ли это попадание в выдачу?**
A: Нет. Поисковики индексируют, но ранжирование зависит от множества факторов (качество контента, ссылки, поведенческие). Но без индексации — шансов ноль.

**Q: Стоит ли купить кастомный домен?**
A: Да, это улучшит SEO. Кастомный домен выглядит доверительнее для поисковиков, чем `username.github.io`. Но это не обязательно для начала.

**Q: Поможет ли добавление сайта в каталоги?**
A: Да. Ссылки с профильных ресурсов (форумы PoE, Reddit, fan-сайты) улучшат ранжирование.

**Q: Яндекс действительно хуже индексирует SPA?**
A: Да. Яндекс значительно уступает Google в рендеринге JS. Для Яндекса пререндеринг — практически необходимость.
