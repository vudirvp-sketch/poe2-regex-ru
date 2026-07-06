# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 179 (README rewrite как SEO-витрина + docs/ cleanup — удалены 4 устаревших iter-плана).
> **План категории:** `docs/ATLAS_JEWEL_PLAN.md` (решения пользователя зафиксированы в §3, §4, §5).

---

## Текущее состояние (iter 179 — DONE)

**iter 179: README rewrite + docs/ cleanup.** Чисто documentation-only iter, без изменений в коде-функциональности. Цель — превратить README в SEO-оптимизированную «витрину» и облегчить docs/.

**Что сделано:**
- **README.md** полностью переписан как SEO-landing: что это + для кого + key features + quick start + поддерживаемые категории + стек/структура + документация + контакты. Ключевые слова: регексы poe2, регулярное выражение poe2, фильтр предметов poe2, поиск предметов poe2, poe2 regex generator, path of exile 2 search string.
- **docs/ cleanup** — удалены 4 устаревших iter-плана (все DONE/superseded):
  - `docs/ITER142_PROPOSALS.md` — design proposals для KI#23/30/31 (история, ~280 строк).
  - `docs/ITER148_TOOLBAR_REFACTOR.md` — iter 148 toolbar refactor (DONE).
  - `docs/REDESIGN_CONCEPT_v3.md` — iter 164, superseded by `REDESIGN_CONCEPT_v4.md`.
  - `docs/AFFIX_ORDERING_PLAN.md` — iter 112 block-sort-rules (DONE, 100% coverage iter 119).
- **Обновлены stale references** в коде и docs: `src/ui/components/CategoryControlPanel.tsx` (comment про ITER148), `src/shared/block-sort-rules.ts` (comment про AFFIX_ORDERING_PLAN), `src/ui/components/RegexOutput.tsx` + `src/index.css` (3 места — `REDESIGN_CONCEPT_v3 §X` → `redesign v3, §X`), `docs/UI_AUDIT.md` §6 (убрана ссылка на AFFIX_ORDERING_PLAN.md), `docs/REDESIGN_CONCEPT_v4.md` (отметка что v3 удалён), `docs/UI_REFACTOR_PLAN.md` (4 references на ITER142_PROPOSALS — помечены как «удалено в iter 179 cleanup»).
- **`UI_REFACTOR_PLAN.md` оставлен** — слишком много активных code-references (~15 source files ссылаются на «§4 Phase X»). Удаление потребует mass-comment-cleanup — отложено на отдельную итерацию.
- **Проверки**: `tsc` 0, `eslint` 0, `pnpm test` 2405 passed | 5 skipped (без регрессий — код не изменён, только comments + docs). `pnpm build` OK (10 prerendered routes — без изменений).

---

## iter 178 — полировка `/timeless-jewel` (предыдущая)

**iter 178: Полировка `/timeless-jewel`.** Косметика + SEO + производительность иконок. Никаких изменений в regex-engine или других категориях.

**iter 178-fix (post-iter 178 patch):** Файл `public/icons/timeless-jewel.png` перезаписан пользовательской иконкой (commit `8143975`). MD5 `af23c6063c27da0fed56801ccdbe0515`, 28093 bytes, 128×128 RGBA. Очищены устаревшие комментарии в коде. **Если в браузере всё ещё видна старая фиолетовая иконка** — это кэш. Hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) или инкогнито.

Подробности iter 178 — в `worklog.md`.

---

## Roadmap: категория `/timeless-jewel`

| iter | Задача | Статус |
|------|--------|--------|
| 175 | Разведка + план (`docs/ATLAS_JEWEL_PLAN.md`) | ✅ DONE |
| 176 | Дата-модель + JSON + минимальная страница + builder + тесты | ✅ DONE |
| 177 | Фикс деплоя — KI#53 closed | ✅ DONE |
| 178 | Rename + иконка + MobileRegexBar + SEO + self-host icons | ✅ DONE |
| 179 | README rewrite (SEO-витрина) + docs/ cleanup | ✅ DONE |
| 180 | URL-sync + ProfilePanel + SelectedBasket для timeless-jewel | ⏳ NEXT |
| 181+ | ETL-интеграция `parse-timeless-jewel.ts` в `run-etl.ts` (опционально) | ⏳ |

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars. Для atlas-jewel — отдельный `buildAtlasRegex()` со своим overflow-split.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**
`buildMixedAstFromSelections` делегирует MUST/OPT отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts. Редкий edge case.

