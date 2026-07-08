# iter 180 — SEO technical fixes

Архив для слияния с локальной директорией репозитория `poe2-regex-ru`.
Скопировать содержимое поверх локальной копии репозитория, сохранить структуру папок.

## Изменённые файлы (10 + 1 новый)

| Файл | Изменение |
|------|-----------|
| `.github/workflows/deploy.yml` | KI#54 fix: `/timeless-jewel` добавлен в IndexNow urlList |
| `index.html` | `<title>` 80→58, удалён `meta keywords`, обновлён description, добавлен FAQPage JSON-LD |
| `scripts/prerender.ts` | Home route: title/description/noscriptIntro синхронизированы |
| `scripts/prerender-full.ts` | KI#54 fix: `/timeless-jewel` добавлен в routes[] |
| `src/ui/pages/home/SeoBlock.tsx` | FAQ-секция (6 Q&A), синонимы, категория «вневременные самоцветы» |
| `README.md` | Новый раздел «Настройка репозитория» (GitHub Topics, Website, Description) |
| `STATUS.md` | Полный рерайт: убрана iter 178 история, добавлен KI#54, roadmap iter 180/181 |
| `AGENT_NAVIGATION.md` | Header iter 180, §10 prerender warning, §11 SEO changes, §8 pitfall #30 (KI#54) |
| `docs/SEO_PLAN.md` | 9→10 URL, чеклист разбит на DONE / pending |
| `docs/SEO_GROWTH_PLAN.md` | **НОВЫЙ** — единый план роста (REPO / MANUAL / DEFERRED buckets) |
| `worklog.md` | Добавлен Task ID iter-180-seo-fixes |

## Проверки (всё зелёное)

- `npx tsc -b` ✅ 0 errors
- `npx eslint .` ✅ 0 errors
- `npx vitest run` ✅ 2405 passed | 5 skipped (без регрессий)
- `npm run build` ✅ OK (10 prerendered routes, включая `/timeless-jewel`)

## Git-команды

См. `git-commands.sh` в этом же архиве.

## Остановка (stopping point)

iter 180 завершён. Следующая итерация (iter 181) — state-features для `/timeless-jewel`
(URL-sync, ProfilePanel, SelectedBasket). Подробности — в `STATUS.md` → «Next iteration».
