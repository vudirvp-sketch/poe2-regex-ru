# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 165 (концепт-спецификация v4 — детальная проработка UX-аудита без реализации)
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная)
> **Предыдущая:** `docs/REDESIGN_CONCEPT_v3.md` (iter 164 — реализован, см. §4 в v4 для ревизии)

---

## Текущее состояние (iter 165)

**iter 165: концепт-спецификация v4 — без изменения кода.**

Пользователь явно попросил: «сначала проработать и согласовать каждый аспект отдельно и обоснованно, потом реализовывать». Поэтому iter 165 — **только документ**.

Создан `docs/REDESIGN_CONCEPT_v4.md` (~440 строк) с детальной проработкой 7 аспектов внешнего UX-аудита:

1. **A1 — Визуальная иерархия L1/L2/L3.** Аудит смешивает 3 уровня в 2. Реально 4 уровня. iter 164 усилил L2, но контраст corner accents (0.4 vs 0.35) недостаточен. Предложение: вариант A (L3 → монохромный) или B (усиление контраста L1/L2 по opacity).
2. **A2 — Цветовая система.** Аудит утверждает «цвета не несут информации» — неверно. Цвета семантически нагружены на 3 осях (A: affix type, B: origin, C: functional). Проблема в конкуренции L2/L3, использующих одну палитру. Предложение: разделить палитры (L2 — bg-tint, L3 — текст-only).
3. **A3 — Regex как визуальный центр.** iter 164 уже усилил `.regex-output` (gold border + glow + pulse). Аудит увидел старую версию. Предложение: визуальная связь SelectedBasket → RegexOutput + placeholder для пустого состояния.
4. **A4 — Визуальный шум.** Аудит предлагает Compact/Extended toggle — переизобретение existing collapse-логики. Предложение: кнопки «Свернуть/Развернуть все подкатегории».
5. **A5 — Активная вкладка.** iter 164 усилил `.nav-mode-active`. Ждём фидбек пользователя.
6. **A6 — Цельная панель навигации.** Отвергнуто — плохо работает при horizontal scroll на мобильном.
7. **A7 — Косметика меню.** Не конкретизировано аудитом — отложено.

**План iter 166-170+:** одна задача за итерацию, с явными критериями приёмки. См. §5 в v4.

**Код НЕ изменялся в iter 165.** Это намеренно.

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**
`buildMixedAstFromSelections` делегирует MUST/OPT отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts. Редкий edge case.

**KI#43 — Transient `actions/deploy-pages` failures.**
Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Пассивная проверка.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 165 KB — отдельный chunk для mobile-only.
3. Пред-существующие `act()` warnings в `tests/ui/RegexOutput.test.tsx` — от `setCopied(false)` в 2000ms setTimeout.

---

## Подтверждённые ограничения PoE2 (кратко)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | cross-block + same-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | iter 157 T7 in-game verified |
| `^` start-of-block anchor | ⚠️ | **только на первой ALT в OR** (KI#45) |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `"A" "B" "C\|D"` (AND + OR) | ✅ iter 157 | T1/T2 in-game |
| `"!BAD" "MUST" "OPT1\|OPT2"` | ✅ iter 157 | T7 in-game |
| Regex char limit ≈ 250 chars | ✅ | жёсткий в combined-режиме (KI#46) |
| 3-state chip (want/opt/exclude) | ✅ iter 163 | UI готов, KI#48/KI#49 closed |

---

## Next iteration (iter 165 → iter 166)

**iter 165 завершён.** Концепт-спецификация v4 готова к согласованию.

**Что от пользователя нужно (5 минут):**

1. Прочитать `docs/REDESIGN_CONCEPT_v4.md` целиком (особенно §2 — анализ аспектов и §5 — план).
2. По каждому из 7 аспектов (A1-A7) сказать:
   - Какой вариант выбрать (A / B / C / свой).
   - Или «отложить» — если не готов решение.
3. Особое внимание — A2 (цветовая система): это самое спорное.
4. По iter 164 (P1/P2/P3) — сказать: «работает» / «не работает» / «частично». Это определит, нужно ли корректировать iter 166.

**Приоритеты для iter 166 (по плану v4):**
1. **A1 — Усиление контраста L1/L2** (вариант B — opacity/size corner accents). Самый дешёвый, ~10 строк CSS.
2. Если пользователь согласует A2 — iter 167 на разделение палитр.
3. Если пользователь согласует A3 — iter 168 на визуальную связь.
4. Если пользователь согласует A4 — iter 169 на кнопки collapse/expand all.
5. iter 170+ — по фидбеку на A5/A7.
6. Если найден новый баг — завести KI#50+ в STATUS.md, потом фиксить.

---

Контакты: Discord **woonderdad**
