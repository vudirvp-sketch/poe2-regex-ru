# Worklog

---
Task ID: 31
Agent: main
Task: Исправление багов B1–B5 по результатам аудита

Work Log:
- B1: Добавлен resolve.alias в test секцию vite.config.ts — vitest теперь резолвит @core, @shared и др.
- B2: Проверен — FilterStoreApi уже экспортирован (export interface), баг ложный
- B3: Удалён package-lock.json (оставлен pnpm-lock.yaml как единый lock-файл)
- B4: Добавлен .etl-cache/ в .gitignore (кэш HTML лежит в корне, не в scripts/etl/.cache/)
- B5: Заменён ()? на (|) во всех местах dp-factorizer.ts — PoE2 не поддерживает ? квантификатор
  - dpFactorizeByPrefix: prefix(alt1|alt2|)? → prefix(alt1|alt2|)
  - dpFactorizeBySuffix: (alt1|alt2)?suffix → (alt1|alt2|)suffix
  - dpFactorizeCombined: prefix(middle|)?suffix → prefix(middle|)suffix
  - tryMergeAlternatives: shorter(ь)? → shorter(ь|)
  - Обновлены комментарии в dp-factorizer.ts и compute-optimizations.ts (ь? → (ь|))
- Запущены тесты: 761/761 пройдены (25/25 файлов) ✅
- Обновлён STATUS.md — отмечены исправленные баги
- Обновлён worklog.md

Stage Summary:
- 4 из 5 багов исправлены (B2 оказался ложным — FilterStoreApi уже экспортирован)
- Все тесты проходят
- Техдолг D1–D4 не тронут — следующая итерация
