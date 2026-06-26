# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 131
> **UI-документация:** `docs/UI_AUDIT.md` (v2) + `docs/UI_REFACTOR_PLAN.md` (план, reviewed iter 130 + user feedback iter 131) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130 + iter 131 corrections)

---

## Текущее состояние

**iter 131: incorporate user feedback (4 corrections) into UI Refactor Plan — без реализации.**

Пользователь дал feedback на план iter 130 (8.5/10 approval) с 4 конкретными
корректировками. В этой итерации корректировки внедрены в план и эталон
визуализации. Код НЕ тронут.

**Сделано в iter 131:**
1. **`docs/UI_REFACTOR_PLAN.md` обновлён** — 4 корректировки пользователя
   (см. §13.7 NEW):
   - **Correction #1 (Phase 5):** Left panel order **Search → Favorites →
     Filters** (was Favorites → Search). User: «Поиск используется в разы
     чаще». `LeftPanelFavorites.tsx` renders BELOW search, ABOVE filters.
   - **Correction #2 (Phase 3):** 3-column layout **20%/60%/20%** (was
     25%/50%/25%) + **collapsible right `<aside>`** for laptop screens
     (1440×900 и ниже). New §7 Q#8 for collapse behavior.
   - **Correction #3 (Phase 3):** Basket chip cap **20** (was 12). User:
     «У вас легко собираются regex на 15–30 модов».
   - **Correction #4 (Phase 1 + Phase 2):** Default collapse state =
     **top-level EXPANDED, sub-groups COLLAPSED** (was ALL EXPANDED).
     Phase 1 split `collapsedGroups` into TWO sets — `collapsedGroups`
     (top-level, default empty = expanded) + `expandedSubGroups` (sub-groups,
     default empty = collapsed). Field count 4→5. §7 Q#1 RESOLVED.
   - Header, §1 Executive Summary, §5 Dependencies, §6 Risk Register, §7 Qs,
     §8 Test Strategy, §10 Estimate, §11 How to Start, §12 Phase Status,
     §13.3 contradiction #2, §13.6 (рекомендация → iter 132) — все
     актуализированы.
2. **`docs/UI_VISUALIZATION_AUDIT.md` обновлён** — NEW §8 «User Feedback
   iter 131 (4 corrections)» с таблицей + user quotes; §1 layout diagram
   обновлён (20%/60%/20% proportions, ▼ top-level / ▶ sub-groups, chevron
   collapse на right panel, left panel order Search→Favorites→Filters);
   §2 Left/Right panel inventory актуализирован; §5 conflicts table
   updated; §7 Next Steps → iter 132+.
3. **Документация актуализирована:** STATUS.md (этот файл), worklog.md,
   AGENT_NAVIGATION.md, README.md. Код НЕ тронут.

### Проверки (iter 131)

- **vitest:** 1988/1988 tests passed (41 test files). Без изменений vs iter 130.
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

## Next iteration (iter 132)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` end-to-end включая §13
(iter 130 visualization audit) AND §13.7 (iter 131 user feedback corrections).
Затем `docs/UI_VISUALIZATION_AUDIT.md` — user-approved visual target (note
§8 iter 131 corrections).

**Рекомендованный старт:** Phase 1 (foundation: `FilterState` extension
с 5 полями — `collapsedGroups`, `expandedSubGroups`, `showSelectedOnly`,
`pinnedIds`, `chipExpandState` + URL sync backward-compat).

Phase 4 и Phase 4.5 — независимы, можно делать в любой итерации как
«warmup» работу для нового агента.

**Главные ограничения для iter 132:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Phase 5 не стартовать до Phase 1 — `pinnedIds` должны существовать в store.
- Phase 2.5 зависит от Phase 2 — sub-group collapse должен существовать до
  per-sub-group chip truncation.
- Phase 1 теперь 5 полей (was 4) — `expandedSubGroups` добавлено для
  asymmetric default collapse state (§13.7 #4).
- Phase 3: basket cap = 20 (was 12), 3-column 20%/60%/20% + collapsible
  right panel (§13.7 #2, #3).
- Phase 5: left panel order Search → Favorites → Filters (§13.7 #1).

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**
