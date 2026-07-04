# iter 162 — KI#49 fix + ⓘ glyph на MIXED chip

> Архив содержит изменённые файлы для слияния с локальной директорией
> репозитория https://github.com/vudirvp-sketch/poe2-regex-ru.

## Что в архиве

Структура папок повторяет структуру репозитория. Скопируйте файлы
поверх локальной копии репозитория (с заменой существующих).

### Изменённые файлы (9)

| Файл | Что изменилось |
|------|----------------|
| `src/ui/hooks/category-ast-utils.ts` | KI#49 fix — добавлен опциональный параметр `excludeTokens: GameToken[] = []` в `buildMixedAstFromSelections`. `excludedTokens` теперь собирается из 3 источников с dedup по ID. |
| `src/ui/hooks/useCategoryPage.ts` | KI#49 fix — call site в `useRegexBuilder` (MIXED branch) передаёт `selectedTokens.filter(t => excludedIds.has(t.id))` как `excludeTokens`. |
| `src/ui/components/CategoryControlPanel.tsx` | UX — импортирован `Tooltip`, parent radiogroup получил `items-center`, после MIXED `<button>` добавлен sibling `<Tooltip>` (ⓘ glyph, hover 350ms). |
| `src/shared/i18n.ts` | UX — новый ключ `logic.mixed_aria` (aria-label для ⓘ glyph). |
| `tests/ui/buildMixedAst.test.ts` | +3 regression теста для KI#49: positive case (T3 scenario), backward-compat (documents the bug), dedup edge case. |
| `STATUS.md` | Заголовок iter 162, §«Текущее состояние» переписан, KI#49 в Known Issues, KI#48 обновлён, таблица ограничений, Next iteration (iter 162→163). |
| `worklog.md` | +iter 162 запись (Task ID: iter-162, Work Log, Stage Summary). |
| `AGENT_NAVIGATION.md` | Header (current state) обновлён до iter 162. |
| `docs/MIXED_MODE_UI_TESTS.md` | Заголовок обновлён (прогоны iter 161–162), статус прогона T1–T10 в начале, T3 — детальный результат (FAIL → FIX). |

### Дополнительно

| Файл | Что это |
|------|---------|
| `iter162.diff` | Полный diff всех изменений (для ревью). |

## Как применить

```bash
# Из корня локальной копии репозитория poe2-regex-ru:
unzip /path/to/iter162.zip -d /tmp/iter162-extract
cp -r /tmp/iter162-extract/iter162/* .
git add -A
git status  # проверить, что 9 файлов изменено
```

## Git-команды для коммита и push

```bash
git add -A
git commit -m "iter 162: KI#49 fix (pure-EXCLUDE in MIXED) + ⓘ glyph on MIXED chip

- Fix KI#49: pure-EXCLUDE token (only in excludedIds, not in must/opt)
  was silently dropped from !BAD block in MIXED mode. T3 failed:
  expected \"!хаосу\" \"меткости\" \"регенерации маны\", actual
  \"меткости\" \"регенерации маны\" (without !хаосу).

  Root cause: buildMixedAstFromSelections computed excludedTokens by
  filtering mustTokens/optTokens against excludedIds. But useRegexBuilder
  filters mustTokens by selectedIds and optTokens by optionalIds —
  pure-exclude tokens never entered either list.

  Fix: new optional param excludeTokens: GameToken[] in
  buildMixedAstFromSelections. Call site passes
  selectedTokens.filter(t => excludedIds.has(t.id)). 3 regression
  tests in tests/ui/buildMixedAst.test.ts (positive + backward-compat
  document-the-bug + dedup edge case).

- UX: explicit ⓘ glyph as sibling of MIXED chip button. Hover 350ms
  opens Tooltip with explanation of shift+click (OPT) and right-click
  (EXCLUDE) gestures. Before iter 162 these gestures were hidden
  (only the native title attr on the chip revealed them).

- New i18n key: logic.mixed_aria (aria-label for the ⓘ glyph).

- Documentation: STATUS.md, worklog.md, AGENT_NAVIGATION.md,
  docs/MIXED_MODE_UI_TESTS.md updated.

All checks PASS: tsc 0, eslint 0, vitest 2318/2318, vite build PASS."

git push origin main
```

## Точка остановки

**iter 162 завершён.** Все 3 задачи пользователя выполнены:
1. ✅ T3 bug fixed (KI#49) — pure-EXCLUDE больше не теряется.
2. ✅ ⓘ glyph добавлен на MIXED chip с delayed tooltip.
3. ✅ Документация актуализирована.

**Что НЕ сделано (для iter 163):**
- Повторный прогон T3 пользователем (после применения iter 162) —
  должен теперь PASS.
- Прогон T6–T10 (T6 пользователь пропустил в iter 161).
- Заполнить UX Feedback Checklist (§4 в docs/MIXED_MODE_UI_TESTS.md).
- Закрыть KI#48 — отметить PASS/FAIL, обновить STATUS.md.
- Если ⓘ glyph на MIXED chip мешает или tooltip непонятен — polish.
- Фоновые задачи: APCA, MobileRegexBar split, удаление one-shot скриптов,
  KI#47 cross-suppression (low priority), KI#43 deploy retry confirmation.
