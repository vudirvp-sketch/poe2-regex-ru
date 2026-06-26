# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 129
> **UI-аудит:** `docs/UI_AUDIT.md` (v2, 2026-06-21) + `docs/UI_REFACTOR_PLAN.md` (iter 129)

---

## Текущее состояние

**iter 129: cleanup + stabilisation — подготовка к UI-рефакторингу.**

Пользователь дал задачу: «в этой итерации чисто приведение всего в порядок
и устаканивание для дальнейшей работы. пока ничего не реализуем» + запросил
продумать план UI-улучшений.

**Сделано в iter 129:**
1. **Cleanup dead patterns** в `src/shared/mod-classifier.ts` (теперь
   обязательно, было опциональным в iter 128). Удалены 6 BTS-related regex
   patterns из 4 констант (POSITIVE_KEYWORDS, NEGATIVE_KEYWORDS,
   POSITIVE_LOOT_PATTERNS, NEGATIVE_MONSTER_MODIFIERS_PATTERNS,
   WAYSTONE_A_PREFIX) — все они матчили только BTS-токены, отфильтрованные
   на ETL в iter 128 (KI#13). Удалены 4 соответствующих теста в
   `tests/shared/mod-classifier.test.ts`. Тесты: 1992 → 1988 (-4), все pass.
2. **KI#7 (HomePage hero decorations, iter 121) → VERIFIED.** Реализация
   завершена в iter 121: side-ghost portraits (`hero-shaman.webp` left +
   `hero-iva.webp` right), anchored to `<main>` edges, `xl:block` only,
   `h-[80vh] max-h-[720px]`, opacity 0.20, mask-image gradients. CSS
   `.hero-side-ghost` / `.hero-side-ghost--right` (index.css:609-662).
   Build verification: vite build succeeds, CSS compiles. Закрыто.
3. **KI#8 (SeoBlock atmosphere, iter 122) → VERIFIED.** Реализация завершена
   в iter 122: `seo-atmosphere.webp` (1600×900 landscape backdrop) +
   `hero-demon-blue.webp` (right-edge accent). Visible только при
   `<details>[open]`, lg+ only. `mix-blend-screen` + mask-image fade.
   CSS `.home-seo-atmosphere` (index.css:1090-1126) + `.home-seo-demon`
   (index.css:1077-1088). Build verification: vite build succeeds. Закрыто.
4. **UI Refactor Plan** в `docs/UI_REFACTOR_PLAN.md` — детальный план на 5
   фаз (5 итераций), с архитектурным анализом, спецификациями компонентов,
   стратегией тестирования, рисками и открытыми вопросами. **Без
   реализации** — только план.

### Проверки (iter 129)

- **vitest:** 1988/1988 tests passed (41 test files). -4 vs iter 128 (удалены
  dead-pattern tests).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **vite build:** succeeds (472ms, 156 modules, 49.43 kB CSS gzip 10.75 kB).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай (MULTI_RANGE tokens используют простые char-class numRegexes). Mitigation: расширить `distributeAlternation` при FP.

### Закрытые KI (краткая справка)

- **KI#7** (iter 121 → VERIFIED iter 129): HomePage hero decorations.
- **KI#8** (iter 122 → VERIFIED iter 129): SeoBlock atmosphere backdrop.
- **KI#10** (iter 126 — VERIFIED in-game iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 — DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 — FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 — FIXED): пропущен implicit `Редкость монстров` + BTS-статы в waystone-аффиксах.

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
| `prefix (A\|B\|C)%.*suffix` (`()` после literal+space) | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` (`()` после `^`) | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` (`()` ПОСЛЕ `.*` bridge) | ❌ | iter 125 — игнорируется in-game. Fix: Path D distribution |
| Ambiguous suffix → multi-implicit FP | ✅ | iter 126 VERIFIED iter 127. Fix: более specific suffix |
| `.*` cross-block/line boundaries | ✅ | iter 127 VERIFIED — `.*` НЕ пересекает lines/blocks |
| Single-`#` template → tier-hardcoded regex (FN) | ✅ | iter 127. Fix: explicit override |
| BTS-статы в waystone-аффиксах (FP clutter) | ✅ | iter 128. Fix: расширить `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` + добавить implicit `Редкость монстров` |
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
| Reversed RANGE с ambiguous suffix | Уникальный suffix (`едкость предметов` / `едкость монстров`) — explicit ETL override | ✅ iter 126/128 |
| Single-`#` template token | Explicit override с tier-agnostic regex (как у `##` siblings) | ✅ iter 127 (KI#12) |
| BTS-статы в waystone-аффиксах | Фильтр через `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` + новый implicit для суммированных статов | ✅ iter 128 (KI#13) |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---

## Next iteration (iter 130)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` (детальный план на 5 фаз).
Рекомендованный старт — Phase 1 (foundation: filter-store + URL sync для
3 новых полей). См. §11 в плане — "How to Start".

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**
