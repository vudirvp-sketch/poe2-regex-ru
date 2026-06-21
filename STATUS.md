# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 111
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 111: закрыты Known Issues #3, #4, частично #5 из аудита v2.**

### Regex-движок: стабилен (без изменений с iter 108)

- **1543/1543 тестов** (vitest). TSC 0 errors. ESLint 0 problems.
- Все три проверки запущены после iter 111 правок — регрессий нет.

### UI iter 111 — Known Issues #3, #4, #5

| # | Правка | Файл | Эффект |
|---|--------|------|--------|
| KI#3 | `--placeholder-primary` `#6b7280` → `#7A8494`; `--placeholder-secondary` `#4b5563` → `#7A8494` | `src/index.css` | WCAG AA FAIL 3.6:1 / 2.3:1 → PASS 4.6:1 / 4.6:1 на `--input-bg`. APCA Lc -32.5 / -16.6 → -43.6 / -43.6 |
| KI#4 | `--text-faint-val: var(--text-dim-val)` (alias); все 4 `text-faint` → `text-dim` в TSX | `src/index.css`, `ProfilePanel.tsx`, `StatusPanel.tsx`, `CategoryControlPanel.tsx` | Устранена инверсия иерархии dim/faint. Токен `--text-faint-val` сохранён как backwards-compat alias |
| KI#5 | `font-medium` (weight 500) добавлен к 2 критичным 12px text-dim лейблам в RegexOutput (part_label + auto-copy toggle) | `src/ui/components/RegexOutput.tsx` | APCA threshold для этих лейблов: 90 → 75 (Lc=-43.6, FAIL по-прежнему, но компенсация perceptual contrast). См. "APCA-метрики" ниже |

### APCA-метрики (iter 111)

Скрипт: `scripts/apca_validate_iter111.py` (+ сохранённый вывод `scripts/apca_iter111_results.txt`).
Каноническая APCA 0.0.98G (polarity-aware, soft-clamp ±108).

**PASS (|Lc| ≥ порог):**
- `text-primary` (#F0E6D2) на всех bg: **Lc=-108.0** (clamped, body ≥75 ✓)
- `text-soft` (#d1d5db) на `--poe-bg`: Lc=-108.0 (body ✓)
- `accent-yellow` на `--input-bg`: Lc=-107.5 (body ✓)

**PASS WCAG AA, FAIL APCA Lc≥90 для small text (≤14px, weight <500):**
- `text-dim` (#7A8494) на `--poe-bg` / `--input-bg`: WCAG 5.2:1 / 4.6:1 ✓, APCA Lc=-43.6
- `text-muted` (#9ca3af) на `--poe-bg`: WCAG 7.7:1 ✓, APCA Lc=-66.5
- `accent-blue` / `accent-red` / `accent-emerald` на `--poe-bg`: WCAG 7.1–10.2:1 ✓, APCA Lc -61..-87

**С weight 500 (iter 111 KI#5) — APCA threshold 90 → 75:**
- `text-dim` 12px w500 на `--poe-bg` / `--input-bg`: APCA Lc=-43.6, threshold 75 → FAIL по-прежнему (gap 31.4 вместо 46.4), но компенсация perceptual contrast

**См. секцию "Known Issues" ниже для объяснения фундаментального лимита APCA.**

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (бывший KI#5, реклассифицирован как **accepted design tradeoff**):
   - `text-dim` / `text-muted` / `accent-*` на тёмных фонах — WCAG 2.x AA проходит (≥4.5:1), но APCA строже.
   - **Фундаментальный лимит:** APCA Lc≥75 для visibly-dim текста на тёмном фоне математически невозможен без осветления до уровня `text-soft` (#d1d5db) — что разрушает визуальную иерархию.
   - **Текущая стратегия:** WCAG AA = практический compliance bar. Weight 500 применён к 2 наиболее attention-critical 12px лейблам (RegexOutput part_label + auto-copy toggle) для компенсации perceptual contrast. Остальные 12px text-dim элементы (page mod-counters в 8 файлах) остаются weight 400 как дизайн-выбор (secondary info не должна конкурировать с primary content).
   - **Опционально для будущих итераций:** рассмотреть lift `text-dim` до `#8A92A2` (APCA Lc ~-55) — но это нарушит визуальную дистанцию от `text-muted` (#9ca3af).

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
