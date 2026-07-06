# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 176 (новая категория `/timeless-jewel` — дата-модель + JSON + страница + билдер + тесты).
> **План категории:** `docs/ATLAS_JEWEL_PLAN.md` (решения пользователя зафиксированы в §3, §4, §5).

---

## Текущее состояние (iter 176)

**iter 176: Категория `/timeless-jewel` — минимальная рабочая версия.** Реализован отдельный раздел для генерации регексов подсветки нод древа атласа, заменяемых особыми самоцветами (Вечная ненависть + Трагедия героев). Регекс OR-only — только имена нод, без цифр и аффиксов. UI показывает имя ноды + её эффекты (description), генератор использует только имя.

**Что сделано:**
- Новые типы `AtlasNodeToken` + `AtlasJewelCategoryData` в `src/shared/types.ts` (НЕ наследуют `GameToken`).
- Zod-схемы `AtlasNodeTokenSchema` + `AtlasJewelCategoryDataSchema` в `src/shared/schemas.ts`.
- Парсер-скрипт `scripts/etl/parse-timeless-jewel.ts` (cheerio → JSON; 75 нод суммарно).
- `public/generated/timeless-jewel.json` (35 + 40 нод с именами, описаниями, иконками, slug, sourceKey).
- `src/data/atlas-jewel-loader.ts` (fetch + Zod + cache).
- `src/core/atlas-regex-builder.ts` (`buildAtlasRegex()` — OR-only, alphabetical sort, dedupe, overflow split).
- `src/ui/components/AtlasNodeList.tsx` (плоский список: чекбокс + иконка + имя + описание + поиск + highlight).
- `src/ui/pages/timeless-jewel/TimelessJewelPage.tsx` (selector + список + RegexOutput reuse + Atlas-semantics notice).
- Route `/timeless-jewel` + nav-item + i18n-ключи.
- 40 новых тестов (Zod-схемы + builder + AtlasNodeList).
- **Итог: 2405/2410 PASS (5 failures — KI#53, pre-existing), tsc 0, eslint 0, vite build OK.**

**Что НЕ сделано (отложено на iter 177+):**
- URL-sync (selection не сохраняется в hash).
- Profile persistence (no ProfilePanel).
- MobileRegexBar (RegexOutput рендерится inline на mobile).
- SelectedBasket (selection живёт только в чекбоксах списка).
- Prerendering + SEO meta-tags + sitemap.
- Иконки self-host (пока remote CDN poe2db.tw).
- ETL-интеграция в `run-etl.ts` (парсер — отдельный скрипт, запускается вручную).

---

## Roadmap: категория `/timeless-jewel`

| iter | Задача | Статус |
|------|--------|--------|
| 175 | Разведка + план (`docs/ATLAS_JEWEL_PLAN.md`) | ✅ DONE |
| 176 | Дата-модель + JSON + минимальная страница + builder + тесты | ✅ DONE |
| 177 | URL-sync + profile + SelectedBasket + MobileRegexBar + prerender + SEO | ⏳ |
| 178+ | ETL-интеграция в `run-etl.ts` (опционально) | ⏳ |

---

## История (iter 173–175 — одной строкой)

**iter 175:** Разведка и план новой категории `/timeless-jewel` (распарсены 75 нод, зафиксирована Atlas regex-семантика, составлен `docs/ATLAS_JEWEL_PLAN.md`). Код НЕ изменялся.
**iter 174:** KI#52 fix (search auto-expand подкатегорий в ModList/VirtualizedModList).
**iter 173:** KI#51 fix (scroll-aware fade indicators для `.topnav-tabs` + GitHub link в TopNav).

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

**KI#53 — Pre-existing data regression в `iter127-ki12-tier-hardcoded-regex.test.ts` (5 failures).**
После ETL-обновления в `2d48349` в `tablet.json` появились токены с regex, содержащими литералы цифр (например `"ущности: 1"`). Тест ожидает что regex не содержит хардкоженных цифр. **Не блокирует production** — это data-quality check. Фикс требует пересмотра ETL-нормализации tablet-модов (отдельная задача).

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only.

---

## FAQ (частые вопросы)

**Q: Почему в регексе появился `"!100%"` (или другой `"!..."` токен)? Это баг?**
A: Не баг. Это **намеренная защита от ложных срабатываний (FP)** через поле `regexExclude` в ETL-данных. Когда два мода разделяют общую подстроку, ETL добавляет `regexExclude` → компилятор генерирует `"suffix" !"exclude"`. Поле определено в `src/shared/types.ts` (GameToken + OptimizationEntry).

**Q: Почему `/timeless-jewel` — отдельный раздел, а не внутри `/jewel`?**
A: Atlas-семантика regex отличается от item-семантики: multi-word OR работает ✅ (item: ❌), AND/NOT не работают ❌ (item: ✅). Смешивание в одном regex-engine потребовало бы branch-by-category → высокий риск регрессии. Подробности — `docs/ATLAS_JEWEL_PLAN.md` §1–2.

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

## Next iteration (iter 176 → iter 177)

**iter 176 завершён.** Категория `/timeless-jewel` работает: 75 нод (35 + 40), OR-only regex, alphabetical sort, overflow split, поиск с highlight, выбор всех/сброс, Atlas-semantics notice.

**iter 177 — что доделать:**
1. **URL-sync** — selection в hash (через `url-sync.ts`, отдельная логика для atlas-узлов — НЕ filter-store).
2. **Profile persistence** — ProfilePanel integration (отдельный profile-section для timeless-jewel).
3. **SelectedBasket** — показ выбранных нод как чипов над RegexOutput (упрощённая версия без family-group).
4. **MobileRegexBar** — sticky-bottom RegexOutput на mobile.
5. **Prerendering** — добавить `/timeless-jewel` в `scripts/prerender.ts` + `public/sitemap.xml`.
6. **SEO meta-tags** — title, description для `/timeless-jewel`.
7. **Опционально:** self-host иконки в `public/icons/atlas-nodes/` (сейчас remote CDN poe2db.tw).

**iter 178+ (опционально):** ETL-интеграция парсера в `run-etl.ts` (сейчас отдельный скрипт `scripts/etl/parse-timeless-jewel.ts`).

**Активные KI без изменений:** KI#45, KI#46, KI#47, KI#43, KI#53 (новый). Фоновые: APCA Lc<75, MobileRegexBar 168 KB.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
