# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 86 (OP-1 Phase 2 — 14 functional blocks ENABLED in production)

---

## iter 86 — 14 functional blocks enabled in production

Реализованы 7 новых функциональных блоков через **tags + text patterns** (поверх 7 блоков iter 85). Production-страницы RingPage / AmuletPage / BeltPage **переключены на `affix-functional`** — simulation подтвердила other-bucket = 9.9% (цель <30%).

### Что сделано

**7 новых блоков (tags + text):**
| Блок | Ловит через | Примеры |
|---|---|---|
| `defence-stats` | tags `armour`/`evasion`/`energy_shield`/`charm` + text «брон/уклонен/блок/порог оглушен/отклонен ударов» | `+# к броне`, `##% увеличение уклонения`, `Обереги получают зарядов в секунду`, `+# к порогу оглушения` |
| `offence-speed` | tag `speed` + text «скорость атаки/сотворения/передвижения/снарядов» | `##% повышение скорости сотворения чар`, `##% повышение скорости атаки` |
| `crit` | tag `critical` + text «крит» | `##% повышение шанса критического удара`, `##% увеличение бонуса к критическому урону` |
| `damage-type` | tags `damage`/`physical`/`elemental`/`cold`/`fire`/`lightning`/`chaos` + text «урон» | `##% увеличение урона от огня`, `Добавляет от # до # физического урона к атакам` |
| `flasks` | text «флакон» (belt primary + amulet charm-tagged) | `Флаконы получают зарядов в секунду`, `##% шанс сохранить заряды флаконов` |
| `resources` | tags `life`/`mana` + text «максимум.*энерг.*щит/похищен/регенерац/восстанавливает» | `+# к максимуму здоровья`, `+# к максимуму энергетического щита`, `##% полученного урона восполняется в виде здоровья`, MoM |
| `minions` | tag `minion` + text «приспешник/подношен» | `Приспешники имеют ##% увеличение урона`, `##% усиление эффекта Подношений` |

**Match priority (важен — специфичные блоки раньше общих):**
1. spirit → 2. runes-barrier → 3. breach → 4. magic-find → 5. skill-levels → 6. flasks → 7. minions → 8. attributes → 9. resistances → 10. resources → 11. defence-stats → 12. crit → 13. damage-type → 14. offence-speed → 15. other

**Ключевые приоритеты тегов:**
- `minion` бьёт `life`/`mana`/`critical`/`damage`/`speed`/`resistance` (миньон-моды — про миньонов, не про стат)
- `resistance` бьёт `fire`/`cold`/`lightning`/`chaos`/`elemental` (резист-моды имеют те же теги)
- `life`/`mana` бьёт `energy_shield` через text «максимум.*энерг.*щит» (ES-максимум → resources, ES-recharge → defence-stats)
- `critical` бьёт `damage` (крит-моды имеют оба тега)

**Simulation (scripts/simulate-iter86-impact.ts):**

| Категория | Total | Other bucket |
|---|---|---|
| ring | 94 | 9 (9.6%) |
| amulet | 105 | 12 (11.4%) |
| belt | 85 | 7 (8.2%) |
| **Итого** | 284 | **28 (9.9%)** |

**Production switch:**
- `src/ui/pages/ring/RingPage.tsx` — `groupMode="affix-functional"`
- `src/ui/pages/amulet/AmuletPage.tsx` — `groupMode="affix-functional"`
- `src/ui/pages/belt/BeltPage.tsx` — `groupMode="affix-functional"`

**Тесты:** 1268/1268 passing (1216 базовых + 52 новых). Lint: 0 errors. TSC: 0 errors.

### Файлы, изменённые в iter 86

- `src/shared/mod-classifier.ts` — +200 строк (7 новых паттернов + tag-based классификация в `classifyFunctionalBlock()`, обновлены комментарии).
- `tests/shared/mod-classifier.test.ts` — +400 строк (+52 теста: 7 блоков с 4-9 тестами каждый + edge cases + match priority).
- `src/ui/pages/ring/RingPage.tsx` — `groupMode="affix-functional"` + header docstring обновлён.
- `src/ui/pages/amulet/AmuletPage.tsx` — то же.
- `src/ui/pages/belt/BeltPage.tsx` — то же.
- `scripts/simulate-iter86-impact.ts` — новый скрипт: mirror `classifyFunctionalBlock()` на реальных jewellery JSON.
- `STATUS.md` — актуализация под iter 86.
- `docs/AFFIXES_GROUPING_ANALYSIS.md` — §5/§7/§8 обновлены.
- `worklog.md` — iter 86 section, iter 85 сжат до одной строки.

### Что НЕ сделано (намеренно, ждёт iter 87+)

- **10 оставшихся блоков** (penetration, ailments, area-duration, wisps, buff-skills, meta-skills, weapon-specific, conversion, rage-charges, attributes-tagged) — паттерны не написаны. Currently все попадают в `other` (9.9% — приемлемо для production, но можно улучшить).
- **Weapon sub-blocks для jewel** (6 подблоков для 24 family-key) — не начато. Сложная задача: требует подуровня внутри offensive bucket. Это **iter 87**.
- **P1–P3** (ETL-tagged functionalCategory, sortKey + groupingMode toggle, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression, приоритет тегов, визуальная сепарация) — не начаты.

### План iter 87

1. **Weapon sub-blocks для jewel** (главная задача): 6 подблоков (melee/bow/crossbow/staff/spear/dagger) для 24 family-key. Требует подуровня внутри offensive bucket.
2. Если останется время — добавить ещё 2-3 блока из списка выше (penetration / ailments / area-duration) для дальнейшего снижения other-bucket ниже 5%.

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82-86): перегруппировка аффиксов. iter 82 — анализ. iter 83 — верификация. iter 84 — 3 P0-фикса. iter 85 — инфраструктура 24 функциональных блоков (7 активны). iter 86 — +7 блоков (14 активны) + production switch (other-bucket 9.9%). iter 87 — weapon sub-blocks для jewel + возможно ещё 2-3 блока.

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
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре (defensive guard в Oracle — iter 73) |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts (iter 50) |

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
Контакты: Discord **woonderdad**
