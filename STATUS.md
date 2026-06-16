# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 51 — UI redesign Фаза 1: тёплая dark-fantasy палитра + удаление light-темы

---

## iter 51 — Design tokens migration (Фаза 1 из 9)

**Что:** Миграция CSS-токенов на тёплую dark-fantasy палитру по дизайн-заданию. Только CSS + Header.tsx + i18n + index.html. JSX не тронут (имена переменных не менялись).

**Палитра (cold blue-gray → warm dirty-brown):**
| Токен | Было | Стало |
|---|---|---|
| `--poe-bg` | `#0a0a0f` | `#0D0B09` |
| `--poe-bg-secondary` | `#12121a` | `#15110E` |
| `--poe-bg-tertiary` | `#1a1a25` | `#1F1812` |
| `--poe-border` | `#2a2a3a` | `#3A2C22` |
| `--poe-text` | `#c8c8d0` | `#D4C9B8` (parchment) |
| `--poe-text-bright` | `#e8e8f0` | `#F0E6D2` |
| `--poe-gold` | `#af882b` | `#C89A4A` (ТЗ accent) |
| `--poe-gold-bright` | `#d4a843` | `#E0B570` |
| `--input-bg` / `--panel-bg` / `--raised-bg` / `--deep-bg` | cold grays | `#1F1812` / `#15110E` / `#3A2C22` / `#070503` |
| `--chip-bg-selected` | `rgba(30,58,95,.4)` blue-tint | `rgba(200,154,74,.18)` gold-tint |
| `--focus-ring` | `#3b82f6` blue | `#C89A4A` gold |
| `bg-forest.webp` | full opacity | +40% warm rgba overlay (приглушение) |

**Light-тема удалена:**
- Весь `[data-theme="light"]` блок в `index.css` (123 строки)
- Все `[data-theme="light"] ...` правила (sidebar/header, layout-shell, content-area, form elements, control-panel, regex-output, affix frames, mobile media queries) — ещё ~75 строк
- Toggle кнопка в `Header.tsx` (dark-only через `useEffect`)
- i18n ключи `theme.light` / `theme.dark` удалены
- `theme-color` meta в `index.html`: `#0f0f1a` → `#0D0B09`

**Результат:** `index.css` 832 → 633 строки (-199). Все 1144 теста зелёные. TypeScript clean. Lint не ухудшился (59 pre-existing problems в `tests/`, не в моих файлах).

---

## Известные проблемы (Known Issues)

| # | Issue | Status |
|---|-------|--------|
| ~~1~~ | ~~`(?!…)` forward-only FP~~ | ✅ CLOSED iter 46 |
| ~~2~~ | ~~Симулятор не моделирует `(?!…)`~~ | ✅ CLOSED iter 48 |
| ~~3~~ | ~~`^` в OR-context не верифицирован~~ | ✅ CLOSED iter 46 |
| ~~4~~ | ~~AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE~~ | ✅ CLOSED iter 49 |
| ~~5~~ | ~~PoE2 regex char limit ≈ 250 chars~~ | ✅ CLOSED iter 50 |

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
| 2 | ⏳ next | `CategoryLayout` — 2 колонки desktop / 1 mobile |
| 3 | ⏳ | Возвышение `RegexOutput` до Level 1 (gold border + glow) |
| 4 | ⏳ | Навигация как «режимы» (усиленный active-state, mobile tabs) |
| 5 | ⏳ | Компактизация HomePage (хаб категорий, SeoBlock в `<details>`) |
| 6 | ⏳ | Единая панель статусов (`StatusPanel.tsx`) |
| 7 | ⏳ | Mobile sticky copy bar (`MobileRegexBar.tsx`) |
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
