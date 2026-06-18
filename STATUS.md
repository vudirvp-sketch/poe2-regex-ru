# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 88 (OP-1 Phase 2 — ailments + area-duration blocks for jewel, other-bucket <15%)

---

## iter 88 — Ailments + Area-Duration blocks for jewel (other-bucket 14.0%)

Реализованы 2 новых функциональных блока (ailments / area-duration) поверх 15 блоков iter 87. jewel.json other-bucket снижен с 21.8% → **14.0%** (цель <15% достигнута). Заодно исправлен давний UX-баг: лейбл «Магический поиск» → «Рарити».

### Что сделано

**2 новых блока (17 активных из 24):**

| Блок | Паттерн | Семей в jewel.json | Примеры |
|---|---|---|---|
| `ailments` | `AILMENTS_PATTERN` (16 keywords + 2 составных) | 8 | поджог/шок/охлажден/отравлен/оцепенен/парир/пригвожден/ослеплен/состояния |
| `area-duration` | `AREA_DURATION_PATTERN` (3 OR-альтернативы) | 7 | области действия / длительности проклятий и знамён / Улучшает радиус |

**Позиционирование:** оба паттерна вставлены **после `offence-speed` (шаг 15)** и **до фолбэк-возврата `other`**. Такая позиция гарантирует, что новые блоки ловят только те моды, которые иначе попали бы в `other` — ни один существующий bucket не сломан. Verify: `simulate-iter88-impact.ts` показывает 0 false positives для jewel/amulet/ring/belt.

**Match priority (обновлён в iter 88):**
1. spirit → 2. runes-barrier → 3. breach → 4. magic-find → 5. skill-levels → 6. flasks → 7. minions → 8. attributes → 9. resistances → 10. resources → 11. defence-stats → 12. weapon-specific → 13. crit → 14. damage-type → 15. offence-speed → **16. ailments** → **17. area-duration** → 18. other

**UX-фикс (явный баг от пользователя):**
- `FUNCTIONAL_BLOCK_LABELS['magic-find'].label`: «Магический поиск» → «Рарити».
- Цвета `area-duration` обновлены с muted на violet — теперь активный блок.

**Симуляция (scripts/simulate-iter88-impact.ts):**

| Категория | Groups | other iter 87 | other iter 88 | Δ |
|---|---|---|---|---|
| jewel | 193 | 42 (21.8%) | **27 (14.0%)** | -15 |
| amulet | 105 | 12 (11.4%) | 11 (10.5%) | -1 |
| ring | 94 | 9 (9.6%) | 5 (5.3%) | -4 |
| belt | 85 | 7 (8.2%) | 7 (8.2%) | 0 |

✅ Все 20 реклассификаций — из `other` (ни один существующий bucket не сломан).

**Тесты:** 1340/1340 passing (1315 + 25 новых для ailments + area-duration). Lint: 0 errors (2 pre-existing warnings). TSC: 0 errors.

### Файлы, изменённые в iter 88

- `src/shared/mod-classifier.ts` — +85 строк (AILMENTS_PATTERN + AREA_DURATION_PATTERN + шаги 16/17 в classifyFunctionalBlock + JSDoc + обновлённые FUNCTIONAL_BLOCK_LABELS: «Магический поиск»→«Рарити», area-duration muted→violet).
- `tests/shared/mod-classifier.test.ts` — +25 тестов (ailments: 11 positive + 4 negative; area-duration: 8 positive + 2 negative).
- `scripts/simulate-iter88-impact.ts` — новый скрипт: mirror iter 88 patterns + diff vs iter 87 на jewel/amulet/ring/belt.
- `scripts/analyze-iter88-other-bucket.ts` — новый скрипт: dump всех 42 family-keys в `other` (использовался для проектирования паттернов).
- `STATUS.md`, `worklog.md`, `docs/AFFIXES_GROUPING_ANALYSIS.md` — актуализация под iter 88.

### Что НЕ сделано (намеренно, ждёт iter 89+)

- **5 оставшихся блоков** (wisps, buff-skills, meta-skills, conversion, rage-charges) — паттерны не написаны. jewel.json other-bucket = 14.0% с 17 активными блоками (можно улучшить до ~7-8%, если реализовать все 5).
- **penetration** — пропущен в iter 88 (0 family-keys в jewel.json `other` с паттерном `пробива.*сопротивлен` — все penetration-моды уже ловятся damage-type/resistances).
- **P1 task: ETL-tagged functionalCategory** для jewel (по образцу `jewelType`) — не начато. Даст ~100% точность без хрупких regex'ов.
- **P1–P3** (sortKey + groupingMode toggle, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression, приоритет тегов, визуальная сепарация) — не начаты.

### План iter 89

1. **Реализовать ещё 2-3 блока** (buff-skills + meta-skills) для дальнейшего снижения other-bucket jewel.json.
2. Если останется время — P1 task: ETL-tagged functionalCategory для jewel.

---

## Known Issues

Открытых Known Issues нет. Все KI (KI-1, KI-2, KI-3) закрыты.

## Открытые долги

- **OP-1** (iter 82-88): перегруппировка аффиксов. iter 82 — анализ. iter 83 — верификация. iter 84 — 3 P0-фикса. iter 85 — инфраструктура 24 функциональных блоков (7 активны). iter 86 — +7 блоков (14 активны) + production switch для ring/amulet/belt (other-bucket 9.9%). iter 87 — weapon sub-blocks для jewel (6 подблоков для 24 family-key) + production switch для jewel (other-bucket 21.8%). iter 88 — +2 блока (ailments + area-duration, 17 активны) + UX-фикс «Магический поиск»→«Рарити» (jewel other-bucket 14.0%).

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
