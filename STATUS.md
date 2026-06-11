# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 761 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0
> **In-game верификация:** ✅ ЗАВЕРШЕНА

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Per-mod want/exclude toggle — каждый FilterChip имеет кнопку ✗/✓
- Budget-aware UI feedback — amber-предупреждение при 6+ модах и >180 chars, health bar
- Colon anchor — для non-% reversed модов с `: ##` шаблоном (верифицировано в игре)
- In-game верификация ЗАВЕРШЕНА — все regex-паттерны проверены в RU клиенте PoE2
- **B1–B3:** VirtualizedModList implicit-секции, VendorChip ✕-кнопка, FilterChip aria-checked
- Чистка: 31 мёртвый i18n-ключ удалён, дубли CSS устранены
- Feedback-контакт: Discord woonderdad добавлен в Sidebar, README, STATUS
- **SEO оптимизация:** robots.txt, sitemap.xml, SEO-текстовый блок (FAQ/инструкция), og:image, JSON-LD, улучшенные title/h1

---

## SEO — выполнено

| # | Задача | Статус |
|---|--------|--------|
| 1 | `public/robots.txt` | ✅ |
| 2 | `public/sitemap.xml` | ✅ |
| 3 | SEO-блок на HomePage (SeoBlock.tsx) | ✅ |
| 4 | `<h1>` + `<title>` — добавлено "Path of Exile 2" | ✅ |
| 5 | `og:image` + OG-баннер 1200×630 | ✅ |
| 6 | JSON-LD структурированные данные | ✅ |

---

## Известные баги

Нет открытых багов.

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**

---

## Следующие шаги

1. **Ручная работа (не кодом):** Яндекс.Вебмастер, Google Search Console, посты на Reddit/ВК/Discord, GitHub topics
2. VendorPage рефакторинг: заменить дублирующий FilterStoreApi на адаптер поверх useCategoryPage
3. Обновлять ETL при изменении модов в новых лигах/патчах
