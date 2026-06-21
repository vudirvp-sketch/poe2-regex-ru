# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 120
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 120: фикс UI-багов — scroll jump-to-top + jitter в VirtualizedModList (KI#6) и HomePage hero decorations (KI#7).**

iter 119 закрыл все priority-блоки сортировки (18 блоков, 312 family-keys). iter 120 занялся UI-багами, выявленными пользователем:

1. **Scroll jump-to-top + jitter** — на вкладке самоцветов (и других) при выборе аффикса с прокрученной страницей вниз — резкий jump наверх. В некоторых вкладках при скролле аффиксы "дрожат" и наслаиваются. Причина: `useLayoutEffect` в `VirtualizedModList` вызывал `virtualizer.measure()` (3 раза) при каждом изменении `selectedIds`/`perTokenRanges`. `measure()` инвалидирует ВЕСЬ кэш измерений → все rows возвращаются к estimate (120px для subgroup vs actual 40–80px) → padding дрейфует → "jump to top". Фикс: удалён весь блок `useLayoutEffect` с `measure()` + `restore()`, `measureElement` ref + ResizeObserver обрабатывают dynamic measurement автоматически. `ROW_ESTIMATES.subgroup` снижен 120 → 60.

2. **HomePage hero decorations** — `hero-bas-relief.webp` (lg+) "полностью скрывает текст", `news-bg-center.webp` (mobile) "вообще не вижу нигде". Side ghosts (horned-warrior + monster-red, оба landscape) заменены на full-body portrait images: `hero-shaman.webp` (533×800, "шаманка полный рост") слева + `hero-iva.webp` (501×800, "ива") справа. Высота `h-[500px]` (вместо `w-44`), CSS `mask-image: linear-gradient(to bottom, #000 55%, transparent 100%)` для плавного затухания ног + горизонтальный fade на inner edge. Opacity 0.22 (вместо 0.28). Backdrop'ы удалены.

### Сортировка аффиксов внутри блоков (iter 119 — без изменений в iter 120)

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113–118 добавили правила для 15 блоков. iter 119 закрыл 3 оставшихся priority-блока. **Все priority-блоки закрыты.** iter 120 не трогал правила сортировки.

**18 блоков с правилами (iter 119 scope):**

| Блок | # family-keys | # rules | Канонический порядок |
|------|---------------|---------|----------------------|
| `resistances` | 18 | 18 | хаос → молния → холод → огонь; dual-element; all-elements; max-resist; meta; passive-tree |
| `attributes` | 13 | 13 | Сила → Ловкость → Интеллект → Все → dual → tri-or → % increase → requirement reduction |
| `minions` | 34 | 34 | Subject (Companion → Minion → Offering) × Stat (Health → Damage → Crit → Speed → Area → Resists → Utility) |
| `ailments` | 40 | 40 | Operation (Ув. силы → Ув. шанса → Ув. длительности → Ум. длительности → Шанс наложения → Порог → Скорость → Прочее) × State |
| `damage-type` | 47 | 47 | Физический → Огонь → Холод → Молния → Хаос → Стихийный → Generic/by-source → Conditional → By-target → Special |
| `defence-stats` | 28 | 28 | Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони |
| `resources` | 29 | 29 | Здоровье → Мана → ES → Конверсия → Тотем → Прочее |
| `weapon-specific` | 24 | 24 | Мечи → Топоры → Булавы → Боевые посохи → Кинжалы → Копья → Кистени → Луки → Самострелы → Без оружия |
| `flasks` | 16 | 16 | Health flask → Mana flask → Any flask → Flask buffs |
| `offence-speed` | 12 | 12 | attack → cast (generic→mark) → move → projectile → crossbow-reload → warcry → trap → totem → swap → skill (generic→transformed) |
| `crit` | 9 | 9 | chance % (generic→attacks→spells) → chance flat (thorns→fire-spells) → damage % (generic→spells) → damage flat (attacks) → ailment-from-crit |
| `buff-skills` | 7 | 7 | Ауры → Вестники → Проклятия (strength→activation) → Кличи (effect→reload) → Метки (effect) |
| `skill-levels` | 10 | 10 | Levels (all→spells→melee→minion→projectile) → Quality (%→max) → Duration (generic→mark) → Cooldown |
| `area-duration` | 8 | 8 | Area (generic→spells→curses→banners→presence) → Radius improvement → Duration (curses→banners) |
| `meta-skills` | 6 | 6 | Energy (amount→max) → Archon (buff-effect→duration) → Sealed skills (max-charges→frequency) |
| `rage-charges` | 4 | 4 | Flat cap → Active gain (melee hit) → Passive gain (being hit) → Glory gain speed (banners) |
| `runes-barrier` | 4 | 4 | Flat cap → % cap → Regen speed → Conditional recovery (on-ward-use) |
| `penetration` | 3 | 3 | Lightning → Cold → Fire (mirrors resistances element order without chaos) |

**Покрытие:** 100% — все 312 family-keys в 18 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 6 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Эти блоки либо слишком heterogeneous (`other` — 27 family-keys), либо содержат только 1 family-key (`magic-find`, `breach`, `spirit`), либо пусты (`wisps`, `conversion`).

### Проверки (iter 120)

- **vitest:** 1890/1890 tests passed (37 test files) — без изменений vs iter 119 (тесты сортировки не затронуты).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 18/18 blocks fully covered (312 family-keys).
- **vite build:** ✅ built successfully (156 modules, 564 KB JS / 49 KB CSS).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 6 functional blocks без явных правил** (iter 119):
   - Блоки БЕЗ правил: `other` (27), `magic-find` (1), `breach` (1), `spirit` (1), `wisps` (0), `conversion` (0).
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** `other` heterogeneous — скорее всего останется без правил. `magic-find`/`breach`/`spirit` содержат только 1 family-key каждый — правила не нужны (один элемент сортируется сам с собой). `wisps`/`conversion` пустые — нет данных. Таким образом, **iter 119 завершает систематическую сортировку priority-блоков**.
5. **Истощения Бездны regex bug** (closed iter 112): `jewel-desecrated.mod_3yl2ru` имел `regexPrefixContext: "(10—20)%"` (literal range) — regex не матчат реальные предметы. Фикс: data patch + ETL algorithm filter + 2 regression tests.
6. **Scroll jump-to-top + jitter в VirtualizedModList** (iter 120 — fixed):
   - **Симптом 1:** На вкладке самоцветов (и других) при выборе аффикса с прокрученной страницей вниз — резкий jump наверх.
   - **Симптом 2:** В некоторых вкладках при скролле аффиксы "дрожат" и наслаиваются друг на друга.
   - **Причина:** `useLayoutEffect` в `VirtualizedModList` вызывал `virtualizer.measure()` (3 раза: immediate + RAF + setTimeout) при каждом изменении `selectedIds`/`perTokenRanges`. `measure()` инвалидирует ВЕСЬ кэш измерений → все rows возвращаются к estimate-размерам (120px для subgroup, тогда как actual 40–80px) → paddingTop/paddingBottom дрейфуют → visible items смещаются → "jump to top". Jitter при скролле — та же причина: новые rows используют estimate 120px, после ResizeObserver actual размер меньше → totalSize уменьшается → padding дрейфует.
   - **Фикс (iter 120):** Удалён весь блок `useLayoutEffect` с `measure()` + `restore()` (оба: two-column и single-column). `measureElement` ref + ResizeObserver автоматически обрабатывают dynamic measurement. `ROW_ESTIMATES.subgroup` снижен с 120 → 60 (ближе к среднему actual размеру). Браузер сам сохраняет `scrollTop` когда content выше viewport'а не меняется.
7. **HomePage hero decorations: text hidden + images not visible** (iter 120 — fixed):
   - **Симптом 1:** `hero-bas-relief.webp` (lg+, opacity 0.18, mix-blend-screen) — "полностью скрывает текст, мал, странно расположен".
   - **Симптом 2:** `news-bg-center.webp` (mobile, opacity 0.14, mix-blend-screen) — "вообще не вижу нигде".
   - **Фикс (iter 120):** Удалены оба backdrop'а. Side ghosts заменены: `hero-horned-warrior.webp` (landscape 640×390) → `hero-shaman.webp` (portrait 800×1200, "шаманка полный рост"); `hero-monster-red.webp` (landscape 640×375) → `hero-iva.webp` (portrait 800×1200, "ива"). Side ghosts теперь `h-[500px] w-auto` (вместо `w-44`), с CSS `mask-image: linear-gradient(to bottom, black 60%, transparent 100%)` для плавного затухания ног. `faf.png` (1672×941, landscape) — пока не пристроено, нет подходящего места.

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
