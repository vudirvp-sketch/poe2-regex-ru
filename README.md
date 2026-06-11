# PoE2 Regex RU

Генератор регексов и поисковых строк для **Path of Exile 2** (русский клиент).

Выбираете аффиксы → получаете оптимизированную строку для вставки в поисковое окно игры. Работает с лимитом 250 символов, автоматически сокращает regex через дедупликацию, группировку семейств и ёфикацию.

**Онлайн:** [vudirvp-sketch.github.io/poe2-regex-ru](https://vudirvp-sketch.github.io/poe2-regex-ru/)

## Категории

Путевые камни · Башни Предтеч · Реликвии · Самоцветы · Торговец · Пояса · Кольца · Амулеты

## Баг-репорты и предложения

Нашли ошибку или есть идея? Пишите в **Discord**: **woonderdad**

## Технологии

React 19 · Vite · TypeScript · Zustand · Tailwind CSS · Vitest

## Разработка

```bash
pnpm install
pnpm dev        # dev-сервер
pnpm build      # production-сборка
pnpm test       # запуск тестов
pnpm etl        # обновление данных с poe2db.tw
```
