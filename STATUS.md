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
- **B1:** VirtualizedModList рендерит implicit-секции (amber frame, полный width выше prefix/suffix)
- **B2:** VendorChip ✕-кнопка доступна для числовых свойств (Ур. предмета, Треб. уровень)
- **B3:** FilterChip aria-checked корректно отражает excluded (`true`) и partial-excluded (`mixed`)
- Чистка: 31 мёртвый i18n-ключ удалён, дубли CSS устранены, package-lock.json и restructure-implicits.ts удалены

---

## Известные баги

Нет открытых багов.

---

## Следующие шаги

1. VendorPage рефакторинг: заменить дублирующий FilterStoreApi на адаптер поверх useCategoryPage (требует VendorTokenAdapter)
2. Обновлять ETL при изменении модов в новых лигах/патчах
