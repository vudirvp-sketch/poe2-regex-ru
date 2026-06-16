# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 58 — UI Фаза 6 (единая панель статусов `StatusPanel.tsx`)

---

## iter 58 — UI Фаза 6: Единая панель статусов

**Что:** Разрозненные статус-блоки на 8 страницах категорий объединены в единый компонент `StatusPanel.tsx`. Компонент устраняет дублирование JSX (~15-20 строк inline-кода на каждой странице) и предоставляет расширяемый API через `badges` и `alerts` слоты.

**Изменения:**

- **NEW** `src/ui/components/StatusPanel.tsx` — единый компонент:
  - Props: `wantTokens`, `excludeTokens`, `allActiveTokens` (обязательные); `badges` (ReactNode[], по умолчанию []); `alerts` (ReactNode[], по умолчанию []).
  - Рендерит: (1) summary-панель с selected/excluded counts + truncated token lists; (2) inline badges после count-строки; (3) alert-блоки под summary.
  - Возвращает `null` когда нет активных токенов, badges и alerts.
- **Обновлены 8 страниц** — inline status JSX заменён на `<StatusPanel>`:
  - BeltPage, AmuletPage, RingPage, RelicPage — стандартный вызов (3 props, без badges/alerts).
  - JewelPage — `alerts` для amber "hidden mods" warning (ранее в left column children).
  - WaystonePage — `badges` для corrupted/uncorrupted/delirious (ранее inline string interpolation).
  - TabletPage — `badges` для type/rarity/uses (ранее inline string interpolation).
  - VendorPage — `alerts` для yellow verification note (ранее в left column children). Добавлен `status` slot (ранее отсутствовал).
- Удалены неиспользуемые импорты `countUniqueFamilyKeys` из 6 страниц и `t` из 4 стандартных страниц (Belt/Amulet/Ring/Relic — `t` больше не используется напрямую).

**Результат:** 1144 теста зелёные. TypeScript clean. Vite build OK (155 модулей, CSS 42.49 KB / gzip 9.28 KB — −0.15 KB за счёт устранения дублирующихся inline JSX-строк). Lint baseline 59 сохранён.

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
| 4 | ✅ iter 56 | Навигация как «режимы» (усиленный active-state, mobile tabs в Sidebar) |
| 5 | ✅ iter 57 | Компактизация HomePage (хаб категорий, SeoBlock в `<details>`) |
| 6 | ✅ iter 58 | Единая панель статусов (`StatusPanel.tsx`) |
| 7 | ⏳ next | Mobile sticky copy bar (`MobileRegexBar.tsx`) — заодно переместит RegexOutput на mobile в sticky bottom-bar |
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

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`. SeoBlock в `<details>` — контент остаётся в DOM, Google индексирует его даже в закрытом состоянии.

---
Контакты: Discord **woonderdad**
