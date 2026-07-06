# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 178 (полировка `/timeless-jewel` — rename, иконка, MobileRegexBar, SEO, self-host atlas-icons).
> **План категории:** `docs/ATLAS_JEWEL_PLAN.md` (решения пользователя зафиксированы в §3, §4, §5).

---

## Текущее состояние (iter 178 — DONE)

**iter 178: Полировка `/timeless-jewel`.** Косметика + SEO + производительность иконок. Никаких изменений в regex-engine или других категориях.

**Что сделано:**
- **Rename** `'timeless_jewel.title'`: `Особые самоцветы` → `Вневременные самоцветы` (соответствует inside-game item class name). Затронут только `src/shared/i18n.ts`.
- **Иконка** `public/icons/timeless-jewel.png` — пользовательская, 128×128 RGBA, 28 KB, прозрачный фон. `nav-items.ts` обновлён: `icon: 'jewel'` → `icon: 'timeless-jewel'`. Header `TimelessJewelPage.tsx` тоже использует новый path. Формат консистентен с остальными иконками навигации (waystone/tablet/relic/jewel/vendor/belt/ring/amulet/logo).
- **MobileRegexBar** интегрирован в `TimelessJewelPage.tsx`: RegexOutput рендерится в двух местах (desktop aside + mobile sticky-bottom bar), тот же паттерн что `BeltPage`/`RingPage`/etc. Atlas-semantics notice передан как alert.
- **Self-host atlas-node иконки**: 15 уникальных `.webp` скачаны в `public/icons/atlas-nodes/` (~50 KB суммарно). `public/generated/timeless-jewel.json` пропатчен — все 75 `iconUrl` теперь локальные (`icons/atlas-nodes/X.webp`). `AtlasNodeList.tsx` резолвит относительные пути через `import.meta.env.BASE_URL`. **Решает проблему «иконки подгружаются со скрипом»** — больше не нужен DNS/TLS handshake к `cdn.poe2db.tw` при первом заходе.
- **Zod-схема** `AtlasNodeTokenSchema.iconUrl` обновлена: принимает и `https://...` URL, и относительные пути `icons/...` (через `.refine()`).
- **Парсер** `scripts/etl/parse-timeless-jewel.ts` обновлён: новый helper `localizeIconUrl(remoteUrl)` скачивает иконку в `public/icons/atlas-nodes/` (idempotent, с browser-like headers для обхода 403). Future re-runs парсера будут автоматически self-host новые иконки.
- **Prerender + SEO**: `/timeless-jewel` добавлен в `scripts/prerender.ts` (routes[] + navLinks[]) и `public/sitemap.xml`. Сгенерирован `dist/timeless-jewel/index.html` с уникальным `<title>`, `<meta description>`, og:*, canonical.
- **Проверки**: `tsc` 0, `eslint` 0, `pnpm test` 2405 passed | 5 skipped (KI#53), `pnpm build` OK (10 prerendered routes — было 9). TimelessJewelPage chunk 7.09 → 7.63 KB (+MobileRegexBar).

**iter 178 icon-fix (post-iter 178 patch):**
- Файл `public/icons/timeless-jewel.png` перезаписан пользовательской иконкой (commit `8143975`). MD5 `af23c6063c27da0fed56801ccdbe0515`, размер 28093 bytes, 128×128 RGBA, прозрачный фон 47.9% — в том же диапазоне что у соседних иконок (22–71%).
- **Если в браузере всё ещё видна старая фиолетовая иконка** — это кэш. Решение: hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) или открыть сайт в режиме инкогнито. GitHub Pages кэширует статику; новая иконка применится после сброса кэша браузера.
- Очистка устаревших комментариев в коде: `nav-items.ts` (убрано упоминание «purple cosmic gem»), `TimelessJewelPage.tsx` (убрано «purple cosmic gem» в JSDoc).

---

## Roadmap: категория `/timeless-jewel`

| iter | Задача | Статус |
|------|--------|--------|
| 175 | Разведка + план (`docs/ATLAS_JEWEL_PLAN.md`) | ✅ DONE |
| 176 | Дата-модель + JSON + минимальная страница + builder + тесты | ✅ DONE |
| 177 | Фикс деплоя — KI#53 closed | ✅ DONE |
| 178 | Rename + иконка + MobileRegexBar + SEO + self-host icons | ✅ DONE |
| 179 | README rewrite (SEO-витрина) + docs/ cleanup | ⏳ NEXT |
| 180 | URL-sync + ProfilePanel + SelectedBasket для timeless-jewel | ⏳ |
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

## Next iteration (iter 178 → iter 179)

**iter 178 завершён.** Косметика + SEO + self-host иконок. CI зелёный: 2405 passed | 5 skipped, `pnpm build` OK (10 prerendered routes).

**iter 179 — README rewrite (SEO-витрина) + docs/ cleanup:**
1. **README.md rewrite** — превратить в SEO-оптимизированную «витрину» сайта и генератора. Цель: пользователи и AI-агенты находили репозиторий и сайт через поисковые запросы и AI-чаты. Структура: что это + для кого + key features + скриншот/preview + ссылки (online + repo + Discord) + quick start + как использовать генератор + stack/structure (кратко).
2. **docs/ cleanup** — удалить устаревшие итерационные планы (`ITER142_PROPOSALS.md`, `ITER148_TOOLBAR_REFACTOR.md`, `REDESIGN_CONCEPT_v3.md`, `AFFIX_ORDERING_PLAN.md` — все DONE/superseded). Оставить только актуальные reference-документы. Обновить `AGENT_NAVIGATION.md` §13 Documentation Map.
3. **worklog.md trim** — перенести iter 175 в одну строку.

**iter 180 — state-features для `/timeless-jewel`:**
1. **URL-sync** — selection в hash (через `url-sync.ts`, отдельная логика для atlas-узлов — НЕ filter-store).
2. **Profile persistence** — ProfilePanel integration (отдельный profile-section для timeless-jewel).
3. **SelectedBasket** — показ выбранных нод как чипов над RegexOutput (упрощённая версия без family-group).

**iter 181+ (опционально):** ETL-интеграция парсера в `run-etl.ts` (сейчас отдельный скрипт `scripts/etl/parse-timeless-jewel.ts`).

**Технический долг:** 7 relic overrides в `i18n-overrides.json` сейчас no-ops — можно удалить, когда точно убедимся, что они не нужны.

**Активные KI без изменений:** KI#45, KI#46, KI#47, KI#43. Фоновые: APCA Lc<75, MobileRegexBar 168 KB.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
