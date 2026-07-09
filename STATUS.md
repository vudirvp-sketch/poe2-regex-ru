# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 183 (state-features для `/timeless-jewel`).

---

## Текущее состояние (iter 183 — DONE)

**iter 183: state-features для `/timeless-jewel`.** Три точечных добавления без визуального рефакторинга — `/timeless-jewel` теперь соответствует тому, как работают 7 других категорийных страниц (URL-share + ProfilePanel + SelectedBasket):
1. **URL-sync** — выбор (jewel + node ids) персистится в URL hash через `#tj=<lz-string>`. Префикс `#tj=` намеренно отличается от filter-store `#q=`, чтобы страницы не пытались парсить чужой хэш. На mount — restore из URL, на каждое изменение — `replaceState` (без spam в history).
2. **ProfilePanel** — reused as-is (props `category`, `currentFilterData`, `onRestore`). Сериализованный atlas-state (`{j, s}`) передаётся как `currentFilterData`. Сохраняется/загружается через `profile-store.ts` (тот же Zustand persist в localStorage, что и для item-категорий).
3. **AtlasSelectedBasket** — новый минимальный компонент (`src/ui/components/AtlasSelectedBasket.tsx`). Чипы с именами нод + ✗ для удаления. Cap = 20 с «+N ещё» expander (mirrors `SELECTED_BASKET_CAP`). Без family-grouping (atlas-ноды не имеют familyKey/affix).

**iter 182 (предыдущая):** UX-fix KI#57 (MIXED-mode info-badge в RegexOutput) + visual density (right-aside 320→280px, chip gap-2→gap-1.5).

Подробности — в `worklog.md` (Task ID: iter-183-state-features).

---

## Roadmap

| iter | Задача | Статус |
|------|--------|--------|
| 178–182 | Timeless-jewel + UI fixes (KI#54/KI#55/KI#56/KI#57) + visual density | ✅ DONE |
| 183 | state-features для `/timeless-jewel` (URL-sync + ProfilePanel + SelectedBasket) | ✅ DONE |
| 184+ | Cross-tab persistence для `/timeless-jewel` (localStorage, `storage` event sync — analog KI#30 favorites) | ⏳ NEXT |
| 185+ | ETL-интеграция `parse-timeless-jewel.ts` в `run-etl.ts` (опционально) | ⏳ |

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**

**KI#43 — Transient `actions/deploy-pages` failures.** Mitigation: `Wandalen/wretry.action@v3`.

### Закрытые

- **KI#57** — закрыт iter 182 (single-OPT regex выглядит как AND — добавлен info-бейдж).
- **KI#55, KI#56** — закрыты iter 181 (toggle + MIXED hotkeys).
- **KI#54** — `/timeless-jewel` отсутствовал в `prerender-full.ts` и IndexNow urlList. ✅ FIXED (iter 180).
- **KI#53** — Pre-existing data regression. ✅ FIXED (iter 177).
- **KI#48–52** — закрыты в iter 163–174.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only.
3. 7 relic overrides в `i18n-overrides.json` сейчас no-ops — можно удалить.

---

## FAQ (частые вопросы)

**Q: В MIXED-режиме добавил 1 OPT через Ctrl+клик, но регекс выглядит как AND — баг?**
A: Не баг. При единственном OPT токене MIXED_OR деградирует в AND (T1 в `docs/MIXED_MODE_UI_TESTS.md`). Семантически `"MUST" "OPT"` = оба должны быть на предмете. Чтобы убедиться, что OPT учтён, смотрите info-бейдж в RegexOutput. С 2+ OPT они объединяются через `|` (`"OPT1|OPT2"`).

**Q: Почему в регексе появился `"!100%"` (или другой `"!..."` токен)? Это баг?**
A: Не баг. Это намереренная защита от ложных срабатываний (FP) через поле `regexExclude` в ETL-данных.

**Q: Почему `/timeless-jewel` — отдельный раздел, а не внутри `/jewel`?**
A: Atlas-семантика regex отличается от item-семантики. Подробности — `docs/ATLAS_JEWEL_PLAN.md` §1–2.

**Q: Я вижу старую фиолетовую иконку на `/timeless-jewel` — это баг?**
A: Нет, это кэш браузера. Hard refresh (`Ctrl+Shift+R`) или режим инкогнито.

**Q: Можно ли поделиться выбором нод на `/timeless-jewel` через ссылку?**
A: Да, с iter 183. Выбор сохраняется в URL hash (`#tj=...`). Скопируйте URL из адресной строки — opening it у другого пользователя восстановит тот же jewel + набор нод. Также работают профили (ProfilePanel в правом aside).

---

## Подтверждённые ограничения PoE2 (кратко)

### Item-семантика (поиск предметов)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| **`\|` между multi-word фразами** | ❌ | `"А Б\|В Г"` = 0 matches |
| Пробел = AND | ✅ | cross-block + same-block |
| `!` item-wide | ✅ | iter 157 T7 in-game verified |
| `^` start-of-block anchor | ⚠️ | **только на первой ALT в OR** (KI#45) |
| Regex char limit ≈ 250 chars | ✅ | жёсткий в combined-режиме (KI#46) |

### Atlas-семантика (поиск по древу атласа) — iter 175 VERIFIED IN-GAME

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| Substring `Сырая` | ✅ | Находит «Сырая мана» |
| Quoted phrase `"Сырая мана"` | ✅ | Точная фраза |
| OR single words `"А\|Б\|В"` | ✅ | Любое из слов |
| **OR multi-word `"А Б\|В Г"`** | ✅ ⭐ | **ГЛАВНОЕ ОТЛИЧИЕ от item-семантики!** |
| `.*` bridge `"А.*Б"` | ✅ | Между словами в одной quoted-группе |
| AND `"А" "Б"` | ❌ | 0 matches |
| `!` NOT `"!А\|Б"` | ❌ | Подсвечивает ВСЕ ноды |
| Case sensitivity | ✅ | case-insensitive |

**Ключевое ограничение Atlas:** единственная рабочая логика — OR. AND/NOT не работают.

---

## Next iteration (iter 183 → iter 184)

**iter 183 завершён.** state-features для `/timeless-jewel`: URL-sync (`#tj=` prefix), ProfilePanel integration, AtlasSelectedBasket. CI зелёный: tsc 0 errors, eslint 0 errors, vitest 2455 passed | 5 skipped (+30 новых тестов), vite build OK (10 prerendered routes).

**iter 184 — cross-tab persistence для `/timeless-jewel`:** сейчас при навигации между табами выбор `/timeless-jewel` теряется (URL hash перезаписывается новой страницей). Аналог `poe2:favorites:<cat>` / `poe2:uistate:<cat>` (KI#30, KI#50) — per-category localStorage + `storage` event для realtime multi-tab sync. iter 183 уже заложил foundation (`atlas-state-sync.ts`), осталось добавить `read/write/clear` в `local-settings.ts` + `storage` listener в `TimelessJewelPage.tsx`.

**Активные KI:** KI#45, KI#46, KI#47, KI#43.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
