# Анализ: группировка / сортировка / вывод аффиксов

> **Статус:** OP-1 — iter 82 анализ → iter 83 верификация → iter 84 P0-фиксы → iter 85-89 infrastructure (20/24 блоков активны) → iter 90-92 ETL-tagged functionalCategory 100% в продакшене → iter 96 regex удалён из runtime → iter 97 чистка тестов/скриптов.
> **Текущая архитектура:** runtime `classifyFunctionalBlock()` — тонкая Strategy 0 обёртка (majority voting по ETL `functionalCategory`); 22-шаговый regex-классификатор сохранён в ETL `scripts/etl/classify-functional-category.ts`.
> **Метрики (iter 96/97):** jewel other-bucket 8.3%, amulet 6.7%, ring 3.2%, belt 4.7%. 1363/1363 tests, cross-validation 477/477.

---

## 1. Текущая архитектура

### 1.1. Иерархия рендера

4 уровня для 5 категорий (ring/belt/amulet/jewel/relic), 3 уровня для waystone/tablet:

| Уровень | Чем определяется | Где |
|---|---|---|
| **L1 — Affix** | `implicit → prefix → suffix` | `family-grouper.ts` `AFFIX_ORDER` |
| **L2 — Origin** | `normal → desecrated → corrupted → essence → breachborn` | `ModList.tsx` `ORIGIN_ORDER`. Включён для ring/belt/amulet/jewel/relic. |
| **L3 — Semantic** | см. ниже | `classifyGroups()` в `mod-classifier.ts` |
| **L4 — Family group** | чипы в flex-wrap | `ModSubGroupSection` |

### 1.2. Режимы L3 по категориям (`ModGroupMode`)

| Категория | groupMode | Подкатегории L3 |
|---|---|---|
| ring / belt / amulet | `affix-functional` | 20 функциональных блоков |
| jewel | `jewel-functional` | 20 блоков + `weapon-specific` → 6 weapon-class sub-blocks |
| waystone | `affix-sentiment` | Позитивные / Негативные / Нейтральные |
| tablet | `tablet-type` | Ритуал / Бездна / Делириум / Ваал / Экспедиция / Общие |
| relic | `affix-only` | без подкатегорий |
| jewel (доп.) | `jewel-type` (внутри origin) | Рубин / Изумруд / Сапфир / Общие |

### 1.3. Сортировка внутри L3-блока

1. Affix type: `implicit → prefix → suffix`
2. Priority tier: `S → A → B → C`
3. Алфавит по `familyKey` (ru-locale)

### 1.4. Классификация в L3

- **Strategy 0 (ETL lookup):** majority voting по `functionalCategory` на токенах. Используется для jewellery/jewel — все 477 family-groups имеют ETL-тег.
- **Текстовая эвристика:** для waystone/tablet/relic (не используют `classifyFunctionalBlock()`).

---

## 2. Ключевые баги и проблемы (актуальные)

### 2.1. Tablet «generic» — 39% всех модов в «Общие»

В «Общие» сейчас попадают S-tier моды: количество/редкость путевых камней, предметов, размер групп монстров, опыт, эффективность монстров, доп. Сущность/духи азмири/ларец/изгнанники. Все не матчат keyword-паттерны конкретных механик.

**Fix:** Tablet sub-blocks внутри type (см. §3.5).

### 2.2. Waystone sentiment — все 7 neutral были mis-классификации (fixed iter 84)

Расширение `POSITIVE_KEYWORDS` и `NEGATIVE_KEYWORDS` решило проблему: waystone neutral 7 → 0.

### 2.3. Breach Lord-теги — 73 токена без классификации (fixed iter 84)

Теги `kurgal_mod`/`amanamu_mod`/`ulaman_mod` не помогают классифицировать мод по функции. Решено: теги игнорируются в `classifyByTags` + fallback на текст.

### 2.4. Relic — 100% в одной корзине по дизайну

