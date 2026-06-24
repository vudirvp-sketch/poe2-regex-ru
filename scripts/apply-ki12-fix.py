#!/usr/bin/env python3
"""
iter 127 — Apply KI#12 fix: tier-hardcoded regex for single-# relic tokens.

For each of the 7 problematic relic tokens, set the regex to match the
tier-agnostic regex used by their `##` siblings. Also patch the family-level
optimization entries to use the new tier-agnostic regex, and delete the 3
broken cross-family entries that include problematic tokens.

Files modified:
  - scripts/etl/i18n-overrides.json  (add 7 override entries)
  - public/generated/relic.json     (patch 7 token regexes + 4 family opt entries + delete 3 cross-family entries)
"""

import json
from pathlib import Path

REPO = Path("/home/z/my-project/work/poe2-regex-ru")
OVERRIDES_PATH = REPO / "scripts/etl/i18n-overrides.json"
RELIC_JSON_PATH = REPO / "public/generated/relic.json"

# ─── Fix spec: token_id → (new_regex, new_prefixContext, new_regexExclude) ───
# Format matches the JSON structure of relic.json's regex / regexPrefixContext / regexExclude fields.
FIXES = {
    "relic.sanctummonstersreduceddamage1": {
        "regex": "монстры наносят уменьшенный на ",
        "regexPrefixContext": "",
        "regexExclude": [],
        "rawText": "Монстры наносят уменьшенный на 6% урон",
        "rawTextTemplate": "Монстры наносят уменьшенный на #% урон",
        "source": "iter 127 KI#12 fix — single-# template produced tier-hardcoded regex 'на 6%' (FN for tiers 2-3). Override to tier-agnostic regex matching ## siblings (reduceddamage2/3).",
    },
    "relic.sanctummonsterspeed1": {
        "regex": "корость атаки, сотворения чар и",
        "regexPrefixContext": "",
        "regexExclude": [],
        "rawText": "Скорость атаки, сотворения чар и передвижения монстров снижена на 4%",
        "rawTextTemplate": "Скорость атаки, сотворения чар и передвижения монстров снижена на #%",
        "source": "iter 127 KI#12 fix — single-# template produced tier-hardcoded regex 'на 4%' (FN for tiers 2-3). Override to tier-agnostic regex matching ## sibling (monsterspeed3).",
    },
    "relic.sanctummonsterspeed2": {
        "regex": "корость атаки, сотворения чар и",
        "regexPrefixContext": "",
        "regexExclude": [],
        "rawText": "Скорость атаки, сотворения чар и передвижения монстров снижена на 5%",
        "rawTextTemplate": "Скорость атаки, сотворения чар и передвижения монстров снижена на #%",
        "source": "iter 127 KI#12 fix — single-# template produced tier-hardcoded regex 'а на 5' (FN for tiers 1,3). Override to tier-agnostic regex matching ## sibling (monsterspeed3).",
    },
    "relic.sanctumrevealextraroomeachfloor2": {
        "regex": "на карте испытаний раскрывается",
        "regexPrefixContext": "",
        "regexExclude": ["дополнительная"],
        "rawText": "На карте испытаний раскрывается дополнительных комнат: 2",
        "rawTextTemplate": "На карте испытаний раскрывается дополнительных комнат: #",
        "source": "iter 127 KI#12 fix — single-# template produced tier-hardcoded regex 'ат: 2' (FN for other tiers). Override to tier-agnostic regex + exclude (matching ## sibling revealextraroomeachfloorlarge1).",
    },
    "relic.sanctumrevealextraroomeachfloorlarge2": {
        "regex": "на карте испытаний раскрывается",
        "regexPrefixContext": "",
        "regexExclude": ["дополнительная"],
        "rawText": "На карте испытаний раскрывается дополнительных комнат: 4",
        "rawTextTemplate": "На карте испытаний раскрывается дополнительных комнат: #",
        "source": "iter 127 KI#12 fix — single-# template produced tier-hardcoded regex 'ат: 4' (FN for other tiers). Override to tier-agnostic regex + exclude (matching ## sibling revealextraroomeachfloorlarge1).",
    },
    "relic.sanctumguardsreduceddamage1": {
        "regex": "кие монстры наносят уменьшенный",
        "regexPrefixContext": "",
        "regexExclude": [],
        "rawText": "Редкие монстры наносят уменьшенный на 5% урон",
        "rawTextTemplate": "Редкие монстры наносят уменьшенный на #% урон",
        "source": "iter 127 KI#12 fix — single-# template produced tier-hardcoded regex 'ры наносят уменьшенный на 5' (FN for tiers 2-3). Override to tier-agnostic regex matching ## siblings (guardsreduceddamage2/3).",
    },
    "relic.sanctumbossreduceddamage1": {
        "regex": "урон",
        "regexPrefixContext": "Боссы наносят",
        "regexExclude": [],
        "rawText": "Боссы наносят уменьшенный на 5% урон",
        "rawTextTemplate": "Боссы наносят уменьшенный на #% урон",
        "source": "iter 127 KI#12 fix — single-# template produced tier-hardcoded regex 'сы наносят уменьшенный на 5' (FN for tiers 2-3). Override to tier-agnostic regex 'урон' + prefixContext 'Боссы наносят' (matching ## siblings bossreduceddamage2/3).",
    },
}

