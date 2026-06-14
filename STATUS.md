# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 33 — Устранение повторов на главной

### Что сделано

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `src/shared/i18n.ts` | `home.title` → «Генератор regex для PoE2», `home.subtitle` → «Выбирайте аффиксы — получайте готовую строку для вставки в игру», убран повтор из `description_full`, добавлены ключи `home.nav_label` и `home.header_title` |
| 2 | `src/ui/layout/Header.tsx` | На маршруте `/` заголовок → `home.header_title` («PoE2 Regex») вместо дублирующего `home.title` |
| 3 | `src/ui/layout/Sidebar.tsx` | Ссылка «Главная» → `home.nav_label` вместо длинного `home.title` |
| 4 | Документация | STATUS.md, AGENT_NAVIGATION.md актуализированы |

### Иерархия заголовков главной (после фикса)

| Элемент | Текст | Раньше |
|---------|-------|--------|
| Sidebar brand | PoE2 Regex / Русский клиент | Без изменений |
| Sidebar nav | **Главная** | Поисковые строки PoE2 — русский клиент |
| Header | **PoE2 Regex** | Поисковые строки PoE2 — русский клиент |
| Hero H1 | **Генератор regex для PoE2** | Поисковые строки PoE2 — русский клиент |
| Hero subtitle | **Выбирайте аффиксы — получайте готовую строку для вставки в игру** | Регулярные выражения для фильтрации лута в русском клиенте |

### SEO-статус

| Элемент | Статус |
|---------|--------|
| robots.txt + sitemap.xml | ✅ |
| Route-specific мета-теги | ✅ |
| Open Graph + Twitter Card | ✅ |
| Canonical URL | ✅ |
| JSON-LD | ✅ |
| SeoBlock (FAQ) | ✅ |
| Shell-пререндеринг | ✅ |
| Полный пререндеринг (Playwright) | ✅ |
| IndexNow при деплое | ✅ |
| GSC / Яндекс / Bing верификация | ✅ Мета-теги (ручная: подтвердить) |

### Известные проблемы

| # | Issue | Impact |
|---|-------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа (mitigated: `^`/`%` anchors + threshold) | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
