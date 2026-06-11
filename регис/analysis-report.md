# Regex Analysis Report (Summary)

> Generated: 2026-06-12 (updated)
> Data source: public/generated/
> Total tokens: 1823 (all categories)
> Categories: amulet, belt, jewel-corrupted, jewel-desecrated, jewel, relic, ring, tablet, waystone-desecrated, waystone

---

## Key Findings

### Short Regex Distribution

| Regex Length | Count | Risk Level |
|-------------|-------|------------|
| 4 chars | 1 | High FP risk — `огня` (has `regexPrefixContext`) |
| 5 chars | ~80 | Medium — many rely on context/excludes |
| 6 chars | ~150 | Moderate |
| 7+ chars | ~210 | Low |

**Total tokens with regex < 10 chars: 440** (28% of all tokens)

### Cross-Family FP Status

After `repairCrossFamilyFP()`: **0 cross-family FP** across all categories.

Family-tier FP is expected (by design) — all tiers of the same mod family share the same regex suffix.

### Problematic Patterns (regex ≤ 5 chars)

These rely on `regexExclude` or `regexPrefixContext`:

| Pattern | Category | Mitigation |
|---------|----------|------------|
| `огня` | amulet | regexPrefixContext |
| `молнии` | jewel/waystone | regexExclude/context |
| `на вас` | relic | regexExclude/context |

---

## Truncation Status

**Принцип:** PoE2 = substring search. Базовые truncations работают 100% — верификация нужна только при риске FP на другое слово.

| Truncation | Safe? | Reason |
|------------|-------|--------|
| `эффективн` | ✅ | Уникальная морфема |
| `бездн` | ✅ | Уникальная морфема |
| `путев` | ✅ | Уникальная морфема |
| `глубин` | ✅ | Уникальная морфема |
| `приспешник` | ✅ | Уникальная морфема |
| `оглушен` | ✅ | Уникальная морфема |
| `флакон` | ✅ | Уникальная морфема |
| `хаос` | ✅ | Уникальная морфема |
| `монстр` | ✅ | Уникальная морфема |
| `редкост` | ❌ BLACKLIST | FP на «редкий» |
| `редк` | ❌ BLACKLIST | FP на «редкий» |
| `провал` | ❌ BLACKLIST | Нетестировано + низкая ценность |

---

## How to Regenerate Full Report

Run: `pnpm analyze-fn` — produces detailed per-token analysis.
