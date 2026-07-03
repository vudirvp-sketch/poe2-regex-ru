# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 155 (KI#43 deploy retry fix)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 155: KI#43 deploy retry fix.** Build + Deploy workflow теперь оборачивает `actions/deploy-pages@v4` в `Wandalen/wretry.action@v3` (3 attempts, 30s delay) для автоматического retry при transient Pages API failures. Build artifact успешен — fallback только на deploy step.

---

## Known Issues

### Активные

**KI#43 — Transient `actions/deploy-pages` failures (iter 155).**

**Симптом:** `Build + Deploy` workflow завершается `failure` при `Deploy to Pages` step (~6s), хотя `Build` и `Upload Pages artifact` steps — `success`.

**Incident:** Run [28677715718](https://github.com/vudirvp-sketch/poe2-regex-ru/actions/runs/28677715718) от iter 154 (commit `7dc558d`). Два push'а iter 154 подряд (`fad413f` success → `7dc558d` failure, ~90s apart). Build upload прошел за 1s, deploy step стартовал в 18:35:06 и упал в 18:35:12 — слишком быстро для real failure, GitHub Pages API вернул ошибку без подробностей (admin-only logs).

**Root cause (предположение):** Transient GitHub Pages API error. Pages deployments sometimes fail when triggered shortly after another deploy finished — internal state machine GitHub Pages ещё не released предыдущий deployment.

**Fix (iter 155):** `deploy.yml` → deploy step обёрнут в `Wandalen/wretry.action@v3` (3 attempts, 30s delay между попытками). Все inputs/outputs `actions/deploy-pages@v4` пробрасываются прозрачно (включая `steps.deployment.outputs.page_url`).

**Recovery для существующего failed run:** User может manually re-run failed workflow из GitHub Actions UI (`...` → `Re-run failed jobs`) — Pages API к этому моменту уже свободен.

### Фоновые (low-priority, опциональные)

1. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
2. **MobileRegexBar chunk 158 KB** — отдельный chunk для mobile-only компонента. Можно ещё больше раздробить, но это не критично (загружается только на mobile, не влияет на desktop LCP).
3. **`scripts/patch-ki10-ki12-overrides.ts` (iter 153 one-shot)** — оставлен в repo до следующего ETL refresh. После подтверждения, что `manualOverride` flag корректно защищает future ETL runs, можно удалить.
4. **`_local-tools/browser-test-iter153.sh`** — iter 153 one-shot browser-testing script с hardcoded `/tmp/` paths. Можно удалить или перенести в `docs/` как reference.

### Закрытые

- ✅ **iter 154:** KI#38 scroll jitter (user-verified на «Самоцветы» 250+ токенов), KI#31 mobile UX (user-verified на 8 страницах), iter 150 KI#41 ⓘ glyph visual (user-verified). Repo cleanup: 17 stale files deleted + 11 `.etl-cache/*.html` untracked.
- ✅ **iter 153:** KI#10 (rarity disambiguation override regression), KI#12 (tier-hardcoded regex regression) — fixed via `manualOverride` flag. Bundle 603→342 KB via `React.lazy + Suspense` code-split.
- ✅ **iter 152:** KI#42 search focus loss fix на jewel/waystone.
- ✅ **iter 150:** KI#40 ⭐ pin button on all 7 pages, KI#41 ⓘ in-box layout.
- ✅ **iter 149:** PriorityFilter feature complete removal.
- ✅ **iter 148:** toolbar UX refactor (radiogroups → `<select>`).

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

## Next iteration (iter 155 → iter 156)

**iter 155 завершён: KI#43 deploy retry fix. Готов к push.**

**Приоритеты для iter 156:**

1. **Новые баги** (если найдены) — сначала документировать в STATUS.md как Known Issue, потом фиксить.

2. **Фоновые задачи (опционально, low-priority):**
   - **APCA Lc<75 для small text weight 400** — weight 500 на критичных лейблах.
   - **MobileRegexBar chunk 158 KB** — дальнейший code-split, если user заметит медленную загрузку на mobile.
   - **`scripts/patch-ki10-ki12-overrides.ts` (iter 153 one-shot)** — удалить после подтверждения, что `manualOverride` flag защищает future ETL runs.
   - **`_local-tools/browser-test-iter153.sh`** — удалить или перенести в `docs/` как reference.

3. **Новые фичи / UX-импрувменты** — по запросу user.

---

Контакты: Discord **woonderdad**
