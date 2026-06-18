# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 85 (OP-1 Phase 2 — functional blocks infrastructure)

---

## iter 85 — Functional blocks infrastructure (7 of 24)

Реализована инфраструктура для 24-блочной системы группировки аффиксов (замена 4 крупных корзин offensive/defensive/attribute/neutral). Классификатор готов, но **НЕ включён в production** — переключение произойдёт в iter 86 после добавления ещё 5-7 блоков.

### Что сделано

**Архитектура (src/shared/mod-classifier.ts):**
- Новый тип `FunctionalBlock` (24 значения: spirit, skill-levels, attributes, resources, runes-barrier, resistances, magic-find, defence-stats, offence-speed, crit, damage-type, penetration, ailments, area-duration, wisps, buff-skills, minions, meta-skills, weapon-specific, flasks, conversion, rage-charges, breach, other).
- `FUNCTIONAL_BLOCK_LABELS` — display-конфиг (label + colorClass + bgClass + borderClass) для всех 24 блоков.
- `FUNCTIONAL_BLOCK_ORDER` — порядок рендера (игрок-сценарий: Spirit → Skill levels → Attributes → Resources → Runes barrier → Resistances → ... → Other).
- `classifyFunctionalBlock(group): FunctionalBlock` — классификатор с 7 активными паттернами (spirit/skill-levels/attributes/resistances/runes-barrier/magic-find/breach) + fallback в `other`.
- Новый режим `ModGroupMode = 'affix-functional'` добавлен в `classifyGroups()` — возвращает sub-groups по функциональному блоку, упорядоченные по `FUNCTIONAL_BLOCK_ORDER`.

**Активные паттерны (7 блоков):**
| Блок | Паттерн | Что ловит (примеры) |
|---|---|---|
| `spirit` | `/к духу/i` | `+# к духу` (amulet S-tier) |
| `skill-levels` | `уровень.*камн.*умений` + 6 вариантов | `+# к уровню всех камней умений`, `+#% к максимальному качеству`, `#% повышение скорости перезарядки умений`, `#% увеличение длительности эффекта умения` |
| `attributes` | `к силе\|к ловк\|к интелл` + 7 вариантов | `+# к силе`, `+# ко всем атрибутам`, `+# к силе и ловкости` (Breach Lord dual-attr), `#% уменьшение требований к характеристикам` |
| `resistances` | `сопротивлен\|добавлен.*свойств.*сопротивлен` | `+#% к сопротивлению огню`, `+#% ко всем стихийным сопротивлениям`, `#% повышение значений добавленных свойств сопротивлений` |
| `runes-barrier` | `руническ.*барьер` | `+# к максимуму рунического барьера`, `#% увеличение максимума рунического барьера`, `#% повышение скорости регенерации рунического барьера`, `Восстанавливает # рунического барьера при использовании оберега` |
| `magic-find` | `редкост.*найден.*предмет\|количеств.*найден.*предмет` | `#% повышение редкости найденных предметов` (prefix + suffix) |
| `breach` | `Знак.*повелител.*Бездн` | `Знак повелителя Бездны` (6 family-groups: ring+amulet+belt × prefix+suffix) |

**Приоритет матчинга (важен):** spirit → runes-barrier → breach → magic-find → skill-levels → attributes → resistances → other. Специфичные паттерны проверяются раньше общих.

**Тесты (tests/shared/mod-classifier.test.ts):**
- 44 новых теста (1172 базовых + 44 = **1216 passing**).
- Покрытие: 7 блоков с 1-4 тестами каждый + edge cases (без тегов, dual-attr Breach Lord, MF vs skill-levels disambiguation) + match priority + FUNCTIONAL_BLOCK_LABELS contract + classifyGroups integration.

**Симуляция (mirror классификатора на реальных JSON, scripts/simulate-iter85-impact.ts):**

| Категория | Total groups | 7 блоков поймали | Other bucket |
|---|---|---|---|
| ring | 94 | 27 (28.7%) | 67 (71.3%) |
| amulet | 105 | 36 (34.3%) | 69 (65.7%) |
| belt | 85 | 19 (22.4%) | 66 (77.6%) |
| **Итого** | 284 | 82 (28.9%) | 200 (70.4%) |

