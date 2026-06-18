# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 84 (P0-fixes implementation)

---

## iter 84 — P0-фиксы реализованы

Реализованы 3 P0-фикса из анализа iter 83 (см. [`docs/AFFIXES_GROUPING_ANALYSIS.md`](docs/AFFIXES_GROUPING_ANALYSIS.md)).

### Что сделано

**Bug #7 (Breach Lord-теги, 73 токена):**
- Введён `BREACH_LORD_TAGS = {'kurgal_mod','amanamu_mod','ulaman_mod'}` в `mod-classifier.ts`.
- `classifyByTags` теперь пропускает эти теги при переборе → классификация идёт по другим тегам (damage/life/resistance/...).
- Если у member'а остались только Breach Lord теги → `classifyByTags` вызывает `classifyByText` как fallback.
- В `DEFENSIVE_KEYWORDS` добавлено `флакон` (Breach Lord flask-моды: «Флаконы маны/здоровья получают зарядов в секунду»).

**Bug #2 (waystone 7 mis-классификаций, не 4):**
- В `POSITIVE_KEYWORDS` добавлено `больше.*волшебн.*редк.*монстр` (2 группы: prefix+suffix «На #% больше волшебных и редких монстров»).
- В `NEGATIVE_KEYWORDS` добавлено:
  - `бонус.*крит.*урон.*монстр` (1 группа «+##% к бонусу критического урона монстров»)
  - `шанса появления свойств.*редк.*монстр` (2 группы prefix+suffix)
  - `больше.*эффективн.*монстр` (2 группы prefix+suffix)
- Итог: waystone neutral 7 → 0.

**Bug #4-5 (aura+gem теги):**
- `aura` и `gem` добавлены в `OFFENSIVE_TAGS`.
- Текущие `gem`-токены уже имели парные теги (`caster`/`minion`) → сразу классифицировались offensive. Добавление `gem` даёт робастность для будущих модов.
- `aura`-токены (2 в jewel: «сила умений аур», «область действия присутствия») теперь offensive вместо neutral.

### Тесты

- 1158 базовых + 14 новых = **1172 теста, все зелёные**.
- Новые тесты покрывают: aura/gem → offensive, kurgal/amanamu/ulaman skip + text-fallback (armour/flask/attribute), нейтральность при отсутствии тегов, waystone 4 reclassification.
- `pnpm lint`: 0 ошибок, 2 pre-existing warnings (TanStack virtual memoization).

### Симуляция (verifies iter 84 impact)

Скрипт: `scripts/simulate-classifiers.ts` (mirror классификаторов на реальных JSON).

| Категория | Groups | Neutral до | Neutral после | Δ |
|---|---|---|---|---|
| ring | 98 | 14 | 13 | -1 |
| amulet | 105 | 22 | 18 | -4 |
| belt | 85 | 21 | 17 | -4 |
| jewel | 193 | 47 | 45 | -2 |
| waystone | 50 | 7 | **0** | -7 |
| waystone-desecrated | 29 | 6 | 6 | 0 |
| **Итого** | 560 | 117 | **99** | **-18 (-15%)** |

> **Заметка iter 84:** iter 83 считал «4 mis + 3 actual» для waystone. Реально все 7 были mis-классификации (тексты уникальны, но встречаются как prefix+suffix = 2 группы на текст). Все 7 теперь reclassified.

### Файлы, изменённые в iter 84

- `src/shared/mod-classifier.ts` — 3 P0-фикса (Breach Lord skip + text fallback + flask keyword + aura/gem tags + waystone keywords).
- `tests/shared/mod-classifier.test.ts` — 14 новых тестов.
- `STATUS.md` — актуализация под iter 84.
- `docs/AFFIXES_GROUPING_ANALYSIS.md` — актуализация §5 приоритетов и §8 статус.
- `scripts/simulate-classifiers.ts` — скрипт верификации (вне репозитория — для разработки).

### Что НЕ сделано (намеренно, ждёт следующих итераций)

- **P0 оставшиеся** (не реализованы):
  - Внедрение 24 функциональных блоков для jewellery (вместо 4 корзин).
  - Weapon sub-blocks для jewel (6 подблоков для 24 family-key).
- **P1–P3** — не начаты.
- **ETL-tagged functionalCategory** — не начат (P1).

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82-84): перегруппировка аффиксов. P0-фиксы (Breach Lord/waystone/aura+gem) — выполнены iter 84. Оставшиеся P0 (24 функциональных блока + weapon sub-blocks) ждут следующей итерации.

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