# ─── Family-level optimization entries to update ───
# These entries use the FIRST (alphabetically) token's regex, which is tier-hardcoded.
# After we fix the per-token regexes, the first token's regex becomes tier-agnostic,
# so we need to update these entries' regex field to match.
FAMILY_OPT_UPDATES = {
    # Key: sorted ids joined by ':'
    "relic.sanctummonstersreduceddamage1:relic.sanctummonstersreduceddamage2:relic.sanctummonstersreduceddamage3": {
        "regex": "монстры наносят уменьшенный на ",
    },
    "relic.sanctummonsterspeed1:relic.sanctummonsterspeed2:relic.sanctummonsterspeed3": {
        "regex": "корость атаки, сотворения чар и",
    },
    "relic.sanctumguardsreduceddamage1:relic.sanctumguardsreduceddamage2:relic.sanctumguardsreduceddamage3": {
        "regex": "кие монстры наносят уменьшенный",
    },
    "relic.sanctumbossreduceddamage1:relic.sanctumbossreduceddamage2:relic.sanctumbossreduceddamage3": {
        "regex": "урон",
        # Note: prefixContext is NOT part of OptimizationEntry — it's per-token.
        # The optimization entry just has 'regex'. The compile-time combines with
        # individual token's prefixContext at runtime if needed.
        # Actually looking at buildOptimizedNode: it uses entry.regexPrefixContext (optional).
        # We need to set it on the entry.
        "regexPrefixContext": "Боссы наносят",
    },
    # Note: revealextraroomeachfloor2:large1:large2 already has tier-agnostic regex
    # 'на карте испытаний раскрывается' (from large1, which was already correct).
    # No update needed.
    # But the 2-token entry revealextraroomeachfloor2:large2 needs to be deleted
    # (it uses tier-hardcoded 'ат:.*4|ат:.*2' Path D).
}

# ─── Cross-family optimization entries to DELETE ───
# These entries include problematic tokens and use tier-hardcoded regexes via Path D.
# After fix, they would need recomputation (can't do without re-running ETL).
# Safer to delete — runtime will OR individual regexes.
CROSS_FAMILY_DELETE_KEYS = [
    "relic.sanctumbossreduceddamage1:relic.sanctumguardsreduceddamage1",
    "relic.sanctumbossreduceddamage1:relic.sanctumguardsreduceddamage1:relic.sanctummonsterspeed2",
    "relic.sanctummonsterspeed1:relic.sanctummonstersreduceddamage1:relic.sanctumrevealextraroomeachfloorlarge1",
    "relic.sanctumrevealextraroomeachfloor2:relic.sanctumrevealextraroomeachfloorlarge2",
]


def update_overrides():
    """Add 7 override entries to i18n-overrides.json."""
    print(f"Updating {OVERRIDES_PATH.name}...")
    with open(OVERRIDES_PATH, encoding="utf-8") as f:
        data = json.load(f)

    if "overrides" not in data:
        data["overrides"] = {}

    for tid, spec in FIXES.items():
        # Skip if rawText/rawTextTemplate not in spec (defensive)
        entry = {
            "rawText": spec["rawText"],
            "rawTextTemplate": spec["rawTextTemplate"],
            "regex": spec["regex"],
            "source": spec["source"],
        }
        if spec["regexPrefixContext"]:
            entry["regexPrefixContext"] = spec["regexPrefixContext"]
        if spec["regexExclude"]:
            entry["regexExclude"] = spec["regexExclude"]
        data["overrides"][tid] = entry
        print(f"  + {tid}: regex={spec['regex']!r}")

    # Update timestamp
    data["_updated"] = "2026-06-25"

    with open(OVERRIDES_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"  Written {OVERRIDES_PATH}")


