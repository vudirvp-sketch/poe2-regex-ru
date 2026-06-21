# iter 120 — Archive Contents

**Дата:** 2026-06-21
**Итерация:** 120
**Задача:** Фикс UI-багов — scroll jump-to-top + jitter в VirtualizedModList (KI#6) и HomePage hero decorations (KI#7).

## Структура архива (сохраняет структуру репозитория для слияния)

```
.
├── AGENT_NAVIGATION.md                              [modified]  — header updated to iter 120
├── STATUS.md                                        [modified]  — iter 120 current state + KI#6, KI#7
├── worklog.md                                       [modified]  — iter 120 detailed log
├── docs/
│   └── UI_AUDIT.md                                  [modified]  — iter 120 note added
├── src/
│   ├── index.css                                    [modified]  — +.hero-side-ghost + .hero-side-ghost--right CSS classes
│   └── ui/
│       ├── components/
│       │   └── VirtualizedModList.tsx               [modified]  — removed useLayoutEffect with measure() (KI#6 fix)
│       └── pages/
│           └── home/
│               └── HomePage.tsx                     [modified]  — replaced hero images (KI#7 fix)
└── public/
    └── atmosphere/
        ├── hero-shaman.webp                         [NEW]       — 533×800 portrait, 126 KB (from "шаманка полный рост.png")
        └── hero-iva.webp                            [NEW]       — 501×800 portrait, 78 KB (from "ива.png")
```

## Как применить

Скопируйте содержимое архива в корень локального репозитория `poe2-regex-ru` с заменой существующих файлов:

```bash
# Из корня локального репозитория poe2-regex-ru:
unzip /path/to/iter120.zip -d /tmp/iter120
cp -r /tmp/iter120/* .
git add -A
git commit -m "iter 120: fix scroll jump-to-top + jitter (KI#6) + HomePage hero decorations (KI#7)"
git push origin main
```

## Что исправлено

### KI#6 — Scroll jump-to-top + jitter в VirtualizedModList

**Симптом:** На вкладке самоцветов (и других) при выборе аффикса с прокрученной страницей вниз — резкий jump наверх. В некоторых вкладках при скролле аффиксы "дрожат" и наслаиваются.

**Причина:** `useLayoutEffect` в `VirtualizedModList` вызывал `virtualizer.measure()` (3 раза: immediate + RAF + setTimeout) при каждом изменении `selectedIds`/`perTokenRanges`. `measure()` инвалидирует ВЕСЬ кэш измерений TanStack Virtual → все rows возвращаются к estimate-размерам (120px для `subgroup`, тогда как actual 40–80px) → `paddingTop`/`paddingBottom` дрейфуют → visible items смещаются → "jump to top". Jitter при скролле — та же причина: новые rows используют estimate 120px, после ResizeObserver actual размер меньше → `totalSize` уменьшается → padding дрейфует → "дрожание".

**Фикс:**
- Удалён ВЕСЬ блок `useLayoutEffect` с `measure()` + `restore()` (оба: two-column и single-column) + связанные refs и scroll listener.
- Удалён `useLayoutEffect` import (больше не используется).
- `ROW_ESTIMATES.subgroup` снижен 120 → 60 (ближе к actual average для 1-3 chip subgroups без range inputs).
- `measureElement` ref + ResizeObserver автоматически обрабатывают dynamic row measurement (TanStack Virtual built-in). Браузер сам сохраняет `scrollTop` когда content выше viewport'а не меняется.

### KI#7 — HomePage hero decorations

**Симптомы:**
- `hero-bas-relief.webp` (lg+, opacity 0.18, mix-blend-screen) — "полностью скрывает текст, мал, странно расположен".
- `news-bg-center.webp` (mobile, opacity 0.14, mix-blend-screen) — "вообще не вижу нигде".
- `hero-horned-warrior.webp` + `hero-monster-red.webp` (xl+, landscape, w-44 = 176px) — upper-body busts, нужно заменить на full-body portrait.

**Фикс:**
- Удалены оба backdrop'а (`hero-bas-relief.webp` lg+, `news-bg-center.webp` mobile).
- Side ghosts заменены: `hero-horned-warrior.webp` (landscape 640×390) → `hero-shaman.webp` (portrait 533×800, "шаманка полный рост"); `hero-monster-red.webp` (landscape 640×375) → `hero-iva.webp` (portrait 501×800, "ива").
- Высота `h-[500px] w-auto` (вместо `w-44`), opacity 0.22 (вместо 0.28).
- CSS `.hero-side-ghost` + `.hero-side-ghost--right` с `mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)` для плавного затухания ног + horizontal fade на inner edge (сторона к тексту). WebKit prefix добавлен для Safari.

## Что НЕ пристроено

- `faf.png` (1672×941, landscape) — пользователь сказал "не знаю куда можно пристроить и нужно ли". Оставлено на усмотрение пользователя.

## Что НЕ удалено (можно удалить в iter 121+)

Следующие atmosphere images больше не используются в HomePage, но остаются в `public/atmosphere/` (не удалены, чтобы не сломать возможные другие ссылки):
- `hero-horned-warrior.webp`
- `hero-monster-red.webp`
- `hero-bas-relief.webp`
- `news-bg-center.webp`

## Проверки

- ✅ `npx tsc --noEmit` → 0 errors
- ✅ `npx eslint .` → 0 problems
- ✅ `npx vitest run` → 1890/1890 tests passed (37 test files, без изменений vs iter 119)
- ✅ `python3 scripts/audit_block_sort_coverage.py` → 18/18 blocks fully covered (312 family-keys)
- ✅ `npx vite build` → built successfully (156 modules, 564 KB JS / 49 KB CSS)

## Точка остановки

**iter 120 COMPLETE.** Два UI-бага из запроса пользователя исправлены. В iter 121 можно:
1. **Визуальная верификация пользователем** — UI в браузере: (а) scroll на вкладке самоцветов (и других) — не должно быть jump-to-top при выборе аффикса, не должно быть jitter при скролле; (б) HomePage hero — shaman слева, ива справа, оба full-body с плавным затуханием ног, текст не перекрыт backdrop'ами.
2. Опционально: cleanup неиспользуемых atmosphere images (4 файла, см. выше).
3. Опционально: пристроить `faf.png`.
4. Опционально (перенос из iter 111): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
5. Опционально: систематизация `other` block (27 family-keys) — LOW priority, heterogeneous.
