# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 110
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 110: реализованы Приоритет 2.7–2.9 + Приоритет 3.10–3.13 аудита v2.**

### Regex-движок: стабилен (без изменений с iter 108)

- **1543/1543 тестов** (vitest). TSC 0 errors. ESLint 0 problems.
- Все три проверки запущены после iter 110 правок — регрессий нет.

### UI iter 110 — Приоритет 2 (3 пункта) + Приоритет 3 (4 пункта)

| # | Правка | Файл | Эффект |
|---|--------|------|--------|
| 2.7 | `--poe-bg-secondary`/`--panel-bg` `#15110E` → `#1A1510` | `src/index.css` | Luminance Δ 0.007→0.012 (≥0.01 порог Material/NN/g) |
| 2.8 | `body { line-height: 1.6; letter-spacing: 0.01em; }` + mono reset | `src/index.css` | Dark mode ergonomics, кириллица breathing |
| 2.9 | ProfilePanel `bg-btn-primary` → `btn-cta` | `src/ui/components/ProfilePanel.tsx` | Палитровая консистентность (Pitfall 28 закрыт) |
| 3.10 | `font-feature-settings: "tnum"` на body | `src/index.css` | Tabular nums для counts/ranges — нет jitter |
| 3.11 | `--font-mono` переопределён: `'Noto Sans Mono', ui-monospace, ...` | `src/index.css` `@theme` | Системный Noto Sans Mono первым (Linux), без self-host overhead |
| 3.12 | APCA-валидация 18 пар | `scripts/apca_validate_iter110.py` | См. секцию "APCA-результаты" ниже |
| 3.13 | `--text-dim-val` `#6b7280` → `#7A8494` | `src/index.css` | WCAG AA на `--input-bg` (4.2→5.2:1), APCA Lc +8.3 |

### APCA-результаты (iter 110)

**PASS (|Lc| ≥ порог):**
- `text-primary` (#F0E6D2) на всех bg: **Lc=-97.4** (body text ≥75 ✓)
- `text-soft` (#d1d5db) на `--poe-bg`: Lc=-86.5 (body text ✓)
- `accent-yellow` на `--input-bg`: Lc=-84.2 (body text ✓)

**Улучшено, но не достигает APCA-порога для small text (≥90):**
- `text-dim NEW` (#7A8494) на `--poe-bg`: **Lc=-42.8** (было -34.5, +8.3)
- `text-dim NEW` на `--input-bg`: **Lc=-42.8** (было -34.5, +8.3)
- `text-faint` (#7C8494) на `--poe-bg`: Lc=-43.0

Скрипт: `scripts/apca_validate_iter110.py` (+ сохранённый вывод `scripts/apca_iter110_results.txt`).

### Что осталось из аудита

| # | Действие | Файл | Обоснование | Статус |
|---|----------|------|-------------|--------|
| — | Визуальная верификация в браузере | — | Пользователь должен проверить UI: контрасты, читаемость 12px текста, рендеринг Noto Sans (особенно на Linux) | ⬜ |

Все 13 пунктов аудита v2 реализованы (Приоритет 1 в iter 109, Приоритет 2+3 в iter 110). Остаётся только визуальная верификация пользователем.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **`--placeholder-secondary: #4b5563`** — не входил в P1.2/3.13. Контраст 3.5:1 на `--input-bg`, APCA Lc=-21.3. Применяется только к placeholder-тексту. Рассмотреть осветление в iter 111.
4. **`--text-dim-val` (#7A8494) и `--text-faint-val` (#7C8494) перцептивно идентичны** (Δ < 1% luminance) — историческая иерархия dim=gray-500>lighter>faint=gray-600>darker инвертирована. Оба токена сейчас на уровне gray-400. План iter 111: либо (a) поднять faint до ~#8E96A4 (gray-350), либо (b) консолидировать dim+faint в один `--text-secondary` токен.
5. **APCA-порог Lc≥90 для small text не достигнут** для `text-dim`/`text-faint`/`text-muted`/`accent-blue`/`accent-red`/`accent-emerald` на тёмных фонах. WCAG 2.x AA проходит (контраст ≥4.5:1), но APCA строже — это тот самый "false pass", о котором предупреждал аудит (секция 5.1). Решение: либо дальнейшее осветление токенов, либо изменение размеров/весов шрифта для compensating perceptual contrast.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---

Контакты: Discord **woonderdad**
