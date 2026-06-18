# Анализ: группировка / сортировка / вывод аффиксов

> **Статус:** Open Proposal OP-1 — iter 82 анализ → iter 83 верификация → iter 84 P0-фиксы → iter 85 infrastructure (7/24 блоков) → iter 86 +7 блоков (14/24) + production switch для ring/amulet/belt → iter 87 weapon sub-blocks для jewel (6 weapon-class sub-blocks) + production switch для jewel → iter 88 +2 блока (17/24 активны: ailments + area-duration) → iter 89 +3 блока (20/24 активны: rage-charges + meta-skills + buff-skills) → iter 90-91 ETL-tagged functionalCategory 100% в продакшене → **iter 92 fix multi-segment + i18n-override: 0 расхождений ETL vs regex (было 11)**.
> **iter 92:** Two-pass ETL classification (single-segment tiers first with tags, multi-segment text-only per segment) + re-classify functionalCategory in applyI18nOverrides. jewel other-bucket 8.3% (unchanged), amulet 6.7% (было 7.6%), ring 3.2% (unchanged), belt 4.7% (было 5.9%). 1363/1363 tests.
> **Цель:** ёмкое описание текущей архитектуры, найденные проблемы, обоснованные предложения с учётом специфики PoE2.

---

## 1. Текущая архитектура (как есть)

### 1.1. Иерархия рендера

4 уровня для 5 категорий (ring/belt/amulet/jewel/relic), 3 уровня для waystone/tablet:

| Уровень | Чем определяется | Где |
|---|---|---|
| **L1 — Affix** | `implicit → prefix → suffix` (фиксированный порядок) | `family-grouper.ts:151` `AFFIX_ORDER` |
| **L2 — Origin** | `normal → desecrated → corrupted → essence → breachborn` | `ModList.tsx:76` `ORIGIN_ORDER`. **Включён по умолчанию** для ring/belt/amulet/jewel/relic через `showOriginSubSections={true}`. |
| **L3 — Semantic** | см. ниже | `classifyGroups()` в `mod-classifier.ts` |
| **L4 — Family group** | чипы в flex-wrap | `ModSubGroupSection` |

### 1.2. Режимы L3 по категориям (`ModGroupMode`)

| Категория | groupMode | Подкатегории L3 |
|---|---|---|
| ring / belt / amulet | `affix-functional` (iter 86-89) | 20 функциональных блоков: Spirit / Skill levels / Attributes / Resources / Runes barrier / Resistances / Defence stats / Offence speed / Crit / Damage type / Ailments / Area-Duration / Rage-charges / Meta-skills / Buff-skills / Minions / Flasks / Рарити / Breach / Other |
| jewel | `jewel-functional` (iter 87) | 20 функциональных блоков + `weapon-specific` раскрывается в 6 weapon-class sub-blocks (melee / bow / crossbow / staff / spear / dagger) |
| waystone | `affix-sentiment` | Позитивные / Негативные / Нейтральные |
| tablet | `tablet-type` | Ритуал / Бездна / Делириум / Ваал / Экспедиция / Общие |
| relic | `affix-only` | без подкатегорий (ВСЕ моды в одной корзине) |
| jewel (доп.) | `jewel-type` (внутри origin) | Рубин / Изумруд / Сапфир / Общие |

### 1.3. Сортировка внутри L3-блока (`family-grouper.ts:150-160`)

1. Affix type: `implicit → prefix → suffix`
2. Priority tier: `S → A → B → C`
3. Алфавит по `familyKey` (ru-locale)

### 1.4. Классификация в L3

