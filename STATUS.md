# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Тесты:** ✅ 986 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 29 — SEO: пререндеринг + верификация

### Изменения

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `index.html` | Мета-теги `google-site-verification` и `yandex-verification` (вместо заглушки) |
| 2 | `public/googled4deeaff5bba3bb2.html` | Перемещён из корня репозитория (не деплоился) |
| 3 | `public/yandex_227088c0d89586c7.html` | Перемещён из корня репозитория (не деплоился) |
| 4 | `scripts/prerender.ts` | Скрипт пререндеринга — генерирует 9 route-specific HTML файлов |
| 5 | `package.json` | `build` скрипт: добавлен `tsx scripts/prerender.ts` после `vite build` |

### SEO-статус

| Элемент | Статус |
|---------|--------|
| robots.txt | ✅ |
| sitemap.xml (9 URL) | ✅ |
| Open Graph + Twitter Card | ✅ Route-specific для каждой страницы |
| JSON-LD Structured Data | ✅ |
| SeoBlock (FAQ-текст) | ✅ |
| Пререндеринг (shell pages) | ✅ 9 route-specific HTML + `<noscript>` fallback |
| Yandex Webmaster | ✅ Верифицирован (мета-тег + HTML-файл) |
| Google Search Console | ✅ Мета-тег добавлен (подтвердить в GSC) |
| IndexNow API key | ✅ Создан |
| Bing Webmaster Tools | ❌ Требует ручной верификации |

### Что делает пререндеринг

`scripts/prerender.ts` после `vite build` генерирует для каждого маршрута отдельный `index.html`:
- `dist/waystone/index.html` — уникальные `<title>`, `<meta description>`, `og:*`, `twitter:*`, `<link rel="canonical">`
- `<noscript>` блок с навигацией и описанием категории — для краулеров без JS
- GitHub Pages отдаёт эти файлы напрямую → Яндекс/Bing видят route-specific контент

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
