# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 108
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 108 + post-fix audit: вложенные кавычки в OR-регексах устранены. UI-аудит v2 проведён.**

### Regex-движок: стабилен

- 1543/1543 тестов (vitest). TSC 0 errors. ESLint 0 problems.
- iter 108 фикс глобально эффективен (0 критических нарушений по всем 10 категориям).

### UI-аудит v2 (2026-06-21): найдены проблемы

Полный аудит → `docs/UI_AUDIT.md`. Краткое резюме:

**Критические (Приоритет 1):**
1. `--text-primary: #ffffff` — halation на dark bg (контраст 18.3:1, рекомендован ≤ 15:1). Заменить на `#F0E6D2`.
2. `--text-faint (#4b5563)` — контраст 3.5:1 на #0D0B09 → **FAIL WCAG AA** (нужно ≥ 4.5:1). Осветлить до `#7C8494`.
3. Тексты 10px (StatusPanel, ProfilePanel) — **FAIL WCAG AA**. Минимум → 12px.
4. Тексты 11px (TopNav subtitle, RegexOutput part label, chip badges) — трудночитаемы в dark mode. Минимум → 12px.
5. `.topnav-brand-title` font-weight 700 → 600 (dark mode bleed).

**Рекомендуемые (Приоритет 2):**
6. Подключить Noto Sans (400/500/600, Cyrillic+Latin subset).
7. Увеличить `--poe-bg-secondary` до `#1A1510` (luminance-разделение).
8. `body { line-height: 1.6; letter-spacing: 0.01em; }` для dark mode.
9. ProfilePanel `bg-btn-primary` → `btn-cta` (палитровая консистентность).

**Улучшения (Приоритет 3):**
10. `font-feature-settings: "tnum"` для числовых элементов.
11. Noto Sans Mono для regex display.
12. APCA-валидация контрастов.
13. `--text-dim-val` осветлить до `#7A8494`.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **UI: --text-primary #ffffff halation** — высокий контраст 18.3:1, нужен off-white.
4. **UI: text-faint FAIL WCAG AA** — контраст 3.5:1 на dark bg, минимум 4.5:1.
5. **UI: 10–11px тексты** — ниже WCAG-минимума для dark mode, повысить до 12px.
6. **UI: btn-primary (#2563eb) в ProfilePanel** — холодный синий в тёплой палитре.

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
