# PoE2 Regex RU — Iter 45 Archive (analysis-only)

## What's inside

Этот архив содержит **только обновлённую документацию** для слияния с локальной директорией. Код НЕ менялся (principle: «лучше недоделать, чем сломать»).

Сохранена структура папок для прямого merge.

## Changed files (4 docs only)

### Documentation (4 files)
- `STATUS.md` → iter 45 section, root cause FP с «Приспеш», proposed fix для iter 46, optimal-use audit table, Known Issues обновлены (5 issues prioritized)
- `AGENT_NAVIGATION.md` → v31, §5 iter 45 added, §9 `(?!…)` ⚠️ forward-only + `^` в OR ⚠️ UNVERIFIED, §11 Pitfall 12 REWRITTEN (forward-only semantic + iter 46 proposed fix), §11 Pitfall 16 EXPANDED (simulator gap), §11 Pitfall 22 ADDED (`^`-anchor underused), §12 iter 45 note
- `docs/IN_GAME_TESTS.md` → iter 45 FINDING block (root cause, simulator gap, proposed fix) + iter 46 in-game test plan (3 tests: A/B/C), dialect table updated, syntax rule 10 added
- `worklog.md` → Task ID 45 (этот), Task 44 сжат в Stage Summary, Older iterations (43 и ранее) сжаты

### Removed
- `README_ITER44.md` — устарел, заменён на `README_ITER45.md` (этот файл)

## How to apply

### Option 1: Merge with local working copy
```bash
# Из корня локального репозитория poe2-regex-ru:
unzip iter45.zip -d /tmp/iter45
cp -r /tmp/iter45/* ./   # скопирует 4 doc файла с сохранением структуры
rm README_ITER44.md 2>/dev/null  # удалить устаревший файл (если есть)
```

### Option 2: Git apply
Используй git-команды ниже для commit + push.

## What was done (iter 45)

### User-reported FP (post-iter 44)

Пользователь in-game проверил regex iter 44:
```
"повышение скорости атаки(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми)|перезарядки умений|передвижения|атаки копьями"
```

Регекс **подсветил нужные аффиксы**, но **также подсветил сапфиры** с аффиксом «Приспешники имеют х% повышение скорости атаки и сотворения чар» — FP с minion-вариантом остался.

### Root cause: `(?!…)` is FORWARD-ONLY

`(?!.*X)` lookahead в PoE2 проверяет текст **только ВПЕРЁД** от текущей позиции (позиция курсора — сразу после matched-суффикса «повышение скорости атаки»). `.*` из этой позиции захватывает только остаток блока — « и сотворения чар». В этом остатке «Приспеш» нет → lookahead проходит → FP.

В блоке «**Приспеш**ники имеют … повышение скорости атаки и сотворения чар» слово «Приспеш» стоит **ДО** суффикса — forward-only lookahead его не видит.

Lookbehind `(?<!…)` НЕ поддерживается в PoE2.

### Simulator gap

`src/core/poe2-regex-matcher.ts` НЕ токенизирует `(?!…)` вообще (токен `?` обрабатывается как `optional` quantifier). iter 44 regression test (optimizer.test.ts lines 888-968) проверял STRUCTURE скомпилированной строки (contains `(?!.*A)`, no nested quotes, length ≤250), а НЕ SEMANTIC behavior. Симулятор пропускал lookahead молча → FP не был пойман в тестах.

### User's intuition «медвежья услуга» — confirmed correct

Iter 44 заменил item-wide `!` (корректный semantic, но порождает nested quotes в OR-context) на per-block `(?!…)` (избегает nested quotes, но forward-only). Это trade-off, который ломается именно на кейсе пользователя (exclude ДО суффикса).

### Proposed fix for iter 46 (NOT YET IMPLEMENTED)

Одна строка в `src/core/compiler.ts` normalizeAst AND-in-OR transform:

```diff
- const mergedValue = `${literalChild.value}${lookaheads}`;
+ const mergedValue = `^${lookaheads}.*${literalChild.value}`;
```

Результат: `^(?!.*A)(?!.*B).*Z` вместо `Z(?!.*A)(?!.*B)`.

`^` анкер ставит курсор в начало блока → `.*` внутри lookahead покрывает ВЕСЬ блок (до и после позиции суффикса) → bidirectional exclude semantic.

