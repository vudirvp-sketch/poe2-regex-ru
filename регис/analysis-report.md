# Regex Analysis Report (Summary)

> Generated: 2026-06-06T15:00:41.425Z
> Data source: public/generated/
> Total tokens: 1573 (note: current ETL produces 1823 with all categories)
> Categories: amulet, belt, jewel-corrupted, jewel-desecrated, jewel, relic, ring, tablet, waystone-desecrated, waystone

---

## Key Findings

### Short Regex Distribution

| Regex Length | Count | Risk Level |
|-------------|-------|------------|
| 4 chars | 1 | High FP risk — single word like `огня` |
| 5 chars | ~80 | Medium — many rely on context/excludes |
| 6 chars | ~150 | Moderate |
| 7+ chars | ~210 | Low — typically unique enough |

**Total tokens with regex < 10 chars: 440** (28% of all tokens)

### Problematic Patterns (regex length ≤ 5)

These tokens have very short regexes and rely on `regexExclude` or `regexPrefixContext` to prevent cross-family FP:

| Pattern | Category | Example token | Mitigation |
|---------|----------|---------------|------------|
| `огня` | amulet | genesistree firespell base critical chance | regexPrefixContext |
| `урону` | amulet/jewel | critical multiplier (all tiers share this) | family-tier FP (by design) |
| `к силе` | amulet/belt/ring | strength mods (all tiers) | family-tier FP (by design) |
| `броне` | belt | armour mods (all tiers) | family-tier FP (by design) |
| `молнии` | jewel/waystone | lightning damage/res | regexExclude/context |
| `холоду` | jewel | cold resistance | family-tier FP |
| `хаосу` | jewel | chaos resistance | family-tier FP |
| `быстрее` | amulet/belt | minion revive speed | family-tier FP |
| `для чар` | amulet/jewel/ring | spell crit chance | family-tier FP |
| `на вас` | relic | various self-buffs | regexExclude/context |
| `секунду` | ring | life regen | family-tier FP |

### Cross-Family FP Status

After `repairCrossFamilyFP()`: **0 cross-family FP** across all categories.

Family-tier FP is expected (by design) — all tiers of the same mod family share the same regex suffix.

---

## How to Regenerate Full Report

Run: `pnpm analyze-fn` — produces detailed per-token analysis in this file.
The full 440-entry table is omitted here to keep this file lightweight for agent context.