def patch_relic_json():
    """Patch relic.json: 7 token regexes + 4 family opt entries + delete 3 cross-family entries."""
    print(f"\nPatching {RELIC_JSON_PATH.name}...")
    with open(RELIC_JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    # 1. Patch per-token regexes (and prefixContext/exclude if specified)
    patched_tokens = 0
    for token in data.get("tokens", []):
        tid = token.get("id", "")
        if tid in FIXES:
            spec = FIXES[tid]
            old_regex = token.get("regex", {}).get("ru", "")
            token["regex"]["ru"] = spec["regex"]
            # Set regexPrefixContext
            if "regexPrefixContext" not in token:
                token["regexPrefixContext"] = {}
            token["regexPrefixContext"]["ru"] = spec["regexPrefixContext"]
            # Set regexExclude
            if "regexExclude" not in token:
                token["regexExclude"] = {}
            token["regexExclude"]["ru"] = spec["regexExclude"]
            print(f"  Token {tid}:")
            print(f"    regex: {old_regex!r} → {spec['regex']!r}")
            print(f"    regexPrefixContext: {spec['regexPrefixContext']!r}")
            print(f"    regexExclude: {spec['regexExclude']!r}")
            patched_tokens += 1
    print(f"  Patched {patched_tokens} token regexes.")

    # 2. Update family-level optimization entries
    opt = data.get("optimizationTable", {})
    updated_opts = 0
    for key, update in FAMILY_OPT_UPDATES.items():
        if key in opt:
            old_regex = opt[key].get("regex", {}).get("ru", "")
            opt[key]["regex"]["ru"] = update["regex"]
            if "regexPrefixContext" in update:
                if "regexPrefixContext" not in opt[key]:
                    opt[key]["regexPrefixContext"] = {}
                opt[key]["regexPrefixContext"]["ru"] = update["regexPrefixContext"]
            print(f"  Opt entry {key}:")
            print(f"    regex: {old_regex!r} → {update['regex']!r}")
            updated_opts += 1
        else:
            print(f"  WARNING: opt entry {key!r} not found, skipping.")
    print(f"  Updated {updated_opts} family-level opt entries.")

    # 3. Delete broken cross-family entries
    deleted = 0
    for key in CROSS_FAMILY_DELETE_KEYS:
        if key in opt:
            old_regex = opt[key].get("regex", {}).get("ru", "")
            del opt[key]
            print(f"  Deleted opt entry {key}:")
            print(f"    (was: regex={old_regex!r})")
            deleted += 1
        else:
            print(f"  WARNING: opt entry {key!r} not found, skipping delete.")
    print(f"  Deleted {deleted} cross-family opt entries.")

    with open(RELIC_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"  Written {RELIC_JSON_PATH}")


def verify():
    """Verify patches by re-reading the files."""
    print("\n--- Verification ---")
    # Verify relic.json
    with open(RELIC_JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)
    for tid, spec in FIXES.items():
        token = next((t for t in data["tokens"] if t["id"] == tid), None)
        if not token:
            print(f"  FAIL: {tid} not found in relic.json")
            continue
        actual_regex = token.get("regex", {}).get("ru", "")
        actual_ctx = token.get("regexPrefixContext", {}).get("ru", "")
        actual_excl = token.get("regexExclude", {}).get("ru", [])
        if actual_regex != spec["regex"]:
            print(f"  FAIL: {tid} regex={actual_regex!r}, expected {spec['regex']!r}")
        elif actual_ctx != spec["regexPrefixContext"]:
            print(f"  FAIL: {tid} regexPrefixContext={actual_ctx!r}, expected {spec['regexPrefixContext']!r}")
        elif actual_excl != spec["regexExclude"]:
            print(f"  FAIL: {tid} regexExclude={actual_excl!r}, expected {spec['regexExclude']!r}")
        else:
            print(f"  OK: {tid} regex={actual_regex!r}, ctx={actual_ctx!r}, excl={actual_excl!r}")

    # Verify opt entries
    opt = data.get("optimizationTable", {})
    for key in CROSS_FAMILY_DELETE_KEYS:
        if key in opt:
            print(f"  FAIL: opt entry {key} should have been deleted")
        else:
            print(f"  OK: opt entry {key} deleted")

    # Verify i18n-overrides.json
    with open(OVERRIDES_PATH, encoding="utf-8") as f:
        ov = json.load(f)
    for tid in FIXES:
        if tid not in ov["overrides"]:
            print(f"  FAIL: {tid} not in i18n-overrides.json")
        else:
            print(f"  OK: {tid} in i18n-overrides.json")

    # JSON validity
    print("\nJSON validity: OK (no parse errors)")


if __name__ == "__main__":
    update_overrides()
    patch_relic_json()
    verify()
