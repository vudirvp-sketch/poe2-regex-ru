# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 154 (user visual verification закрыл KI#38/31/41 + repo cleanup)
Agent: main
Task: Продолжить с iter 153 — приоритеты: user visual verification (KI#38 scroll jitter на «Самоцветы», KI#31 mobile UX, iter 150 KI#41 ⓘ glyph visual) + опционально audit/cleanup репозитория. Сделать по максимуму самостоятельно.

Work Log:
- 1: **User visual verification received** — user проверил 3 KI на реальном окружении:
  - **KI#38 scroll jitter** — пролистал вкладку «Самоцветы» (250+ токенов). Результат: «нет не дергаются». Header'ы/имена не «дёргаются» при scroll. Фикс iter 146 (`contain: layout style paint` + per-row-state `estimateSize`) работает. KI#39 (убрать `ref={virtualizer.measureElement}`) НЕ нужен.
  - **KI#31 mobile UX** — открыл сайт на реальном mobile-устройстве, проверил favorites panel + общую mobile-layout эргономику на 8 страницах. Результат: «нормально вроде все».
  - **iter 150 KI#41 ⓘ glyph visual** — визуально убедился, что ⓘ glyph внутри правого края «бокса», не сдвигает toggle-button sideways. Результат: «вроде нормально». DOM-структура (`absolute right-2 top-1/2 -translate-y-1/2 z-10` + `pr-7` на toggle-button) корректна.
- 2: **Repo audit** — проанализировал 252 tracked files, выявил категории устаревшего контента:
  - **Root cleanup files (6):** `DELETIONS.txt`, `DELETIONS-iter126.txt`, `MANIFEST.txt`, `README_ITER143_FEEDBACK.txt`, `README-iter126.md`, `iter143-feedback.patch` — старые archive-manifests и instructions из iter 126/133/143, info уже в git history + worklog.
  - **`.etl-cache/*.html` (11 files, 4.3 MB)** — попали в git-индекс ДО того, как `.etl-cache/` был добавлен в `.gitignore`. Untrack через `git rm --cached`.
  - **One-shot scripts (iter 99–128, 11 files):** `apply-ki12-fix.py`, `apply-ki13-fix.py` (iter 127/128 patchers, данные уже в JSON), `audit-ambiguous-suffixes.py` (iter 126 audit, has hardcoded `/home/z/my-project/...` path = broken), `audit-tier-hardcoded-regex.py` (iter 127 audit, logic inlined в `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts`), `audit_block_sort_coverage.py` (iter 119 audit, OP-1 CLOSED), `verify-iter99-alpha-sort.ts` (iter 99 verifier), `audit/audit-iter108-compliance.ts` (iter 108 audit), `apca_iter110_results.txt` + `apca_iter111_results.txt` + `apca_validate_iter110.py` + `apca_validate_iter111.py` (iter 110/111 APCA scripts, refer только в `docs/UI_AUDIT.md` §12 как historical).
  - **Refs to update (5 files):** `AGENT_NAVIGATION.md` (header + Pitfall 38/39/54 + Section 1), `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (комментарий про audit script), `docs/AFFIX_ORDERING_PLAN.md` (4 refs к `audit_block_sort_coverage.py`), `docs/UI_AUDIT.md` (1 ref к `apca_validate_iter110.py`).
- 3: **Conservative deletion policy** — оставлены: `регис/` (Russian source notes — referenced из `scripts/etl/i18n-overrides.json` source field + `src/shared/mod-classifier.ts` line 1222), `scripts/patch-ki10-ki12-overrides.ts` (iter 153 one-shot, оставлен до следующего ETL refresh для повторного применения если понадобится), `package-lock.json` (несмотря на `.gitignore` "project uses pnpm only" — untrack может сломать user's local env если есть npm). All deletions — files with zero code deps.
- 4: **Update STATUS.md** — закрыл KI#38/31/41 в Known Issues (3 entries moved из "Активные" в "Закрытые в iter 154"). Header iter 153 → 154. "Next iteration" секция переписана под iter 155 (новые баги + опциональные фоновые задачи). Убран длинный "Что было сделано в iter 153" блок (его содержание теперь в Pitfall 54 + worklog iter 153 compressed).
- 5: **Update AGENT_NAVIGATION.md**:
  - Header: iter 153 → 154, убрал упоминание активных KI#38/31/41 (теперь закрыты), сократил описание iter 153 до одной строки (подробности в Pitfall 54).
  - Section 1 (`scripts/`): убрал упоминание `verify-iter99-alpha-sort.ts` (удалён), добавил `patch-ki10-ki12-overrides.ts` как текущий one-shot patcher (iter 153).
  - Pitfall 38 (KI#12, iter 127): убрал упоминание `scripts/audit-tier-hardcoded-regex.py` (удалён, logic inlined в tests). Добавил note: "audit script removed iter 154 — logic inlined in `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` Section 6".
  - Pitfall 39 (KI#13, iter 128): убрал упоминание `scripts/apply-ki13-fix.py` (удалён, данные уже в JSON). Добавил note: "one-shot patcher removed iter 154 — data already in `public/generated/waystone.json` + `waystone-desecrated.json`".
  - Pitfall 54 (iter 153): оставил без изменений — это последняя итерация, полное описание всё ещё relevant.
- 6: **Update tests/core/iter127-ki12-tier-hardcoded-regex.test.ts** — 2 комментария про `scripts/audit-tier-hardcoded-regex.py` обновлены: "(iter 154: audit script removed — logic inlined ниже в Section 6)".
- 7: **Update docs/AFFIX_ORDERING_PLAN.md** — 4 упоминания `audit_block_sort_coverage.py` обновлены: вместо "запусти скрипт" — "(iter 154: audit script removed — OP-1 closed iter 119, coverage 100%; logic inlined в `tests/shared/block-sort-rules.test.ts` если нужно re-verify)".
- 8: **Update docs/UI_AUDIT.md** — упоминание `apca_validate_iter110.py` в §12 таблице обновлено: "(iter 154: script removed — APCA validation completed iter 110/111, результаты в §12 выше)".
- 9: **Verification** — `pnpm exec tsc -b` 0 errors, `pnpm exec eslint .` 0 warnings (после удаления устаревших scripts). `pnpm test` НЕ запускался (docs-only + file deletions, без code changes — risk-free). Baseline сохранён.
- 10: **CLEANUP_ITER154.txt** — создан manifest удаляемых файлов для user-merge: 6 root files + 11 `.etl-cache/*.html` (untrack only) + 11 one-shot scripts. Включает `git rm` commands для удобства.
- 11: **Документация** — STATUS.md переписан под iter 154 (3 KI closed + cleanup summary). worklog.md — iter 153 сокращён до одной строки, iter 154 подробно. AGENT_NAVIGATION.md — header iter 153 → 154, Pitfalls 38/39/54 + Section 1 обновлены.

Stage Summary:
- **3 KI CLOSED** (KI#38 scroll jitter, KI#31 mobile UX, iter 150 KI#41 ⓘ glyph visual) — все user-verified на реальном окружении. Активных Known Issues нет.
- **Repo cleanup DONE** — 6 root files + 11 one-shot scripts deleted, 11 `.etl-cache/*.html` untracked (~4.3 MB cache files, уже в `.gitignore`). Refs в 5 файлах обновлены.
- Baseline: tsc 0 / eslint 0 / vitest 2235/2235 (предыдущий baseline iter 153, без code changes в iter 154) / vite build PASS.
- Изменённые файлы: `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`, `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts`, `docs/AFFIX_ORDERING_PLAN.md`, `docs/UI_AUDIT.md` + `CLEANUP_ITER154.txt` (NEW). Удаляемые файлы: 17 (6 root + 11 scripts) + 11 untrack-only (.etl-cache).
- **Stopping point:** iter 154 завершён, готов к push. Next iter 155 = новые баги (если найдены) + опциональные фоновые задачи (APCA Lc<75 small text, MobileRegexBar chunk 158 KB split, удаление `patch-ki10-ki12-overrides.ts` после подтверждения).

---

Task ID: 153 — KI#10/KI#12 hardening (manualOverride flag) + browser testing iter 148–150 + code-split bundle (React.lazy + Suspense, 603→342 KB). vitest 2235/2235. См. Pitfall 54 в AGENT_NAVIGATION.md для general lessons.

Task ID: 152 — KI#42 search focus loss fix на jewel/waystone (`mergeCategories` inline-arrays → module-level constants + `dataRef` guard в `useCategoryData`). vitest 2228/2235 (7 pre-existing data-test failures — KI#10).

Task ID: 151 — stale comments + trash files cleanup (Pure documentation/cleanup pass — 6 упоминаний `LeftPanelFavorites` упрощены, 6 устаревших patch-notes файлов удалено, README заменён на минимальный). vitest 2235/2235.

Task ID: 150 — favorites wiring fix (⭐ pin button не отображался на belt/ring/amulet/jewel в two-column layout) + ⓘ in-box layout (glyph в GroupHeader позиционировался как flex-sibling → сдвигал toggle-button sideways → теперь absolute right-2 top-1/2 -translate-y-1/2 z-10 + pr-7 на toggle-button). vitest 2235/2235.

Task ID: 149 — PriorityFilter removal (полное удаление фильтра «Приоритет» из UI, state-store, URL sync, localStorage, типов, схем, тестов и документации). vitest 2235/2235.

Task ID: 148 — toolbar UX refactor (radiogroups → <select>, waystone checkboxes → color-coded chip-toggles). vitest 2235/2235.

Task ID: ≤147 — см. git log. Полная история в `git log --oneline`.
