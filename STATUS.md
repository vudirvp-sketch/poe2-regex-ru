# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 121
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 121: ре-фикс HomePage hero decorations — iter 120 fix был неполным.**

Пользователь проверил результат iter 120 и обнаружил: "ты обрезал все". Анализ показал **2 бага в iter 120 fix**:

1. **Head cropping**: hero block имеет `overflow-hidden`, а side ghosts — `absolute top-1/2 -translate-y-1/2 h-[500px]`. При hero block высотой ~165px (текст h1+p+p+badges) и изображении 500px → image top на -167px (ВЫШЕ блока), image bottom на +332px (НИЖЕ блока). `overflow-hidden` обрезает изображение так, что видна только средняя часть (~33%–66% от image height) → **ГОЛОВА ПОЛНОСТЬЮ ОБРЕЗАНА**, ноги тоже обрезаны. Это полная противоположность "full body" — виден только торс.

2. **Images trapped in max-w-4xl**: side ghosts были внутри `<div className="mx-auto max-w-4xl">` (896px max). На wide-экранах они оказывались у краёв 896px-колонки, а **НЕ у краёв экрана**. Пользователь хотел "по краям экрана".

**Фикс (iter 121):**
- Layout.tsx: `<main>` получает `relative` (становится positioning context для side ghosts).
- HomePage.tsx: side ghosts вынесены ИЗ hero block и ИЗ max-w-4xl — теперь siblings max-w-4xl в Fragment. Anchor: `absolute top-0 left-0` (shaman) / `top-0 right-0` (iva) — относительно `<main>`, т.е. у краёв экрана ниже TopNav. Высота `h-[80vh] max-h-[720px]` (вместо `h-[500px]`) — 90% от natural 800px, full body. Opacity 0.20. Content обёрнут в `relative z-10` (поверх side ghosts).
- index.css: bottom fade смягчён `#000 75% → transparent 100%` (вместо 55%→100% — было слишком агрессивно, fade только нижние 25% = ноги/ступни). Horizontal fade ПОЧИНЕН: iter 120 fade был на OUTER edge (у viewport edge) — баг; iter 121 fade на INNER edge (к тексту) — правильно. `linear-gradient(to right, #000 0%, #000 75%, transparent 100%)` для shaman (fade правого edge), mirror для iva.
- Hero block: удалены `isolate` и `overflow-hidden` (side ghosts больше не внутри, эти классы не нужны).

iter 120 также пофиксил scroll jump-to-top + jitter (KI#6) — этот фикс **остаётся в силе** (корректный, без багов).

### Сортировка аффиксов внутри блоков (iter 119 — без изменений в iter 120/121)

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

### Проверки (iter 121)

- **vitest:** 1890/1890 tests passed (37 test files) — без изменений vs iter 120 (UI-only fix, тесты не затронуты).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 18/18 blocks fully covered (312 family-keys).
- **vite build:** ✅ built successfully.

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
7. **HomePage hero decorations: head cropping + images not at viewport edges** (iter 121 — fixed):
   - **Симптом (user feedback после iter 120):** "ты обрезал все" — видна только средняя часть (торс), голова и ноги обрезаны. Plus изображения "по бокам" max-w-4xl колонки, а не по бокам экрана.
   - **Причина (2 бага в iter 120 fix):**
     - **(a) Head cropping:** hero block имеет `overflow-hidden`, а side ghosts — `absolute top-1/2 -translate-y-1/2 h-[500px]`. При hero block высотой ~165px и изображении 500px → image top на -167px (ВЫШЕ блока), image bottom на +332px (НИЖЕ блока). `overflow-hidden` обрезает до видимой средней части (~33%–66% image height) → голова и ноги обрезаны.
     - **(b) Images trapped:** side ghosts были внутри `<div className="mx-auto max-w-4xl">` (896px max) → на wide-экранах у краёв 896px-колонки, не у краёв экрана.
   - **Фикс (iter 121):** Layout.tsx — `<main>` получает `relative`. HomePage.tsx — side ghosts вынесены ИЗ hero block И ИЗ max-w-4xl в Fragment, anchored `absolute top-0 left-0` / `top-0 right-0` относительно main (края экрана ниже TopNav), `h-[80vh] max-h-[720px]` (вместо `h-[500px]`), opacity 0.20. Content обёрнут в `relative z-10`. index.css — bottom fade `#000 75% → transparent 100%` (вместо 55%→100%), horizontal fade на INNER edge (вместо OUTER — баг iter 120). Hero block: удалены `isolate` и `overflow-hidden`.

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
