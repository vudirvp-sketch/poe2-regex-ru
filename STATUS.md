# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 89 (OP-1 Phase 2 — buff-skills + meta-skills + rage-charges for jewel, other-bucket 8.3%)

---

## iter 89 — buff-skills + meta-skills + rage-charges (jewel other-bucket 8.3%)

Реализованы 3 новых функциональных блока поверх 17 блоков iter 88. jewel.json other-bucket снижен с 14.0% → **8.3%** (цель ~7-8% достигнута). Бонусные улучшения для amulet/ring/belt.

### Что сделано

**3 новых блока (20 активных из 24):**

| Блок | Паттерн | Семей в jewel | Бонус (amulet/ring/belt) |
|---|---|---|---|
| `rage-charges` | `свирепост\|славы.*знам[её]н` | 4 | — |
| `meta-skills` | `Мета-умени\|Архонт\|запечат\|вызываем.*умени` | 1 | +5 (amulet/ring/belt) |
| `buff-skills` | `аур\|Вестник\|мет[о]?к(?!ост)\|клич\|знам[её]н\|проклят` | 6 | +4 (amulet/ring) |

**Позиционирование:** все 3 паттерна вставлены **после `area-duration` (шаг 17)** и **до фолбэк-возврата `other`**. Порядок: rage-charges (более конкретный — слава знамён) → meta-skills → buff-skills (самый широкий — все ауры/вестники/метки/кличи/знамёна/проклятия). Эта позиция гарантирует, что новые блоки ловят только те моды, которые иначе попали бы в `other` — ни один существующий bucket не сломан.

**Match priority (обновлён в iter 89):**
1. spirit → 2. runes-barrier → 3. breach → 4. magic-find → 5. skill-levels → 6. flasks → 7. minions → 8. attributes → 9. resistances → 10. resources → 11. defence-stats → 12. weapon-specific → 13. crit → 14. damage-type → 15. offence-speed → 16. ailments → 17. area-duration → **18. rage-charges** → **19. meta-skills** → **20. buff-skills** → 21. other

**Ключевая защита от false-positive:** `мет[о]?к(?!ост)` — негативный lookahead исключает «меткости» (точность) из buff-skills, ловя только «меток/метки/метку» (метки — mark skills). Без этого lookahead глобальная меткость неправильно попала бы в buff-skills.

**Симуляция (scripts/simulate-iter89-impact.ts):**

| Категория | Groups | other iter 88 | other iter 89 | Δ |
|---|---|---|---|---|
| jewel | 193 | 27 (14.0%) | **16 (8.3%)** | -11 |
| amulet | 105 | 11 (10.5%) | **7 (6.7%)** | -4 |
| ring | 94 | 5 (5.3%) | **3 (3.2%)** | -2 |
| belt | 85 | 7 (8.2%) | **4 (4.7%)** | -3 |

✅ Все 20 реклассификаций — из `other` (ни один существующий bucket не сломан). Подтверждено реальным `classifyFunctionalBlock` через `scripts/verify-iter89-deployment.ts`.

**Тесты:** 1363/1363 passing (1340 + 23 новых для rage-charges + meta-skills + buff-skills). Lint: 0 errors (2 pre-existing warnings). TSC: 0 errors.

### Файлы, изменённые в iter 89

- `src/shared/mod-classifier.ts` — +90 строк (RAGE_CHARGES_PATTERN + META_SKILLS_PATTERN + BUFF_SKILLS_PATTERN + шаги 18/19/20 в classifyFunctionalBlock + JSDoc + обновлённые комментарии).
- `tests/shared/mod-classifier.test.ts` — +23 теста (rage-charges: 4 positive + 2 negative; meta-skills: 6 positive; buff-skills: 8 positive + 4 negative) + 2 обновлённых существующих теста (warcry-recharge теперь buff-skills вместо other).
- `scripts/analyze-iter89-other-bucket.ts` — новый скрипт: dump всех 27 family-keys в `other` после iter 88 (использовался для проектирования паттернов).
- `scripts/simulate-iter89-impact.ts` — новый скрипт: mirror iter 89 patterns + diff vs iter 88 на jewel/amulet/ring/belt.
- `scripts/verify-iter89-deployment.ts` — новый скрипт: финальная верификация с реальным `classifyFunctionalBlock` из исходников (не mirror).
- `STATUS.md`, `worklog.md`, `docs/AFFIXES_GROUPING_ANALYSIS.md` — актуализация под iter 89.

### Что НЕ сделано (намеренно, ждёт iter 90+)

- **3 оставшихся блока** (wisps, conversion, penetration) — паттерны не написаны. jewel.json other-bucket = 8.3% с 20 активными блоками. В jewel.json `other` сейчас 0 family-keys с `сгустк` (wisps), 0 с `от получаемого урона` (conversion — уже в RESOURCES), 0 с `пробива.*сопротивлен` (penetration — уже в damage-type/resistances). Реализация этих блоков даст минимальное снижение other-bucket для jewel, но может помочь для waystone/tablet.
- **P1 task: ETL-tagged functionalCategory** для jewel (по образцу `jewelType`) — не начато. Даст ~100% точность без хрупких regex'ов.
- **P1–P3** (sortKey + groupingMode toggle, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression, приоритет тегов, визуальная сепарация) — не начаты.

### План iter 90

1. Если в jewel.json появятся новые моды (сгустки, конверсия, пробитие) — реализовать соответствующие блоки.
2. P1 task: ETL-tagged functionalCategory для jewel — более высокий приоритет, чем оставшиеся regex-блоки.

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82-89): перегруппировка аффиксов. iter 82 — анализ. iter 83 — верификация. iter 84 — 3 P0-фикса. iter 85 — инфраструктура 24 функциональных блоков (7 активны). iter 86 — +7 блоков (14 активны) + production switch для ring/amulet/belt (other-bucket 9.9%). iter 87 — weapon sub-blocks для jewel (6 подблоков для 24 family-key) + production switch для jewel (other-bucket 21.8%). iter 88 — +2 блока (ailments + area-duration, 17 активны) + UX-фикс «Магический поиск»→«Рарити» (jewel other-bucket 14.0%). iter 89 — +3 блока (rage-charges + meta-skills + buff-skills, 20 активны) (jewel other-bucket 8.3%, бонусные улучшения для amulet/ring/belt).

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