Relic использует `affix-only` mode → 80 токенов, 25 family-groups в одной корзине без подгрупп. Это **не баг, а архитектурное решение** — но возможен `relic-semantic` mode (см. §3.6).

### 2.5. Мета-механики PoE2 (частично fixed iter 89)

Вестники / Знамёна / Кличи / Метки / Обереги / Запечатанные / Архонт / Мета-умения — теперь отдельные функциональные блоки (buff-skills, meta-skills, rage-charges).

### 2.6. L3-бакеты слишком крупные для jewellery (fixed iter 85-89)

Замена 4 корзин на 20 функциональных блоков снизила other-bucket с 70% до 8-9%.

### 2.7. Нет промежуточного уровня между L3 и чипами

Скачок от L3 сразу к чипам. Промежуточного уровня «Урон по стихиям / Скорость / Крит / ...» — нет.

### 2.8. Сортировка привязана к рендеру

`groupTokensByFamily` сортирует сразу по тир→алфавит. Нет возможности переопределить порядок независимо от классификатора.

---

## 3. Открытые предложения (P1-P3)

### 3.1. Поле `sortKey` + `groupingMode` toggle в UI (P1)

Добавить computed-поле `sortKey: string` формата `{tier}.{blockKey}.{alphaKey}`. Сортировка в `groupTokensByFamily` меняется на сортировку по `sortKey`. Это развязывает «семантическую группировку» и «порядок рендера».

Переключатель «Группировка» в панели управления:
- **По популярности** (текущий: tier → alpha)
- **По блокам** (новый: tier → blockKey → alpha)
- **По алфавиту** (простой алфавит)

Состояние в URL через `url-sync.ts`.

### 3.2. Waystone — sub-blocks внутри sentiment (P1)

Внутри `positive`: Лут / Сустейн / Механики / Опыт.
Внутри `negative`: Урон монстров / Защита монстров / Сложность редких / Негатив земле/проклятия / Дебаффы игрока.

### 3.3. Tablet — sub-blocks внутри type (P1)

Внутри каждого типа: Количество/Редкость / Механика-специфика / Прочее.
Для `generic`: Базовые → Лут / Опыт / Монстры / Доп. контент / Особые.

### 3.4. Tier-aware сортировка внутри блоков (P2)

Внутри функционального блока разделить на S → A → B → C с тонкими визуальными разделителями (не заголовками, а микро-отступами).

### 3.5. Визуальная сепарация блоков (P3)

В `ModSubGroupSection` добавить тонкую горизонтальную черту под заголовком L4 и чуть больший вертикальный отступ между блоками.

### 3.6. Relic-semantic mode (P2)

Ввести для relic отдельный `relic-semantic` mode с блоками: Честь / Монстры / Комнаты / Торговцы / Прочее. Альтернатива: оставить `affix-only` (25 групп — читаемо и без подгрупп).

### 3.7. hideLabel auto-suppression (done iter 62)

iter 62 уже умеет скрывать Level-3 бейдж, если в скоупе только ОДНА sub-group. Для категорий с малым числом модов (jewel-corrupted 10 токенов, relic 80) блоки не превращаются в шум из «заголовков с 1 чипом». Функциональный блок рендерится как бейдж только если в нём ≥2 family-groups.

---

## 4. Приоритезация

