# Worklog

---
Task ID: 8
Agent: main
Task: Итерация 8 — Визуальная проверка dark/light + VendorPage фиксы

Work Log:
- 1: VendorPage displayText ≥{value} — при установленном min через perTokenRange, числовой чип показывает «Ур. предмета ≥75» вместо «Ур. предмета ≥N». Замена ≥N → ≥{minValue} в groupedFamilies useMemo
- 2: CategoryControlPanel overflow counter — добавлен activeTokenCount display (N выбрано) рядом с excludedCount
- 3: Light theme indicator backgrounds — добавлены light-theme overrides для --indicator-green/yellow/red (0.2 opacity) и --section-* (0.12 opacity) для видимости на белом фоне
- 4: Light theme form elements — добавлены стили для checkbox, control panel background, regex output background в light theme
- 5: Light theme danger borders — добавлены --danger-border и --danger-border-strong overrides для light theme
- 6: Vendor regex equivalence tests — 17 тестов в tests/ui/vendor-regex-equivalence.test.ts. Выявлено 2 отличия от legacy: (а) числовые свойства используют reversed pattern (багфикс), (б) AND-режим = true AND (поведение изменено)
- 7: Обновлены STATUS.md и AGENT_NAVIGATION.md (pitfalls #16, #17)
- Тесты: 778/778 ✅ | Build: ✅ | TypeScript: ✅ | !important: 0

Stage Summary:
- VendorPage numeric chip displayText динамически обновляется при установке min-значения
- Overflow counter виден на всех 8 страницах (CategoryControlPanel)
- Light theme: indicator/section backgrounds, form elements, danger borders корректны
- Regex equivalence: buildAstFromSelections даёт корректный reversed pattern для числовых свойств (багфикс vs legacy)
- AND-режим для vendor = true AND (поведение отличается от legacy OR-внутри-AND)

---
Task ID: 7
Agent: main
Task: Итерация 7 — VendorPage → useCategoryPage unification

Work Log:
- 1: Fixed build error — removed `priorityTier: 'B'` from vendor-adapter.ts GameToken (field doesn't exist on GameToken type, was blocking deployment)
- 2: Fixed vendor-adapter regex mapping — numeric properties use `numericSuffix` as regex.ru (not empty string), non-numeric use actual regex pattern
- 3: Fixed vendor-adapter familyKey display — `familyKey.ru = prop.label` for non-numeric, `prop.label.replace('≥N', '≥#')` for numeric. Previously was `vendor:${prop.id}` showing raw IDs in chips
- 4: Fixed vendor-adapter rawTextTemplate — numeric properties use `prop.label.replace('≥N', '≥##')` so extractSlotValues correctly maps ranges[] → min/max inputs appear
- 5: Switched VendorPage from `useVendorPage()` to `useCategoryPage({ categoryId: 'vendor', customData: buildVendorCategoryData() })`
- 6: Replaced all VendorChip with FilterChip (61 chips, FamilyGroup-based)
- 7: GROUP_COLORS moved from useVendorPage export to local VendorPage definition, derived from `tags: [group:${group}]`
- 8: Deleted dead code: `useVendorPage.ts`, `VendorChip.tsx`
- 9: Updated CSS comments (VendorChip → FilterChip)
- 10: Updated FilterChip doc comment (removed VendorChip reference)
- 11: Visual verification via browser — all checks pass (title, groups, selection, exclude, numeric input, alert)
- 12: Updated STATUS.md, AGENT_NAVIGATION.md
- Тесты: 761/761 ✅ | Build: ✅ | TypeScript: ✅ | !important: 0

Stage Summary:
- VendorPage fully unified with useCategoryPage (no more separate useVendorPage hook)
- Deployment build error fixed
- VendorChip deleted — all pages use FilterChip
- GROUP_COLORS derived from token tags system
- Numeric vendor properties (Ур. предмета, Треб. уровень) show min/max inputs when selected
- displayText post-processing prevents duplicate range display for numeric chips

---
Task ID: 6
Agent: main
Task: Итерация 6 — семантические opacity-токены, vendor-adapter fix, customData support

Work Log:
- E1: FilterChip opacity-modifiers → семантические токены
- E2: CategoryControlPanel warnings → семантические
- E3: Overflow indicator → `text-accent-red-dim`
- E4: VendorChip exclude button → семантические токены
- E5: Alert borders/text → семантические
- E6: vendor-adapter.ts исправлен
- E7: useCategoryPage — добавлен `customData` support
- E8: --lt-* переменные проверены
- Тесты: 761/761 ✅ | Build: ✅ | TypeScript: ✅ | !important: 0

Stage Summary:
- Все opacity-модификаторы переведены на семантические токены (dark + light)
- vendor-adapter корректен и готов к интеграции
- useCategoryPage поддерживает customData — инфраструктура для N1 готова
