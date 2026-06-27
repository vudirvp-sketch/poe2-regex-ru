# iter 148 — Toolbar Refactor (UX reorganization)

> **Цель:** уменьшить визуальный перегруз панели управления Waystone (и других категорийных страниц), не ломая существующую state-модель и ARIA-семантику.

---

## Контекст проблемы

На странице Waystone одновременно видно **12+ контролов**, расположенных плоско на одном визуальном уровне. Мозг не может сразу определить, что первично, а что второстепенно:

| Блок | Контролов | Частота использования | Визуальный вес сейчас |
|---|---|---|---|
| Логика поиска (И/ИЛИ) | 2 | Постоянно | amber-600 — OK |
| Приоритет (Все/S+A/S) | 3 | Редко | 3 кнопки + label — избыточно |
| Сортировка (Альф/Приор) | 2 | Очень редко | 2 кнопки + label — избыточно |
| Режим отображения | 2 | Периодически | Длинный label + 2 кнопки — тяжело |
| Map-фильтры (Оскв/Неоскв/Делир) | 3 | Периодически | Чекбоксы + текст — не отличаются от настроек |
| Поиск + Тип + Источник | 3 | Постоянно | OK |
| Развернуть/Свернуть | 2 | Редко | hidden on mobile — OK |

---

## Решение

### Принципы

1. **Доминируют только то, что трогают каждый раз**: поиск + И/ИЛИ + Тип + Источник.
2. **Редко меняемое сворачивается в `<select>`**: Приоритет, Сортировка, Режим отображения.
3. **Сокращаются избыточные подписи**: `Режим отображения аффиксов` → `Показывать`.
4. **Map-фильтры становятся цветными chip-тоглами** (purple/emerald/blue), чтобы визуально отделить их от настроек интерфейса.
5. **State-модель и ARIA-семантика не меняются** — только presentation layer.

### Что меняется

#### `CategoryControlPanel.tsx`

- **Приоритет**: `radiogroup` (3 кнопки + label) → `<select>` с 3 опциями. Экономия: 4 слота → 1.
- **Сортировка**: `radiogroup` (2 кнопки + label) → `<select>` с 2 опциями. Экономия: 3 слота → 1.
- **Режим отображения**: `radiogroup` (2 кнопки + длинный label) → `<select>` с 2 опциями + короткий label `Показывать`. Экономия: 4 слота → 1.
- **И/ИЛИ** — НЕ ТРОГАЕМ. Остаются prominent amber-кнопками (используются постоянно).
- **Range filter, Round10, Threshold, Extra controls** — НЕ ТРОГАЕМ.

#### `ModList.tsx` (sticky-search-bar)

- Поиск остаётся prominent (flex-1).
- Тип и Источник — остаются `<select>`.
- `Развернуть/Свернуть` — остаются, но переезжают в компактную группу с меньшим gap.

#### `WaystonePage.tsx` (extraControls)

- 3 чекбокса → 3 цветных chip-тогла:
  - `Осквернён` → purple chip (text-accent-purple + border).
  - `Неосквернён` → emerald chip.
  - `Делириум` → blue chip.
- Chip-togle — это `<button>` с `aria-pressed`, не `<input type="checkbox">`. Но т.к. соседние категории (vendor/tablet/etc.) тоже могут иметь extraControls, изменения должны быть совместимы — оставляю `<input type="checkbox">` визуально стилизованным как chip, чтобы не ломать ARIA-роль checkbox на сложных формах.

> **Решение по chip-тоглам:** использую `<label>` с `<input type="checkbox">` + chip-style CSS-классами. Это сохраняет существующую ARIA-семантику и keyboard model (Space toggle), но визуально превращает их в теги Path of Exile.

### Что НЕ меняется

- `filter-store.ts` — state-модель та же.
- `useCategoryPage.ts` — те же хуки.
- URL sync — тот же.
- Profile persistence — тот же.
- i18n-ключи — добавляются новые для коротких лейблов, старые сохраняются для backward compat.
- Mobile layout — `flex-wrap` остаётся, на mobile селекты лучше кнопок (меньше ширины).

---

## i18n changes

```ts
// Новые ключи (короткие лейблы для <select>):
'sort.label_short': 'Сортировка',
'filter.show_mode_label_short': 'Показывать',
'priority.label_short': 'Приоритет',
// Существующие (priority.all/sa/s_only, sort.alpha/tier_first, filter.show_all/show_selected) — переиспользуются как <option>.
```

---

## Risk assessment

| Риск | Mitigation |
|---|---|
| ARIA-radiogroup → select ломает keyboard nav (arrow keys) | `<select>` нативно поддерживает arrow keys + Enter + Space — это не регрессия, а стандартизация |
| Кнопки с amber/highlight теряются | И/ИЛИ остаются prominent; для select'ов selected-value виден в самой кнопке select'а |
| На mobile select'ы хуже, чем кнопки | На mobile select нативно открывает OS-picker — это UX-улучшение, не регрессия |
| Chip-стиль ломается в других категориях | Изменения только в WaystonePage.extraControls; остальные страницы не используют extraControls с чекбоксами в таком виде |

---

## Test plan

- `pnpm exec tsc -b` — 0 errors
- `pnpm exec eslint .` — 0 warnings
- `pnpm test` — все существующие тесты проходят (изменения в presentation layer не должны ломать логические тесты)
- `pnpm build` — succeeds
- Визуальная проверка на Waystone — на следующей итерации (browser testing)
