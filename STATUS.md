# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 55 — UI Фаза 3 (возвышение `RegexOutput` до Level 1: gold border + glow)

---

## iter 55 — UI Фаза 3: RegexOutput Level 1

**Что:** `<RegexOutput>` получил визуальный Level 1 frame (золотая рамка + свечение + угловые акценты) — соответствует паттерну `.affix-header-*` (prefix/suffix/implicit), но использует золотой brand-accent (`--poe-gold` = `#C89A4A`). Цель — визуально выделить главную функциональную единицу каждой категорийной страницы.

**Изменения — чистый CSS + 2 строки в TSX:**

- `src/index.css` — добавлен блок `.regex-output` (Level 1 frame, gold):
  - Background: `linear-gradient(135deg, rgba(200,154,74,0.08) → 0.02), var(--poe-bg)` — тёплый gold-tint поверх базового bg.
  - Border: `1px solid rgba(200,154,74,0.35)` + `border-left: 3px solid var(--poe-gold)`.
  - Border-radius: `6px`, padding `12px` (mobile: `10px`).
  - Box-shadow: `0 0 0 1px rgba(200,154,74,0.06), 0 0 18px rgba(200,154,74,0.10)` — двойной glow (halo + aura).
  - Corner accents (`::before`/`::after`): золотые уголки 8×8px в TR/BL позициях (как у `.affix-header-*`).
- `src/ui/components/RegexOutput.tsx`:
  - Удалён inline `style={{ background: 'var(--poe-bg, #0a0a0f)' }}` — background теперь управляется CSS-классом.
  - Удалены Tailwind утилиты `-mx-1 px-1 py-1` (негативный margin + padding override) — padding теперь часть `.regex-output` frame.
  - Docstring обновлён: упоминание iter 55 / Phase 3 / Level 1 frame.

**Результат:** 1144 теста зелёные. TypeScript clean. Vite build OK (9 prerendered HTML). Lint baseline 59 сохранён. CSS bundle +~1.5 KB (40.74 KB gzipped 8.93 KB).

---

## Известные проблемы (Known Issues)

| # | Issue | Status |
|---|-------|--------|
| ~~1-5~~ | (см. git history) | ✅ CLOSED iter 46-50 |

**Открытых Known Issues нет.**

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts (iter 50) |

---

## UI Redesign — план (9 фаз)

| Фаза | Статус | Что |
|------|--------|-----|
| 0 | ✅ iter 51 | Аудит CSS-токенов, таблица маппинга |
| 1 | ✅ iter 51 | Миграция design tokens (тёплая палитра, удаление light-темы, приглушение bg-forest) |
| 2 | ✅ iter 52-53 | `CategoryLayout` — 2 колонки desktop / 1 mobile. **Все 8 страниц мигрированы** |
| 3 | ✅ iter 55 | Возвышение `RegexOutput` до Level 1 (gold border + glow) |
| 4 | ⏳ next | Навигация как «режимы» (усиленный active-state, mobile tabs в Sidebar) |
| 5 | ⏳ | Компактизация HomePage (хаб категорий, SeoBlock в `<details>`) |
| 6 | ⏳ | Единая панель статусов (`StatusPanel.tsx`) |
| 7 | ⏳ | Mobile sticky copy bar (`MobileRegexBar.tsx`) — заодно переместит RegexOutput на mobile в sticky bottom-bar |
| 8 | ⏳ | Полировка: снять шум, оставить «дорогую тишину» |
| 9 | ⏳ | Документация финальная |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---

## SEO-статус

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`.

---
Контакты: Discord **woonderdad**
