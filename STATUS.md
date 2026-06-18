# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 83 (analysis + verification)

---

## Open Proposal (iter 82 → iter 83 verification)

### OP-1: Перегруппировка аффиксов — функциональные блоки вместо 4 крупных корзин

Полный анализ в [`docs/AFFIXES_GROUPING_ANALYSIS.md`](docs/AFFIXES_GROUPING_ANALYSIS.md).

**Суть:** текущая 3-корзинная схема (`offensive/defensive/attribute/neutral`) для jewellery/jewel и 3-корзинная (`positive/negative/neutral`) для waystone отправляют **14-39% всех модов** в «Прочие»/«Общие» — включая S-tier моды (+skill levels, MF, рунический барьер). Tablet «generic» — 39%. Relic — 100% (по дизайну `affix-only`).

**Найденные баги классификации (9, из них 3 — NEW в iter 83):**

1. **S-tier в neutral**: `+# к уровню всех камней умений` (generic), MF, `+#% к качеству всех умений`, `+#% к максимальному качеству`, `+# к максимуму рунического барьера`. *(iter 83: исправление — `+# к духу` НЕ в neutral, он в defensive через `/дух/i` regex.)*
2. **Waystone mis-классификации (4 из 7 neutral):** `+#% к бонусу критического урона монстров` (→ negative), `На #% больше волшебных и редких монстров` (→ positive), `На #% больше шанса появления свойств у редких монстров` (→ negative), `На #% больше эффективности монстров` (→ negative).
3. **Tablet «generic» = 39%** всех модов, включая S-tier (кол-во/редкость/опыт/доп. сущности/изгнанники).
4. **Тег `aura` не входит ни в одну категорию** → 2 токена jewel (сила умений аур) → neutral.
5. **Тег `gem` не используется** → 17 токенов (1 ring + 14 amulet + 2 belt) → neutral.
6. **`Знак повелителя Бездны`** — 6 family-groups (ring+amulet+belt × prefix+suffix), essence-origin, без тегов → neutral. *(iter 83: исправление — 6, не 2)*
7. **NEW (iter 83): Breach Lord-теги `kurgal_mod`/`amanamu_mod`/`ulaman_mod` — 73 токена в neutral** (26+25+22). Теги не входят в OFFENSIVE/DEFENSIVE/ATTRIBUTE buckets. Моды имеют явную семантику (attribute/defensive/offensive/charm/flask), но теряются в neutral.
8. **NEW (iter 83): Relic использует `affix-only` mode → 100% в одной корзине**. 25 family-groups без подгрупп. Не баг, а архитектурное решение — стоит пересмотреть.
9. **NEW (iter 83): Мета-механики PoE2 размазаны**: Вестники/Знамёна/Кличи/Метки/Обереги/Запечатанные/Архонт/Мета-умения/Сгустки/Подношения/Рунический барьер — каждый отдельная «семантическая зона», но живут в offensive/defensive/neutral без подкатегорий.

**Точные counts neutral-корзины (iter 83, верифицировано):**

| Категория | Groups | Neutral | % |
|---|---|---|---|
| ring | 94 | 13 | 13.8% |
| amulet | 105 | 20 | 19.0% |
| belt | 85 | 18 | 21.2% |
| jewel | 193 | 39 | 20.2% |
| waystone | 50 | 7 (4 mis) | 14.0% |
| tablet | 82 | 32 | 39.0% |
| relic | 25 | 25 (по дизайну) | 100% |

**Предлагаемые изменения (см. полный анализ в docs/):**

- **P0**: 24 функциональных блока для jewellery (вместо 4 корзин) — `Дух / Уровень умений / Атрибуты / Здоровье-Мана-ES / Рунический барьер (NEW) / Сопротивления / Защита / Скорость / Крит / Урон / Пробитие / Состояния / Область-Длительность / Сгустки-Wisps (NEW) / Ауры-Вестники-Метки-Знаки-Кличи-Знамёна-Обереги / Приспешники-Компаньоны-Подношения / Архонт-Запечатанные-Мета / Оружие-специфичные / Фласки / MF / Конверсия / Свирепость-Заряды / Бездна-Разлом / Прочее`.
- **P0**: 6 weapon sub-blocks для jewel (24 family-key) — `Урон / Скорость атаки / Крит / Меткость / Шкала / Перезарядка` по типам оружия.
- **P0**: Игнорировать Breach Lord-теги при classifyByTags + fallback на текст (73 токена).
- **P0**: Расширить POSITIVE/NEGATIVE_KEYWORDS для waystone (4 mis-классификации).
- **P0**: Добавить `aura`+`gem` в OFFENSIVE_TAGS (19 токенов).
- **P1**: ETL-tagged `functionalCategory` (по образцу `jewelType`) для ~100% точности.
- **P1**: Поле `sortKey` в `FamilyGroup` + пользовательский тумблер «режим группировки» (блоки/популярность/алфавит) с URL-персистентностью.
- **P1**: Sub-blocks внутри waystone sentiment и tablet type.
- **P2**: `relic-semantic` mode (5 блоков) или подтверждение `affix-only`.
- **P2**: Tier-aware сортировка внутри блоков.
- **P3**: Приоритет тегов вместо first-match; визуальная сепарация блоков.

**Статус:** анализ выполнен и верифицирован, реализация не начата. Ждёт решения по приоритетам.

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82-83): перегруппировка аффиксов — см. выше.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре (defensive guard в Oracle — iter 73) |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts (iter 50) |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---
Контакты: Discord **woonderdad**
