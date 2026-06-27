# iter 147 patch — deploy fix + TS errors + debt cleanup

## Что в архиве

- `STATUS.md` — актуализированная документация (чистая, без длинной истории).
- `worklog.md` — обновлённый worklog (iter 147 подробно, iter ≤146 одной строкой).
- `src/ui/components/VirtualizedModList.tsx` — фикс 6 TS ошибок:
  - Удалён `shouldAdjustScrollPositionOnItemSizeChange: () => false` (не существует в @tanstack/react-virtual v3 types).
  - `getItemKey` для `origin-header` упрощён до `oh:${row.origin}` (вместо `oh:${row.affix}:${row.origin}` — `row.affix` не существует на этом типе).
  - `getItemKey` для `jewel-type-header` упрощён до `jh:${row.jewelType}` (аналогично).
  - Обновлены комментарии (упоминания старого свойства).
- `DELETIONS.txt` — список файлов для удаления локально.

## Файлы для удаления (debt cleanup)

```
src/ui/components/LeftPanelFavorites.tsx
tests/ui/LeftPanelFavorites.test.tsx
```

`LeftPanelFavorites` не импортируется ни одной страницей с iter 139 (KI#20).

## Как применить

```bash
# 1. Перейти в локальный клон репозитория
cd /path/to/poe2-regex-ru

# 2. Распаковать архив поверх локальной копии (tar.gz с .tar расширением на tmpfiles.org)
tar -xf /path/to/iter147-patch.tar

# 3. Удалить неиспользуемые файлы
rm -f src/ui/components/LeftPanelFavorites.tsx
rm -f tests/ui/LeftPanelFavorites.test.tsx

# 4. Проверить, что всё собирается
pnpm install --frozen-lockfile
pnpm test      # должно быть 2235/2235 passed
pnpm build     # должно пройти без ошибок tsc

# 5. Закоммитить и запушить (см. git-команды ниже)
```

## Git-команды

```bash
git add STATUS.md worklog.md \
        src/ui/components/VirtualizedModList.tsx
git rm src/ui/components/LeftPanelFavorites.tsx \
       tests/ui/LeftPanelFavorites.test.tsx
git commit -m "iter 147: deploy fix + TS errors + debt cleanup

- Fix 6 pre-existing TS errors in VirtualizedModList.tsx that blocked deploy:
  * Remove shouldAdjustScrollPositionOnItemSizeChange (not in @tanstack/react-virtual v3 API)
  * Simplify getItemKey for origin-header / jewel-type-header (row.affix was undefined on these types)
- Delete unused LeftPanelFavorites component + test (not imported since iter 139 / KI#20)
- Update STATUS.md: clean doc, document KI#39 conditional plan

Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / pnpm build PASS"
git push origin main
```

## Точка остановки

**Сделано в iter 147:**
1. Исправлены 6 TS ошибок в `VirtualizedModList.tsx` → деплой должен пройти.
2. Удалён неиспользуемый `LeftPanelFavorites.tsx` + тест (debt cleanup).
3. `STATUS.md` актуализирован (убрана длинная история, оставлены только ключевые KI).
4. `worklog.md` сжат (iter 147 подробно, iter ≤146 одной строкой).
5. Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / build PASS.

**НЕ сделано (на следующую итерацию — iter 148):**
1. Browser testing KI#36/37/38 — проверить на 7 категориях.
2. KI#39 (условный) — если KI#38 jitter остаётся, отключить `measureElement` (dynamic measurement), оставить только `estimateSize`.
3. Mobile layout optimization для favorites panel (KI#31 follow-up).
4. Stale comments cleanup — подчистить упоминания `LeftPanelFavorites` в 5 файлах (`useCategoryPage.ts`, `i18n.ts`, `index.css`, `FavoritesIndicator.tsx`, `CategoryLayout.tsx`).
5. Code-split bundle — `index-*.js` > 500 KB warning.
