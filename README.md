# PoE2 Regex RU

Генератор regex-фильтров для Path of Exile 2 (русский клиент).

- **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
- **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

## Документация

| Файл | Назначение |
|------|-----------|
| `STATUS.md` | Текущее состояние проекта + Known Issues + Atlas regex-семантика |
| `AGENT_NAVIGATION.md` | Entry-документ для AI-агента — структура, pitfalls, итерации |
| `worklog.md` | История итераций (последняя — подробно, старые — одной строкой) |
| `docs/ARCHITECTURE.md` | Архитектура core/regex-движка |
| `docs/ATLAS_JEWEL_PLAN.md` | iter 175–176 — план + реализация категории `/timeless-jewel` (особые самоцветы: Вечная ненависть + Трагедия героев). iter 176 DONE. |
| `docs/UI_AUDIT.md` | Полный UI-аудит v2 (палитра, типографика, контрасты) |
| `docs/UI_REFACTOR_PLAN.md` | Полный план UI-рефакторинга (фазы 1-5) |
| `docs/REDESIGN_CONCEPT_v3.md` | Концепт-спецификация редизайна v3 (iter 164) |
| `docs/ETL_GUIDE.md` | ETL-пайплайн: poe2db.tw → `public/generated/*.json` |
| `регис/` | Пользовательские in-game данные (списки модов, тесты, списки нод особых самоцветов) |

## Разработка

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm test         # Vitest (all tests)
pnpm build        # tsc -b + vite build + prerender
pnpm etl          # ETL pipeline (poe2db.tw → generated JSON)

# Timeless Jewel parser (iter 176) — separate from run-etl.ts.
# Re-run only when GGG adds a new timeless jewel, then commit the JSON.
npx tsx scripts/etl/parse-timeless-jewel.ts
```

## Стек

- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS 4 + Zustand 5 + Zod 4
- Vitest 4 + Playwright 1.52 (prerender)
- `@tanstack/react-virtual` для виртуализации

## Структура

```
src/
├── core/        # Regex engine (ZERO npm deps — pure TS)
├── shared/      # Types, i18n, schemas, family-grouper
├── strategies/  # Locale strategy (Russian dialect)
├── store/       # Zustand stores — filter/profile/url-sync
├── data/        # Zod-validated JSON loader
└── ui/          # React — pages, layout, components, hooks
public/
└── generated/   # ETL output (belt/ring/amulet/jewel/waystone/tablet/relic JSON)
scripts/
└── etl/         # ETL pipeline
tests/           # Vitest — core/, shared/, etl/, ui/, integration/
```

Контакты: Discord **woonderdad**
