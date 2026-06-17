# iter 65 patch — UI Phase 11: PoE2 Atmospheric Styling

Применить поверх локальной копии репозитория `https://github.com/vudirvp-sketch/poe2-regex-ru`
(коммит `376a2ea` — iter 64). Структура каталогов в архиве 1-в-1 повторяет структуру репо.

## Что внутри

| Путь | Действие |
|------|----------|
| `public/atmosphere/bg.webp`              | НОВЫЙ — текстура фона (Step 3) |
| `public/atmosphere/bg-2x.webp`           | НОВЫЙ — текстура для `.poe-divider--ornate` (Step 1) |
| `public/atmosphere/title-bg-4x.webp`     | НОВЫЙ — визуальный референс для `.poe-panel-header` (Step 1) |
| `public/atmosphere/early-access-button-underlay.webp` | НОВЫЙ — визуальный референс для `.btn-cta` (Step 2) |
| `src/index.css`                          | ИЗМЕНЁН — новые `.poe-panel-header` / `.poe-divider(-ornate)` / `.btn-cta(-success/-error)` + body bg swap (`bg-forest.webp` → `bg.webp` + vignette) + `.skip-link` Pitfall 28 фикс |
| `src/ui/layout/TopNav.tsx`               | ИЗМЕНЁН — добавлен `poe-panel-header` класс + `title` на brand-link |
| `src/ui/layout/CategoryLayout.tsx`       | ИЗМЕНЁН — `<hr className="poe-divider--ornate">` между header и grid |
| `src/ui/pages/home/HomePage.tsx`         | ИЗМЕНЁН — `<hr className="poe-divider--ornate">` между hero и cards grid |
| `src/ui/components/RegexOutput.tsx`      | ИЗМЕНЁН — Copy-кнопки: `bg-btn-primary/success/danger` → `.btn-cta/-success/-error` |
| `STATUS.md`                              | ИЗМЕНЁН — iter 65 + Phase 11 row + Known Issues closed |
| `AGENT_NAVIGATION.md`                    | ИЗМЕНЁН — iter 65 header + `public/atmosphere/` row + Pitfall 29 |
| `worklog.md`                             | ИЗМЕНЁН — iter 65 полный раздел + iter 64 сжат в одну строку |

## Применение (merge с локальной директорией)

```bash
cd /path/to/your/local/poe2-regex-ru
# Распаковать архив поверх рабочей копии
unzip -o iter65-patch.zip -d .
# Проверить, что всё на месте
git status
```

## Верификация (выполнить после применения)

```bash
pnpm install            # если ещё не установлены deps
npx tsc -b              # должно быть clean (0 ошибок)
pnpm test               # должно быть 1144/1144 passed
pnpm build              # tsc + vite build + prerender — должно завершиться OK
```

Ожидаемый CSS размер после сборки: ~45 KB raw / ~9.9 KB gzip (было 42.87 KB / 9.44 KB).
JS размер не меняется: 501.97 KB raw / 144.67 KB gzip.

## Git-команды для коммита и пуша

```bash
git add public/atmosphere/ src/index.css \
        src/ui/layout/TopNav.tsx \
        src/ui/layout/CategoryLayout.tsx \
        src/ui/pages/home/HomePage.tsx \
        src/ui/components/RegexOutput.tsx \
        STATUS.md AGENT_NAVIGATION.md worklog.md

git commit -m "iter 65: UI Phase 11 — PoE2 atmospheric styling (title-bg-4x + bg-2x + bg + early-access-button-underlay) + Pitfall 28 fix on .skip-link

- Step 1 (Structure): .poe-panel-header (gold filigree rim via inset box-shadow,
  ::before/::after 6px gold dot accents) applied to TopNav; .poe-divider and
  .poe-divider--ornate (bg-2x.webp texture, mask-image fade) added between
  header and grid in CategoryLayout + HomePage.
- Step 2 (Interactive): .btn-cta / -success / -error / :disabled replace the
  cold bg-btn-primary (#2563eb, Pitfall 28 violation) on RegexOutput Copy
  buttons (both main + PartCopyButton). Dark metallic base + gold rim +
  crimson radial glow on hover (early-access-button-underlay inspiration).
- Step 3 (Atmosphere): body background swapped from bg-forest.webp to
  atmosphere/bg.webp with strong warm dim (0.78 → 0.92) + radial vignette.
  bg-forest*.webp kept in /public for cached-URL backward-compat.
- Pitfall 28 fix: .skip-link cold #2563eb → var(--poe-gold) brand color.
- New public/atmosphere/ dir with 4 PoE2-themed webp assets.
- Pitfall 29 added to AGENT_NAVIGATION.md (atmospheric CSS primitives rules).
- Tests: 1144/1144 passed. tsc clean. vite build OK. CSS +2.14 KB raw / +0.5 KB gzip."

git push origin main
```

## Точка остановки для продолжения (для следующего чата)

**iter 65 COMPLETE. Открытых Known Issues нет.**

Все 3 шага из ТЗ реализованы + Pitfall 28 фикс на `.skip-link`.

### Кандидаты для следующей iter 66 (после in-browser visual review)

1. **In-browser check** bg.webp текстуры при разных viewport sizes (mobile / 768-1024 / 1440+).
   Если vignette слишком давит — ослабить `rgba(7,5,3,0.55)` до `0.40` в `src/index.css`.
2. **In-browser check** `.poe-panel-header` 6px gold dot accents на TopNav — не перекрывают ли
   они brand-logo на 320-360px viewport? Если да — скрыть dots через
   `@media (max-width: 380px) { .topnav.poe-panel-header::before,
   .topnav.poe-panel-header::after { display: none } }`.
3. **In-browser check** `.btn-cta` crimson glow — не слишком ли яркий на OLED? Если да —
   снизить `0.40` alpha до `0.30` на hover в `.btn-cta:hover:not(:disabled)` rule.
4. **Кандидат на следующую итерацию:** применить `.poe-panel-header` к category page `<h2>`
   заголовкам (8 страниц — WaystonePage, TabletPage, RingPage, и т.д.) — визуально объединит
   TopNav + page-header под один filigree-стиль. Сейчас `<h2>` используют только gold text
   color без рамки. Делать отдельной итерацией с in-browser review (визуальный риск: рамка
   вокруг inline-flex h2 с иконкой может выглядеть "коробочно" — нужно тестировать).
5. **Кандидат на следующую итерацию:** удалить `public/bg-forest.webp` + `public/bg-forest-mobile.webp`
   (старые background-ассеты) после как минимум 1 release cycle — сейчас оставлены для
   cached-URL backward-compat.
6. **Cleanup:** удалить unused i18n ключи `home.header_title` и `app.title`
   (iter 64 stopping point candidate, всё ещё не сделано — harm-less, но мусор в `src/shared/i18n.ts`).
7. **Compact mode для TopNav tabs на md (768-1024px):** iter 64 stopping point — проверить
   in-browser, помещаются ли все 9 табов без скролла. Если тесно — добавить compact mode
   (icon-only) для md через media query.
8. **Tab font size на < md:** iter 64 stopping point — `text-[13px]` → `text-[14px]` если
   позволяет ширина.
