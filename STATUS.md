# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ | **Cross-family FP:** 0
> **Тесты:** ✅ 778/778 | **Build:** ✅ | **!important:** 0

---

## Текущая итерация (8): Визуальная проверка dark/light + VendorPage фиксы

### Что сделано

| # | Задача | Результат |
|---|--------|-----------|
| 1 | VendorPage: ≥{value} в displayText | При установленном min-значении через perTokenRange, числовой чип показывает «Ур. предмета ≥75» вместо «Ур. предмета ≥N». Замена работает для обоих числовых свойств (itemLevel, charLevel) |
| 2 | CategoryControlPanel: overflow counter | Добавлен счётчик активных токенов (selected + excluded) рядом с индикатором excluded. Показывает «N выбрано» при activeTokenCount > 0 на всех 8 страницах |
| 3 | Light theme: indicator backgrounds | Добавлены light-theme overrides для indicator-green/yellow/red (0.2 opacity вместо 0.15) и section-* (0.12 вместо 0.1) для лучшей видимости на белом фоне |
| 4 | Light theme: form elements | Добавлены light-theme стили для checkbox, control panel background, regex output background. Формы корректно отображаются в светлой теме |
| 5 | VendorPage: regex equivalence tests | 17 тестов в `tests/ui/vendor-regex-equivalence.test.ts` проверяют корректность regex output через buildAstFromSelections. Выявлены 2 отличия от legacy buildVendorRegex (см. ниже) |
| 6 | Opacity-токены проверены | ⚡ (amber-soft), ⚓ (blue-soft), 2x (amber-mid), 1е/2е (blue-mid/orange-mid) — все работают в dark/light темах через CSS custom properties |
| 7 | Alert-блоки проверены | Vendor verification (section-yellow/aborder-yellow), jewel hidden mods (section-amber/aborder-amber), regex budget (section-amber/aborder-amber-strong) — корректны в обеих темах |
| 8 | Exclude-кнопки проверены | FilterChip exclude (✗/✓) использует bg-btn-danger/bg-raised — корректно в dark и light темах |

### Отличия от legacy buildVendorRegex (документированные)

| Отличие | Legacy (buildVendorRegex) | Новый (buildAstFromSelections) | Статус |
|---------|--------------------------|-------------------------------|--------|
| Числовые свойства: порядок regex | `"50.*уровень предмета"` (number.*suffix) — НЕ работает в игре | `"уровень предмета.*50"` (suffix.*number) — работает в игре | ✅ Багфикс — reversed pattern корректен для PoE2 |
| AND-режим: несколько нечисловых свойств | `"качеств\|гнёзд"` — все wanted в одном OR (ANY) | `"качеств" "гнёзд"` — каждое свойство отдельно (ALL) | ⚡ Поведение изменено — true AND вместо OR-внутри-AND. OR-режим даёт legacy-поведение |

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser doesn't extract modCode for jewels → `jewelType` always "shared" | Open | Low |
| 2 | Enumerated ranges can FP on range notation numbers | Mitigated | Edge case |

---

## Следующая итерация

| # | Задача | Описание |
|---|--------|----------|
| N1 | Light theme: полная визуальная проверка в браузере | Пройти все 8 страниц, сделать скриншоты dark/light, исправить оставшиеся проблемы контрастности |
| N2 | VendorPage: AND-режим семантика | Решить: оставить true AND или добавить hybrid OR-внутри-AND для нечисловых свойств как в legacy? |
| N3 | Удалить useVendorPage.ts и VendorChip.tsx | Эти файлы больше не используются VendorPage — чистый dead code |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
