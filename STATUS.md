# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 180 (SEO technical fixes — title/meta/keywords + FAQ schema + synonyms + KI#54 fix).
> **План категории:** `docs/ATLAS_JEWEL_PLAN.md`.

---

## Текущее состояние (iter 180 — IN PROGRESS)

**iter 180: SEO technical fixes.** Технические правки SEO, которые не затрагивают интерфейс: исправление `<title>`/`<meta>`, удаление мёртвого `meta keywords`, добавление FAQ-секций и синонимов в свёрнутый SEO-блок, добавление `FAQPage` JSON-LD schema, фикс KI#54 (regression iter 178: `/timeless-jewel` отсутствовал в `prerender-full.ts` и IndexNow urlList).

**Что вне рамок итерации** (по решению пользователя):
- Переезд на свой домен — отложен.
- Анонсирующие посты на DTF / Steam-гайды / форум — пользователь делает сам.
- Любые правки, способные визуально сломать интерфейс — не делаются.

Подробности — в `worklog.md` (Task ID: iter-180-seo-fixes) и `docs/SEO_GROWTH_PLAN.md`.

---

## Roadmap

| iter | Задача | Статус |
|------|--------|--------|
| 175–178 | Категория `/timeless-jewel` (разведка → реализация → полировка) | ✅ DONE |
| 179 | README rewrite (SEO-витрина) + docs/ cleanup | ✅ DONE |
| 180 | SEO technical fixes (title/meta/FAQ/KI#54) | ⏳ IN PROGRESS |
| 181 | URL-sync + ProfilePanel + SelectedBasket для `/timeless-jewel` | ⏳ NEXT |
| 182+ | ETL-интеграция `parse-timeless-jewel.ts` в `run-etl.ts` (опционально) | ⏳ |

---

## Known Issues

### Активные

**KI#54 — iter 178 regression: `/timeless-jewel` отсутствует в `prerender-full.ts` и IndexNow urlList.**
iter 178 добавил категорию в `scripts/prerender.ts` (shell-пререндер) и `public/sitemap.xml`, но забыл:
1. `scripts/prerender-full.ts` — Playwright full-prerender НЕ рендерит React-контент для `/timeless-jewel` (краулеры без JS видят shell + `<noscript>`, но не список нод).
2. `.github/workflows/deploy.yml` → `indexnow` job — URL `/timeless-jewel` НЕ отправляется в IndexNow при деплое.
Fix (iter 180): добавлен в оба места.

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars. Для atlas-jewel — отдельный `buildAtlasRegex()` со своим overflow-split.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**
`buildMixedAstFromSelections` делегирует MUST/OPT отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts. Редкий edge case.

**KI#43 — Transient `actions/deploy-pages` failures.**
Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Пассивная проверка.

### Закрытые

- **KI#53** — Pre-existing data regression в `iter127-ki12-tier-hardcoded-regex.test.ts`. ✅ FIXED (iter 177).
- **KI#48, KI#49, KI#50, KI#51, KI#52** — закрыты в iter 163–174 (см. `worklog.md`).

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only.
3. 7 relic overrides в `i18n-overrides.json` сейчас no-ops — можно удалить, когда точно убедимся, что они не нужны.

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

## Next iteration (iter 180 → iter 181)

**iter 180 завершён.** Технические SEO-правки без изменения интерфейса: исправлены `<title>` (80→58 chars, ключевое вперёд), удалён мёртвый `meta keywords`, в `SeoBlock.tsx` добавлены FAQ-секция и синонимы (лут фильтр, поиск в тайнике, аффиксы и моды), добавлен `FAQPage` JSON-LD schema в `index.html`, пофикшен KI#54 (prerender-full.ts + IndexNow).

**iter 181 — state-features для `/timeless-jewel`:**
1. **URL-sync** — selection в hash (через `url-sync.ts`, отдельная логика для atlas-узлов — НЕ filter-store).
2. **Profile persistence** — ProfilePanel integration.
3. **SelectedBasket** — показ выбранных нод как чипов над RegexOutput.

**iter 182+ (опционально):** ETL-интеграция парсера в `run-etl.ts`.

**Технический долг:**
- 7 relic overrides в `i18n-overrides.json` сейчас no-ops — можно удалить.
- `docs/UI_REFACTOR_PLAN.md` — все 7 фаз DONE, но ~15 source files ссылаются на «§4 Phase X» в комментариях. Удаление требует mass-comment-cleanup.

**Активные KI:** KI#54 (FIXED iter 180), KI#45, KI#46, KI#47, KI#43.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
