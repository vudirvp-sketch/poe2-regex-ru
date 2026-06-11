# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ | **Cross-family FP:** 0
> **Тесты:** ✅ 778/778 | **Build:** ✅ | **!important:** 0

---

## Текущая итерация (9): SEO, dead code, light theme mobile

### Что сделано

| # | Задача | Результат |
|---|--------|-----------|
| 1 | VendorPage AND-режим: решение | **Оставлен true AND** — логичнее и согласованно с другими категориями. Переключатель И/ИЛИ уже на странице — для «любое совпадение» пользователь выбирает OR |
| 2 | Удалён dead code | Удалены `src/ui/hooks/useVendorPage.ts` и `src/ui/components/VendorChip.tsx` — не имели импортов, чистый мусор |
| 3 | Light theme: мобильные стили | Добавлены `[data-theme="light"]` overrides в `@media (max-width: 768px)`: control panel opaque, affix frames с повышенным контрастом, chip readability. Убран `!important` с `.regex-output` |
| 4 | SEO: тексты на главной | Заменено ~22 вхождений «мод» на «аффикс/свойство/характеристика» в i18n.ts. Каждая категория теперь с уникальным описанием вместо шаблона «— моды X» |
| 5 | SEO: мета-теги | Обновлены title, description, keywords, og:*, twitter:* в index.html. Добавлены ключевые слова: регексы пое2, регулярное выражение пое2, фильтрация предметов пое2, поиск предметов пое2 |
| 6 | SEO: SeoBlock.tsx | Переписан — уникальные заголовки, разнообразная лексика, ключевые поисковые запросы естественно встроены |
| 7 | Документация | STATUS.md, AGENT_NAVIGATION.md очищены от устаревших секций, удалены упоминания удалённых файлов |

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser doesn't extract modCode for jewels → `jewelType` always "shared" | Open | Low |
| 2 | Enumerated ranges can FP on range notation numbers | Mitigated | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
