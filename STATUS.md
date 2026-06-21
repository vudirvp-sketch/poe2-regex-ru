# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 123
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 123: cleanup stale DELETIONS-iter*.txt instruction files.**

iter 121 и iter 122 создали `DELETIONS-iter{121,122}.txt` — однострочные списки файлов, которые пользователь должен был удалить из локальной копии при применении архива. Эти инструкции устарели: целевые файлы уже удалены в соответствующих итерациях. iter 123 завершает cleanup, удаляя сами списки инструкций (по аналогии с тем, как iter 121 удалил `DELETIONS-iter100.txt`).

Никаких изменений в коде, тестах или UI. KI#7 (hero decorations, iter 121) и KI#8 (SeoBlock atmosphere, iter 122) остаются в состоянии awaiting user visual verification — это визуальные проверки, которые может выполнить только пользователь в браузере.

**НЕ сделано в iter 123 (перенос в iter 124+):**
- Визуальная верификация пользователем KI#7 (hero decorations) — xl+ экран (≥1280px).
- Визуальная верификация пользователем KI#8 (SeoBlock atmosphere) — lg+ экран (≥1024px), раскрытый `<details>`.
- Опционально: cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2 (перенос из iter 111, risky без визуальной верификации).
- Опционально (LOW): систематизация `other` block (27 family-keys) — heterogeneous.

### Сортировка аффиксов внутри блоков (iter 119 — без изменений в iter 120/121/122/123)

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113–118 добавили правила для 15 блоков. iter 119 закрыл 3 оставшихся priority-блока. **Все priority-блоки закрыты.** iter 120–123 не трогали правила сортировки.

**18 блоков с правилами (iter 119 scope):**

| Блок | # family-keys | Канонический порядок |
|------|---------------|----------------------|
| `resistances` | 18 | хаос → молния → холод → огонь; dual-element; all-elements; max-resist; meta; passive-tree |
| `attributes` | 13 | Сила → Ловкость → Интеллект → Все → dual → tri-or → % increase → requirement reduction |
| `minions` | 34 | Subject (Companion → Minion → Offering) × Stat (Health → Damage → Crit → Speed → Area → Resists → Utility) |
| `ailments` | 40 | Operation (Ув. силы → Ув. шанса → Ув. длительности → Ум. длительности → Шанс наложения → Порог → Скорость → Прочее) × State |
| `damage-type` | 47 | Физический → Огонь → Холод → Молния → Хаос → Стихийный → Generic/by-source → Conditional → By-target → Special |
| `defence-stats` | 28 | Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони |
| `resources` | 29 | Здоровье → Мана → ES → Конверсия → Тотем → Прочее |
| `weapon-specific` | 24 | Мечи → Топоры → Булавы → Боевые посохи → Кинжалы → Копья → Кистени → Луки → Самострелы → Без оружия |
| `flasks` | 16 | Health flask → Mana flask → Any flask → Flask buffs |
| `offence-speed` | 12 | attack → cast (generic→mark) → move → projectile → crossbow-reload → warcry → trap → totem → swap → skill (generic→transformed) |
| `crit` | 9 | chance % (generic→attacks→spells) → chance flat (thorns→fire-spells) → damage % (generic→spells) → damage flat (attacks) → ailment-from-crit |
| `buff-skills` | 7 | Ауры → Вестники → Проклятия (strength→activation) → Кличи (effect→reload) → Метки (effect) |
| `skill-levels` | 10 | Levels (all→spells→melee→minion→projectile) → Quality (%→max) → Duration (generic→mark) → Cooldown |
| `area-duration` | 8 | Area (generic→spells→curses→banners→presence) → Radius improvement → Duration (curses→banners) |
| `meta-skills` | 6 | Energy (amount→max) → Archon (buff-effect→duration) → Sealed skills (max-charges→frequency) |
| `rage-charges` | 4 | Flat cap → Active gain (melee hit) → Passive gain (being hit) → Glory gain speed (banners) |
| `runes-barrier` | 4 | Flat cap → % cap → Regen speed → Conditional recovery (on-ward-use) |
| `penetration` | 3 | Lightning → Cold → Fire (mirrors resistances element order without chaos) |

**Покрытие:** 100% — все 312 family-keys в 18 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 6 functional blocks** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Эти блоки либо слишком heterogeneous (`other` — 27 family-keys), либо содержат только 1 family-key (`magic-find`, `breach`, `spirit`), либо пусты (`wisps`, `conversion`).

### Проверки (iter 123)

- **vitest:** 1890/1890 tests passed (37 test files) — без изменений vs iter 122 (cleanup-only, код не затронут).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 18/18 blocks fully covered (312 family-keys).
- **vite build:** ✅ built successfully (без изменений vs iter 122).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 6 functional blocks без явных правил** (iter 119):
   - Блоки БЕЗ правил: `other` (27), `magic-find` (1), `breach` (1), `spirit` (1), `wisps` (0), `conversion` (0).
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** `other` heterogeneous — скорее всего останется без правил. `magic-find`/`breach`/`spirit` содержат только 1 family-key каждый — правила не нужны (один элемент сортируется сам с собой). `wisps`/`conversion` пустые — нет данных. Таким образом, **iter 119 завершает систематическую сортировку priority-блоков**.
5. **HomePage hero decorations: awaiting user visual verification** (iter 121 — fixed, pending verification):
   - **Симптом (user feedback после iter 120):** "ты обрезал все" — видна только средняя часть (торс), голова и ноги обрезаны. Plus изображения "по бокам" max-w-4xl колонки, а не по бокам экрана.
   - **Фикс (iter 121):** Layout.tsx — `<main>` получил `relative`. HomePage.tsx — side ghosts вынесены в Fragment (siblings max-w-4xl), anchored `absolute top-0 left-0`/`right-0` (края экрана ниже TopNav), `h-[80vh] max-h-[720px]` (90% natural 800px), opacity 0.20, content в `relative z-10`. index.css — bottom fade `#000 75% → transparent 100%` (вместо 55%→100%), horizontal fade на INNER edge (вместо OUTER — баг iter 120). Hero block: удалены `isolate` и `overflow-hidden`.
   - **Awaiting verification:** xl+ экран (≥1280px): shaman слева у края экрана, ива справа у края экрана, оба full-body (от головы до ног), головы видны у TopNav, ноги плавно затухают в нижних 25%, inner edge плавно затухает к тексту. На <xl изображения скрыты.
6. **SeoBlock atmosphere backdrop: awaiting user visual verification** (iter 122 — NEW, pending verification):
   - **Что добавлено:** `seo-atmosphere.webp` (1600×900, faf.png → WebP q85) — широкий landscape backdrop в SeoBlock, виден только при раскрытом `<details>`, lg+ only. opacity 0.18, `mix-blend-screen`, fade bottom 40%.
   - **Awaiting verification:** lg+ экран (≥1024px), раскрыть SeoBlock `<details>`: тёплый тёмный арт виден позади SEO-текста, не отвлекает от чтения, плавно затухает к низу. Текст читаем поверх. `hero-demon-blue.webp` (правый край) по-прежнему виден поверх backdrop'а.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |
| Range-like regexPrefixContext | ❌ не работает — фильтруем на ETL | ✅ iter 112 (fix) |

---

Контакты: Discord **woonderdad**
