#!/usr/bin/env bash
# Git-команды для применения iter 180 (SEO technical fixes).
# Запускать из корня локальной копии репозитория poe2-regex-ru.
#
# Порядок:
# 1. Распаковать архив поверх локальной копии (сохраняя структуру папок).
# 2. Запустить этот скрипт или выполнить команды вручную ниже.

set -e

# 1. Проверить, что мы в корне репозитория.
if [ ! -f "package.json" ] || [ ! -d ".git" ]; then
  echo "ERROR: запустите этот скрипт из корня репозитория poe2-regex-ru"
  exit 1
fi

# 2. Проверить, что мы на ветке main.
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "WARNING: текущая ветка '$CURRENT_BRANCH', не 'main'. Переключиться? (y/N)"
  read -r switch
  if [ "$switch" = "y" ] || [ "$switch" = "Y" ]; then
    git checkout main
  fi
fi

# 3. Стейдж всех изменённых + новых файлов.
git add \
  .github/workflows/deploy.yml \
  AGENT_NAVIGATION.md \
  README.md \
  STATUS.md \
  docs/SEO_PLAN.md \
  docs/SEO_GROWTH_PLAN.md \
  index.html \
  scripts/prerender-full.ts \
  scripts/prerender.ts \
  src/ui/pages/home/SeoBlock.tsx \
  worklog.md

# 4. Коммит.
git commit -m "iter 180: SEO technical fixes

- title: 80→58 chars, keyword forward ('Path of Exile 2' в начале)
- meta keywords removed (мёртвый груз)
- meta description: +синонимы ('лут-фильтр', 'аффиксы и моды', 'лимит 250 символов')
- OG / Twitter tags синхронизированы с новым title/description
- JSON-LD WebApplication: 8→9 категорий, +featureList
- JSON-LD FAQPage: 6 Q&A (синхронизирован с FAQ-секцией в SeoBlock)
- SeoBlock.tsx: +FAQ-секция внутри <details> (не влияет на интерфейс)
- SeoBlock.tsx: +синонимы в основном тексте (лут-фильтр, поиск в тайнике, аффиксы и моды)
- README: +раздел 'Настройка репозитория' (GitHub Topics, Website, Description)
- KI#54 fix (iter 178 regression): /timeless-jewel добавлен в prerender-full.ts
  routes[] и в IndexNow urlList в deploy.yml
- docs/SEO_GROWTH_PLAN.md (новый): единый план роста (REPO/MANUAL/DEFERRED buckets)
- docs/SEO_PLAN.md: 9→10 URL, чеклист разбит на DONE/pending
- STATUS.md: рерайт (убрана iter 178 история, добавлен KI#54, roadmap iter 180/181)
- AGENT_NAVIGATION.md: header iter 180, §10 prerender warning, §11 SEO changes,
  §8 pitfall #30 (KI#54)

CI зелёный: tsc 0, eslint 0, vitest 2405 passed | 5 skipped, build OK (10 routes)."

# 5. Пуш.
git push origin main

echo ""
echo "✓ iter 180 запушен в origin/main."
echo "  CI запустит build + deploy автоматически (см. GitHub Actions tab)."
echo "  После деплоя — IndexNow уведомит Bing/Яндекс о 10 URL (включая /timeless-jewel)."
