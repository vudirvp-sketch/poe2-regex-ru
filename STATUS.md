# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 936/936 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 21 — Tests & deploy fix

### Сделано в итерации 21

**1. Деплой починен:**
- `pnpm-lock.yaml` обновлён — добавлена пропущенная зависимость `zod`
- `package-lock.json` удалён (проект использует pnpm)
- `.gitignore` обновлён — `package-lock.json` исключён
- `deploy.yml` — улучшены шаги corepack

**2. React component tests (47 тестов):**

| Компонент | Файл | Тестов | Покрытие |
|-----------|------|--------|----------|
| `PageStateWrapper` | `tests/ui/PageStateWrapper.test.tsx` | 9 | loading/error/no-data/render-prop, приоритеты состояний |
| `RegexOutput` | `tests/ui/RegexOutput.test.tsx` | 17 | health bar (green/yellow/red), overflow, copy, auto-copy, budget warning, ARIA |
| `FilterChip` | `tests/ui/FilterChip.test.tsx` | 21 | 5 состояний, ARIA, toggle, exclude, tier count, 2x badge, range text, ⚡⚓ indicators, keyboard |

**3. ETL Zod-схемы + тесты (19 тестов):**

| Схема | Назначение |
|-------|------------|
| `RawModTierSchema` | Валидация tiers на входе ETL (level ≥ 0, affix prefix|suffix) |
| `RawModGroupDataSchema` | Валидация групп (genGroup ≠ '', tiers ≥ 1) |

**4. sanitizeJsObjectLiteral() — unit tests (23 теста):**
- Trailing commas (nested, whitespace)
- Unquoted keys (underscore, dollar, numeric suffix)
- Single-quoted strings (keys, values, empty)
- Combined transformations (poe2db-like data)
- Already-valid JSON passthrough

**5. parseTypeBPage() — ETL coverage (17 тестов):**
- 6 origins (normal, corrupted, desecrated, essence, breach, perfect_essence)
- Family grouping, maxLevel, tags, modCode extraction
- Empty categories, missing ModsView, empty descriptions

### Инфраструктура тестов
- `jsdom` + `@testing-library/jest-dom` добавлены в devDependencies
- `tests/setup.ts` — автоматическое подключение jest-dom матчеров
- `vite.config.ts` — `include: ['tests/**/*.test.{ts,tsx}']`, `setupFiles`, per-file environment override

---

## План рефакторинга

| # | Область | Приоритет | Суть | Статус |
|---|---------|-----------|------|--------|
| 1 | ETL compute-regex | **Высокий** | Разбить на модули | ✅ Done (iter 18) |
| 2 | Core optimizer | **Средний** | Разбить optimizer.ts на 3 модуля | ✅ Done (iter 19) |
| 3 | Data layer | **Средний** | Zod-схемы для CategoryData | ✅ Done (iter 20) |
| 4 | Security | **Средний** | Убрать `new Function()` | ✅ Done (iter 20) |
| 5 | Tests | Низкий | React component tests; расширить ETL coverage | ✅ Done (iter 21) |

---

## Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
3. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только.
4. **`.*` does NOT cross block boundaries** — Cross-block → AND (`"X" "Y"`).
5. **Substring search** — PoE2 regex = substring match. Truncated words work if the prefix is unique.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
