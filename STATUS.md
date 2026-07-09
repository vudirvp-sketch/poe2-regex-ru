# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 182 (UX-fix KI#57 + visual density tuning).

---

## Текущее состояние (iter 182 — DONE)

**iter 182: UX-fix для MIXED-mode + visual density.** Два точечных изменения без визуального рефакторинга:
1. **KI#57 FIXED** — пользователь жаловался, что в MIXED-режиме с 1 OPT регекс выглядит идентично AND-режиму (`"MUST1" "MUST2" "OPT1"`). После ревизии выяснилось: **код корректен** (поведение документировано в T1 — single-OPT деградирует до AND). Реальная проблема — UX: пользователь не видит, что OPT-токен действительно учтён. Fix: в RegexOutput добавлен info-бейдж «Смешанный: N обяз. + M опц. + K искл.», рендерится только в MIXED-режиме при наличии OPT/EXCLUDE. Проп `mixedModeInfo` проброшен во все 7 категорийных страниц.
2. **Visual density** — уменьшена ширина right-aside (320→280px), tighten chip gap (gap-2 → gap-1.5) в ModList + VirtualizedModList. GridLayout 2 колонки **НЕ делался** — пользователь явно отверг (нарушает вертикальное сканирование).

Подробности — в `worklog.md` (Task ID: iter-182-ux-density).

---

## Roadmap

| iter | Задача | Статус |
|------|--------|--------|
| 178–181 | Timeless-jewel + UI fixes (KI#55/KI#56) | ✅ DONE |
| 182 | UX-fix KI#57 (MIXED info-badge) + visual density | ✅ DONE |
| 183 | state-features для `/timeless-jewel` (URL-sync + ProfilePanel + SelectedBasket) | ⏳ NEXT |
| 184+ | ETL-интеграция `parse-timeless-jewel.ts` в `run-etl.ts` (опционально) | ⏳ |

---

## Known Issues

### Активные

**KI#57 — iter 182 FIXED: single-OPT regex выглядит идентично AND — пользователь думает, что OPT не работает.**
Root: T1-документация (`docs/MIXED_MODE_UI_TESTS.md` §T1) — при единственном OPT токене MIXED_OR деградирует в обычный AND. Это **корректное поведение** (семантически `"MUST" "OPT"` = оба должны быть на предмете). Проблема — UX: пользователь не получает визуального подтверждения, что OPT-токен действительно учтён. Fix iter 182: info-бейдж в RegexOutput с разбивкой MUST/OPT/EXCLUDE. Код генерации regex НЕ менялся (он корректен).

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**

**KI#43 — Transient `actions/deploy-pages` failures.** Mitigation: `Wandalen/wretry.action@v3`.

### Закрытые

- **KI#55, KI#56** — закрыты iter 181 (toggle + MIXED hotkeys).
- **KI#54** — `/timeless-jewel` отсутствовал в `prerender-full.ts` и IndexNow urlList. ✅ FIXED (iter 180).
- **KI#53** — Pre-existing data regression в `iter127-ki12-tier-hardcoded-regex.test.ts`. ✅ FIXED (iter 177).
- **KI#48, KI#49, KI#50, KI#51, KI#52** — закрыты в iter 163–174.

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

## Next iteration (iter 182 → iter 183)

**iter 182 завершён.** UX-fix KI#57 (info-бейдж MIXED-режима в RegexOutput) + visual density (right-aside 320→280px, chip gap-2→gap-1.5). CI зелёный.

**iter 183 — state-features для `/timeless-jewel`:** URL-sync, ProfilePanel, SelectedBasket. Сейчас `/timeless-jewel` — статичная страница без интерактивности. Добавить filter-store, URL hash sync, SelectedBasket + RegexOutput — соответствует тому, как работают 7 других категорийных страниц.

**Активные KI:** KI#57 (FIXED iter 182), KI#45, KI#46, KI#47, KI#43.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