| Метрика | iter 44 (текущий) | iter 46 (предложенный) |
|---------|-------------------|------------------------|
| Длина | 192 chars | 195 chars (+3) |
| Forward-excludes (топорами, луками…) | ✅ | ✅ |
| Backward-excludes (Приспеш до суффикса) | ❌ FP | ✅ |
| Nested quotes | нет | нет |
| ≤250 chars | ✅ | ✅ |

**Risk:** in-game verify нужен, что `^` работает внутри `|`-группы (применяется только к первой альтернативе). В docs `^` верифицирован только для single-quoted `"^28%"` (Phase 9b), не для `"^…|B|C"`.

### Optimal-use audit (iter 45)

| Паттерн | In-game verified | Оптимально? |
|---------|------------------|-------------|
| Path D | ✅ iter 41 | ✅ Да |
| `.*` within single block | ✅ iter 37 | ✅ Да |
| `\|` top-level | ✅ iter 38-41 | ✅ Да |
| `^` start-of-block | ✅ Phase 9b | ⚠️ **Только RANGE, не LITERAL с excludes** — упущенная возможность |
| `!` item-wide | ✅ iter 14 | ✅ Да (но не в OR-context) |
| `(?!…)` per-block | ⚠️ forward-only (iter 45) | ❌ **Не оптимально** — iter 44 без `^`-анкера |
| Number enumeration | ✅ Phase 9 | ✅ Да |
| Truncated stems | ✅ iter 37 | ✅ Да |
| Subset-skip opt-entry | n/a | ✅ Да |

### Verification

- `pnpm test` → 1106 passed (без изменений, код не трогался)
- `npx tsc -b` → 0 errors
- ETL не перегенерировался (код не менялся)

## Stop point — что сделано, на чём остановились

**Сделано:**
- ✅ Анализ проблемы (text report в чат, без PDF/DOCX)
- ✅ Root cause идентифицирован: `(?!…)` forward-only
- ✅ Simulator gap идентифицирован: `poe2-regex-matcher.ts` не моделирует `(?!…)`
- ✅ Подтверждена правильность интуиции пользователя про «медвежью услугу»
- ✅ Аудит использования всех in-game verified паттернов
- ✅ Предложен фикс для iter 46: `^(?!…).*Z` (одна строка в `compiler.ts`)
- ✅ Документация обновлена чисто (4 файла, без мусора)
- ✅ Все 1106 тестов проходят (код не тронут)
- ✅ iter 46 in-game test plan (3 теста: A/B/C) описан в `docs/IN_GAME_TESTS.md`

**Не сделано (намеренно — требует in-game verify перед внедрением):**
- **Внедрение фикса `^(?!…).*Z`** в `src/core/compiler.ts` — требует in-game verify `^` в OR-context
- **Обновление 4 iter 44 tests** под новый формат — будет сделано вместе с фиксом
- **Simulator extension** — добавить `(?!…)` tokenization в `poe2-regex-matcher.ts` (опционально, iter 47)
- **Char-limit auto-split** для 2 over-limit entries в jewel (опционально)

**Возможные следующие шаги:**
1. **iter 46 — In-game verify `^` в OR-context** по тест-плану в `docs/IN_GAME_TESTS.md`:
   - Тест A: `"^(?!.*Приспеш).*повышение скорости атаки"` — single-quoted baseline
   - Тест B: `"^(?!.*Приспеш).*повышение скорости атаки|перезарядки умений"` — OR-context, ключевой
   - Тест C: `"повышение скорости атаки(?!.*Приспеш)|перезарядки умений"` — control, должен давать FP
2. **iter 46 — Внедрить фикс** если Тест A+B PASS:
   - `src/core/compiler.ts` normalizeAst — одна строка
   - `tests/core/optimizer.test.ts` — обновить 4 iter 44 tests
   - Добавить 2 NEW tests для backward-exclude case (minion-блок data)
3. **iter 47 — Simulator extension** (опционально): добавить `(?!…)` tokenization

**For new chat:** читать `worklog.md` (Task ID 45), `STATUS.md` (iter 45), `docs/IN_GAME_TESTS.md` (iter 45 FINDING section с test plan для iter 46).
