# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 87 (OP-1 Phase 2 — weapon sub-blocks for jewel ENABLED in production)

---

## iter 87 — Weapon sub-blocks for jewel (6 weapon-class sub-blocks)

Реализованы 6 weapon-class sub-blocks (melee / bow / crossbow / staff / spear / dagger) для 24 weapon-specific family-keys в jewel.json. JewelPage переключён на новый режим `jewel-functional` — вариант `affix-functional`, где `weapon-specific` блок раскрывается в 6 подблоков по классу оружия.

### Что сделано

**Новая архитектура:**
- `WeaponClass` type (`melee | bow | crossbow | staff | spear | dagger`) + `WEAPON_CLASS_LABELS` (display config, 6 entries).
- `WEAPON_NAME_TO_CLASS` lookup table — 10 weapon name variants → 6 weapon classes.
- `classifyWeaponClass(group): WeaponClass | null` — текстовая классификация по имени оружия.
- `WEAPON_SPECIFIC_PATTERN` — single OR-pattern ловит все 10 weapon name variants.
- `classifyFunctionalBlock()` — добавлен шаг 12 (weapon-specific) ДО crit/damage-type/offence-speed. Match priority обновлён с 15 до 16 шагов.
- Новый `ModGroupMode = 'jewel-functional'` — вариант `affix-functional`, где `weapon-specific` блок раскрывается в 6 sub-blocks (weapon-melee / weapon-bow / weapon-crossbow / weapon-staff / weapon-spear / weapon-dagger) + defensive `weapon-other` fallback (для будущих weapon mods, которые не матчат ни один из 10 weapon names).
- `classifyGroups(mode='jewel-functional')` — split logic с preserve-reference semantics.

**Распределение 24 family-keys по 6 weapon classes (verified симуляцией):**

| Weapon class | Family-keys | Examples |
|---|---|---|
| melee | 10 | урон топорами/булавами/кистенями/мечами/без оружия, скорость атаки (топорами/мечами/без оружия), крит кистенями, шкала оглушения булавами |
| bow | 3 | урон луками, меткость луками, скорость атаки луками |
| crossbow | 2 | урон самострелами, скорость атаки самострелами |
| staff | 3 | урон боевыми посохами, скорость атаки боевыми посохами, шкала заморозки боевыми посохами |
| spear | 3 | урон копьями, скорость атаки копьями, бонус к крит урону копьями |
| dagger | 3 | урон кинжалами, скорость атаки кинжалами, шанс критического удара кинжалами |
| **Итого** | **24** | |

**Match priority (обновлён в iter 87):**
1. spirit → 2. runes-barrier → 3. breach → 4. magic-find → 5. skill-levels → 6. flasks → 7. minions → 8. attributes → 9. resistances → 10. resources → 11. defence-stats → **12. weapon-specific** → 13. crit → 14. damage-type → 15. offence-speed → 16. other

Шаг 12 (weapon-specific) ловит weapon mods ДО crit/damage-type/offence-speed, потому что weapon mods имеют теги attack+damage / attack+speed / attack+critical, но функционально это weapon-conditional passives.

**Simulation (scripts/simulate-iter87-impact.ts):**
- ✅ Check 1: 24 weapon family-keys (≥24 expected)
- ✅ Check 2: all 6 weapon classes have at least 1 family-key
- ✅ Check 3: no weapon mods fell into `weapon-other` fallback bucket
- ✅ Check 4: jewel.json other-bucket = 21.8% (< 30% target)

**Production switch:**
- `src/ui/pages/jewel/JewelPage.tsx` — `groupMode="affix-semantic"` → `groupMode="jewel-functional"` + header docstring обновлён.

**Тесты:** 1315/1315 passing (1268 базовых + 47 новых). Lint: 0 errors (2 pre-existing warnings). TSC: 0 errors.

### Файлы, изменённые в iter 87

- `src/shared/mod-classifier.ts` — +120 строк (WeaponClass type + WEAPON_CLASS_LABELS + WEAPON_NAME_TO_CLASS + classifyWeaponClass + WEAPON_SPECIFIC_PATTERN + шаг 12 в classifyFunctionalBlock + 'jewel-functional' mode в classifyGroups).
- `tests/shared/mod-classifier.test.ts` — +386 строк (+47 тестов: classifyWeaponClass для всех 6 классов, WEAPON_CLASS_LABELS, weapon-specific match priority, jewel-functional mode).
- `src/ui/pages/jewel/JewelPage.tsx` — `groupMode="jewel-functional"` + header docstring.
- `scripts/simulate-iter87-impact.ts` — новый скрипт: mirror классификаторов на реальных jewel JSON.
- `STATUS.md` — актуализация под iter 87.
- `docs/AFFIXES_GROUPING_ANALYSIS.md` — §5/§7/§8 обновлены.
- `worklog.md` — iter 87 section, iter 86 сжат до одной строки.

### Что НЕ сделано (намеренно, ждёт iter 88+)

- **9 оставшихся блоков** (penetration, ailments, area-duration, wisps, buff-skills, meta-skills, conversion, rage-charges, attributes-tagged) — паттерны не написаны. jewel.json other-bucket = 21.8% — приемлемо для production, но можно улучшить.
- **P1–P3** (ETL-tagged functionalCategory, sortKey + groupingMode toggle, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression, приоритет тегов, визуальная сепарация) — не начаты.

### План iter 88

1. **Снижение other-bucket jewel.json ниже 15%** — добавить 2-3 блока (ailments / penetration / area-duration) через tags + text patterns (как iter 86 для jewellery).
2. Если останется время — P1 task: ETL-tagged functionalCategory для jewel (по образцу jewelType).

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82-87): перегруппировка аффиксов. iter 82 — анализ. iter 83 — верификация. iter 84 — 3 P0-фикса. iter 85 — инфраструктура 24 функциональных блоков (7 активны). iter 86 — +7 блоков (14 активны) + production switch для ring/amulet/belt (other-bucket 9.9%). iter 87 — weapon sub-blocks для jewel (6 подблоков для 24 family-key) + production switch для jewel (other-bucket 21.8%). iter 88 — снизить other-bucket jewel.json ниже 15% + возможно ETL-tagged functionalCategory.

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
