# SEO-план: индексация PoE2 Regex RU

> **Дата обновления:** 2026-07-08 (iter 180)
> **Статус:** Технические шаги — DONE. Ручные шаги — pending (см. `docs/SEO_GROWTH_PLAN.md`).

## SEO-статус

| Элемент | Статус | Примечание |
|---------|--------|------------|
| `robots.txt` | ✅ | Allow /, ссылка на sitemap. **Ограничение:** на GitHub Pages project page доступен только по `/poe2-regex-ru/robots.txt`, не в корне хоста — автообнаружение может не срабатывать (см. `docs/SEO_GROWTH_PLAN.md` → Bucket 3). |
| `sitemap.xml` | ✅ | 10 URL (главная + 9 категорий, включая `/timeless-jewel` с iter 178) |
| Мета-теги | ✅ | Route-specific title, description (через `scripts/prerender.ts`) |
| Open Graph | ✅ | Route-specific |
| Twitter Card | ✅ | Route-specific |
| Canonical URL | ✅ | Route-specific |
| JSON-LD WebApplication | ✅ | iter 180: обновлён (9 категорий, `featureList`) |
| JSON-LD FAQPage | ✅ | iter 180: добавлен (6 Q&A, синхронизирован с `SeoBlock.tsx`) |
| SeoBlock с FAQ | ✅ | iter 180: FAQ-секция + синонимы внутри `<details>` |
| `<title>` оптимизирован | ✅ | iter 180: 80→58 chars, ключевое «Path of Exile 2» вперёд |
| `meta keywords` удалён | ✅ | iter 180: мёртвый груз |
| Shell-пререндеринг | ✅ | 10 HTML + `<noscript>` (`scripts/prerender.ts`) |
| Полный пререндеринг (Playwright) | ✅ | iter 180 — KI#54 fix: `/timeless-jewel` добавлен в `scripts/prerender-full.ts` |
| IndexNow при деплое | ✅ | iter 180 — KI#54 fix: `/timeless-jewel` добавлен в urlList |
| Google Search Console | ✅ Мета-тег | **ВРУЧНУЮ:** подтвердить в GSC (см. `SEO_GROWTH_PLAN.md` §2.1) |
| Яндекс Вебмастер | ✅ Мета-тег + HTML-файл | **ВРУЧНУЮ:** подтвердить (URL: `https://vudirvp-sketch.github.io/poe2-regex-ru/`) |
| Bing Webmaster Tools | ✅ Мета-тег | **ВРУЧНУЮ:** подтвердить |

## Верификация поисковых систем (MANUAL — пользователь делает в веб-панелях)

### Google Search Console

Мета-тег в `index.html`:
```html
<meta name="google-site-verification" content="Y3FJLnFm7oinObEWZ4LpjVRlZgigJsRthhk_dv2FRng" />
```

1. [search.google.com/search-console](https://search.google.com/search-console)
2. Добавить ресурс → Префикс URL → `https://vudirvp-sketch.github.io/poe2-regex-ru/`
3. Способ: HTML-тег → «Подтвердить»
4. Отправить sitemap: `sitemap.xml`
5. URL Inspection → Request Indexing для всех 10 URL
6. **Не удалять** мета-тег после подтверждения

### Яндекс Вебмастер

Мета-тег в `index.html`:
```html
<meta name="yandex-verification" content="227088c0d89586c7" />
```

HTML-файл: `public/yandex_227088c0d89586c7.html`

**Важно:** добавлять сайт с полным путём — `https://vudirvp-sketch.github.io/poe2-regex-ru/`, не `https://vudirvp-sketch.github.io/`.

1. [webmaster.yandex.ru](https://webmaster.yandex.ru)
2. Добавить сайт: `https://vudirvp-sketch.github.io/poe2-regex-ru/`
3. Способ: HTML-тег → «Подтвердить»
4. Добавить sitemap → Указать регион: Россия
5. **Не удалять** мета-тег после подтверждения

### Bing Webmaster Tools

Мета-тег в `index.html`:
```html
<meta name="msvalidate.01" content="00214E3CD35D8ED3C98A16701C202966" />
```

1. [bing.com/webmasters](https://www.bing.com/webmasters)
2. Импорт из GSC (если GSC уже подтверждён) или ручная верификация
3. «Подтвердить» — мета-тег уже в коде
4. Отправить sitemap
5. **Не удалять** мета-тег после подтверждения

---

## Чеклист

### Технические (REPO — DONE)

- [x] sitemap.xml 10 URL (iter 178: +`/timeless-jewel`)
- [x] IndexNow API ключ (`public/7cf0e35e568e2791d08835cdbd1d8a97.txt`)
- [x] google-site-verification мета-тег
- [x] yandex-verification мета-тег + HTML-файл
- [x] Bing Webmaster мета-тег (msvalidate.01)
- [x] Shell-пререндеринг (`scripts/prerender.ts`, 10 routes)
- [x] Playwright полный пререндер (`scripts/prerender-full.ts`, 10 routes — iter 180 KI#54 fix)
- [x] GitHub Actions: Playwright + build:full + IndexNow (iter 180 KI#54 fix: `/timeless-jewel` в urlList)
- [x] `<title>` оптимизирован под 60 символов (iter 180)
- [x] `meta keywords` удалён (iter 180)
- [x] JSON-LD WebApplication + FAQPage (iter 180)
- [x] FAQ-секция в `SeoBlock.tsx` (iter 180)
- [x] Синонимы в SEO-тексте (iter 180)

### Ручные (MANUAL — pending)

- [ ] Подтвердить GSC
- [ ] Отправить sitemap в GSC + Request Indexing для 10 URL
- [ ] Подтвердить Яндекс Вебмастер
- [ ] Подтвердить Bing Webmaster
- [ ] GitHub Topics + Website + Description в About (см. `README.md` → «Настройка репозитория»)
- [ ] Внешние ссылки и дистрибуция (Steam-гайд, DTF, форум, Discord, VK) — см. `docs/SEO_GROWTH_PLAN.md` §2.3

---

## Связанные документы

- `docs/SEO_GROWTH_PLAN.md` — единый план роста (REPO / MANUAL / DEFERRED buckets).
- `STATUS.md` → Known Issues (KI#54 закрыт в iter 180).
- `index.html` — все мета-теги и JSON-LD schema.
