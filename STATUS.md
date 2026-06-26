# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 130
> **UI-документация:** `docs/UI_AUDIT.md` (v2) + `docs/UI_REFACTOR_PLAN.md` (план, reviewed iter 130) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130)

---

## Текущее состояние

**iter 130: review плана UI-рефакторинга против визуализации — без реализации.**

Пользователь дал задачу: «проверь на ошибки и упущения новый план, убедись
что все сделано качественно и полно» + приложил визуализацию целевого UI.
Также: «в этой итерации чисто приведение всего в порядок и устаканивание
для дальнейшей работы. пока ничего не реализуем».

**Сделано в iter 130:**
1. **VLM-анализ визуализации** через z-ai vision API — полный инвентарь
   элементов (3-колоночный layout, левая панель с избранным выше поиска,
   центр с 3 сворачиваемыми категориями + подгруппами + «+N ещё», правая
   панель с basket + affix-type бейджами + «Обозначения» легендой).
2. **Создан `docs/UI_VISUALIZATION_AUDIT.md`** (~140 строк) — отдельный
   артефакт с описанием эталона: layout, element inventory, color coding,
   UX patterns, конфликты с `UI_AUDIT.md`, файлы-затронутые.
3. **`docs/UI_REFACTOR_PLAN.md` обновлён** — добавлен §13 «Visualization
   Audit» с 5 пропусками + 2 противоречиями. Корректировки:
   - Phase 1: +`chipExpandState: Set<string>` для Phase 2.5.
   - Phase 2.5 (NEW): «+N ещё» per-sub-group chip expander.
   - Phase 3: +affix-type badges (ИМПЛИСИТ/ПРЕФИКС/СУФФИКС) на basket chips.
   - Phase 4: chip density 20%→25% (px-1.5 py-0.5).
   - Phase 4.5 (NEW): «Обозначения» icon legend.
   - Phase 5: favorites MOVED to LEFT panel above search;
     TopNav dropdowns REMOVED (visualization keeps flat nav).
   - §5 Phase Dependencies: +Phase 2.5, +Phase 4.5.
   - §6 Risk Register: TopNav risk REMOVED; +2 new risks.
   - §7 Open Questions: Q#5 REMOVED, Q#6 updated to 25%, +Q#7 (preview count).
   - §10 Estimate: 5→6 iterations, 28→42 files, 5→6 new files, 52-78→65-96 tests.
   - §12 Phase Status: all 7 phases marked NOT STARTED with iter 130 notes.
4. **Документация актуализирована:** STATUS.md (этот файл), worklog.md,
   AGENT_NAVIGATION.md. Код НЕ тронут.

### Проверки (iter 130)

- **vitest:** 1988/1988 tests passed (41 test files). Без изменений vs iter 129.
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Код не изменён** — только doc-файлы.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай. Mitigation: расширить `distributeAlternation` при FP.

### Закрытые KI (краткая справка)

- **KI#7** (iter 121 → VERIFIED iter 129): HomePage hero decorations.
- **KI#8** (iter 122 → VERIFIED iter 129): SeoBlock atmosphere backdrop.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 → DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы в waystone-аффиксах.

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

## Next iteration (iter 131)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` end-to-end включая §13
(iter 130 visualization audit corrections). Затем
`docs/UI_VISUALIZATION_AUDIT.md` — user-approved visual target.

**Рекомендованный старт:** Phase 1 (foundation: `FilterState` extension
с 4 полями — `collapsedGroups`, `showSelectedOnly`, `pinnedIds`,
`chipExpandState` + URL sync backward-compat).

Phase 4 и Phase 4.5 — независимы, можно делать в любой итерации как
«warmup» работу для нового агента.

**НЕ реализовывать:** TopNav dropdowns (visualization keeps flat nav).

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**