**Вывод симуляции:** с 7 блоками other-bucket = 70.4% — это ХУЖЕ текущего neutral (17.7%). Поэтому production-страницы **ОСТАВЛЕНЫ на `affix-semantic`**. iter 86 добавит 5-7 блоков (defence-stats, offence-speed, crit, damage-type, flasks, ...) — после этого other-bucket опустится достаточно, чтобы переключить страницы на `affix-functional`.

### Файлы, изменённые в iter 85

- `src/shared/mod-classifier.ts` — добавлен `FunctionalBlock` type, `FUNCTIONAL_BLOCK_LABELS`, `FUNCTIONAL_BLOCK_ORDER`, 7 паттернов (SPIRIT/SKILL_LEVELS/ATTRIBUTES/RESISTANCES/RUNES_BARRIER/MAGIC_FIND/BREACH), функция `classifyFunctionalBlock()`, режим `affix-functional` в `classifyGroups()`. ModGroupMode расширен новым значением.
- `tests/shared/mod-classifier.test.ts` — +44 теста (7 блоков + match priority + FUNCTIONAL_BLOCK_LABELS contract + classifyGroups integration).
- `src/ui/pages/ring/RingPage.tsx` — комментарий в header docstring про iter 85 (groupMode остался `affix-semantic`).
- `src/ui/pages/amulet/AmuletPage.tsx` — то же.
- `src/ui/pages/belt/BeltPage.tsx` — то же.
- `STATUS.md` — актуализация под iter 85.
- `docs/AFFIXES_GROUPING_ANALYSIS.md` — §5 приоритезация обновлена, §7 iter 85 добавлен.
- `worklog.md` — iter 85 section.

### Что НЕ сделано (намеренно, ждёт следующих итераций)

- **Включение `affix-functional` в production** — блокировано до тех пор, пока other-bucket не опустится ниже 30% (нужно ещё 5-7 блоков).
- **Остальные 17 блоков** (defence-stats, offence-speed, crit, damage-type, penetration, ailments, area-duration, wisps, buff-skills, minions, meta-skills, weapon-specific, flasks, conversion, rage-charges, resources, attributes-tagged) — паттерны не написаны.
- **Weapon sub-blocks для jewel** (6 подблоков для 24 family-key) — не начато. Сложная задача: требует подуровня внутри offensive bucket.
- **P1–P3** (ETL-tagged functionalCategory, sortKey + groupingMode toggle, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression, приоритет тегов, визуальная сепарация) — не начаты.

### План iter 86

1. Реализовать еще 5-7 блоков высшего приоритета для снижения other-bucket с 70% до <30%:
   - `defence-stats` (Броня/Уклонение/ES/Блок/Порог оглушения) — через теги `armour`/`evasion`/`energy_shield`/`charm` + текстовые паттерны.
   - `offence-speed` (Скорость атаки/сотворения/передвижения/перезарядки/снарядов) — через тег `speed` + текст.
   - `crit` (Шанс/Бонус/По типу урона) — через тег `critical` + текст.
   - `damage-type` (Физ/Огонь/Холод/Молния/Хаос/Стихийный/От чар/От атак) — через теги `damage`/`physical`/`elemental`/`cold`/`fire`/`lightning`/`chaos` + текст.
   - `flasks` (belt primary, flask-моды) — через текст «флакон».
   - `resources` (Здоровье/Мана/ES — максимум, регенерация, похищение) — через теги `life`/`mana` + текст.
   - `minions` (Приспешники/Компаньоны/Подношения) — через тег `minion` + текст «приспешник»/«подношен».
2. После этого — переключить RingPage/AmuletPage/BeltPage на `affix-functional`.
3. Параллельно — план weapon sub-blocks для jewel (iter 87).

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82-85): перегруппировка аффиксов. iter 82 — анализ. iter 83 — верификация. iter 84 — 3 P0-фикса. iter 85 — инфраструктура 24 функциональных блоков (7 активны). iter 86 — следующие 5-7 блоков + включение в production.

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
