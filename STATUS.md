# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 82 (analysis-only)

---

## Open Proposal (iter 82)

### OP-1: Перегруппировка аффиксов — функциональные блоки вместо 4 крупных корзин

Полный анализ в [`docs/AFFIXES_GROUPING_ANALYSIS.md`](docs/AFFIXES_GROUPING_ANALYSIS.md).

**Суть:** текущая 3-корзинная схема (`offensive/defensive/attribute/neutral`) для jewellery/jewel и 3-корзинная (`positive/negative/neutral`) для waystone отправляют **15-38% всех модов** в «Прочие»/«Общие» — включая S-tier моды (Spirit, +skill levels, MF).

**Найденные баги классификации (6):**

1. **S-tier в neutral**: `+# к духу`, `+#% к уровню всех камней умений`, `#% повышение редкости найденных предметов`, `+#% к качеству всех умений` — все без тегов → neutral, несмотря на S/A/B tier.
2. **Waystone mis-классификации (4 из 7 neutral):** `+#% к бонусу критического урона монстров` (neutral → negative), `На #% больше волшебных и редких монстров` (neutral → positive), `На #% больше шанса появления свойств у редких монстров` (neutral → negative), `На #% больше эффективности монстров` (neutral → negative).
3. **Tablet «generic» = 38%** всех модов, включая S-tier (кол-во/редкость/опыт/доп. сущности/изгнанники).
4. **Тег `aura` не входит ни в OFFENSIVE/DEFENSIVE/ATTRIBUTE** → 2 токена jewel (сила умений аур) → neutral.
5. **Тег `gem` не используется** → 17 токенов (1 ring + 14 amulet + 2 belt) → neutral.
6. **Breach-themed `Знак повелителя Бездны`** (essence-origin, ring) — без тегов → neutral.

**Предлагаемые изменения (см. полный анализ в docs/):**

- P0: 22 функциональных блока для jewellery (вместо 4 корзин) — `Дух / Уровень умений / Атрибуты / Здоровье-Мана-ES / Сопротивления / Защита / Скорость / Крит / Урон / Пробитие / Состояния / Область-Длительность / Ауры-Вестники-Метки / Приспешники / Оружие-специфичные / Фласки / MF / Конверсия / Свирепость-Заряды / Бездна / Мета / Прочее`.
- P0: 6 weapon sub-blocks для jewel (23 family-key) — `Урон / Скорость атаки / Крит / Меткость / Шкала / Перезарядка` по типам оружия.
- P1: ETL-tagged `functionalCategory` (по образцу `jewelType`) для ~100% точности.
- P1: Поле `sortKey` в `FamilyGroup` + пользовательский тумблер «режим группировки» (блоки/популярность/алфавит) с URL-персистентностью.
- P1: Sub-blocks внутри waystone sentiment (positive/negative × 4-5 sub-blocks) и tablet type (5 типов × 3 sub-blocks + generic с 5 sub-blocks).

**Статус:** анализ выполнен, реализация не начата. Ждёт решения по приоритетам.

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82): перегруппировка аффиксов — см. выше.

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
