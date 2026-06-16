# PoE2 Regex RU — Iter 46 Archive

`^(?!…).*Z` bidirectional exclude — **IMPLEMENTED + IN-GAME VERIFIED** (Tests A+B PASS, Test C confirms root cause).

## What's inside

Архив содержит **только изменённые/новые файлы** для слияния с локальной директорией. Структура папок сохранена.

### Modified (7 files)
- `src/core/compiler.ts` — one-line fix в `normalizeAst` (AND-in-OR transform): `Z(?!…)` → `^(?!…).*Z`. Docstring обновлён.
- `tests/core/optimizer.test.ts` — 4 iter 44 tests обновлены под новый формат `^(?!…).*Z` + 2 NEW backward-exclude regression tests (minion-блок data). +3 structural assertions в end-to-end regression test.
- `worklog.md` — Task ID 46 (этот), Task 45 сжат в Stage Summary.
- `STATUS.md` — iter 46 section (in-game verification table, fix diff, optimal-use audit, Known Issues: 2 closed, 3 remain).
- `AGENT_NAVIGATION.md` — v32 (§5 iter 46 added, §9 `^` в OR ✅ verified, §9 `(?!…)` ✅ bidirectional, §11 Pitfall 12/22 updated — fix IMPLEMENTED, §12 iter 46 note).
- `docs/IN_GAME_TESTS.md` — iter 46 VERIFICATION block (Tests A/B/C results), dialect table updated, syntax rule 10 updated.
- `docs/ARCHITECTURE.md` — §3 (Path D history) iter 46 note added, dialect table `(?!…)` updated, syntax rule 8 + alternative-strategy example updated.

### Deleted (1 file)
- `README_ITER45.md` — устаревший архивный файл iter 45 (заменён worklog + STATUS). См. `DELETIONS.txt`.

## How to apply

### Option 1: Merge with local working copy
```bash
unzip iter46.zip -d /tmp/iter46
cp -r /tmp/iter46/* ./
rm README_ITER45.md 2>/dev/null
```

### Option 2: Git apply
Используй git-команды ниже для commit + push.

## Verification
- `npx vitest run` → 1108 passed (1106 baseline + 2 NEW iter 46 tests)
- `npx tsc -b` → 0 errors
- Inline verify (user scenario): 195 chars ≤250 ✅

## Точка остановки
iter 46 COMPLETE. Возможные следующие шаги (iter 47):
1. Simulator extension (опционально): добавить `(?!…)` tokenization в `poe2-regex-matcher.ts`. Закроет Known Issue #2.
2. Production ETL rerun (опционально): `pnpm etl:fresh` (не обязательно — compiler fix применяется на лету).
3. Pitfall 11 fix (low priority): AND-in-OR с multi-LITERAL + EXCLUDE — сейчас даёт nested quotes.

**For new chat:** читать worklog.md (Task ID 46), STATUS.md (iter 46), docs/IN_GAME_TESTS.md (iter 46 VERIFICATION section), AGENT_NAVIGATION.md v32.
