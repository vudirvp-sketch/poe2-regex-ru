# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 109
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 109: реализован Приоритет 1 UI-аудита v2 (5 правок CSS/JSX) + подключён Noto Sans.**

### Regex-движок: стабилен (без изменений с iter 108)

- **1543/1543 тестов** (vitest). TSC 0 errors. ESLint 0 problems.
- iter 108 фикс (вложенные кавычки в OR-регексах) — 0 критических нарушений по 10 категориям.
- Все три проверки (`tsc -b`, `vitest run`, `eslint .`) запущены после iter 109 правок — регрессий нет.

### UI iter 109 — Приоритет 1 (все 5 пунктов выполнены)

| # | Правка | Файл | Эффект |
|---|--------|------|--------|
| 1 | `--text-primary: #ffffff` → `#F0E6D2` | `src/index.css` | Halation ↓, контраст 18.3→13.5:1 |
| 2 | `--text-faint-val: #4b5563` → `#7C8494` | `src/index.css` | WCAG AA FAIL → PASS (3.5→6.5:1) |
| 3 | Все `10px` → `12px` | StatusPanel, ProfilePanel, JewelPage, VendorPage, TabletPage | WCAG AA PASS |
| 4 | Все `11px` → `12px` | TopNav, RegexOutput, FilterChip, index.css | Читаемость ↑ |
| 5 | `.topnav-brand-title` weight `700` → `600` | `src/index.css` | Dark mode bleed ↓ |

### UI iter 109 — Noto Sans подключён (Приоритет 2.6, опережая план)

- Self-hosted woff2 subsets (Cyrillic + Latin + core punctuation/currency), 3 веса (400/500/600).
- Файлы: `public/fonts/NotoSans-{400,500,600}.woff2` (≈ 40 KB каждый, 132 KB total).
- `@font-face` блок в начале `src/index.css`, `font-display: swap`.
- `body { font-family: 'Noto Sans', system-ui, ... }` — Noto Sans первым, system stack как fallback.

### Что осталось из аудита (Приоритет 2 + 3)

| # | Действие | Файл | Обоснование |
|---|----------|------|-------------|
| 7 | `--poe-bg-secondary` `#15110E` → `#1A1510` | index.css | Luminance-разделение Δ=0.012 |
| 8 | `body { line-height: 1.6; letter-spacing: 0.01em; }` | index.css | Dark mode ergonomics |
| 9 | ProfilePanel `bg-btn-primary` → `btn-cta` | ProfilePanel.tsx | Палитровая консистентность |
| 10 | `font-feature-settings: "tnum"` | index.css | Tabular stability для чисел |
| 11 | Noto Sans Mono для regex display | index.css + index.html | Визуальная согласованность |
| 12 | APCA-валидация контрастов | ручная проверка | Подготовка к WCAG 3.0 |
| 13 | `--text-dim-val` `#6b7280` → `#7A8494` | index.css | Контраст на `--input-bg` |

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **UI: `--placeholder-secondary: #4b5563`** — не входил в P1.2, оставлен как есть. Контраст 3.5:1, но применяется только к placeholder-тексту (не persistent copy). Рассмотреть осветление в Приоритете 3.

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
