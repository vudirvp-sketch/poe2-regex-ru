# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 57 — UI Фаза 5 (компактизация HomePage: SeoBlock в `<details>`)

---

## iter 57 — UI Фаза 5: Компактизация HomePage

**Что:** Главная страница стала плотнее — уменьшены вертикальные отступы (mb-10→mb-6, mt-10→mt-6, mt-12→mt-6, mt-8→mt-6), сжаты карточки категорий (p-4→p-3, иконка 44→40), а длинный SEO-текст свёрнут в нативный `<details>` с золотым `<summary>` (закрыт по умолчанию).

**Изменения:**

- `src/ui/pages/home/SeoBlock.tsx` — содержимое обёрнуто в `<details className="home-seo-details">` с `<summary className="home-seo-summary">`. Все 4 SEO-секции сохранены внутри (Google индексирует `<details>` даже в закрытом состоянии). Нативная keyboard-accessibility.
- `src/ui/pages/home/HomePage.tsx` — tightened: Hero `mb-10→mb-6`, `mb-3→mb-2`, `mb-4→mb-3`, `mb-6→mb-4`; stat badges `text-[13px]→[12px]`, `px-2 py-1→px-1.5 py-0.5`, `gap-3→gap-2`; category cards `gap-4→gap-3`, `p-4→p-3`, icon `44×44→40×40` (height 48→40), `mb-2→mb-1.5`, `mt-2→mt-1.5`; Features section `mt-10→mt-6`, `gap-4→gap-3`, `p-4→p-3`, title `text-xl→text-base`, desc `text-[13px]→[12px]`, `mb-2→mb-1.5`; SeoBlock wrapper `mt-12→mt-6`; Footer `mt-8→mt-6`.
- `src/shared/i18n.ts` — добавлен ключ `'home.seo_summary'`: «Подробнее о регексах PoE2 — как пользоваться генератором, ёфикация, лимит 250 символов».
- `src/index.css` — +49 строк после блока `.mobile-nav-tab`:
  - `.home-seo-details` — карточка-обёртка (`--poe-bg-secondary` + 1px border + radius 6px).
  - `.home-seo-summary` — gold text, `cursor: pointer`, `list-style: none` (кросс-браузерно скрыт дефолтный треугольник), hover bg tint.
  - `.home-seo-summary::before` — кастомный маркер `▸` (gold), поворот на 90° когда `details[open]`.
  - `.home-seo-content` — padding для раскрытого контента.

**Результат:** 1144 теста зелёные. TypeScript clean. Vite build OK (154 модуля, 9 prerendered HTML, CSS 42.64 KB / gzip 9.31 KB — +0.69 KB uncompressed за счёт нового CSS-блока). Lint baseline 59 сохранён.

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
| 6 | ⏳ next | Единая панель статусов (`StatusPanel.tsx`) |
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

✅ Полный набор реализован. См. `docs/SEO_PLAN.md`. SeoBlock теперь в `<details>` — контент остаётся в DOM, Google индексирует его даже в закрытом состоянии.

---
Контакты: Discord **woonderdad**
