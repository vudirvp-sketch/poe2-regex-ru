# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 181 (UI fixes — KI#55 toggle + KI#56 MIXED hotkeys + rename «Башни» → «Плитки»).

---

## Текущее состояние (iter 181 — DONE)

**iter 181: UI fixes по фидбеку пользователя.** Три точечных баг-фикса без визуального рефакторинга:
1. **KI#55** — `<select>` «Показывать» (showSelectedOnly) никогда не активировался, даже при выбранных избранных/исключённых аффиксах. Корень: disable-condition считал только `selectedCount` (want), а фильтр в `VirtualizedModList.visibleGroups` реально оставляет `selected ∪ excluded ∪ pinned ∪ optional`. Fix: добавлен prop `pinnedCount`, totalVisibleCount = selected + excluded + optional + pinned; лейбл «Выбранные (N)» → «Мои (N)».
2. **KI#56** — Shift+LMB в MIXED-режиме выделял текст (браузерный default). Fix: `onMouseDown` preventDefault при shift; добавлен Ctrl+LMB как альтернатива; добавлена видимая кнопка ⊕/⊖ на чипе для мобильных (touch не имеет shift/ctrl).
3. **Rename** — категория «Башни Предтеч» → «Плитки Предтеч» (i18n, SeoBlock, README, prerender). In-game item names («Башня Бездны Предтеч») не тронуты — это каноничные строки PoE2 ru-клиента.

Подробности — в `worklog.md` (Task ID: iter-181-ui-fixes).

---

## Roadmap

| iter | Задача | Статус |
|------|--------|--------|
| 178–180 | Timeless-jewel category + SEO fixes | ✅ DONE |
| 181 | UI fixes (KI#55 toggle + KI#56 MIXED hotkeys + rename) | ✅ DONE |
| 182 | Visual layout density (Flow Layout / chips tuning) — см. `docs/UI_AUDIT.md` | ⏳ NEXT |
| 183 | state-features для `/timeless-jewel` (URL-sync + ProfilePanel + SelectedBasket) | ⏳ |
| 184+ | ETL-интеграция `parse-timeless-jewel.ts` в `run-etl.ts` (опционально) | ⏳ |

---

## Known Issues

### Активные

**KI#55 — iter 181 FIXED: show-selected-only toggle никогда не активировался.**
Root: disable-condition считал только `selectedCount` (wantGroupCount), игнорируя `excludedIds` / `pinnedIds` / `optionalIds`, которые тоже попадают в фильтр `visibleGroups`. Fix iter 181: добавлен prop `pinnedCount`, totalVisibleCount = selected + excluded + optional + pinned; лейбл «Выбранные (N)» → «Мои (N)». Все 7 категорийных страниц обновлены.

**KI#56 — iter 181 FIXED: Shift+LMB в MIXED-режиме выделял текст.**
Root: shift+mousedown запускает browser text selection ДО click event — preventDefault в onClick слишком поздно. Fix iter 181: `onMouseDown` preventDefault при shift + добавлен Ctrl+LMB как альтернатива (нет side-effect) + видимая кнопка ⊕/⊖ на чипе (mobile-friendly). Shift+click сохранён для muscle memory + backward compat с тестами.

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**

**KI#43 — Transient `actions/deploy-pages` failures.** Mitigation: `Wandalen/wretry.action@v3`.

### Закрытые

- **KI#54** — `/timeless-jewel` отсутствовал в `prerender-full.ts` и IndexNow urlList. ✅ FIXED (iter 180).
- **KI#53** — Pre-existing data regression в `iter127-ki12-tier-hardcoded-regex.test.ts`. ✅ FIXED (iter 177).
- **KI#48, KI#49, KI#50, KI#51, KI#52** — закрыты в iter 163–174.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only.
3. 7 relic overrides в `i18n-overrides.json` сейчас no-ops — можно удалить.
4. `docs/UI_REFACTOR_PLAN.md` — все 7 фаз DONE, но ~15 source files ссылаются на «§4 Phase X» в комментариях.

---

## FAQ (частые вопросы)

**Q: Почему в регексе появился `"!100%"` (или другой `"!..."` токен)? Это баг?**
A: Не баг. Это намереренная защита от ложных срабатываний (FP) через поле `regexExclude` в ETL-данных.

**Q: Почему `/timeless-jewel` — отдельный раздел, а не внутри `/jewel`?**
A: Atlas-семантика regex отличается от item-семантики. Подробности — `docs/ATLAS_JEWEL_PLAN.md` §1–2.

**Q: Я вижу старую фиолетовую иконку на `/timeless-jewel` — это баг?**
A: Нет, это кэш браузера. Hard refresh (`Ctrl+Shift+R`) или режим инкогнито.

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

## Next iteration (iter 181 → iter 182)

**iter 181 завершён.** UI fixes: KI#55 (toggle) + KI#56 (MIXED hotkeys) + rename «Башни» → «Плитки». CI зелёный: 2418 passed | 5 skipped (+13 новых тестов), build OK (10 prerendered routes).

**iter 182 — visual layout density.** Пользователь сообщил об избыточном «воздухе» в интерфейсе, но попросил не ломать логику. Анализ показал, что чипы уже используют `inline-flex` + `flex-wrap`, так что проблема не в layout-движке. Возможные направления:
1. Уменьшить right-aside ширину (320px → 280px) — больше места для чипов.
2. Уменьшить gap между чипами (`gap-2` → `gap-1.5`) при сохранении tap-target a11y.
3. Slightly tighter chip padding (`px-1.5 py-0.5` → `px-1.25 py-0.4`).
4. Пересмотреть `maxWidth: 100%` на chip — возможно, ограничение по max-content.
**Важно:** пользователь явно просил итеративный подход — лучше недоделать, чем сломать. Каждое изменение отдельно тестировать.

**iter 183 — state-features для `/timeless-jewel`:** URL-sync, ProfilePanel, SelectedBasket (раньше был iter 181, сдвинут).

**Активные KI:** KI#55 (FIXED iter 181), KI#56 (FIXED iter 181), KI#45, KI#46, KI#47, KI#43.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
