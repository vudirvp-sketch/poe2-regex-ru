# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 169 (KI#50 — фикс потери expand/collapse состояния при переключении вкладок)
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная, решения пользователя зафиксированы в §9)

---

## Текущее состояние (iter 169)

**iter 169: KI#50 — фикс потери expand/collapse состояния при смене вкладок.**

Пользователь сообщал: «При смене вкладок постоянно приходится заново кликать на 'развернуть все' — состояние и выбор не сохраняется». Корневая причина: каждый categoryId создаёт новый Zustand store с пустыми defaults (`expandedSubGroups = new Set()` = все COLLAPSED), а URL hash шарится между категориями. При переходе amulet→ring в store ring попадают amulet-ключи (`amulet:prefix:...`), которые не матчятся с ring-подгруппами → подгруппы ring остаются COLLAPSED.

Фикс: per-category localStorage для `expandedSubGroups` / `collapsedGroups` / `chipExpandState` (pattern mirrors KI#30 favorites). На mount: фильтруем cross-category leak из URL, если in-category ключей нет — восстанавливаем из localStorage. На каждое изменение — пишем в localStorage.

| Аспект | До (iter 168) | После (iter 169) |
|--------|---------------|------------------|
| Expand state при смене вкладок | ❌ Теряется (новый store, URL shared) | ✅ Сохраняется per-category в localStorage |
| Cross-category URL leak | ❌ amulet-ключи загрязняют ring store | ✅ Фильтруются через `filterInCategoryKeys` |
| Shareable links с expand state | ✅ Работали через URL | ✅ Продолжают работать (URL wins если есть in-category ключи) |

**Изменённые файлы:**
- `src/store/local-settings.ts` — +4 helper'а (`readUiState`, `writeUiState`, `clearUiState`, `filterInCategoryKeys`, `uiStateStorageKey`) под ключом `poe2:uistate:<categoryId>`.
- `src/ui/hooks/useCategoryPage.ts` — useState initializer после favorites restore (фильтр + restore) + persist block внутри URL sync effect.
- `tests/store/KI50UiState.test.ts` — +N тестов (mirror KI30Favorites pattern).

**Критерий приёмки:**
- ✅ tsc 0 errors, eslint 0 errors, vitest (2328 + новые) PASS.
- ✅ vite build PASS.
- ⏳ Визуальная валидация: раскрыть подгруппы на amulet → перейти на ring → вернуться на amulet → подгруппы amulet остаются раскрытыми.

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

## Next iteration (iter 169 → iter 170)

**iter 169 в работе.** KI#50 (фикс потери expand/collapse состояния при смене вкладок) — пользователь сообщал о баге, фикс приоритетнее A4.

**План iter 170:** **A4 — Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (~60-80 строк, низкий риск).

**Дальнейший план:**
- iter 171+: по фидбеку на A5 (активная вкладка) и A7 (косметика меню). D1-D3 — отдельный трек.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad**
