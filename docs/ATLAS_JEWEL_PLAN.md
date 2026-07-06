# Atlas Jewel — План новой категории (iter 175–176)

> **Статус:** iter 176 — РЕАЛИЗОВАНА минимальная рабочая версия. iter 177+ — полировка (URL-sync, profile, prerender, SEO).
> **Цель:** Отдельный раздел для генерации регексов подсветки нод древа атласа, заменяемых особыми (Вневременными) самоцветами.
> **Документ-источник:** пользовательский запрос + тесты Atlas regex-семантики (см. `регис/результаты AND+OR тестов.md`).

---

## 0. Решения пользователя (iter 175 → iter 176)

| # | Решение | Выбор | Обоснование |
|---|---------|-------|-------------|
| 1 | Архитектура | **Вариант A** — новый top-level раздел `/timeless-jewel` | Полная изоляция от `/jewel`; Atlas-семантика OR-only несовместима с item-regex-engine. |
| 2 | Название | `/timeless-jewel` + «Особые самоцветы» | Соответствует PoE-терминологии (Timeless Jewels). |
| 3 | ETL | **One-off TS-парсер** `scripts/etl/parse-timeless-jewel.ts` (cheerio → JSON, committed output) | Лучшее из обоих миров: deterministic, reviewable, low-risk. НЕ в `run-etl.ts` (запускается вручную при появлении новых timeless jewels). |
| 4 | UI | **Новый `AtlasNodeList`** (НЕ обёртка над `VirtualizedModList`) | `VirtualizedModList` жёстко завязан на `GameToken` + L1/L2/L3 иерархию. 75 нод — виртуализация не нужна, плоский список достаточен. |
| 5 | Description в UI | **REQUIRED** (`description: Record<Locale, string>` в `AtlasNodeToken`) | Пользователь должен видеть что нода даёт, чтобы решить что кликать. Генератор использует только `name`. |

---

## 1. Постановка задачи

В PoE2 существуют **2 особых самоцвета** — «Вечная ненависть» (Undying Hate) и «Трагедия героев» (Heroic Tragedy). Механика:
- Самоцвет вставляется в сокет древа атласа.
- В радиусе вокруг сокета **оригинальные ноды заменяются на альтернативные** (AlternatePassiveSkills).
- В игре есть строка поиска по древу атласа — туда пользователь вставляет регекс, чтобы подсветить нужные ноды.

**Регекс должен подсвечивать только НАЗВАНИЯ нод** — без цифр, без аффиксов, без описаний эффектов.
Пример: нода «Служитель Тьмы» даёт «20% увеличение количества даров» → в регексе только `"Служитель Тьмы"`.

### Почему нельзя смешать с существующей категорией `/jewel`

