# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 761 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0
> **In-game верификация:** ✅ ЗАВЕРШЕНА (2026-06-10)

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Per-mod want/exclude toggle — каждый FilterChip имеет кнопку ✗/✓
- Budget-aware UI feedback — amber-предупреждение при 6+ модах и >180 chars, health bar
- Colon anchor — для non-% reversed модов с `: ##` шаблоном (верифицировано в игре)
- In-game верификация ЗАВЕРШЕНА — все regex-паттерны проверены в RU клиенте PoE2

---

## Известные баги

| # | Баг | Критичность | Статус |
|---|-----|-------------|--------|
| B1 | VirtualizedModList не отображает implicit-секции (belt/ring/amulet/jewel если есть implicit-токены) | Высокая | Открыт |
| B2 | VendorChip: числовые свойства (Ур. предмета, Треб. уровень) не имеют кнопки exclude | Средняя | Открыт |
| B3 | FilterChip aria-checked не отражает excluded-состояние для screen readers | Низкая | Открыт |

---

## Мусор (к удалению)

- `package-lock.json` — проект использует pnpm
- `scripts/restructure-implicits.ts` — неиспользуемый одноразовый скрипт
- ~20 мёртвых i18n-ключей (waystone.tier, result.*, match.*, mod.search и др.)
- Дубли CSS-правил в index.css (text-emerald-400, bg-emerald-900/30)

---

## Следующие шаги

1. Исправить B1: добавить implicit-рендеринг в VirtualizedModList
2. Исправить B2: добавить exclude-кнопку для числовых vendor-свойств
3. Рефакторинг VendorPage: использовать useCategoryPage вместо дублирующего FilterStoreApi
4. Почистить мёртвые i18n-ключи и дубли CSS
5. Обновлять ETL при изменении модов в новых лигах/патчах