| P | Что | Статус |
|---|---|---|
| **P0** ✅ | Waystone POSITIVE/NEGATIVE_KEYWORDS расширение | done iter 84 — waystone neutral 7 → 0 |
| **P0** ✅ | Breach Lord-теги skip + text fallback | done iter 84 — 73 токена получили корректную классификацию |
| **P0** ✅ | `aura`/`gem` теги в OFFENSIVE_TAGS | done iter 84 |
| **P0** ✅ | 24-блочная infrastructure (FunctionalBlock type + FUNCTIONAL_BLOCK_LABELS + classifyFunctionalBlock + `affix-functional` mode) | done iter 85-89 — 20/24 блоков активны |
| **P0** ✅ | Production switch для ring/amulet/belt (`affix-functional`) + jewel (`jewel-functional` with weapon sub-blocks) | done iter 86-87 |
| **P0** ✅ | Ailments + Area-Duration блоки | done iter 88 — jewel other-bucket 21.8% → 14.0% |
| **P0** ✅ | Rage-charges + Meta-skills + Buff-skills блоки | done iter 89 — jewel other-bucket 14.0% → 8.3% |
| **P1** ✅ | ETL-tagged functionalCategory для ring/amulet/belt/jewel | done iter 90-92 — 100% точность |
| **P1** | Поле `sortKey` в FamilyGroup + `groupingMode` toggle в UI | не начато |
| **P1** | Tablet sub-blocks внутри type | не начато — generic bucket 39% → цель <15% |
| **P1** | Waystone sub-blocks внутри sentiment | не начато — 3 корзины → 12-20 читаемых блоков |
| **P2** | Relic-semantic mode (или подтверждение `affix-only`) | не начато |
| **P2** | Tier-aware сортировка внутри блоков (микро-отступы S/A/B/C) | не начато |
| **P2** ✅ | hideLabel auto-suppression для блоков с 1 чипом | done iter 62 |
| **P3** | Визуальная сепарация блоков (border-bottom, gap) | не начато |

---

## 5. Специфика PoE2

1. **Weapon-specific моды на самоцветах валидны** — это пассивные бонусы для экипированного оружия, не отдельные категории оружия.
2. **Состояний в PoE2 больше, чем в PoE1**: поджог / шок / охлаждение / отравление / кровотечение / оцепенение / парирование / пригвождение / разрушение брони / разрез. У каждого свой «стек» модов.
3. **Приспешники / Компаньоны / Подношения / Тотемы / Вестники** — отдельные сущности-мишени в PoE2. Не смешивать с обычным уроном игрока.
4. **Ресурсы PoE2**: здоровье / мана / энергетический щит / **рунический барьер** / свирепость / дух (для relic) / честь. Рунический барьер — NEW-механика PoE2 (отдельный от ES defensive resource).
5. **Свежие механики PoE2**: обереги (charms), Парирование, Вестники, Мета-умения, Архонт, Запечатанные умения, Ваал-маяки, Бездна-истощение, Сгустки (wisps — Breach-механика), Подношения — у каждой свой набор модов.
6. **MF в PoE2 менее приоритетен**, чем в PoE1 (нет нормального трейда в Early Access).
7. **Spirit (Дух) — критически важная характеристика** для minion-билдов. Отдельный блок, не теряется в defensive.
8. **Breach Lord-моды** (kurgal/amanamu/ulaman) — это конкретные Breach Lord-специфичные моды на essence-origin предметах. У них есть нормальная игровая функция, просто источник — Breach Lord. Классифицировать по функции, не по источнику.
9. **Знак повелителя Бездны (Breach Lord's Mark)** — 6 family-groups (ring+amulet+belt × prefix+suffix), essence-origin, без тегов. Единственный Breach-themed мод без Breach Lord-тега.

---

## 6. Ключевые файлы для будущих итераций

- `src/shared/mod-classifier.ts` (~1140 строк) — `classifyFunctionalBlock()` (Strategy 0), `classifyByTags`, `classifyByText`, `classifyJewelType`, `classifyWeaponClass`, `classifyWaystoneSentiment`, `classifyTabletType`.
- `src/shared/family-grouper.ts` (316 строк) — `groupTokensByFamily` + будущий `sortKey`.
- `src/shared/types.ts` — `FamilyGroup` (добавить `sortKey`), `ModGroupMode` (новые режимы).
- `src/ui/components/VirtualizedModList.tsx` (811 строк) — поддержка будущих sub-block levels.
- `src/ui/components/CategoryControlPanel.tsx` — тумблер «режим группировки».
- `src/store/url-sync.ts` — URL-персистентность для `groupingMode`.
- `scripts/etl/classify-functional-category.ts` — ETL-tagged `functionalCategory` (Strategy 0 data source).