| Аспект | Категория `/jewel` (текущая) | Новая категория (план) |
|--------|------------------------------|------------------------|
| Что ищет | Аффиксы на предмете-самоцвете (например «+5 к силе») | Названия нод на древе атласа |
| Где пользователь вставляет регекс | Поиск предметов в инвентаре | Поиск по древу атласа |
| Семантика регекса | Item-семантика (AND ✅, NOT ✅, multi-word OR ❌) | **Atlas-семантика** (AND ❌, NOT ❌, **multi-word OR ✅**) |
| Числовые диапазоны | Да (5—10, ##%) | Нет — только имена |
| Тип аффикса | prefix/suffix/implicit | Не применимо |
| Семейства (familyKey) | Да — для группировки | Не применимо |

**Вывод:** смешивание невозможно ни в данных, ни в UI, ни в regex-engine. Нужен **отдельный раздел**.

---

## 2. Семантика Atlas regex (VERIFIED IN-GAME — тесты пользователя)

| Синтаксис | Работает на древе атласа? | Примечание |
|-----------|---------------------------|------------|
| Substring `Сырая` | ✅ | Находит «Сырая мана» |
| Quoted phrase `"Сырая мана"` | ✅ | Точная фраза |
| OR single words `"А\|Б\|В"` | ✅ | Любое из слов |
| **OR multi-word `"А Б\|В Г"`** | ✅ ⭐ | **ГЛАВНОЕ ОТЛИЧИЕ от item-семантики!** |
| AND `"А" "Б"` | ❌ | 0 matches — НЕ работает |
| `.*` bridge `"А.*Б"` | ✅ | Между словами в одной quoted-группе |
| `!` NOT `"!А\|Б"` | ❌ | Подсвечивает ВСЕ ноды — НЕ работает |
| Case sensitivity | ✅ case-insensitive | `сырая мана` находит `Сырая мана` |

### Ключевое ограничение

На древе атласа **невозможно** составить регекс «3 обязательных + хотя бы 1 опциональный», потому что AND и NOT не работают. Единственная рабочая логика — **OR**: подсветить любые ноды, содержащие ЛЮБОЕ из перечисленных названий.

### Варианты регекса, которые генератор должен уметь строить

| Вариант | Когда использовать | Пример (для Вечной ненависти) |
|---------|--------------------|------------------------------|
| **A — все выбранные** | Подсветить всё, что интересно | `"Сдержанное возвышение\|Служитель Тьмы\|Хранитель духа\|Крошитель костей\|Колдовское восхождение\|Неприкрытая жестокость\|Проводник Бездны"` |
| **B — только MUST** | Отметить критически важные | `"Сдержанное возвышение\|Служитель Тьмы\|Хранитель духа"` |
| **C — только OPT** | Опциональные отдельно | `"Крошитель костей\|Колдовское восхождение\|Неприкрытая жестокость\|Проводник Бездны"` |

⚠️ Лимит 250 символов на регекс сохраняется. При 35—40 нодах в одной группе это **критично** — суммарная длина всех названий может превышать лимит. Нужна логика split (как в `splitOverLimitRegex()` для items).

---

## 3. Архитектурное решение

### 3.1. Вариант A (РЕКОМЕНДУЕМЫЙ): Новый top-level раздел `/timeless-jewel`

**Обоснование:**
- Полная изоляция от существующего `/jewel` — ноль риска для текущего функционала.
- Семантика Atlas regex отличается от item regex — отдельная страница позволяет использовать упрощённый regex-builder без оглядок на AND/NOT/ranges.
- Соответствует явному требованию пользователя: «не хочу чтобы названия нод смешивались с аффиксами других самоцветов».
- Единая точка входа для обоих особых самоцветов (selector внутри страницы).

**Структура:**
```
/timeless-jewel                # единый route, selector внутри
  ├── Undying Hate (35 нод)    # переключатель
  └── Heroic Tragedy (40 нод)  # переключатель
```

### 3.2. Альтернативы (отклонены)

- **Sub-section внутри `/jewel`** — отклонено: смешает две разные regex-семантики, усложнит URL-sync и profile persistence.
- **Расширение origin-системы (`jewel-timeless.json`)** — отклонено: `GameToken` schema не подходит (нет ranges/affix/familyKey), потребовало бы hack-fields.
- **Две отдельные страницы `/undying-hate` + `/heroic-tragedy`** — отклонено: дублирование кода, 2 nav-вкладки вместо 1.

---

## 4. Дата-модель (НОВАЯ — не наследует GameToken)

Существующая `GameToken` (193 поля с ranges, familyKey, affix, genderForms и т.д.) избыточна для atlas-нод. Вводим **новую минимальную схему**:

```typescript
// src/shared/types.ts — НОВЫЙ тип
export interface AtlasNodeToken {
  id: string;                          // 'undying-hate.abyss_notable_1'
  jewel: 'undying-hate' | 'heroic-tragedy';
  name: Record<Locale, string>;        // { ru: 'Служитель Тьмы' }
  /** Необязательное: краткое описание эффекта (для tooltip, не входит в регекс) */
  description?: Record<Locale, string>;
  /** Английское имя ноды (для корреляции с poe2db) */
  slug: string;                        // 'Disciple_of_Darkness'
  /** AlternatePassiveSkills key из poe2db */
  sourceKey: string;                   // 'abyss_notable_1'
}

export interface AtlasJewelCategoryData {
  version: string;
  category: 'timeless-jewel';
  source: 'poe2db.tw';
  sourceHash?: string;
  jewels: Array<{
    id: 'undying-hate' | 'heroic-tragedy';
    name: Record<Locale, string>;      // { ru: 'Вечная ненависть' }
    nodes: AtlasNodeToken[];
  }>;
}
```

**Zod-схема** (новая) — в `src/shared/schemas.ts`:
```typescript
export const AtlasNodeTokenSchema = z.object({
  id: z.string(),
  jewel: z.enum(['undying-hate', 'heroic-tragedy']),
  name: LocalizedString,
  description: LocalizedString.optional(),
  slug: z.string(),
  sourceKey: z.string(),
});

export const AtlasJewelCategoryDataSchema = z.object({
  version: z.string(),
  category: z.literal('timeless-jewel'),
  source: z.string(),
  sourceHash: z.string().optional(),
  jewels: z.array(z.object({
    id: z.enum(['undying-hate', 'heroic-tragedy']),
    name: LocalizedString,
    nodes: z.array(AtlasNodeTokenSchema),
  })),
});
```

### 4.1. JSON-файл: `public/generated/timeless-jewel.json`

Ручная кураторская сборка из PoE2DB (75 нод суммарно). Содержит 2 jewels-объекта.

**Почему ручная, а не ETL?**
- Объём маленький (75 нод) — ручная выверка надёжнее.
- Структура PoE2DB-страницы простая (`<a data-hover="?s=Data%5CAlternatePassiveSkills%2F..." href="...">NAME</a>`), но требует отдельного парсера — это дополнительный ETL-тип, которого пока нет.
- При росте числа timeless jewels (если GGG добавит новые) — можно написать ETL-парсер позже.

**Альтернатива (опционально):** ETL-парсер типа `'relic'` (новый тип `'timeless-jewel'`) в `scripts/run-etl.ts`. Источник: `https://poe2db.tw/ru/Undying_Hate` + `https://poe2db.tw/ru/Heroic_Tragedy`, парсинг секции `#ВневременнойсамоцветPassive`. Можно отложить на iter 177+.

---

## 5. UI / UX план

### 5.1. Навигация

- **Новый nav-элемент** в `src/ui/layout/nav-items.ts`:
  ```typescript
  { path: '/timeless-jewel', label: 'timeless_jewel.title', icon: 'jewel' },
  ```
  Позиция: после `/jewel` (логически рядом).
- **Иконка:** переиспользовать `public/icons/jewel.png` (или добавить `timeless-jewel.png` — отдельно, по решению пользователя).
- **i18n-ключи** в `src/shared/i18n.ts`:
  ```
  'timeless_jewel.title': 'Особые самоцветы',
  'timeless_jewel.subtitle': 'Подсветка нод древа атласа',
  'timeless_jewel.selector_label': 'Самоцвет',
  'timeless_jewel.undying_hate': 'Вечная ненависть',
  'timeless_jewel.heroic_tragedy': 'Трагедия героев',
  'timeless_jewel.node_count': '{n} нод',
  'timeless_jewel.regex_hint': 'Регекс для вставки в поиск древа атласа. AND и НЕ работают иначе — см. подсказку ⓘ.',
  'timeless_jewel.atlas_semantics_notice': 'На древе атласа работают только OR-паттерны. AND и НЕ не поддерживаются.',
  ```

### 5.2. Структура страницы `src/ui/pages/timeless-jewel/TimelessJewelPage.tsx`

```
┌──────────────────────────────────────────────────────────┐
│ Header: «Особые самоцветы» + selector (2 кнопки)        │
├──────────────────────────────────────────────────────────┤
│ Controls: поиск по имени ноды + сброс + счётчик          │
├──────────────────────────────────────────────────────────┤
│ ModList (упрощённый):                                    │
│   ┌─────────────────────────────────────────────────┐    │
│   │ ☐ Служитель Тьмы              [поиск: "Сл"]     │    │
│   │ ☐ Сдержанное возвышение                         │    │
│   │ ☑ Хранитель духа                                 │    │
│   │ ☐ Крошитель костей                               │    │
│   │ ... (всего 35 или 40 нод)                        │    │
│   └─────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────┤
│ RegexOutput:                                             │
│   "Служитель Тьмы|Сдержанное возвышение|Хранитель духа" │
│   [Copy]  ♥ 65/250 chars  ⚠ atlas mode                 │
├──────────────────────────────────────────────────────────┤
│ ⓘ Atlas semantics notice (info box)                     │
└──────────────────────────────────────────────────────────┘
```

### 5.3. Упрощённый компонент `AtlasNodeList`

НЕ переиспользуем `VirtualizedModList` / `ModList` напрямую — они завязаны на:
- `groupMode` (jewel-functional, affix-semantic, и т.д.)
- L1/L2/L3 иерархию (Affix → Origin → Semantic → chip)
- `familyKey`-группировку
- `collapsedGroups` / `expandedSubGroups`
- per-token `ranges`, `genderForms`, и т.д.

Вместо этого — **новый компонент `AtlasNodeList.tsx`** в `src/ui/components/`:
- Простой плоский список чекбоксов с именами нод.
- Поиск по substring (case-insensitive).
- Подсветка совпадений поиска.
- Сортировка: alphabetical (default) — другой режим не нужен.
- Состояние selected хранится в новом Zustand-store `atlas-jewel-store.ts` (или reuse `filter-store` с упрощённым API).

Альтернатива (если хочется меньше кода): обёртка над `VirtualizedModList` с transformацией `AtlasNodeToken[]` → `GameToken[]` (с пустыми ranges/familyKey и `affix='implicit'`). Требует моковых полей — semantic noise, но меньше новых компонентов. Решение за пользователем.

### 5.4. Regex-builder (НОВЫЙ — упрощённый)

Существующий `useRegexBuilder` из `useCategoryPage.ts` завязан на:
- `buildAstFromSelections` с AND/OR/MIXED_OR/EXCLUDE/RANGE нодами
- `compileAst` из `src/core/compiler.ts`
- `optimize` из `src/core/optimizer.ts`
- 250-char `truncateMixedOrLiterals`

Для atlas-нод нужно **только**: `"Name1|Name2|Name3"` — single quoted group, top-level `|`, без `.*`-bridges (имена — фразы целиком).

**Новая функция** в `src/ui/pages/timeless-jewel/` (или `src/core/atlas-regex-builder.ts`):
```typescript
export function buildAtlasRegex(
  selectedNames: string[],
  options?: { sortAlphabetically?: boolean }
): { regex: string; overflow: boolean; parts: string[] } {
  // 1. Sort (default: alphabetical for stable output)
  // 2. Join with | — escape nothing (names are plain text, no regex metachars in Russian node names)
  // 3. Wrap in single quoted group: "Name1|Name2|Name3"
  // 4. If > 250 chars — split into multiple quoted groups (each a separate OR)
  //    ⚠️ Atlas не поддерживает AND — но поддерживает OR multi-word.
  //    Split = N независимых regex-поисков, пользователь применяет их по очереди.
  //    Each part = OR of subset. Это аналог splitOverLimitRegex() для items.
}
```

⚠️ **Важно:** проверка на дубликаты имён между двумя самоцветами — если «Жертва плоти» (Undying Hate) и какое-то имя из Heroic Tragedy совпадают, в одном регексе они задвоены. Решение: при selector mode показывать только ноды выбранного самоцвета; режим «оба» — опционально (требует дедупликации).

---

## 6. План реализации (итерации)

### iter 175 — ТЕКУЩАЯ (разведка и планирование)
- ✅ Распарсены PoE2DB-страницы → списки нод сохранены в `регис/`.
- ✅ Зафиксирована Atlas-семантика regex.
- ✅ Составлен этот план.
- ✅ Документация (STATUS.md, AGENT_NAVIGATION.md) обновлена.
- **НЕ реализован код.**

### iter 176 — Дата-модель + минимальная страница
1. Добавить `AtlasNodeToken` + `AtlasJewelCategoryData` типы в `src/shared/types.ts`.
2. Добавить Zod-схемы в `src/shared/schemas.ts`.
3. Создать `public/generated/timeless-jewel.json` (ручная сборка из распарсенных списков).
4. Создать `src/data/atlas-jewel-loader.ts` (fetch + Zod-валидация + cache).
5. Создать `src/ui/pages/timeless-jewel/TimelessJewelPage.tsx` (минимальный — selector + список + regex output).
6. Создать `src/ui/components/AtlasNodeList.tsx` (плоский virtualized-список чекбоксов).
7. Добавить route в `src/App.tsx`.
8. Добавить nav-item в `src/ui/layout/nav-items.ts`.
9. Добавить i18n-ключи в `src/shared/i18n.ts`.
10. Тесты: Zod-схема, loader, regex-builder, page render.

### iter 177 — Полировка UI + UX-фичи
1. Подсветка совпадений поиска.
2. Info-бокс про Atlas-семантику (`ⓘ Atlas semantics notice`).
3. Profile persistence (как в существующих категориях).
4. URL-sync (через `url-sync.ts`).
5. Favorites (★) — опционально, по востребованности.
6. Prerendering (`scripts/prerender.ts` — добавить `/timeless-jewel` route).
7. Sitemap (`public/sitemap.xml` — новая запись).
8. SEO meta-tags.

### iter 178+ — ETL-интеграция (опционально)
- Новый ETL-тип `'timeless-jewel'` в `scripts/run-etl.ts`.
- Парсер секции `#ВневременнойсамоцветPassive` из HTML.
- Auto-refresh при появлении новых timeless jewels.

---

## 7. Риски и mitigations

| Риск | Mitigation |
|------|-----------|
| Длина регекса > 250 chars при большом выборе нод | Реализовать `splitAtlasRegex()` — аналог `splitOverLimitRegex()`. Каждая часть — отдельный OR, пользователь применяет по очереди. |
| Дубликаты имён между двумя самоцветами | Selector mode показывает только выбранный самоцвет. Режим «оба» — опционально, с дедупликацией. |
| Регрессия существующего `/jewel` | Ноль изменений в `jewel.json` / `JewelPage.tsx` / regex-engine. Полная изоляция. |
| Семантика Atlas может измениться (патчи GGG) | Документировать в `STATUS.md` (раздел «Подтверждённые ограничения PoE2» → Atlas). При изменении — пересмотреть plan. |
| `ёфикация` / диалект | Atlas-ноды — готовые имена из клиента, ёфикация не нужна. Не применять `applyDialectOptimizations`. |

---

## 8. Что нужно от пользователя для старта iter 176

1. **Подтвердить архитектурное решение** — Вариант A (новый top-level раздел `/timeless-jewel`).
2. **Выбрать название раздела:**
   - `/timeless-jewel` + «Особые самоцветы» (рекомендуется)
   - `/atlas-jewel` + «Самоцветы атласа»
   - `/unique-jewel` + «Уникальные самоцветы»
   - другое
3. **Подтвердить ручную сборку JSON** (vs ETL-парсер сразу) — iter 176 ручная, iter 178+ ETL.
4. **Подтвердить список нод** (см. `регис/undying_hate_nodes.txt` + `регис/heroic_tragedy_nodes.txt`) — проверить, не пропущены ли, нет ли опечаток.
5. **Решить по переиспользованию UI:** новый `AtlasNodeList` (рекомендуется) vs обёртка над `VirtualizedModList`.

---

## 9. Ссылки

- PoE2DB Вечная ненависть: https://poe2db.tw/ru/Undying_Hate#ВневременнойсамоцветPassive
- PoE2DB Трагедия героев: https://poe2db.tw/ru/Heroic_Tragedy#ВневременнойсамоцветPassive
- Распарсенные списки нод: `регис/undying_hate_nodes.txt`, `регис/heroic_tragedy_nodes.txt`
- Тесты Atlas regex-семантики: `регис/результаты AND+OR тестов.md`
- Существующая jewel-категория: `src/ui/pages/jewel/JewelPage.tsx`, `public/generated/jewel.json`
- Regex-движок: `src/core/compiler.ts`, `src/core/optimizer.ts`, `src/core/limits.ts`