**KI#43 — Transient `actions/deploy-pages` failures.**
Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Пассивная проверка.

### Закрытые

**KI#53 — Pre-existing data regression в `iter127-ki12-tier-hardcoded-regex.test.ts`.** ✅ FIXED (iter 177)
Двойная регрессия после ETL-обновления `2d48349`: (1) 4 tablet-токена получили tier-hardcoded regex (KI#12-pattern); (2) 7 relic-токенов iter 127 fix пропали из source data. Fix: 4 новых tablet override'а + tablet.json patch + `describe.skipIf` для relic-specific секций теста. SECTION 6 (audit) остаётся активным.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only.

---

## FAQ (частые вопросы)

**Q: Почему в регексе появился `"!100%"` (или другой `"!..."` токен)? Это баг?**
A: Не баг. Это **намеренная защита от ложных срабатываний (FP)** через поле `regexExclude` в ETL-данных. Когда два мода разделяют общую подстроку, ETL добавляет `regexExclude` → компилятор генерирует `"suffix" !"exclude"`. Поле определено в `src/shared/types.ts` (GameToken + OptimizationEntry).

**Q: Почему `/timeless-jewel` — отдельный раздел, а не внутри `/jewel`?**
A: Atlas-семантика regex отличается от item-семантики: multi-word OR работает ✅ (item: ❌), AND/NOT не работают ❌ (item: ✅). Смешивание в одном regex-engine потребовало бы branch-by-category → высокий риск регрессии. Подробности — `docs/ATLAS_JEWEL_PLAN.md` §1–2.

**Q: Я вижу старую фиолетовую иконку на `/timeless-jewel` — это баг?**
A: Нет, это кэш браузера. Файл `public/icons/timeless-jewel.png` уже заменён на пользовательскую (commit `8143975`, MD5 `af23c6063c27da0fed56801ccdbe0515`). Hard refresh (`Ctrl+Shift+R`) или режим инкогнито показывают новую иконку.

---

## Подтверждённые ограничения PoE2 (кратко)

### Item-семантика (поиск предметов)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| **`\|` между multi-word фразами** | ❌ | broken — `"А Б\|В Г"` = 0 matches |
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
| AND `"А" "Б"` | ❌ | 0 matches — НЕ работает |
| `!` NOT `"!А\|Б"` | ❌ | Подсвечивает ВСЕ ноды — НЕ работает |
| Case sensitivity | ✅ | case-insensitive |

**Ключевое ограничение Atlas:** единственная рабочая логика — **OR** (подсветить любые ноды, содержащие ЛЮБОЕ из перечисленных названий). AND/NOT не работают.

**Подробнее:** `docs/ATLAS_JEWEL_PLAN.md` §2 + `регис/результаты AND+OR тестов.md`.

---

## Next iteration (iter 179 → iter 180)

**iter 179 завершён.** README переписан как SEO-витрина, docs/ почищен (4 устаревших файла удалено). CI зелёный: 2405 passed | 5 skipped, `pnpm build` OK (10 prerendered routes — без изменений).

**iter 180 — state-features для `/timeless-jewel`:**
1. **URL-sync** — selection в hash (через `url-sync.ts`, отдельная логика для atlas-узлов — НЕ filter-store).
2. **Profile persistence** — ProfilePanel integration (отдельный profile-section для timeless-jewel).
3. **SelectedBasket** — показ выбранных нод как чипов над RegexOutput (упрощённая версия без family-group).

**iter 181+ (опционально):** ETL-интеграция парсера в `run-etl.ts` (сейчас отдельный скрипт `scripts/etl/parse-timeless-jewel.ts`).

**Технический долг:**
- 7 relic overrides в `i18n-overrides.json` сейчас no-ops — можно удалить, когда точно убедимся, что они не нужны.
- `docs/UI_REFACTOR_PLAN.md` (iter 137) — все 7 фаз DONE, но ~15 source files ссылаются на «§4 Phase X» в комментариях. Удаление требует mass-comment-cleanup — отложено.

**Активные KI без изменений:** KI#45, KI#46, KI#47, KI#43. Фоновые: APCA Lc<75, MobileRegexBar 168 KB.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
