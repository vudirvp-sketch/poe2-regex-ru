# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 145 (KI#34 scroll doubling + KI#35 expand/collapse keys)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 145: исправлены 2 user-reported бага.**

| KI | Описание | Файлы | Root cause |
|----|----------|-------|------------|
| KI#34 | Scroll doubling на jewels tab | `VirtualizedModList.tsx` | Два virtualizer'а на одном scroll container вызывали feedback loop через `applyScrollAdjustment` — оба вызывали `scrollTo()` на одном элементе, scrollTop колебался, items визуально «двоились» |
| KI#35 | Expand All / Collapse All не работают | `VirtualizedModList.tsx`, `ModList.tsx` | Кнопки генерировали ключи `${cat}:${aff}:${sg.key}` без origin/jewelType, а buildColumnRows использовал `${cat}:${aff}:${origin}[:${jt}]:${sg.key}` — ключи не совпадали |

**Baseline: tsc 0 / eslint 0 / vitest 2247/2247.**

### Архитектурные изменения iter 145

1. **`shouldAdjustScrollPositionOnItemSizeChange: () => false`** — отключена корректировка scroll position при изменении размера item'а. С двумя независимыми virtualizer'ами на одном scroll element'е корректировка создавала feedback loop. Без корректировки items выше viewport'а могут слегка сдвигаться при measurement updates, но это менее заметно чем визуальное «двоение».

2. **`getItemKey` (stable keys)** — virtualizer'ы теперь используют стабильные ключи вместо index-based (`0`, `1`, `2`...). Формат: `ch:prefix`, `oh:prefix:normal`, `sg:prefix:jewel:prefix:normal:skill-levels` и т.д. Предотвращает corruption measurement cache при reorder.

3. **`overscan: 5`** (было 10) — меньше рендерящихся items = меньше ResizeObserver callbacks = меньше scroll adjustment attempts.

4. **CSS `items-start`** на двухколоночной grid — decouples column heights, measurement updates в одной колонке не сдвигают другую.

5. **Expand All / Collapse All** — ключи sub-group теперь генерируются с учётом `showOriginSubSections` и `showJewelTypeSubGroups`, используя ту же логику что и `buildColumnRows/emitSubGroup`. Формат: `${topKey}:${origin}:${sg.key}` или `${topKey}:${origin}:${jewelType}:${sg.key}`.

---

## Known Issues

### Активные (требуют browser testing)

1. **KI#23 (scroll jitter)** — variant (b) + KI#34 fix применены. Browser testing нужен чтобы подтвердить что jitter/doubling устранён. Если всё ещё заметно — variant (a) static row heights как fallback.

2. **KI#31 (quick-select panel UX)** — MVP реализован. User feedback по расположению, range inputs, mobile layout.

3. **KI#32 (cascade expand)** — исправлено в iter 144, но browser testing на 7 страницах не проведён.

### Фоновые (low-priority)

4. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
5. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
6. **KI#9: MULTI_RANGE slot N>0** — monitoring, редкий случай.

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
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `prefix (A\|B\|C)%.*suffix` | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` | ❌ | Fix: Path D |
| Regex char limit ≈ 250 chars | ✅ | runtime split |

---

## Next iteration (iter 145 → iter 146)

**iter 145 завершён: 2 KI исправлены, tsc 0 / eslint 0 / vitest 2247/2247.**

**Приоритеты для iter 146:**

1. **Browser testing KI#34 scroll fix** — проверить scroll на всех страницах (belt/ring/amulet/jewel/waystone/tablet/relic/vendor). Двоение на jewels должно быть устранено.

2. **Browser testing KI#35 expand/collapse** — нажать «Раскрыть все» / «Свернуть все» на jewel tab (и других с showOriginSubSections). Все sub-groups должны корректно раскрываться/сворачиваться.

3. **Если найдены баги** — сначала документировать в STATUS.md как NEW KI, потом фиксить.

4. **Возможные follow-up:**
   - KI#31 mobile layout optimization
   - KI#23 variant (a) fallback если jitter остаётся
   - KI#9 monitoring

---

Контакты: Discord **woonderdad**
