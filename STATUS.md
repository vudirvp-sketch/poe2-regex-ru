# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 173 (KI#51 fix — scroll affordance для TopNav tabs + GitHub link в TopNav).
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная, решения пользователя зафиксированы в §9)

---

## Текущее состояние (iter 173)

**iter 173: KI#51 fix + GitHub link.** Пользователь подтвердил: при сжатии окна браузера часть кнопок категорий (Кольца, Амулеты и т.д.) не отображается, и пользователь не знает, что они есть — горизонтальный скролл `.topnav-tabs` визуально невидим (`scrollbar-width: none`). Зафиксирован как KI#51, по правилу «сначала документируй, потом фиксись».

**Fix KI#51:** Добавлены scroll-aware fade-индикаторы по краям `.topnav-tabs`:
- Новый wrapper `.topnav-tabs-wrap` (relative, `flex:1`, `min-width:0`) оборачивает существующий `.topnav-tabs` scroll-container.
- `::before` (левый fade) и `::after` (правый fade) — `linear-gradient` от `var(--poe-bg)` к transparent, ширина 24px.
- JS в `TopNav.tsx` через `useRef`/`useEffect`/`useState` трекает `scrollLeft` + `clientWidth` vs `scrollWidth`, выставляет классы `topnav-tabs-wrap--can-left` / `topnav-tabs-wrap--can-right`. Fade появляется только когда есть куда скроллить в эту сторону. Слушатели `scroll` (passive) + `resize`, cleanup в unmount.
- CSS `transition: opacity 0.2s ease` — плавное появление/исчезновение.

**GitHub link:** В `.topnav-feedback` (правый край TopNav, lg+) добавлена ссылка на репозиторий рядом с Discord-хинтом: `Баги и идеи → Discord: woonderdad · GitHub ↗`. GitHub — внешняя ссылка (`target="_blank" rel="noopener noreferrer"`), стилизована под existing feedback-text, hover lifts opacity 0.45 → 0.85. Новый i18n ключ `nav.github`: `GitHub`.

**Изменённые файлы (iter 173):**
- `src/ui/layout/TopNav.tsx` — `useRef`/`useEffect`/`useState` для scroll-position tracking, wrapper div вокруг `.topnav-tabs`, GitHub link в feedback area.
- `src/index.css` — `.topnav-tabs-wrap` + `::before`/`::after` fade gradients + `.topnav-feedback-link` styles.
- `src/shared/i18n.ts` — ключ `nav.github`.

**Проверки:** tsc 0 errors, eslint 0 errors, vitest 2366/2366 PASS (0 регрессий — изменения UI не покрыты unit-тестами, scroll tracking тестируется визуально). vite build PASS — CSS 61.17 → 62.37 KB (+1.20 KB raw / +0.05 KB gzip — большая часть комментариями, вырежутся в prod при необходимости).

---

## Решения пользователя по аудиту v4 (iter 165 → iter 173)

| Аспект | Решение | Приоритет | Статус |
|--------|---------|-----------|--------|
| **A1** — иерархия L1/L2/L3 | **Вариант B** — усиление контраста L1/L2 по opacity/size corner accents | №3 | **iter 168 DONE** ✅ валидировано |
| **A2** — цветовая система | **Вариант A** — разделить визуальный язык L2 (фрейм+bg-tint) и L3 (нейтральный+текст-only) | №1 | **iter 166 DONE** ✅ валидировано |
| **A3** — Regex как визуальный центр | **Вариант C** — placeholder + визуальная связь SelectedBasket → RegexOutput | №2 | **iter 167 DONE** ✅ валидировано |
| **A4** — визуальный шум | **Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (НЕ toggle Compact/Extended) | №4 | **iter 170 DONE** ✅ валидировано |
| **A5** — активная вкладка | iter 164 уже достаточен — не усиливать дальше | low | **CLOSED iter 173** (по фидбеку: «вариант a5-1 короче» = оставить как есть) |
| **A6** — цельная панель навигации | **Отклонено** — плохо работает при horizontal scroll на мобильном | — | не делаем |
| **A7** — косметика меню | Частично закрыт KI#51 (scroll affordance). Остальное — по конкретике. | — | partial iter 173 |

### Явно отклонённые пользователем направления

- Центрирование меню
- Полная смена цветовой схемы
- Str/Dex/Int палитра для категорий
- Цельный navbar
- Toggle Compact/Extended как в аудите (вместо этого — кнопки «Свернуть/Развернуть все»)
- Дальнейшее усиление active tab (A5 — iter 164 достаточно)

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
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only. Содержит transitive imports из RegexOutput (`@core/limits`, `@store/url-sync`, `@shared/i18n`).

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

## Next iteration (iter 173 → iter 174)

**iter 173 завершён.** KI#51 (hidden categories on narrow viewports) — fix применён, ждёт визуальной валидации. GitHub link добавлен.

**Ожидается от пользователя:**
1. Визуальная валидация iter 173: сжать окно браузера до ширины, где табы не помещаются → должны появиться fade-индикаторы справа (и слева после скролла) → табы можно проскроллить → Кольца/Амулеты видны.
2. Визуальная валидация GitHub link: правый край TopNav на десктопе (lg+) → «Discord: woonderdad · GitHub ↗».
3. Конкретика по A7 — что ещё в меню требует косметики (после KI#51 fix)?

**План iter 174+:** по фидбеку пользователя. Активные KI без изменений: KI#45, KI#46, KI#47, KI#43. Оставшиеся фоновые issues: APCA Lc<75, MobileRegexBar 168 KB.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
