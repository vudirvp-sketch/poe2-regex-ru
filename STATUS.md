# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 168 (A1 — Вариант B — усиление контраста L1/L2 corner accents)
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная, решения пользователя зафиксированы в §9)

---

## Текущее состояние (iter 168)

**iter 168: A1 — Вариант B — усиление контраста L1/L2 по opacity/size corner accents.**

Изменены только CSS-значения в существующих правилах — без новых классов, без новых компонентов, без новых тестов. Цель: увеличить контраст между corner accents у L1 (`.affix-header-{prefix,suffix,implicit}`) и L2 (`.affix-origin-header`) с ~12% до ~25%.

| Селектор | До (iter 164) | После (iter 168) |
|----------|---------------|------------------|
| `.affix-header-{prefix,suffix}::before/::after` | 6×6, opacity 0.4 | **8×8, opacity 0.55** |
| `.affix-header-implicit::before/::after` | 6×6, opacity 0.4 | **8×8, opacity 0.55** |
| `.affix-origin-header::before/::after` | 5×5, opacity 0.35 | **4×4, opacity 0.30** |

Border widths НЕ тронуты: L1=4px, L2=3px, L3=0 (как и планировалось в v4 §A1 Вариант B).

**Изменённые файлы:**
- `src/index.css` — 3 блока corner accent правил обновлены + расширенные комментарии в шапке L1 / L2 секций, объясняющие новое состояние.

**Критерий приёмки:**
- ✅ Все тесты `tests/ui/GroupHeader.test.tsx`, `tests/ui/ModList.test.tsx`, `tests/ui/VirtualizedModList.test.tsx` — PASS (они проверяют className presence, не CSS-значения).
- ✅ tsc 0 errors, eslint 0 errors, vitest 2328/2328 PASS (базовая линия сохранена).
- ✅ vite build PASS. CSS **61.17 → 61.17 KB** (+0 KB raw / +0 KB gzip — только значения в существующих правилах изменены, новые правила не добавлены, комментарии вырезаются из prod-сборки).
- ⏳ Визуальная валидация: на скриншоте amulet/ring/belt/jewel-страницы при раскрытых L1+L2+L3 пользователь за < 1 секунды отвечает на вопрос «какой это уровень?» для любого блока.

---

## Решения пользователя по аудиту v4 (iter 165 → iter 168)

| Аспект | Решение | Приоритет | Статус |
|--------|---------|-----------|--------|
| **A1** — иерархия L1/L2/L3 | **Вариант B** — усиление контраста L1/L2 по opacity/size corner accents | №3 | **iter 168 DONE** |
| **A2** — цветовая система | **Вариант A** — разделить визуальный язык L2 (фрейм+bg-tint) и L3 (нейтральный+текст-only) | №1 | **iter 166 DONE** |
| **A3** — Regex как визуальный центр | **Вариант C** — placeholder + визуальная связь SelectedBasket → RegexOutput | №2 | **iter 167 DONE** |
| **A4** — визуальный шум | **Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (НЕ toggle Compact/Extended) | №4 | iter 169 (план) |
| **A5** — активная вкладка | НЕ трогать структуру меню. Максимум: усилить active, spacing, hover. | low | iter 170+ |
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

## Next iteration (iter 168 → iter 169)

**iter 168 завершён.** A1 (Вариант B — усиление контраста L1/L2 corner accents) реализован и протестирован.

**План iter 169:** **A4 — Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (~60-80 строк, низкий риск).

**Дальнейший план:**
- iter 170+: по фидбеку на A5 (активная вкладка) и A7 (косметика меню). D1-D3 — отдельный трек.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad**
