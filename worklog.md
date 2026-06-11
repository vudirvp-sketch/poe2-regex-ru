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
- Запущены тесты: 761/761 пройдены (25/25 файлов) ✅

Stage Summary:
- 4 из 5 багов исправлены (B2 оказался ложным)
- Все тесты проходят

---
Task ID: 32
Agent: main
Task: Технический долг D1–D4

Work Log:
- D3: profileCounter — заменён `let profileCounter = 0` на `deriveNextCounter()`, который вычисляет следующий счётчик из существующих ID профилей. Больше не зависит от памяти модуля.
- D1: VendorPage рефакторинг — создан хук `useVendorPage.ts` с полной бизнес-логикой (state, URL sync, regex compilation). VendorPage стал чистым рендер-компонентом. Извлечены чистые функции `buildVendorRegex()` и `groupVendorProperties()`.
- D4: DIALECT_PAIRS — удалена пара `['о', 'в', 'ов']` (не фонологическая). Остальные пары подтверждены анализом данных (только `карт[ые]` в реальных данных).
- D2: CSS variables — добавлены `--lt-*` CSS variables для всех light-theme цветов. Хардкоженные значения в `!important` правилах заменены на `var(--lt-*)`. Сами `!important` сохранены (необходимы для перебивания Tailwind), но все значения централизованы.
- B6: Исправлен `pnpm build` — рефакторинг vite.config.ts: alias-конфиг вынесен в переменную, `test` получает его через spread.
- Запущены тесты: 761/761 ✅
- Build: ✅ проходит

Stage Summary:
- Весь техдолг D1–D4 закрыт
- 761 тест проходят, build проходит
- Документация обновлена (STATUS.md, AGENT_NAVIGATION.md, worklog.md)