- **Теги** (предпочтительнее, есть для jewellery/jewel): `classifyByTags()` — для каждого member'а берётся **первый тег** из `member.tags[]`, попадающий в OFFENSIVE/DEFENSIVE/ATTRIBUTE; затем majority voting.
- **Текстовая эвристика** (fallback для waystone/tablet/relic и token'ов без тегов): `classifyByText()` — regex по `displayText`.

---

## 2. Найденные проблемы (с количественной оценкой)

> Все counts верифицированы iter 83 прямой симуляцией классификаторов на реальных JSON.

### 2.1. «Прочие» / «Нейтральные» / «Общие» корзины — 14-39% всех модов

| Категория | Total groups | Neutral / «Прочие» / «Общие» | Доля |
|---|---|---|---|
| ring | 94 | 13 | **13.8%** |
| amulet | 105 | 20 | **19.0%** |
| belt | 85 | 18 | **21.2%** |
| jewel | 193 | 39 | **20.2%** |
| waystone | 50 | 7 (4 из них — mis-классификации) | 14% |
| tablet | 82 | 32 | **39.0%** |
| relic | 25 | 25 (по дизайну — `affix-only` mode) | 100% |

**Итого:** 154 из 634 family-groups (24%) — в «мусорной» корзине.

### 2.2. S-tier моды в «Прочих» (исправлено iter 83)

iter 82 утверждал, что `+# к духу` попадает в neutral — **это неверно**. `/дух/i` входит в DEFENSIVE_KEYWORDS → Spirit уходит в **defensive** (но всё равно теряется в крупной корзине).

**Реальные S-tier моды в neutral:**
- `+# к уровню всех камней умений` (amulet, suffix — generic без типа) — S, нет тегов → neutral
- `#% повышение редкости найденных предметов` (MF, ring/amulet prefix+suffix) — B в `*_B` паттернах, нет тегов → neutral
- `+#% к качеству всех умений` (amulet) — нет в priority-паттернах, нет тегов → neutral
- `+#% к максимальному качеству` (ring/amulet) — нет тегов → neutral
- `+# к максимуму рунического барьера` (ring/amulet) — нет тегов → neutral
- `#% увеличение длительности эффекта умения` — нет тегов → neutral
- `#% повышение скорости перезарядки умений` — нет тегов → neutral
- `#% усиление эффекта Подношений` — нет тегов → neutral
- `#% усиление эффекта создаваемых вами сгустков` — Breach-mechanic, см. §2.7

### 2.3. Waystone sentiment — 4 mis-классификации (верифицировано iter 83)

| Family key | Сейчас | Должно быть |
|---|---|---|
| `+#% к бонусу критического урона монстров` | neutral | **negative** |
| `На #% больше волшебных и редких монстров` | neutral | **positive** |
| `На #% больше шанса появления свойств у редких монстров` | neutral | **negative** |
| `На #% больше эффективности монстров` | neutral | **negative** |

`POSITIVE_KEYWORDS` и `NEGATIVE_KEYWORDS` нужно расширить.

### 2.4. Tablet «generic» — 39% всех модов, включая S-tier

В «Общие» сейчас попадают S-tier моды (верифицировано iter 83):
- `#% увеличение количества находимых на карте путевых камней`
- `#% увеличение редкости находимых на карте предметов`
- `#% увеличение размера групп монстров на карте`
- `#% увеличение количества получаемого опыта на карте`
- `#% увеличение количества выпадающих из боссов карты путевых камней`
- `#% увеличение редкости монстров на карте`
- `На карте можно встретить дополнительную Сущность` / `дополнительного духа азмири` / `дополнительный ларец` / `дополнительных бродячих изгнанников`
- `#% увеличение эффективности монстров`

Все не матчат keyword-паттерны конкретных механик → сваливаются в «Общие».

### 2.5. Тег `aura` и `gem` не входят ни в одну категорию (верифицировано iter 83)

- `aura` (2 токена в jewel: «сила умений аур», «область действия присутствия») → neutral.
- `gem` (17 токенов: 1 ring + 14 amulet + 2 belt, «связан с камнем умений», в основном +уровень камней умений чар) → neutral.

Нужно добавить в OFFENSIVE_TAGS (или создать отдельную категорию для buff-модов).

### 2.6. `Знак повелителя Бездны` — 6 family-groups, не 2 (исправлено iter 83)

iter 82 утверждал «2 family-key в ring» — **неполно**. Реально: **6 family-groups** (essence-origin, без тегов):
- ring prefix + ring suffix
- amulet prefix + amulet suffix
- belt prefix + belt suffix

Все → neutral. Это явно Breach-themed мод.

### 2.7. NEW (iter 83): Breach Lord-теги `kurgal_mod` / `amanamu_mod` / `ulaman_mod` — 73 токена в neutral

Это **самый крупный неучтённый баг**. Три Breach Lord-специфичных тега **не входят ни в OFFENSIVE/DEFENSIVE/ATTRIBUTE** → все 73 токена идут в neutral.

| Тег | Ring | Amulet | Belt | Total | Breach Lord |
|---|---|---|---|---|---|
| `kurgal_mod` | 8 | 11 | 7 | **26** | Kurgal, the Brazen Lord |
| `amanamu_mod` | 8 | 10 | 7 | **25** | Amanamu, Where Drifting Memories Sediment |
| `ulaman_mod` | 6 | 9 | 7 | **22** | Ulaman, Sovereign of the Well |
| **Итого** | 22 | 30 | 21 | **73** | |

**Примеры модов, которые сейчас в neutral, хотя имеют явную семантику:**
- `+# к силе и ловкости` (ulaman) — это ATTRIBUTE
- `+# к ловкости и интеллекту` (kurgal) — это ATTRIBUTE
- `+# к силе и интеллекту` (amanamu) — это ATTRIBUTE
- `+#% к сопротивлениям молнии и хаосу` (ulaman) — это DEFENSIVE
- `+#% к сопротивлениям холоду и хаосу` (kurgal) — это DEFENSIVE
- `Приспешники наносят увеличенный на #% урон...` (amanamu) — это OFFENSIVE
- `#% увеличение урона от чар при полном энергетическом щите` (kurgal) — это OFFENSIVE
- `Восстанавливает #% здоровья при убийстве` (ulaman) — это DEFENSIVE/sustain
- `Используемые вами обереги с #% шансом могут не потратить заряды` (amanamu) — это CHARM
- `Флаконы маны получают зарядов в секунду: #` (kurgal) — это FLASK
- `Флаконы здоровья получают зарядов в секунду: #` (ulaman) — это FLASK

**Решение:** при классификации Breach Lord-теги должны ** игнорироваться** — классификация должна идти по другим тегам (`life`/`mana`/`damage`/`elemental`/...) или по тексту. Либо ETL должен извлекать `functionalCategory` для каждого Breach Lord-мода отдельно.

### 2.8. NEW (iter 83): Relic — 100% «neutral» по дизайну

Relic использует `affix-only` mode → вообще без семантической классификации. 80 токенов, 25 family-groups, 0 тегов. Все в одной корзине.

Это **не баг, а архитектурное решение**, но пользователь relic-страницы не получает никакой группировки. Стоит либо:
- Ввести `relic-semantic` mode с блоками `Честь / Монстры / Комнаты / Торговцы / Прочее`.
- Либо оставить как есть (категория маленькая, 25 групп — читаемо).

### 2.9. NEW (iter 83): Мета-механики PoE2 размазаны по категориям

В PoE2 появились новые buff/skill-типы, каждый из которых — отдельная «семантическая зона» для игрока. Сейчас они размазаны:

| Механика | Где живёт сейчас | Кол-во | Должно быть |
|---|---|---|---|
| Вестники (Heralds) | offensive (если `damage` тег) или neutral | 2 | отдельный sub-block |
| Знамёна (Banners) | neutral (нет тегов) | 3 | отдельный sub-block |
| Кличи (Warcries) | offensive (`damage`+`speed` теги) | 4 | отдельный sub-block |
| Метки (Marks) | offensive (`attack` тег) | 22 | отдельный sub-block |
| Обереги (Charms) | defensive (`charm` тег) | 25 | отдельный sub-block |
| Запечатанные умения | neutral (нет тегов) | 2 | отдельный sub-block |
| Архонт | offensive (`elemental`/`minion` теги) | 4 | отдельный sub-block |
| Мета-умения | neutral (нет тегов) | 1 | отдельный sub-block |
| Подношения (Offerings) | neutral/defensive (`life`/`minion`) | 14 | sub-block внутри minion |
| Сгустки (Wisps) | neutral (`amanamu_mod` тег) | 24 | отдельный sub-block (Breach-механика) |
| Рунический барьер | neutral (нет тегов) | 4 | отдельный defensive sub-block |

### 2.10. L3-бакеты слишком крупные для jewellery

В блоке «Атакующие» для кольца сейчас вместе: «скорость атаки мечами», «увеличение урона от молнии», «шанс критического удара кинжалами», «сила поджога», «пробитие сопротивления холоду», «увеличение урона приспешников». Это 5 разных функциональных групп, перемешанных алфавитом внутри одного тира.

### 2.11. Алфавит внутри тира не функционален

«`#%` повышение скорости атаки» и «`#%` повышение скорости сотворения чар» стоят рядом (оба на «п»), но «`#%` увеличение урона от молнии» (тоже атакующее) уезжает далеко — на «у». Игрок мыслит темами (весь cold-стек вместе, весь crit-стек вместе), не алфавитом.

### 2.12. Weapon-specific моды размазаны по блоку «Атакующие»

iter 82 утверждал «23 family-key» — **iter 83 нашёл 24** (добавился `#% повышение скорости атаки без оружия` в jewel). Все имеют корректные теги (`['damage','attack']` или `['attack','speed']` или `['attack','critical']`) → правильно классифицируются как offensive, но сортируются алфавитно вместе со всеми остальными атакующими модами.

### 2.13. Нет промежуточного уровня между L3 и чипами

Скачок от «Атакующие» сразу к чипам. Промежуточного уровня «Урон по стихиям / Скорость / Крит / Пробитие / Состояния / Приспешники» — нет.

### 2.14. Сортировка прибинжена к рендеру

`groupTokensByFamily` сортирует сразу по тир→алфавит. Нет возможности переопределить порядок независимо от классификатора.

---

## 3. Уточнение про weapon-specific моды в PoE2

В проекте **нет отдельных категорий-страниц для оружия** (sword/dagger/axe/...). Список категорий: home, waystone, tablet, relic, jewel, vendor, belt, ring, amulet — 9 штук.

Weapon-specific моды встречаются **только в `jewel.json`** (24 family-key). Это **пассивные бонусы самоцветов** («+X% к урону мечами», «+X% к скорости атаки кинжалами» и т.д.) — они применяются, когда у игрока экипировано соответствующее оружие.

**Точное оружие в `jewel.json` (10 типов):** мечами, кинжалами, топорами, булавами, луками, самострелами, копьями, боевыми посохами, кистенями, без оружия.

**PoE2 Early Access статус оружия:** булавы, мечи, топоры, кинжалы, луки, самострелы, копья, боевые посохи, скипетры, жезлы, посохи — **в игре**. Кистени и «без оружия» (unarmed) — пока не отдельные классы оружия в EA, но моды уже есть в данных poe2db. Эти моды **валидны**, не удалять. Если часть оружия ещё не в EA — это отдельная задача фильтрации, не относится к группировке.

---

## 4. Предложения по перегруппировке

### 4.1. Полная схема функциональных блоков для jewellery (24 блока, обновлено iter 83)

Замена 4 крупных корзин (offensive/defensive/attribute/neutral) на 24 функциональных блока:

```
 1. ДУХ (Spirit) — S, amulet-only (5 tokens, 1 family-key)
 2. УРОВЕНЬ УМЕНИЙ — +уровень камней умений (всех типов), +качество умений
 3. АТРИБУТЫ — Сила, Ловкость, Интеллект, Все, включая dual-attr (сила+ловкость, и т.д.)
 4. ЗДОРОВЬЕ / МАНА / ES — максимум, регенерация, похищение, восстановление
 5. РУНИЧЕСКИЙ БАРЬЕР — NEW (4 tokens, сейчас в neutral)
 6. СОПРОТИВЛЕНИЯ — Огонь/Холод/Молния/Хаос/Все, включая dual-resist
 7. ЗАЩИТНЫЕ ПОКАЗАТЕЛИ — Броня, Уклонение, ES, Блок, Порог оглушения
 8. СКОРОСТЬ — Атак / Сотворения чар / Передвижения / Перезарядки / Снарядов
 9. КРИТ — Шанс / Бонус / По типу урона
10. УРОН ПО ТИПУ — Физ/Огонь/Холод/Молния/Хаос/Стихийный/От чар/От атак
11. ПРОБИТИЕ СОПРОТИВЛЕНИЯ — Огонь/Холод/Молния/Хаос
12. СОСТОЯНИЯ (ailments) — Поджог/Шок/Охлаждение/Отравление/Кровотечение/Оцепенение/Парирование/Пригвождение/Разрушение брони/Разрез — ✅ iter 88
13. ОБЛАСТЬ / ДЛИТЕЛЬНОСТЬ — Область действия, Длительность умения, Длительность состояний — ✅ iter 88
14. СГРУСТКИ (Wisps) — NEW (24 tokens, Breach-механика, сейчас в neutral через amanamu_mod) — ⏳ iter 90+ (0 family-keys в jewel `other`)
15. АУРЫ / ВЕСТНИКИ / МЕТКИ / КЛИЧИ / ЗНАМЁНА / ПРОКЛЯТИЯ — buff-type skills — ✅ iter 89 (buff-skills)
16. ПРИСПЕШНИКИ / КОМПАНЬОНЫ / ПОДНОШЕНИЯ — minion-related (Offerings теперь здесь)
17. АРХОНТ / ЗАПЕЧАТАННЫЕ / МЕТА-УМЕНИЯ — ✅ iter 89 (meta-skills)
18. ОРУЖИЕ-СПЕЦИФИЧНЫЕ (jewel only) — 24 family-key в 6 sub-blocks (см. §4.2)
19. ФЛАКОНЫ — belt primary, все flask-моды
20. РАРИТИ (MF) — Редкость, Количество найденных предметов
21. КОНВЕРСИЯ / СУСТЕЙН — MoM, Урон→Здоровье, Урон→Мана, Восстановление при убийстве — ⏳ iter 90+ (0 family-keys в jewel `other` — похищен уже в RESOURCES)
22. СВИРЕПОСТЬ / ЗАРЯДЫ — Свирепость, Слава знамён — ✅ iter 89 (rage-charges)
23. БЕЗДНА / РАЗЛОМ — Breach Lord's Mark (6 tokens) + Истощение Бездны + Breach Lord-теги (kurgal/amanamu/ulaman — 73 tokens)
24. ПРОЧЕЕ — реально <5% после внедрения блоков выше
```

Внутри каждого блока — сортировка `tier → alpha` (текущее поведение сохраняется).

### 4.2. Оружейный sub-block для jewel (24 family-key, обновлено iter 83)

Сгруппировать 24 weapon-specific family-key по шаблону:

| Подблок | Кол-во | Варианты |
|---|---|---|
| Урон {оружием} | 10 | булавами, боевыми посохами, кинжалами, кистенями, копьями, луками, мечами, самострелами, топорами, без оружия |
| Скорость атаки {оружием} | 8 | боевыми посохами, кинжалами, копьями, луками, мечами, самострелами, топорами, без оружия |
| Крит {оружием} | 3 | кинжалами (шанс), кистенями (шанс), копьями (бонус к крит. урон) |
| Меткость {оружием} | 1 | луками |
| Шкала {оружием} | 2 | оглушение булавами, заморозка боевыми посохами |
| Перезарядка {оружием} | 0 | (самострела встречается в EMERALD_SCORES, но без family-key — проверяется отдельно) |

Визуально:
```
▼ Урон (10)
    без оружия  боевыми посохами  булавами  кинжалами  кистенями  копьями  луками  мечами  самострелами  топорами
```

### 4.3. ETL-tagged functionalCategory (по образцу `jewelType`)

В `classifyJewelType` уже есть образцовый паттерн (Strategy 1: ETL lookup 100% / Strategy 2: weighted keyword scoring ~94%). Распространить на функциональные блоки. ETL может из poe2db ModCalc-страниц извлекать не только `jewelType`, но и `functionalCategory`.

Даст ~100% точность без хрупких regex'ов. Особенно важно для Breach Lord-модов (73 токена) — у них есть `kurgal_mod`/`amanamu_mod`/`ulaman_mod` теги, но они **не помогают** классифицировать мод по функции. ETL должен извлекать реальную функцию из текста мода.

### 4.4. Поле `sortKey` в `FamilyGroup` + пользовательский тумблер

Добавить computed-поле `sortKey: string` формата `{tier}.{blockKey}.{alphaKey}`. Сортировка в `groupTokensByFamily` меняется на сортировку по `sortKey`. Это развязывает «семантическую группировку» и «порядок рендера».

Добавить в панель управления переключатель «Группировка» с тремя режимами:
- **По популярности** (текущий: tier → alpha)
- **По блокам** (новый: tier → blockKey → alpha) — для крафта/теории
- **По алфавиту** (простой алфавит) — для поиска по имени

Состояние тумблера должно жить в URL (через `url-sync.ts`), чтобы ссылками можно было делиться.

### 4.5. Waystone — sub-blocks внутри sentiment

Внутри `positive`:
- **Лут** (кол-во/редкость/размер групп, больше волшебных/редких)
- **Сустейн** (доп. путевые, шанс выпадения, сундуки, сущности, духи азмири, изгнанники)
- **Механики** (Бездна, Ритуал, Делириум, Ваал, Экспедиция — доп. контент)
- **Опыт** (больше опыта, боссы дают больше опыта)

Внутри `negative`:
- **Урон монстров** (увеличение урона, крит, меткость, пробитие сопротивлений)
- **Защита монстров** (сопротивления, здоровье, ES, уклончивость, бронированность, эффективность, порог оглушения/состояний)
- **Сложность редких монстров** (больше свойств, доп. свойства, доп. снаряды, увеличенная область)
- **Негатив земле/проклятия** (подожжённая/замёрзшая/заряженная земля, проклятия)
- **Дебаффы игрока** (меньше флаконов, меньше регена, меньше скорости перезарядки, меньше максимума сопротивлений)

### 4.6. Tablet — sub-blocks внутри type

Внутри каждого типа (ritual/breach/delirium/vaal/expedition):
- **Количество/Редкость** (S)
- **Механика-специфика** (для Breach — доп. бездны/осколки/истощение/Глубины Бездны/свойства Бездны; для Ritual — алтари/дань/награды/ритуальный круг/возрождение; для Vaal — маяки/кристаллы/призвание; для Expedition — рунические монстры/артефакты/взрывчатка/журналы; для Delirium — туман/зеркала/симулякры/боссы)
- **Прочее** (опыт, золото, размер групп)

Для `generic` ввести подтype **«Базовые»** с подразделами:
- **Лут** (количество/редкость предметов, путевые камни)
- **Опыт**
- **Монстры** (волшебные/редкие/уникальные, размер групп, эффективность)
- **Доп. контент** (сущности, духи азмири, ларцы, изгнанники, ритуальные круги)
- **Особые** (Осталось зарядов, Карта обладает доп. свойством, Добавляет Заражение)

### 4.7. Порядок блоков — «игрок-сценарий», не алфавит, не priority tier

Порядок должен отражать типичный сценарий крафта:
1. Сначала «конечные цели» — Spirit, +skill levels, атрибуты (база билда).
2. Потом survivability — здоровье, мана, ES, рунический барьер, сопротивления, защита.
3. Потом offence — скорость, крит, урон, пробитие, состояния.
4. Потом специфика — minion, weapon-specific, flasks, MF, conversion, breach, meta.
5. В конце — прочее (площадь, длительность, второстепенные механики).

Это **не совпадает с простым S→A→B→C порядком**, потому что Spirit (S) и +skill levels (S) должны быть выше, чем S-tier elemental damage. Tier — про ценность, порядок — про логику сборки.

### 4.8. hideLabel auto-suppression для блоков с 1 чипом

iter 62 уже умеет скрывать Level-3 бейдж, если в скоупе только ОДНА sub-group. При добавлении функциональных блоков нужно следить, чтобы для категорий с малым числом модов (jewel-corrupted 10 токенов, relic 80) блоки не превращались в шум из «заголовков с 1 чипом».

Решение: функциональный блок рендерится как бейдж только если в нём ≥2 family-groups. Иначе — чипы сливаются в общий поток блока-родителя.

### 4.9. Приоритет тегов вместо first-match

Заменить «first matching tag in member.tags wins» на приоритетный матч: `ailment > elemental_type > damage > attribute > defensive > offensive > neutral`. Это уберёт зависимость от порядка тегов внутри `member.tags[]`.

**Важно для Breach Lord-модов (iter 83):** теги `kurgal_mod`/`amanamu_mod`/`ulaman_mod` должны **полностью игнорироваться** при priority-tag матче — они указывают на источник (Breach Lord), а не на функцию. То же самое про теги `charm` (это тип buff'а, не defensive) — должен идти в раздел «Ауры/Вестники/Метки/.../Обереги».

### 4.10. Tier-aware сортировка внутри блоков

Внутри функционального блока разделить на S → A → B → C с тонкими визуальными разделителями (не заголовками, а микро-отступами). Это даст пользователю подсказку «вот тут топовые моды блока».

### 4.11. Визуальная сепарация блоков

В `ModSubGroupSection` добавить тонкую горизонтальную черту под заголовком L4 (sub-semantic) и чуть больший вертикальный отступ между блоками. Сейчас все чипы идут в едином flex-wrap потоке — глазу не за что зацепиться.

### 4.12. NEW (iter 83): Relic-semantic mode

Ввести для relic отдельный `relic-semantic` mode с блоками:
- **Честь** (максимум, восстановление, сопротивление чести)
- **Монстры** (увеличение/уменьшение урона монстров, боссов, редких монстров)
- **Комнаты** (доп. комнаты, доп. товаров, ключи)
- **Торговцы** (снижение цен, доп. товар)
- **Прочее** (святая вода, проклятия, скорость монстров)

Альтернатива: оставить `affix-only` (25 групп — читаемо и без подгрупп).

---

## 5. Приоритезация (обновлено iter 89)

| P | Что | Затронутые файлы | Статус | Эффект |
|---|---|---|---|---|
| **P0** ✅ | Расширение POSITIVE/NEGATIVE_KEYWORDS для waystone (7 mis-классификаций, не 4) | `src/shared/mod-classifier.ts` | **done iter 84** | waystone neutral 7 → 0 |
| **P0** ✅ | Игнорировать Breach Lord-теги (`kurgal_mod`/`amanamu_mod`/`ulaman_mod`) при classifyByTags + fallback на текст | `src/shared/mod-classifier.ts` | **done iter 84** | ~73 токена получили корректную классификацию; -11 neutral (jewellery) |
| **P0** ✅ | Добавить тег `aura` и `gem` в OFFENSIVE_TAGS | `src/shared/mod-classifier.ts` | **done iter 84** | `aura` (2 jewel-токена) из neutral → offensive; `gem`-токены уже имели парные caster/minion теги (робастность для будущих модов) |
| **P0** ✅ infrastructure | FunctionalBlock type + FUNCTIONAL_BLOCK_LABELS (24 entries) + classifyFunctionalBlock (7 active patterns) + `affix-functional` mode в classifyGroups + 44 теста | `src/shared/mod-classifier.ts` + `tests/shared/mod-classifier.test.ts` | **done iter 85** | Готова к расширению в iter 86 |
| **P0** ✅ | Реализованы 7 новых функциональных блоков (defence-stats / offence-speed / crit / damage-type / flasks / resources / minions) через tags + text patterns | `src/shared/mod-classifier.ts` | **done iter 86** | other-bucket снизился с 70.4% до 9.9% (jewellery) |
| **P0** ✅ | Включить `affix-functional` groupMode в RingPage/AmuletPage/BeltPage | `src/ui/pages/{ring,amulet,belt}/*.tsx` | **done iter 86** | 3 страницы теперь используют 14 функциональных блоков вместо 4 корзин |
| **P0** ✅ | Weapon sub-blocks для jewel (по 6 группам из §4.2): WeaponClass type + WEAPON_CLASS_LABELS + classifyWeaponClass + WEAPON_SPECIFIC_PATTERN + `'jewel-functional'` mode | `src/shared/mod-classifier.ts` + `src/ui/pages/jewel/JewelPage.tsx` + `tests/shared/mod-classifier.test.ts` | **done iter 87** | 24 family-key организованы в 6 читаемых подблоков (melee=10, bow=3, crossbow=2, staff=3, spear=3, dagger=3); JewelPage переключён на `jewel-functional` |
| **P1** | ETL-tagged functionalCategory для ring/amulet/belt/jewel (по образцу jewelType) | `scripts/etl/normalize.ts` + `generate-dictionary.ts` + `fetch-poe2db.ts` | не начато | ~100% точность классификации |
| **P1** ✅ | Снижение other-bucket jewel.json ниже 15% через ailments + area-duration блоки | `src/shared/mod-classifier.ts` + `tests/shared/mod-classifier.test.ts` | **done iter 88** | jewel.json other-bucket 21.8% → **14.0%** |
| **P1** ✅ | Дальнейшее снижение other-bucket jewel.json до ~8% через buff-skills + meta-skills + rage-charges блоки | `src/shared/mod-classifier.ts` + `tests/shared/mod-classifier.test.ts` | **done iter 89** | jewel.json other-bucket 14.0% → **8.3%** + бонусные улучшения для amulet/ring/belt |
| **P1** | Поле `sortKey` в FamilyGroup + `groupingMode` toggle в UI | `src/shared/types.ts` + `family-grouper.ts` + `ModList.tsx` + `CategoryControlPanel.tsx` + `url-sync.ts` | не начато | Развязка «семантика» vs «порядок рендера» |
| **P1** | Tablet sub-blocks внутри type | `src/shared/mod-classifier.ts` + `ModList.tsx` | не начато | generic bucket снижается с 39% до <15% |
| **P1** | Waystone sub-blocks внутри sentiment | `src/shared/mod-classifier.ts` + `ModList.tsx` | не начато | 3 корзины → 12-20 читаемых блоков |
| **P2** | Relic-semantic mode (или подтверждение `affix-only`) | `src/shared/mod-classifier.ts` + `ModList.tsx` + `RelicPage.tsx` | не начато | 25 групп → 5 читаемых блоков (если решено внедрять) |
| **P2** | Tier-aware сортировка внутри блоков (микро-отступы S/A/B/C) | `family-grouper.ts` + `ModList.tsx` | не начато | Визуальная подсказка «топовые моды блока» |
| **P2** | hideLabel auto-suppression для блоков с 1 чипом | `ModList.tsx` (расширение iter 62 логики) | не начато | Меньше шума на малых категориях |
| **P3** | Приоритет тегов вместо first-match | `src/shared/mod-classifier.ts` | не начато | Детерминированная классификация при multi-tag |
| **P3** | Визуальная сепарация блоков (border-bottom, gap) | `ModList.tsx` + `index.css` | не начато | Лучшая читаемость |

---

## 6. Специфика PoE2, которую важно соблюсти

1. **Weapon-specific моды на самоцветах валидны** — это пассивные бонусы для экипированного оружия, не отдельные категории оружия.
2. **Состояний в PoE2 больше, чем в PoE1**: поджог / шок / охлаждение / отравление / кровотечение / оцепенение / парирование / пригвождение / разрушение брони / разрез. У каждого свой «стек» модов (сила + длительность + шанс + порог). Группировать по ailment.
3. **Приспешники / Компаньоны / Подношения / Тотемы / Вестники** — отдельные сущности-мишени в PoE2. Не смешивать с обычным уроном игрока.
4. **Ресурсы PoE2**: здоровье / мана / энергетический щит / **рунический барьер** / свирепость / дух (для relic) / честь. Это разные «пулы», не путать. Рунический барьер — NEW-механика PoE2 (отдельный от ES defensive resource).
5. **Свежие механики PoE2**: обереги (charms), Парирование, Вестники, Мета-умения, Архонт, Запечатанные умения, Ваал-маяки, Бездна-истощение, Сгустки (wisps — Breach-механика), Подношения — у каждой свой набор модов.
6. **MF в PoE2 менее приоритетен**, чем в PoE1 (нет нормального трейда в Early Access) — MF-блок нужен, но после урон/защита.
7. **Spirit (Дух) — критически важная характеристика** для minion-билдов (от него зависит, сколько умений можно вызвать). Должен быть отдельный блок, не теряться в defensive.
8. **Breach Lord-моды** (kurgal/amanamu/ulaman) — это конкретные Breach Lord-специфичные моды, появляющиеся на essence-origin предметах. Они **не являются чисто Breach-themed** — у них есть нормальная игровая функция (атрибуты, сопротивления, урон и т.д.), просто источник — Breach Lord. Классифицировать нужно по функции, не по источнику.
9. **Знак повелителя Бездны (Breach Lord's Mark)** — 6 family-groups (ring+amulet+belt × prefix+suffix), essence-origin, без тегов. Это **единственный** Breach-themed мод без Breach Lord-тега — нужно отдельное правило для него (или ручная разметка в ETL).

---

## 7. История итераций

### iter 89 — buff-skills + meta-skills + rage-charges blocks (20 of 24 active)

Реализованы 3 новых функциональных блока поверх 17 блоков iter 88. jewel.json other-bucket 14.0% → **8.3%** (цель ~7-8% достигнута). Бонусные улучшения для amulet/ring/belt.

**Что сделано:**
- `RAGE_CHARGES_PATTERN = /(?:свирепост|славы.*знам[её]н)/i` — 4 hits в jewel (3 свирепость + 1 слава знамён). Должен идти ДО buff-skills (слава знамён содержит «знамён»).
- `META_SKILLS_PATTERN = /(?:Мета-умени|Архонт|запечат|вызываем.*умени)/i` — 1 hit в jewel + 5 bonus в amulet/ring/belt.
- `BUFF_SKILLS_PATTERN = /(?:аур|Вестник|мет[о]?к(?!ост)|клич|знам[её]н|проклят)/i` — 6 hits в jewel + 4 bonus в amulet/ring. Ключевая защита: `мет[о]?к(?!ост)` — негативный lookahead исключает «меткости» (accuracy), ловит только «меток/метки/метку» (mark skills).
- В `classifyFunctionalBlock()` добавлены **шаг 18 (RAGE_CHARGES)**, **шаг 19 (META_SKILLS)**, **шаг 20 (BUFF_SKILLS)** — AFTER `area-duration` (шаг 17), BEFORE `other` fallback. Порядок: rage-charges → meta-skills → buff-skills (от более конкретного к более широкому).
- 23 новых теста (rage-charges: 4 positive + 2 negative; meta-skills: 6 positive; buff-skills: 8 positive + 4 negative). + 2 обновлённых существующих теста (warcry-recharge теперь buff-skills).
- Penetration, wisps, conversion пропущены (0 family-keys в jewel.json `other` для этих паттернов).

**Симуляция (scripts/simulate-iter89-impact.ts):**

| Категория | Groups | other iter 88 | other iter 89 | Δ |
|---|---|---|---|---|
| jewel | 193 | 27 (14.0%) | 16 (8.3%) | -11 |
| amulet | 105 | 11 (10.5%) | 7 (6.7%) | -4 |
| ring | 94 | 5 (5.3%) | 3 (3.2%) | -2 |
| belt | 85 | 7 (8.2%) | 4 (4.7%) | -3 |

✅ Все 20 реклассификаций — из `other` (ни один существующий bucket не сломан).

**Изменённые файлы (6):**
- `src/shared/mod-classifier.ts` — +90 строк (RAGE_CHARGES_PATTERN + META_SKILLS_PATTERN + BUFF_SKILLS_PATTERN + шаги 18/19/20 + JSDoc + обновлённые комментарии).
- `tests/shared/mod-classifier.test.ts` — +23 теста.
- `scripts/analyze-iter89-other-bucket.ts` — новый скрипт (dump 27 family-keys в `other` после iter 88 + preliminary candidate patterns).
- `scripts/simulate-iter89-impact.ts` — новый скрипт (mirror iter 88 vs iter 89 patterns + diff).
- `scripts/verify-iter89-deployment.ts` — новый скрипт (финальная верификация с реальным classifyFunctionalBlock).
- `STATUS.md`, `docs/AFFIXES_GROUPING_ANALYSIS.md`, `worklog.md`.

### iter 88 — Ailments + Area-Duration blocks (17 of 24 active)

Реализованы 2 новых функциональных блока поверх 15 блоков iter 87. jewel.json other-bucket 21.8% → **14.0%** (цель <15% достигнута). Заодно — UX-фикс: «Магический поиск» → «Рарити». (Подробности в git — сжато в iter 89.)

**Что сделано:**
- `AILMENTS_PATTERN` — 16 keywords (поджог/шок/охлажден/заморозк/отравлен/отравить/кровотеч/оцепенен/парир/пригвожден/Разрез/ослеплен/ослепить/горючест/восприимчивост/истощен) + 2 составных (наложен.*состоян, стихийн.*состоян). Без `мет[о]?к` (mark skills → buff-skills будущий блок).
- `AREA_DURATION_PATTERN` — 3 OR-альтернативы (област.*действ / длительн.*(?:проклят|знам[её]н) / Улучшает радиус). Намеренно ограничен: generic «длительность умения» уже ловится SKILL_LEVELS_PATTERN.
- В `classifyFunctionalBlock()` добавлены **шаг 16 (AILMENTS)** и **шаг 17 (AREA_DURATION)** — AFTER `offence-speed` (шаг 15), BEFORE `other` fallback. Это гарантирует, что новые блоки ловят только то, что иначе попало бы в `other` — ни один существующий bucket не сломан.
- `FUNCTIONAL_BLOCK_LABELS['magic-find'].label`: «Магический поиск» → **«Рарити»**.
- `FUNCTIONAL_BLOCK_LABELS['area-duration']`: muted → violet (теперь активный блок).
- 25 новых тестов (ailments: 11 positive + 4 negative; area-duration: 8 positive + 2 negative).
- Penetration пропущен (0 family-keys в jewel.json `other` с паттерном `пробива.*сопротивлен` — все penetration-моды уже ловятся damage-type/resistances).

**Симуляция (scripts/simulate-iter88-impact.ts):**

| Категория | Groups | other iter 87 | other iter 88 | Δ |
|---|---|---|---|---|
| jewel | 193 | 42 (21.8%) | 27 (14.0%) | -15 |
| amulet | 105 | 12 (11.4%) | 11 (10.5%) | -1 |
| ring | 94 | 9 (9.6%) | 5 (5.3%) | -4 |
| belt | 85 | 7 (8.2%) | 7 (8.2%) | 0 |

✅ Все 20 реклассификаций — из `other` (ни один существующий bucket не сломан).

**Изменённые файлы (6):**
- `src/shared/mod-classifier.ts` — +85 строк (AILMENTS_PATTERN + AREA_DURATION_PATTERN + шаги 16/17 + JSDoc + FUNCTIONAL_BLOCK_LABELS: Рарити + area-duration violet).
- `tests/shared/mod-classifier.test.ts` — +25 тестов.
- `scripts/simulate-iter88-impact.ts` — новый скрипт (mirror iter 87 vs iter 88 patterns + diff).
- `scripts/analyze-iter88-other-bucket.ts` — новый скрипт (dump 42 family-keys в `other` + preliminary candidate patterns).
- `STATUS.md`, `docs/AFFIXES_GROUPING_ANALYSIS.md`, `worklog.md`.

### iter 87 — Weapon sub-blocks for jewel + production switch

Реализованы 6 weapon-class sub-blocks (melee / bow / crossbow / staff / spear / dagger) для 24 weapon-specific family-keys в jewel.json. JewelPage переключён на новый режим `jewel-functional`. 47 новых тестов. jewel.json other-bucket = 21.8% (цель <30% достигнута). 1315/1315 tests. (Подробности в git — сжато в iter 88.)

### iter 86 — 7 new functional blocks + production switch (14 of 24)

Реализованы 7 новых функциональных блоков через **tags + text patterns** поверх 7 блоков iter 85. Production-страницы RingPage/AmuletPage/BeltPage **переключены на `affix-functional`**. Other-bucket = 9.9% (цель <30% достигнута с запасом). 1268/1268 tests. (Подробности в git — сжато в iter 87.)

### iter 85 — Functional blocks infrastructure (7 of 24)

Реализована инфраструктура 24-блочной системы. **Production НЕ переключён** — other-bucket = 70.4% с 7 блоками. 1216/1216 tests. (Подробности в git — сжато в iter 87.)

### iter 84 — P0-фиксы (Breach Lord / waystone / aura+gem)

Реализованы 3 P0-фикса из анализа iter 83.

**Bug #7 (Breach Lord-теги, 73 токена):**
- `BREACH_LORD_TAGS = {'kurgal_mod','amanamu_mod','ulaman_mod'}` в `mod-classifier.ts`.
- `classifyByTags` пропускает эти теги → классификация по другим тегам.
- Если у member'а только Breach Lord теги → fallback на `classifyByText`.
- `DEFENSIVE_KEYWORDS` расширено `флакон` (Breach Lord flask-моды).

**Bug #2 (waystone mis-классификации):**
- iter 83 считал «4 mis + 3 actual» — **ошибка**: реально все 7 были mis (каждый текст встречается как prefix+suffix = 2 группы, итого 4 уникальных текста × ~1.75 группы = 7 групп).
- `POSITIVE_KEYWORDS` += `больше.*волшебн.*редк.*монстр` (2 группы).
- `NEGATIVE_KEYWORDS` += `бонус.*крит.*урон.*монстр` (1) + `шанса появления свойств.*редк.*монстр` (2) + `больше.*эффективн.*монстр` (2).
- Итог: waystone neutral 7 → 0.

**Bug #4-5 (aura+gem теги):**
- `aura` и `gem` добавлены в `OFFENSIVE_TAGS`.
- `gem`-токены в реальных JSON уже имели парные теги (`caster`/`minion`) → классифицировались offensive и до фикса. Добавление `gem` в OFFENSIVE_TAGS даёт робастность для будущих модов.
- `aura`-токены (2 в jewel: «сила умений аур», «область действия присутствия») — реально исправлены из neutral → offensive.

**Тесты:** 1158 базовых + 14 новых = **1172 теста, все зелёные**. `pnpm lint`: 0 ошибок.

**Симуляция (mirror классификаторов на реальных JSON):**

| Категория | Groups | Neutral до | Neutral после | Δ |
|---|---|---|---|---|
| ring | 98 | 14 | 13 | -1 |
| amulet | 105 | 22 | 18 | -4 |
| belt | 85 | 21 | 17 | -4 |
| jewel | 193 | 47 | 45 | -2 |
| waystone | 50 | 7 | **0** | -7 |
| waystone-desecrated | 29 | 6 | 6 | 0 |
| **Итого** | 560 | 117 | **99** | **-18 (-15%)** |

### iter 83 — верификация + 3 новых бага

**Исправления к iter 82:**
1. **§2.1**: Уточнены точные counts (ring 13.8%, amulet 19.0%, belt 21.2%, jewel 20.2%, tablet 39.0%).
2. **§2.2**: `+# к духу` НЕ в neutral — он в defensive (через `/дух/i` regex). Actual S-tier в neutral: `+# к уровню всех камней умений` (generic), MF, `+#% к качеству всех умений`, `+#% к максимальному качеству`, `+# к максимуму рунического барьера`.
3. **§2.6**: `Знак повелителя Бездны` — 6 family-groups (ring+amulet+belt × prefix+suffix), не 2.
4. **§2.12 / §4.2**: weapon-specific family-keys — 24, не 23 (добавился `#% повышение скорости атаки без оружия`).

**Новые баги (iter 83):** §2.7 (Breach Lord 73 токена), §2.8 (Relic 100% neutral по дизайну), §2.9 (мета-механики PoE2 размазаны).

**Новые предложения (iter 83):** §4.1 (24 блока), §4.9 (charm в buff-типы, Breach Lord skip), §4.12 (relic-semantic mode).

### iter 82 — первичный анализ

6 багов, 22 функциональных блока.

---

## 8. Статус

**iter 82:** первичный анализ (6 багов, 22 блока).
**iter 83:** верификация + исправления + 3 новых бага (9 багов, 24 блока).
**iter 84:** 3 P0-фикса реализованы (Breach Lord skip + text fallback + waystone keywords + aura/gem tags). 1172 теста зелёные. Neutral-корзина: -18 групп (-15%).
**iter 85:** Инфраструктура 24 функциональных блоков готова (7 активны). Production НЕ переключён — other-bucket = 70.4% с 7 блоками.
**iter 86:** +7 блоков (14 активны) через tags + text patterns. **Production переключён** — RingPage/AmuletPage/BeltPage используют `affix-functional`. Other-bucket = 9.9% (цель <30% достигнута).
**iter 87:** Weapon sub-blocks для jewel (6 weapon-class sub-blocks для 24 family-key) + новый `jewel-functional` mode. **Production переключён** — JewelPage использует `jewel-functional`. jewel.json other-bucket = 21.8% (цель <30% достигнута). 1315/1315 tests.
**iter 88:** +2 блока (17 активны: ailments + area-duration). jewel.json other-bucket 21.8% → **14.0%** (цель <15% достигнута). UX-фикс: «Магический поиск» → «Рарити». 1340/1340 tests.
**iter 89:** +3 блока (20 активны: rage-charges + meta-skills + buff-skills). jewel.json other-bucket 14.0% → **8.3%** (цель ~7-8% достигнута). Бонусные улучшения: amulet 10.5% → 6.7%, ring 5.3% → 3.2%, belt 8.2% → 4.7%. 1363/1363 tests.

**Ключевые файлы, затронутые в iter 89:**
- `src/shared/mod-classifier.ts` (~1940 строк) — добавлены RAGE_CHARGES_PATTERN + META_SKILLS_PATTERN + BUFF_SKILLS_PATTERN + шаги 18/19/20 в `classifyFunctionalBlock()`.
- `tests/shared/mod-classifier.test.ts` (~2030 строк) — +23 теста (rage-charges: 4+2, meta-skills: 6+0, buff-skills: 8+4) + 2 обновлённых существующих теста (warcry-recharge теперь buff-skills).
- `scripts/analyze-iter89-other-bucket.ts` — dump всех 27 family-keys в `other` после iter 88 + preliminary candidate patterns (использовался для проектирования паттернов).
- `scripts/simulate-iter89-impact.ts` — mirror iter 88 vs iter 89 patterns + diff на jewel/amulet/ring/belt.
- `scripts/verify-iter89-deployment.ts` — финальная верификация с реальным `classifyFunctionalBlock` (не mirror).

**Ключевые файлы для будущих итераций (iter 90+):**
- `src/shared/mod-classifier.ts` — опционально реализовать wisps/conversion/penetration блоки (сейчас 0 family-keys в jewel `other` для этих паттернов). Более высокий приоритет: ETL-tagged functionalCategory (P1) — даст ~100% точность без хрупких regex'ов.
- `src/shared/family-grouper.ts` (316 строк) — `groupTokensByFamily` + будущий `sortKey`.
- `src/shared/types.ts` — `FamilyGroup` (добавить `sortKey`), `ModGroupMode` (новые режимы).
- `src/ui/components/VirtualizedModList.tsx` (811 строк) — поддержка будущих sub-block levels (если понадобятся для waystone/tablet).
- `src/ui/components/CategoryControlPanel.tsx` — тумблер «режим группировки».
- `src/store/url-sync.ts` — URL-персистентность для `groupingMode`.
- `scripts/etl/normalize.ts` + `generate-dictionary.ts` + `fetch-poe2db.ts` — для ETL-tagged `functionalCategory` (P1).
