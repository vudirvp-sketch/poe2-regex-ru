# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 166 (реализация A2 — разделение визуальных палитр L2/L3)
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная, решения пользователя зафиксированы в §9)

---

## Текущее состояние (iter 166)

**iter 166: A2 — разделение визуальных палитр L2 (origin) / L3 (functional).**

Решение пользователя по A2 → **Вариант A** (разделить визуально происхождение и функциональность). Реализация через **display-layer override** (минимальный риск): в `ModList.tsx` + `VirtualizedModList.tsx` L3 sub-group рендерится с нейтральными `bg-panel/15 border border-edge/15` вместо цветного `bg-section-*`. `colorClass` (цветной текст) остаётся — это и есть «тонкий цветовой акцент только на тексте».

L2 (origin) не тронут — сохраняет цветной bg-tint (`bg-section-*`). Таким образом B-ось (происхождение) и C-ось (функция) теперь на разных визуальных языках: L2 = фрейм с цветным bg, L3 = нейтральный контейнер с цветным текстом.

`mod-classifier.ts` НЕ изменён — `bgClass`/`borderClass` поля сохранены для обратной совместимости (тесты проверяют `length > 0`), но в L3-рендере больше не применяются. Это сознательное решение: избежать модификации 50+ category map entries и потенциальных regressions в других usage-ах.

---

## Решения пользователя по аудиту v4 (iter 165 → iter 166+)

| Аспект | Решение | Приоритет | Статус |
|--------|---------|-----------|--------|
| **A1** — иерархия L1/L2/L3 | **Вариант B** — усиление контраста L1/L2 по opacity/size corner accents | №3 | iter 168 (план) |
| **A2** — цветовая система | **Вариант A** — разделить визуальный язык L2 (фрейм+bg-tint) и L3 (нейтральный+текст-only) | №1 | **iter 166 (текущая)** |
| **A3** — Regex как визуальный центр | **Вариант C** — placeholder + визуальная связь SelectedBasket → RegexOutput | №2 | iter 167 (план) |
| **A4** — визуальный шум | **Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (НЕ toggle Compact/Extended) | №4 | iter 169 (план) |
| **A5** — активная вкладка | НЕ трогать структуру меню. Максимум: усилить active, spacing, hover. Ждёт визуальной валидации iter 164 | low | iter 170+ |
| **A6** — цельная панель навигации | **Отклонено** — плохо работает при horizontal scroll на мобильном | — | не делаем |
| **A7** — косметика меню | Отложено — требуется конкретика от пользователя | — | iter 170+ |

### Явно отклонённые пользователем направления

- Центрирование меню
- Полная смена цветовой схемы
- Str/Dex/Int палитра для категорий
- Цельный navbar
- Toggle Compact/Extended как в аудите (вместо этого — кнопки «Свернуть/Развернуть все»)

### Новые идеи пользователя (D1-D3) — отложены

| Идея | Описание | Статус |
|------|----------|--------|
| **D1** | Проверка новичком — дать новому пользователю задачу «найди мод на макс resistance хаоса», замерить время | Отложено — методология, не код |
| **D2** | Аналитика кликов — что пользователи раскрывают чаще всего | Отложено — требует backend/privacy review |
| **D3** | Поиск недооценён — поиск важнее вкладок сверху, заслуживает больше внимания | Отложено — отдельный трек после A1-A4 |

### Подтверждение iter 164 (P1/P2/P3)

Пользователь не сообщил о регрессиях после iter 164. Считаем P1/P2/P3 «работает», корректировок не требуется. iter 166 не зависит от этого подтверждения.

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

## Next iteration (iter 166 → iter 167)

**iter 166 завершён.** A2 (разделение палитр L2/L3) реализован через display-layer override.

**План iter 167:** **A3 — Вариант C** — placeholder для пустого RegexOutput + визуальная связь SelectedBasket → RegexOutput. ~80-120 строк TSX + CSS + тесты. Средний риск.

**Дальнейший план (по приоритетам пользователя):**
- iter 168: **A1 — Вариант B** — усиление контраста L1/L2 по opacity/size corner accents (~10 строк CSS, минимальный риск).
- iter 169: **A4 — Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (~60-80 строк, низкий риск).
- iter 170+: по фидбеку на A5 (активная вкладка) и A7 (косметика меню). D1-D3 — отдельный трек.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad**
