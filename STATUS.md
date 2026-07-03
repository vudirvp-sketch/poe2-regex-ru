# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 153 (KI#10/KI#12 hardening + browser testing iter 148–150 + code-split bundle)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 153: закрыто 3 приоритета из Next iter 152 + проведено browser testing.**

### 1. KI#10/KI#12 hardening (manualOverride flag)

После iter 151 (ETL refresh) 7 тестов в `iter126-ki10-rarity-disambiguation` (2) и `iter127-ki12-tier-hardcoded-regex` (5) падали: ETL перегенерировал `public/generated/*.json`, и `iterative-optimizer` (Step 10) затирал explicit-regex overrides из `i18n-overrides.json`:

- `waystone.implicit.item_rarity`: `едкость предметов` → `предметов` (KI#10 regression)
- `relic.sanctummonstersreduceddamage1`: `монстры наносят уменьшенный на ` → `уменьшенный на 6` (KI#12 tier-hardcoded regression)
- 4 family-level opt entries в relic.json тоже стали tier-hardcoded
- 4 broken cross-family opt entries вернулись

**Fix (2 слоя):**
1. **`manualOverride` flag** — добавлен в `GameToken` (types.ts + schemas.ts). `applyI18nOverrides()` в `run-etl.ts` выставляет `manualOverride: true` когда override содержит explicit `regex`. `iterative-optimizer.ts` скипает такие токены (skip всех 5 стратегий).
2. **One-shot patch script** `scripts/patch-ki10-ki12-overrides.ts` — восстанавливает override-regexes в существующих JSON-файлах + патчит 4 family-opt entries + удаляет 4 broken cross-family entries. Запускается один раз на текущих данных; будущие ETL-запуски защищены `manualOverride` flag.

**Результат:** все 2235 тестов PASS (было 2228/2235).

### 2. Browser testing iter 148 + 149 + 150 + KI#36/37/42

Скрипт `scripts/browser-test-iter153.sh` прогоняет 7 категорийных страниц через `agent-browser` и проверяет:

| Проверка | belt | ring | amulet | jewel | waystone | tablet | relic |
|----------|------|------|--------|-------|----------|--------|-------|
| iter 148: Сортировка select | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A (by design) |
| iter 148: Показывать select | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| iter 149: Priority select removed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| iter 150 KI#40: ⭐ pin button | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| iter 150 KI#41: ⓘ tooltip button | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| KI#37: origin badge | — | — | — | ✅ | ✅ | — | — |
| KI#42: search focus retention | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| KI#36: favorites panel (manual) | ✅ (belt) | — | — | — | — | — | — |

KI#36 manually verified на belt: pin token → «Открыть панель избранных аффиксов (N)» button появляется в header → click открывает portal-panel со списком favorited families + «Выбрать»/«Убрать» buttons.

### 3. Code-split bundle (index-*.js < 500 KB)

`src/App.tsx`: 8 категорийных страниц переведены на `React.lazy` + `Suspense`. HomePage остаётся eager (landing-page LCP).

**Before:** `index-*.js` 603.71 KB (gzip 165 KB) — Vite warning > 500 KB.
**After:** `index-*.js` 342.11 KB (gzip 104.62 KB) + 8 lazy chunks по 3.6–7.5 KB + 4 shared chunks (IconLegend 14 KB, ModList 15 KB, VirtualizedModList 37 KB, MobileRegexBar 158 KB). **43% reduction главного bundle**, warning убран.

Все 8 страниц загружаются корректно после lazy-load (browser-verified: title + h2 корректные на каждой странице).

### Что было сделано в iter 153

| Изменение | Файлы | Что сделано |
|-----------|-------|-------------|
| KI#10/KI#12 type+schema | `src/shared/types.ts`, `src/shared/schemas.ts` | Добавлен `manualOverride?: boolean` в `GameToken` interface + Zod schema. |
| KI#10/KI#12 ETL guard | `scripts/run-etl.ts` | `applyI18nOverrides` выставляет `manualOverride: true` для explicit-regex overrides. |
| KI#10/KI#12 optimizer skip | `scripts/etl/iterative-optimizer.ts` | Skip всех 5 стратегий для `manualOverride`-токенов. |
| KI#10/KI#12 one-shot patch | `scripts/patch-ki10-ki12-overrides.ts` (NEW) | Восстанавливает 13 override-regexes + 4 family-opt entries + удаляет 4 broken opt entries в существующих JSON. |
| KI#10/KI#12 data patch | `public/generated/{relic,waystone,waystone-desecrated,tablet}.json` | 13 токенов patched, 4 opt entries patched, 4 opt entries deleted. |
| Browser testing | `scripts/browser-test-iter153.sh` (NEW, outside repo) | 7 страниц × 6 проверок = 42 теста, все PASS. |
| Code-split bundle | `src/App.tsx` | 8 категорийных страниц на `React.lazy` + `Suspense`. |
| Документация | `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` | Переписаны под iter 153. |

**Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / `vite build` PASS (главный bundle 342 KB, warning убран).**

---

## Known Issues

### Активные (требуют user visual verification)

1. **KI#38 (scroll jitter CSS contain)** — фикс iter 146 готов, browser test через accessibility tree не определяет визуальный jitter. Нужен user: пролистать список на вкладке «Самоцветы» (250+ токенов) — есть ли «дёрганье» header'ов/имён при scroll? Если да → применить KI#39 (убрать `ref={virtualizer.measureElement}`, оставить только `estimateSize`).
2. **KI#31 (mobile layout для favorites panel)** — фикс iter 144 готов, mobile UX требует user feedback на реальном устройстве.
3. **Mobile layout general** — проверка на реальном мобильном устройстве (не симулятор) для всех 8 страниц.

### Фоновые (low-priority)

4. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
5. **MobileRegexBar chunk 158 KB** — отдельный chunk для mobile-only компонента. Можно ещё больше раздробить, но это не критично (загружается только на mobile).

### Закрытые в iter 153

- ✅ **KI#10 (rarity disambiguation override regression)** — fixed via `manualOverride` flag.
- ✅ **KI#12 (tier-hardcoded regex regression)** — fixed via `manualOverride` flag.
- ✅ **iter 148 visual check (toolbar selects)** — browser-verified на 7 страницах.
- ✅ **iter 149 visual check (Priority filter removed)** — browser-verified на 7 страницах.
- ✅ **iter 150 KI#40 (⭐ pin button on all 7 pages)** — browser-verified.
- ✅ **iter 150 KI#41 (ⓘ tooltip positioning)** — button present на 7 страницах (visual side-shift требует user check, но KI#41 fix был про DOM-структуру — `absolute` positioning, не `flex`-sibling — это проверено в tests/ui/GroupHeader.test.tsx).
- ✅ **KI#37 (origin badge)** — browser-verified на jewel/waystone.
- ✅ **KI#42 (search focus retention)** — browser-verified на 7 страницах (type+backspace, focus=INPUT).
- ✅ **Bundle > 500 KB** — fixed via React.lazy + Suspense code-split.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `prefix (A\|B\|C)%.*suffix` | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` | ❌ | Fix: Path D |
| Regex char limit ≈ 250 chars | ✅ | runtime split |

---

## Next iteration (iter 153 → iter 154)

**iter 153 завершён: KI#10/KI#12 hardening + browser testing iter 148–150 + code-split bundle. Готов к push.**

**Приоритеты для iter 154:**

1. **User visual verification** (нужны user-проверки, не агентские):
   - **KI#38 scroll jitter** — пролистать вкладку «Самоцветы» (250+ токенов). Если есть «дёрганье» → применить KI#39 (убрать `ref={virtualizer.measureElement}` с virtual row, оставить только `estimateSize`).
   - **KI#31 mobile UX** — открыть сайт на реальном мобильном устройстве, проверить favorites panel + общую mobile-layout эргономику на 8 страницах.
   - **iter 150 KI#41 ⓘ glyph visual** — убедиться визуально, что ⓘ glyph не сдвигает toggle-button sideways (DOM-структура проверена, нужен визуальный eye-check).

2. **Bundle further optimization (опционально)** — `MobileRegexBar` chunk 158 KB. Можно разбить, если user заметит медленную загрузку на mobile.

3. **APCA Lc<75 для small text weight 400** — weight 500 на критичных лейблах.

4. **Новые баги** (если найдены) — сначала документировать в STATUS.md как Known Issue, потом фиксить.

---

Контакты: Discord **woonderdad**
