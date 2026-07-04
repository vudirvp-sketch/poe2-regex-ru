# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 164 (UX redesign v3 — L2 origin frame, усиление nav-active и RegexOutput)
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v3.md`
> **UI-документация:** `docs/UI_AUDIT.md` (v2), `docs/UI_REFACTOR_PLAN.md`, `docs/REDESIGN_CONCEPT_v3.md`

---

## Текущее состояние (iter 164)

**iter 164: UX redesign v3 — 3 точечных улучшения по концепт-спецификации.**

1. **P1 — L2 origin header frame.** Новый CSS-класс `.affix-origin-header`
   (gradient + 3px border-l + small corner accents) для заголовков origin-секций
   (Обычные / Осквернённые / Очернённые / Сущность / Разлома). Применён в
   `ModList.tsx` и `VirtualizedModList.tsx`. Создаёт чёткую 3-ступенчатую
   иерархию: L1 (affix column, большой фрейм) → L2 (origin, средний фрейм) →
   L3 (sub-group, плоский badge).
2. **P2 — усиление `.nav-mode-active`.** Alpha gradient 0.14 → 0.20,
   box-shadow 0.10 → 0.16/0.18, добавлен text-shadow. Активная вкладка теперь
   читается мгновенно на ярких OLED.
3. **P3 — усиление `.regex-output` + pulse-on-change.** Border alpha
   0.35 → 0.48, glow 0.10 → 0.18. CSS-анимация `regex-output-pulse` (600ms)
   срабатывает при изменении regex string — мгновенная обратная связь
   «выбрал → результат». `prefers-reduced-motion` уважается.

**Концепт-спецификация создана:** `docs/REDESIGN_CONCEPT_v3.md` — обоснованный
анализ внешнего UX-аудита (согласия/разногласия), приоритизированный план,
что НЕ делаем и почему.

**Все проверки PASS:** tsc 0, eslint 0, 2319/2319 tests PASS, vite build PASS
(CSS 60 → 61 KB, main bundle 343 KB без изменений).

**Изменённые файлы (iter 164):**
- `docs/REDESIGN_CONCEPT_v3.md` — новый концепт-документ.
- `src/index.css` — `.affix-origin-header`, усиление `.regex-output` + pulse
  keyframes, усиление `.nav-mode-active`.
- `src/ui/components/ModList.tsx` — L2 origin header использует
  `.affix-origin-header` (убран inline `border-l-2`).
- `src/ui/components/VirtualizedModList.tsx` — то же для virtualized версии.
- `src/ui/components/RegexOutput.tsx` — pulse-on-change effect (rAF + timeout
  + `setIsPulsing` toggle, класс `regex-output--pulse`).
- `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы.

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder
`buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается
в `useRegexBuilder` когда compiled regex > 240 chars.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**
`buildMixedAstFromSelections` делегирует MUST/OPT отдельно, поэтому
`computeSuppressedExcludes` не видит cross-MUST/OPT conflicts. Редкий edge case.

**KI#43 — Transient `actions/deploy-pages` failures.**
Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Пассивная проверка.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 165 KB — отдельный chunk для mobile-only.
3. Пред-существующие `act()` warnings в `tests/ui/RegexOutput.test.tsx` —
   от `setCopied(false)` в 2000ms setTimeout (не от iter 164).

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

## Next iteration (iter 164 → iter 165)

**iter 164 завершён.** Все 3 пункта P1/P2/P3 реализованы. Тесты PASS.

**От пользователя нужно (опционально, 30 секунд):**
1. Визуальная проверка L2 origin header — открыть категорию (например,
   Amulet), убедиться что «Обычные» / «Осквернённые» заголовки имеют явный
   фрейм (gradient + corner accents), отличный от L3 sub-group badges.
2. Визуальная проверка активной вкладки TopNav — должна быть чуть заметнее.
3. Визуальная проверка pulse-анимации RegexOutput — выбрать аффикс, regex
   должен кратко «вспыхнуть» золотым свечением.

**Приоритеты для iter 165 (по запросу пользователя):**
1. Compact/Extended single-toggle (если пользователь запросит после проверки).
2. Ревизия functional category colors (если после iter 164 всё ещё шумно).
3. Усиление визуальной связи SelectedBasket ↔ RegexOutput (animated arrow).
4. Фоновые задачи: APCA Lc<75 audit, MobileRegexBar chunk split.
5. Если найден новый баг — завести KI#50+ в STATUS.md, потом фиксить.

---

Контакты: Discord **woonderdad**
