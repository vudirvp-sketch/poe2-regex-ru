# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 175 (РАЗВЕДКА — план новой категории `/timeless-jewel` для особых самоцветов; Atlas regex-семантика зафиксирована).
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная, решения пользователя зафиксированы в §9)
> **План новой категории:** `docs/ATLAS_JEWEL_PLAN.md` (iter 175 — ждёт согласования пользователя)

---

## Текущее состояние (iter 175 — РАЗВЕДКА)

**iter 175: План новой категории `/timeless-jewel`.** Пользователь хочет добавить отдельный раздел для генерации регексов подсветки нод древа атласа, заменяемых особыми самоцветами («Вечная ненависть» + «Трагедия героев»). Регекс должен подсвечивать только **названия нод** — без цифр, без аффиксов. Требование: названия нод не должны смешиваться с аффиксами существующей категории `/jewel`.

**Что сделано (разведка):**
- Распарсены PoE2DB-страницы обоих самоцветов → списки нод (35 + 40 = 75) сохранены в `регис/undying_hate_nodes.txt` + `регис/heroic_tragedy_nodes.txt`.
- Зафиксирована **Atlas regex-семантика** (отличается от item-семантики!) — см. раздел «Подтверждённые ограничения PoE2» ниже.
- Составлен ёмкий план `docs/ATLAS_JEWEL_PLAN.md` (архитектура, дата-модель, UI, риски, итерации).
- Документация (STATUS.md, AGENT_NAVIGATION.md, README.md, worklog.md) актуализирована.

**Код НЕ изменялся.** Ждём от пользователя: подтверждение архитектуры (Вариант A — новый top-level раздел), выбор названия, проверка списков нод.

---

## Roadmap: новая категория `/timeless-jewel`

| iter | Задача | Статус |
|------|--------|--------|
| 175 | Разведка + план (`docs/ATLAS_JEWEL_PLAN.md`) | ✅ DONE |
| 176 | Дата-модель (`AtlasNodeToken` + Zod) + JSON + минимальная страница | ⏳ ждёт подтверждения |
| 177 | Полировка UI + profile + URL-sync + prerender + SEO | ⏳ |
| 178+ | ETL-интеграция (опционально — при появлении новых timeless jewels) | ⏳ |

**Ключевое решение (предлагается, ждёт подтверждения):** Вариант A — новый top-level раздел `/timeless-jewel` с selector внутри (2 особых самоцвета). Полная изоляция от `/jewel` (разные regex-семантики, разные данные, разные UI).

---

## История (iter 174 — одной строкой)

**iter 174:** KI#52 fix (search auto-expand подкатегорий в ModList/VirtualizedModList через локальные effective Set'ы) + FAQ regexExclude про `"!100%"`. 2370/2370 PASS.

**iter 173:** KI#51 fix (scroll-aware fade indicators для `.topnav-tabs` + GitHub link в TopNav feedback area). A5 CLOSED (iter 164 sufficient). 2366/2366 PASS.

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
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only.

---

## FAQ (частые вопросы)

**Q: Почему в регексе появился `"!100%"` (или другой `"!..."` токен)? Это баг?**
A: Не баг. Это **намеренная защита от ложных срабатываний (FP)** через поле `regexExclude` в ETL-данных. Когда два мода разделяют общую подстроку, ETL добавляет `regexExclude` → компилятор генерирует `"suffix" !"exclude"`. Поле определено в `src/shared/types.ts` (GameToken + OptimizationEntry).

---

## Подтверждённые ограничения PoE2 (кратко)

### Item-семантика (поиск предметов)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| **`\|` между multi-word фразами** | ❌ | broken — `"А Б\|В Г"` = 0 matches |
| Пробел = AND | ✅ | cross-block + same-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | iter 157 T7 in-game verified |
| `^` start-of-block anchor | ⚠️ | **только на первой ALT в OR** (KI#45) |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
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

**Ключевое ограничение Atlas:** единственная рабочая логика — **OR** (подсветить любые ноды, содержащие ЛЮБОЕ из перечисленных названий). AND/NOT не работают → нельзя построить «3 обязательных + хотя бы 1 опциональный».

**Подробнее:** `docs/ATLAS_JEWEL_PLAN.md` §2 + `регис/результаты AND+OR тестов.md`.

---

## Next iteration (iter 175 → iter 176)

**iter 175 завершён (разведка).** План новой категории `/timeless-jewel` составлен, документация актуализирована. Код НЕ изменялся.

**Ожидается от пользователя (для старта iter 176):**
1. **Подтвердить архитектурное решение** — Вариант A (новый top-level раздел `/timeless-jewel` с selector внутри).
2. **Выбрать название раздела** — `/timeless-jewel` (рекомендуется) / `/atlas-jewel` / `/unique-jewel` / другое.
3. **Проверить списки нод** — `регис/undying_hate_nodes.txt` (35) + `регис/heroic_tragedy_nodes.txt` (40).
4. **Решить по ETL** — ручная сборка JSON (iter 176) vs ETL-парсер сразу.
5. **Решить по UI** — новый `AtlasNodeList` (рекомендуется) vs обёртка над `VirtualizedModList`.
6. Визуальная валидация iter 174 (KI#52 fix — search auto-expand подкатегорий), если ещё не сделана.

**Активные KI без изменений:** KI#45, KI#46, KI#47, KI#43. Фоновые: APCA Lc<75, MobileRegexBar 168 KB.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru
