# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Тесты:** ✅ 978+ total | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 28 — SEO: индексация в поисковых системах

### Изменения

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `public/sitemap.xml` | Расширен с 1 до 9 URL (главная + 8 категорий), добавлен `lastmod` |
| 2 | `public/robots.txt` | Добавлен комментарий об IndexNow API key |
| 3 | `public/7cf0e35e568e2791d08835cdbd1d8a97.txt` | IndexNow API key для мгновенной индексации Bing/Яндекс |
| 4 | `public/404.html` | Добавлен `<meta name="robots" content="noindex, follow" />` |
| 5 | `index.html` | Добавлена заглушка для `google-site-verification` мета-тега |
| 6 | `docs/SEO_PLAN.md` | Пошаговый план индексации в поисковых системах |

### SEO-статус

| Элемент | Статус |
|---------|--------|
| robots.txt | ✅ |
| sitemap.xml (9 URL) | ✅ |
| Open Graph + Twitter Card | ✅ |
| JSON-LD Structured Data | ✅ |
| SeoBlock (FAQ-текст) | ✅ |
| Yandex Webmaster | ✅ Верифицирован |
| IndexNow API key | ✅ Создан |
| Google Search Console | ❌ Требует ручной верификации |
| Bing Webmaster Tools | ❌ Требует ручной верификации |
| Пререндеринг (SSG) | ❌ Критично для Яндекс/Bing — следующая итерация |

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
| 3 | SPA без пререндеринга — Яндекс/Bing не видят контент страниц категорий | Open | High (SEO) |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
