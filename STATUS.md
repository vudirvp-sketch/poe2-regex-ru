# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ | **Cross-family FP:** 0
> **Тесты:** ✅ 761/761 | **Build:** ✅ | **!important:** 0

---

## Текущая итерация (7): VendorPage → useCategoryPage unification

### Что сделано

| # | Задача | Результат |
|---|--------|-----------|
| 1 | vendor-adapter.ts: fix build error | Убрано `priorityTier: 'B'` из GameToken — поле не существует в типе, было причиной сломанного деплоя |
| 2 | vendor-adapter.ts: numeric regex mapping | Для числовых свойств regex.ru = numericSuffix (текст после числа), для остальных — regex pattern |
| 3 | vendor-adapter.ts: familyKey display text | `familyKey.ru` = `prop.label` для нечисловых, `prop.label.replace('≥N', '≥#')` для числовых — отображает русские метки в чипах вместо `vendor:xxx` |
| 4 | vendor-adapter.ts: rawTextTemplate ## placeholder | Для числовых свойств `rawTextTemplate` содержит `##` — extractSlotValues корректно маппит ranges[] и min/max inputs появляются |
| 5 | VendorPage → useCategoryPage switch | VendorPage использует `useCategoryPage({ categoryId: 'vendor', customData: buildVendorCategoryData() })` вместо `useVendorPage()` |
| 6 | VendorChip → FilterChip | Все 61 chip рендерятся через FilterChip с FamilyGroup. Числовые inputs работают через perTokenRanges |
| 7 | GROUP_COLORS → из tags | Группировка по `tags: [group:${group}]`, GROUP_COLORS определён локально в VendorPage |
| 8 | Delete dead code | `useVendorPage.ts` и `VendorChip.tsx` удалены. CSS комментарии обновлены |

### Визуальная проверка VendorPage

| Проверка | Результат |
|----------|-----------|
| Заголовок «Торговец» | ✅ |
| 14 групп чипов с цветными заголовками | ✅ |
| FilterChip вместо VendorChip (61 чип) | ✅ |
| Выбор чипа → подсветка (bg-chip-active) | ✅ |
| Кнопка exclude (✗) → состояние excluded (bg-indicator-red) | ✅ |
| Числовой input (≥Мин / ≤Макс) для Ур. предмета | ✅ |
| Alert-блок проверки | ✅ |

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser doesn't extract modCode for jewels → `jewelType` always "shared" | Open | Low |
| 2 | Enumerated ranges can FP on range notation numbers | Mitigated | Edge case |

---

## Следующая итерация

| # | Задача | Описание |
|---|--------|----------|
| N1 | Визуальная проверка dark/light на всех страницах | Пройтись по всем 8 страницам: новые opacity-токены (⚡, ⚓, 2x, 1е/2е), alert-блоки, exclude-кнопки, overflow counter, form-элементы |
| N2 | VendorPage: regex output проверка | Сравнить regex output при переключении с VendorChip на FilterChip — убедиться, что buildAstFromSelections даёт тот же результат, что buildVendorRegex давал |
| N3 | VendorPage: numeric chip display text | При установленном min-значении заменить «≥N» на «≥{value}» в displayText числовых чипов |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
