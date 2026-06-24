# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 125
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 125: фикс in-game FP `(A|B|C) after .* bridge`.**

Пользователь обнаружил баг: при выборе «И» (AND) имплисетов путеводных камней `Редкость предметов: +(0—999)%` и `Эффективность монстров: +(0—999)% ×2` с min=25, генератор выдавал регекс `"едкость.*\+(2[5-9]|[3-9][0-9]|\d{3,})" "ивность.*\+(2[5-9]|[3-9][0-9]|\d{3,})"`, который в игре подсвечивал карты с `+15%` и `+11%` (значения < 25).

**Root cause:** PoE2 in-game regex engine игнорирует содержимое `(A|B|C)`, когда `()` стоит ПОСЛЕ `.*` bridge + literal prefix — движок матчит только prefix broadly. Симулятор (`poe2-regex-matcher.ts`) парсил `(A|B|C)` корректно, поэтому юнит-тесты пропускали этот кейс.

**Фикс (2 части):**
1. **`src/core/compiler.ts`** —新增 `distributeAlternation()` helper: конвертирует `prefix(A|B|C)suffix` → `prefixAsuffix|prefixBsuffix|prefixCsuffix` (Path D — top-level `|`, in-game verified). Применяется в 3 местах `compileInner` для `RANGE` (reversed case with suffix): `isEnumerated`, `≥min`, `≤max`.
2. **`src/ui/hooks/category-ast-utils.ts`** — расширено определение `anchorEnd`: для reversed implicits с шаблоном `...##%` (заканчивается на `+##%`), добавляется `%` как endAnchor. Каждый Path-D альтернатив anchored к `%` → FP-протекция от range notation `(15-25)`.

**After fix:** `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` — корректно НЕ матчит +15% / +11%, корректно матчит ≥20 (round10 от 25).

### Проверки (iter 125)

- **vitest:** 1915/1915 tests passed (38 test files) — +25 новых тестов в `tests/core/iter125-alt-after-bridge.test.ts`, 4 теста обновлены (compiler + vendor-regex-equivalence) под новый Path-D формат.
- **tsc:** 0 errors.
- **eslint:** 0 problems.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 6 functional blocks без явных правил** (iter 119):
   - Блоки БЕЗ правил: `other` (27), `magic-find` (1), `breach` (1), `spirit` (1), `wisps` (0), `conversion` (0).
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
5. **HomePage hero decorations: awaiting user visual verification** (iter 121 — fixed, pending verification):
   - **Симптом:** "ты обрезал все" — видна только средняя часть (торс), голова и ноги обрезаны. Plus изображения "по бокам" max-w-4xl колонки, а не по бокам экрана.
   - **Фикс (iter 121):** Layout.tsx — `<main>` получил `relative`. HomePage.tsx — side ghosts вынесены в Fragment, anchored `absolute top-0 left-0`/`right-0`, `h-[80vh] max-h-[720px]`, opacity 0.20. index.css — bottom fade 75%, horizontal fade на INNER edge.
   - **Awaiting verification:** xl+ экран (≥1280px): shaman слева у края, ива справа у края, оба full-body.
6. **SeoBlock atmosphere backdrop: awaiting user visual verification** (iter 122 — NEW, pending verification):
   - `seo-atmosphere.webp` (1600×900, 146 KB) — широкий landscape backdrop в SeoBlock, виден только при раскрытом `<details>`, lg+ only. opacity 0.18, `mix-blend-screen`, fade bottom 40%.
7. **MULTI_RANGE slot N>0: `(A|B|C) after .* bridge` NOT YET FIXED** (iter 125 — partial fix):
   - **Симптом:** MULTI_RANGE токены с двумя+ placeholders (например, «Добавляет от X до Y урона»), где slot N>0 содержит `(A|B|C)` numRegex — та же проблема, что и reversed RANGE (iter 125 фиксит только reversed RANGE).
   - **Фикс iter 125:** `distributeAlternation()` применяется ТОЛЬКО к reversed `RANGE` (single-placeholder case, covers user-reported bug). MULTI_RANGE компилируется как `parts[0].*parts[1].*...suffix` — если parts[N] (N>0) содержит `()`, паттерн остаётся сломанным in-game.
   - **Mitigation:** на практике MULTI_RANGE tokens используют простые char-class numRegexes (`[4-9][0-9]` для slot 0, `[1-5][0-9]` для slot 1) — `()` встречается редко. Если возникнет FP — нужно расширить `distributeAlternation` до MULTI_RANGE (combinatorial: distribute ВСЕ слоты с `()` — может дать до 3×3=9 альтернатив, всё ещё ≤250 char limit).
   - **План:** мониторить FP-репорты от пользователей; если проявится — фикс в iter 126+.

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
| `(A\|B\|C)` alone (вся quoted group) | ✅ | in-game verified (iter 15) |
| `(A\|B\|C)%.*suffix` (`()` в НАЧАЛЕ quoted group) | ✅ | Threshold pattern, iter 15 T2 |
| `prefix (A\|B\|C)%.*suffix` (`()` после literal+space) | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` (`()` после `^`) | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` (`()` ПОСЛЕ `.*` bridge) | ❌ | **iter 125** — игнорируется in-game, матчит prefix broadly. Fix: Path D distribution |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE (≥min) | `^N.*suffix` (Phase 9b) | ✅ |
| Reversed RANGE (implicits, `suffix.*N`) | `suffix.*A\|suffix.*B\|...` (Path D distribution) | ✅ iter 125 |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |
| Range-like regexPrefixContext | ❌ не работает — фильтруем на ETL | ✅ iter 112 (fix) |

---

Контакты: Discord **woonderdad**
