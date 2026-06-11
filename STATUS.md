# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ полная (включая пороги, {N,}, обрезки, negation)
> **Тесты:** ✅ 802/802 | **Build:** ✅ | **!important:** 0

---

## Текущая итерация (11): Кодовая реализация — ЗАВЕРШЕНА

### Реализованные возможности

| # | Фишка | Статус | Файлы |
|---|-------|--------|-------|
| 1 | `\d{3,}` вместо `[0-9][0-9][0-9]` | ✅ Реализовано | `number-regex.ts` |
| 2 | `\d{2,}` вместо `[0-9][0-9][0-9]?` (исправлен баг `?`) | ✅ Реализовано | `number-regex.ts` |
| 3 | Threshold mode в компиляторе | ✅ Реализовано | `compiler.ts`, `ast.ts`, `types.ts` |
| 4 | Truncated tail optimizer (Phase 3) | ✅ Реализовано | `optimizer.ts` |
| 5 | `{N,}` квантификатор в PoE2 regex матчере | ✅ Реализовано | `poe2-regex-matcher.ts` |
| 6 | 4+ digit поддержка в threeDigitMin | ✅ Реализовано | `number-regex.ts` |

### Детали реализации

**A. `\d{3,}` и `\d{2,}` в generateNumberRegex:**
- Все вхождения `[0-9][0-9][0-9]` (означающие «любое 3+ значное число») заменены на `\d{3,}`
- Баг: `[0-9][0-9][0-9]?` использовал `?` который НЕ поддерживается в PoE2 → заменён на `\d{2,}`
- Экономия: 9 символов на каждый ≥100 паттерн, + исправление корректности для однозначных ≥N
- Добавлена поддержка 4+ значных чисел: `\d{4,}` в threeDigitMin для ≥200, ≥300, ≥900

**B. Threshold mode в компиляторе:**
- Новый флаг `threshold?: boolean` в RANGE AST-узле
- Когда `threshold=true`: RANGE(min, max) компилируется как ≥min (одна группа)
- Обходит AND fallback для широких диапазонов — короче и без FP
- Вербованная in-game: пороговые паттерны `([X-Y]\d|\d{3,})%` не дают FP от диапазонной нотации

**C. Truncated tail optimizer (Phase 3):**
- Безопасный список: `эффективн`, `бездн`, `путев`, `глубин`
- Чёрный список: `редкост` (FP на rarity label), `редк`, `провал`
- Функция `truncateSuffix()` — усекает суффиксы в LITERAL и RANGE узлах
- Функция `isTruncationSafe()` — проверка безопасности усечения
- Сортировка по длине: сначала длинные совпадения (`эффективность монстров` перед `эффективность`)

**D. PoE2 regex matcher `{N,}` поддержка:**
- Добавлен токен `quantifierMin` и AST-узел `repeatMin`
- Матчер корректно обрабатывает `\d{3,}`, `\d{2,}`, `\d{4,}`

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser doesn't extract modCode for jewels → `jewelType` always "shared" | Open | Low |
| 2 | Enumerated ranges can FP on range notation numbers | Mitigated by `^`/`%` anchors + threshold mode | Edge case |
| 3 | `редкост` FP на item rarity label | Mitigated by blacklist в optimizer | Medium — truncated-tail optimizer блокирует |

---

## Что делать дальше

1. **Протестировать `\+` привязку** на путевых камнях с implicit-блоками (нужен in-game тест)
2. **Sign prefix поддержка** — `\+` и `-` перед числом в компиляторе (паттерны `+хх бла`, `-хх% бла`)
3. **Middle-number паттерны** — число в середине текста (`бла бла хх% бла бла`)
4. **Threshold mode в UI** — добавить переключатель threshold/enumeration в интерфейс
5. **Расширить truncated tail safe list** — добавить новые безопасные обрезки по результатам in-game тестов

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
