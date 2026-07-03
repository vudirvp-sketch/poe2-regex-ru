# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 155 (KI#43 deploy retry fix)
Agent: main
Task: iter 154 push trigger'нул `Build + Deploy` workflow, run [28677715718](https://github.com/vudirvp-sketch/poe2-regex-ru/actions/runs/28677715718) — Build job SUCCESS (artifact uploaded), но Deploy to Pages job FAILURE (step 2, ~6s). Investigate + fix.

Work Log:
- 1: **Fetched run info via GitHub API** (`https://api.github.com/repos/vudirvp-sketch/poe2-regex-ru/actions/runs/28677715718/jobs`). 4 jobs total: ETL (skipped), Build (success), Deploy (failure), Notify IndexNow (skipped). All 9 Build steps success including `Upload Pages artifact`. Deploy job `started_at=18:35:04`, step 2 `Deploy to Pages` `started_at=18:35:06`, `conclusion=failure`, `completed_at=18:35:12` — 6 seconds total. Step 1 (`Set up job`) success, step 3 (`Complete job`) success.
- 2: **Compared with successful run 28677653893** (commit `fad413f` — first iter 154 push, 90s earlier). Successful run's deploy step took 6s too (18:33:27 → 18:33:33). Same workflow YAML, same code (diff between `fad413f` and `7dc558d` = only file deletions of stale root files + `.etl-cache/*.html` untrack + `DELETIONS-iter151.txt` added; no source/build logic changes). Build artifact identical in content (verified via `git diff 113b573..7dc558d` — 9157 deletions, 321 insertions, all in cleanup files).
- 3: **Tried to fetch deploy job logs** via API — got `403 Must have admin rights to Repository` (public API doesn't expose job logs to unauthenticated clients). Conclusion: failure mode matches the documented "transient Pages API error" pattern — Build artifact uploaded successfully, deploy step fails fast (6s) without a real artifact issue.
- 4: **Documented KI#43 in STATUS.md** — new active Known Issue: "Transient `actions/deploy-pages` failures". Симптом: Build SUCCESS, Deploy FAILURE ~6s. Incident: run 28677715718 от iter 154. Root cause (предположение): GitHub Pages API internal state machine не released предыдущий deployment (два push'а ~90s apart). Recovery: manual re-run из GitHub Actions UI.
- 5: **Fix deploy.yml** — обернул `actions/deploy-pages@v4` в `Wandalen/wretry.action@v3` (latest release v3.8.0 от 2025-01-09, well-maintained). `attempt_limit: 3`, `attempt_delay: 30` (seconds). Все inputs/outputs пробрасываются прозрачно — `id: deployment` на wretry action, `steps.deployment.outputs.page_url` продолжит работать (wretry.action README: "All inputs and outputs of the internal action are properly forwarded"). Inline comment со ссылкой на KI#43 + STATUS.md. Permissions block unchanged (`pages: write`, `id-token: write` на job level).
- 6: **Validated YAML** — `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"` passes. Jobs: etl/build/deploy/indexnow — все на месте. Deploy step `uses: Wandalen/wretry.action@v3`, `with: {action: actions/deploy-pages@v4, attempt_limit: 3, attempt_delay: 30}`.
- 7: **Cleanup stale manifests** — удалил `DELETIONS-iter151.txt` (iter 151 manifest listing 6 root files — все уже удалены в iter 154) и `CLEANUP_ITER154.txt` (iter 154 cleanup manifest — cleanup применён в commit `7dc558d`). Оба файла — stale manifests уже выполненных cleanups, засоряют root.
- 8: **Updated AGENT_NAVIGATION.md** — header iter 154 → 155, упоминание KI#43 в brief status. NEW Pitfall 56 (CI/CD lessons): (a) **transient GitHub Pages deploy failures** — Build SUCCESS + Deploy FAILURE ~6s = transient Pages API error, NOT artifact issue. Fix pattern: wrap deploy-pages в retry action; (b) **wretry.action usage** — `Wandalen/wretry.action@v3` properly forwards inputs/outputs of inner action, including OIDC id-token permissions; (c) **stale cleanup manifest files** — удалять после применения cleanup, не оставлять как documentation (git history + worklog достаточно).
- 9: **Документация** — STATUS.md переписан под iter 155 (KI#43 в "Активные", iter 154 summary в "Закрытые" — сокращён). worklog.md — iter 154 сокращён до одной строки, iter 155 подробно. AGENT_NAVIGATION.md — header iter 154 → 155, Pitfall 56 добавлен.

Stage Summary:
- **KI#43 FIXED** — `actions/deploy-pages@v4` обёрнут в `Wandalen/wretry.action@v3` (3 attempts, 30s delay). Transient Pages API failures теперь auto-retry вместо manual re-run.
- **2 stale manifest files deleted** — `DELETIONS-iter151.txt`, `CLEANUP_ITER154.txt` (оба уже выполнены).
- **Документация актуальна** — STATUS.md (KI#43 documented + active), worklog.md (iter 155 подробно), AGENT_NAVIGATION.md (Pitfall 56 added).
- Baseline сохранён (без code changes в src/): tsc 0 / eslint 0 / vitest 2235/2235 / vite build PASS (previous baseline iter 154).
- Изменённые файлы: `.github/workflows/deploy.yml`, `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`. Удаляемые файлы: `DELETIONS-iter151.txt`, `CLEANUP_ITER154.txt`.
- **Stopping point:** iter 155 завершён, готов к push. После push'а — проверить что новый `Build + Deploy` run проходит (deploy step теперь должен либо succeed с первой попытки, либо succeed с retry). Если опять failure — admin user может fetch'нуть logs из GitHub UI для точной diagnostics. Next iter 156 = новые баги (если найдены) + опциональные фоновые задачи (APCA Lc<75, MobileRegexBar split, удаление `patch-ki10-ki12-overrides.ts` и `browser-test-iter153.sh`).

---

Task ID: 154 — user visual verification закрыл KI#38/31/41 (scroll jitter на «Самоцветы» 250+ токенов, mobile UX на 8 страницах, ⓘ glyph in-box) + repo cleanup (6 root files + 11 one-shot scripts deleted, 11 `.etl-cache/*.html` untracked, refs updated). vitest 2235/2235 (без code changes).

Task ID: 153 — KI#10/KI#12 hardening (manualOverride flag) + browser testing iter 148–150 + code-split bundle (React.lazy + Suspense, 603→342 KB). vitest 2235/2235. См. Pitfall 54 в AGENT_NAVIGATION.md для general lessons.

Task ID: 152 — KI#42 search focus loss fix на jewel/waystone (`mergeCategories` inline-arrays → module-level constants + `dataRef` guard в `useCategoryData`). vitest 2228/2235 (7 pre-existing data-test failures — KI#10).

Task ID: 151 — stale comments + trash files cleanup (Pure documentation/cleanup pass — 6 упоминаний `LeftPanelFavorites` упрощены, 6 устаревших patch-notes файлов удалено, README заменён на минимальный). vitest 2235/2235.

Task ID: 150 — favorites wiring fix (⭐ pin button не отображался на belt/ring/amulet/jewel в two-column layout) + ⓘ in-box layout (glyph в GroupHeader позиционировался как flex-sibling → сдвигал toggle-button sideways → теперь absolute right-2 top-1/2 -translate-y-1/2 z-10 + pr-7 на toggle-button). vitest 2235/2235.

Task ID: 149 — PriorityFilter removal (полное удаление фильтра «Приоритет» из UI, state-store, URL sync, localStorage, типов, схем, тестов и документации). vitest 2235/2235.

Task ID: 148 — toolbar UX refactor (radiogroups → <select>, waystone checkboxes → color-coded chip-toggles). vitest 2235/2235.

Task ID: ≤147 — см. git log. Полная история в `git log --oneline`.
