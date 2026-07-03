# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 154 (user visual verification закрыл KI#38/31/41 + repo cleanup)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 154: закрыты 3 user-verification KI + проведён repo cleanup.**

### 1. User visual verification — все 3 KI закрыты

| KI | Проверка | Результат | Действие |
|----|----------|-----------|----------|
| KI#38 | Scroll jitter на вкладке «Самоцветы» (250+ токенов) | Плавно, без «дёрганья» header'ов/имён | ✅ CLOSED. Фикс iter 146 (`contain: layout style paint` + `estimateSize` per-row-state) работает. KI#39 (убрать `measureElement`) НЕ нужен. |
| KI#31 | Mobile UX (favorites panel + общая эргономика на 8 страницах) | Нормально на реальном mobile-устройстве | ✅ CLOSED. Favorites quick-select panel + mobile layout работают. |
| iter 150 KI#41 | ⓘ glyph visual side-shift | Glyph внутри правого края «бокса», не сдвигает toggle-button sideways | ✅ CLOSED. DOM-структура (`absolute right-2 top-1/2 -translate-y-1/2 z-10` + `pr-7` на toggle-button) корректна. |

### 2. Repo cleanup (iter 154)

Удалены устаревшие файлы из репозитория (подробности — в `CLEANUP_ITER154.txt` внутри архива iter 154):

- **Root:** `DELETIONS.txt`, `DELETIONS-iter126.txt`, `MANIFEST.txt`, `README_ITER143_FEEDBACK.txt`, `README-iter126.md`, `iter143-feedback.patch` — старые archive-manifests и instructions из iter 126/133/143.
- **`.etl-cache/*.html` (11 files, ~4.3 MB)** — untrack из git (файлы уже в `.gitignore`, но попали в индекс раньше).
- **One-shot scripts (iter 99–128, всё уже применено к данным):** `scripts/apply-ki12-fix.py`, `scripts/apply-ki13-fix.py`, `scripts/audit-ambiguous-suffixes.py`, `scripts/audit-tier-hardcoded-regex.py`, `scripts/audit_block_sort_coverage.py`, `scripts/verify-iter99-alpha-sort.ts`, `scripts/audit/audit-iter108-compliance.ts`, `scripts/apca_iter110_results.txt`, `scripts/apca_iter111_results.txt`, `scripts/apca_validate_iter110.py`, `scripts/apca_validate_iter111.py`. Логика audit'ов либо inlined в `tests/` (iter 127), либо больше не актуальна (iter 99/108/110/111/119/126/128). Папка `scripts/audit/` удалена за пустотой.
- **Документация:** обновлены `AGENT_NAVIGATION.md` (header + Pitfalls 38/39/54 + Section 1), `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (комментарий про удалённый audit script), `docs/AFFIX_ORDERING_PLAN.md` (refs к удалённому `audit_block_sort_coverage.py`), `docs/UI_AUDIT.md` (refs к удалённым `apca_validate_iter110/111.py`).

Baseline сохранён: tsc 0 / eslint 0 / vitest 2235/2235 / `vite build` PASS.

---

## Known Issues

### Активные

**Нет активных KI.** Все user-verification KI закрыты iter 154.

### Фоновые (low-priority, опциональные)

1. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
2. **MobileRegexBar chunk 158 KB** — отдельный chunk для mobile-only компонента. Можно ещё больше раздробить, но это не критично (загружается только на mobile, не влияет на desktop LCP).
3. **`scripts/patch-ki10-ki12-overrides.ts` (iter 153 one-shot)** — оставлен в repo до следующего ETL refresh. После подтверждения, что `manualOverride` flag корректно защищает future ETL runs, можно удалить.

### Закрытые в iter 154

- ✅ **KI#38 (scroll jitter CSS contain)** — user-verified на «Самоцветы» (250+ токенов), плавно.
- ✅ **KI#31 (mobile layout для favorites panel)** — user-verified на реальном mobile-устройстве, 8 страниц.
- ✅ **iter 150 KI#41 (ⓘ glyph visual side-shift)** — user-verified, glyph внутри бокса.

### Закрытые в iter 153

- ✅ **KI#10 (rarity disambiguation override regression)** — fixed via `manualOverride` flag.
- ✅ **KI#12 (tier-hardcoded regex regression)** — fixed via `manualOverride` flag.
- ✅ **iter 148 visual check (toolbar selects)** — browser-verified на 7 страницах.
- ✅ **iter 149 visual check (Priority filter removed)** — browser-verified на 7 страницах.
- ✅ **iter 150 KI#40 (⭐ pin button on all 7 pages)** — browser-verified.
- ✅ **KI#37 (origin badge)** — browser-verified на jewel/waystone.
- ✅ **KI#42 (search focus retention)** — browser-verified на 7 страницах.
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

## Next iteration (iter 154 → iter 155)

**iter 154 завершён: user visual verification закрыл KI#38/31/41 + repo cleanup. Готов к push.**

**Приоритеты для iter 155:**

1. **Новые баги** (если найдены) — сначала документировать в STATUS.md как Known Issue, потом фиксить.

2. **Фоновые задачи (опционально, low-priority):**
   - **APCA Lc<75 для small text weight 400** — weight 500 на критичных лейблах.
   - **MobileRegexBar chunk 158 KB** — дальнейший code-split, если user заметит медленную загрузку на mobile.
   - **`scripts/patch-ki10-ki12-overrides.ts` (iter 153 one-shot)** — удалить после подтверждения, что `manualOverride` flag защищает future ETL runs.

3. **Новые фичи / UX-импрувменты** — по запросу user.

---

Контакты: Discord **woonderdad**
