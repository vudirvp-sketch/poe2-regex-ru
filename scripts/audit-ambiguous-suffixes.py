#!/usr/bin/env python3
"""
iter 127 — Audit script for ambiguous-suffix FP pattern (KI#10 pattern).

Goal: Find tokens in public/generated/*.json whose `regex.ru` is short / generic
and might appear as a substring in OTHER in-game mod texts that share the same
suffix word. The KI#10 fix showed that suffixes like `едкость` (7 chars) match
both `Редкость предметов` AND (hypothetically) `Редкость монстров`, causing FP
on multi-implicit waystones.

For every category, for every token with regex ≤ MAX_REGEX_LEN chars, check:
  1. Is the regex a single short word (no spaces)?
  2. Does the regex string appear as a substring in any OTHER token's rawText
     (across ALL categories — to model in-game item text that may mix implicits
     from different categories that share words)?
  3. For implicits especially — multi-implicit items risk same-block ambiguity.

Output: a report of suspicious tokens grouped by risk level.
"""

import json
import os
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path("/home/z/my-project/work/poe2-regex-ru")
GEN_DIR = REPO_ROOT / "public" / "generated"
REGIS_DIR = REPO_ROOT / "регис"

MAX_REGEX_LEN = 12  # short regexes are suspicious
MIN_REGEX_LEN = 3   # ignore too-short (already filtered by ETL)


def load_all_tokens():
    """Load all tokens from all generated/*.json files."""
    all_tokens = []  # list of (category, token_dict)
    for json_path in sorted(GEN_DIR.glob("*.json")):
        category = json_path.stem  # e.g., 'waystone', 'waystone-desecrated'
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        for token in data.get("tokens", []):
            all_tokens.append({
                "category": category,
                "token_id": token.get("id", ""),
                "rawText_ru": token.get("rawText", {}).get("ru", ""),
                "rawTextTemplate_ru": token.get("rawTextTemplate", {}).get("ru", ""),
                "regex_ru": token.get("regex", {}).get("ru", ""),
                "block": token.get("block", ""),
                "type": token.get("type", ""),
                "familyKey": token.get("familyKey", ""),
            })
    return all_tokens


def load_regis_mods():
    """Load all mod texts from регис/*.md files (manual references)."""
    regis_texts = []
    if REGIS_DIR.exists():
        for md_path in sorted(REGIS_DIR.glob("*.md")):
            try:
                with open(md_path, encoding="utf-8") as f:
                    content = f.read()
                # crude extraction: lines that look like mod texts
                for line in content.splitlines():
                    line = line.strip()
                    # Russian mod lines: usually have a number or % sign
                    if any(c in line for c in "%+#") and len(line) > 10:
                        # Strip markdown list/table prefixes
                        for prefix in ["| ", "- ", "* ", "1. ", "2. ", "# "]:
                            if line.startswith(prefix):
                                line = line[len(prefix):].strip()
                        if line and not line.startswith("|"):
                            regis_texts.append(line)
            except Exception as e:
                print(f"  ! could not read {md_path.name}: {e}")
    return regis_texts


def find_ambiguous_suffixes(all_tokens, regis_texts):
    """Find tokens whose regex is short AND appears as substring in other token texts."""
    # Build cross-category text corpus
    cross_corpus = []  # list of (category, token_id, rawText_ru, template_ru)
    for t in all_tokens:
        if t["rawText_ru"]:
            cross_corpus.append((t["category"], t["token_id"], t["rawText_ru"].lower(), t["rawTextTemplate_ru"].lower()))

    # For each suspicious token, find collisions
    suspicious = []
    for t in all_tokens:
        regex = t["regex_ru"].lower().strip()
        if not regex or len(regex) < MIN_REGEX_LEN or len(regex) > MAX_REGEX_LEN:
            continue
        # Skip regexes with PoE2 metacharacters (|, \\, ., *, +, etc.) — they're already-compiled
        if any(ch in regex for ch in "|\\.*+?()[]{}^$"):
            # Skip already-compiled regexes (these come from i18n-overrides with explicit regex
            # OR from custom compile paths). They're not literal substrings.
            # Actually some valid regexes may contain no metachars but still be flagged. Let's
            # only flag PURE literal substrings (no regex meta).
            continue

        # Now check: does this regex appear in OTHER tokens' rawText (cross-category)?
        cross_matches = []
        for (cat, tid, raw, tmpl) in cross_corpus:
            if cat == t["category"] and tid == t["token_id"]:
                continue
            # Skip same-family tokens (same familyKey)
            if cat == t["category"] and t["familyKey"] and t["familyKey"] == tmpl:
                continue
            if regex in raw:
                cross_matches.append((cat, tid, raw))

        # Also check in регис texts (manual reference data — in-game mod texts not in our DB)
        regis_matches = []
        for line in regis_texts:
            if regex in line.lower():
                regis_matches.append(line)

        if cross_matches or regis_matches:
            suspicious.append({
                "category": t["category"],
                "token_id": t["token_id"],
                "regex_ru": t["regex_ru"],
                "rawText_ru": t["rawText_ru"],
                "rawTextTemplate_ru": t["rawTextTemplate_ru"],
                "block": t["block"],
                "type": t["type"],
                "cross_matches": cross_matches[:5],  # first 5
                "cross_match_count": len(cross_matches),
                "regis_matches": regis_matches[:5],
                "regis_match_count": len(regis_matches),
            })

    return suspicious


def is_implicit(token):
    """Heuristic: implicit tokens have 'implicit' in their id or block."""
    return ("implicit" in token["token_id"].lower()
            or "implicit" in (token["block"] or "").lower()
            or token["type"] == "implicit")


def main():
    print("=" * 80)
    print("iter 127 — Audit for KI#10-style ambiguous suffix FP pattern")
    print("=" * 80)

    all_tokens = load_all_tokens()
    print(f"\nLoaded {len(all_tokens)} tokens from {len(list(GEN_DIR.glob('*.json')))} JSON files.")

    regis_texts = load_regis_mods()
    print(f"Loaded {len(regis_texts)} reference mod texts from регис/*.md")

    # Stats by category
    by_cat = defaultdict(int)
    for t in all_tokens:
        by_cat[t["category"]] += 1
    print("\nTokens per category:")
    for cat, n in sorted(by_cat.items()):
        print(f"  {cat:30s}: {n:5d}")

    suspicious = find_ambiguous_suffixes(all_tokens, regis_texts)
    print(f"\n{'=' * 80}")
    print(f"Found {len(suspicious)} suspicious tokens with short/ambiguous regex.")
    print(f"{'=' * 80}\n")

    # Group by risk level
    # HIGH: implicit tokens (multi-implicit items, same-block ambiguity risk)
    # MEDIUM: explicit tokens with cross-category collisions
    # LOW: only regis matches (hypothetical)
    high_risk = [s for s in suspicious if is_implicit(s) and s["cross_match_count"] > 0]
    med_risk = [s for s in suspicious if not is_implicit(s) and s["cross_match_count"] > 0]
    low_risk = [s for s in suspicious if s["cross_match_count"] == 0 and s["regis_match_count"] > 0]

    def report_group(title, items):
        if not items:
            print(f"\n--- {title}: 0 tokens ---")
            return
        print(f"\n--- {title}: {len(items)} tokens ---")
        for s in items:
            print(f"\n  [{s['category']}] {s['token_id']}")
            print(f"    regex.ru      = {s['regex_ru']!r}  (len={len(s['regex_ru'])})")
            print(f"    rawText       = {s['rawText_ru']!r}")
            print(f"    template      = {s['rawTextTemplate_ru']!r}")
            print(f"    block/type    = {s['block']!r} / {s['type']!r}")
            if s["cross_matches"]:
                print(f"    cross-cat matches ({s['cross_match_count']} total, showing first 5):")
                for (cat, tid, raw) in s["cross_matches"]:
                    print(f"      [{cat}] {tid}")
                    print(f"        {raw!r}")
            if s["regis_matches"]:
                print(f"    регис matches ({s['regis_match_count']} total, showing first 5):")
                for line in s["regis_matches"]:
                    print(f"      {line!r}")

    report_group("HIGH RISK (implicits with cross-category collisions)", high_risk)
    report_group("MEDIUM RISK (explicits with cross-category collisions)", med_risk)
    report_group("LOW RISK (only регис matches, hypothetical in-game)", low_risk)

    # Save full report to file for inspection
    out_path = Path("/home/z/my-project/scripts/audit-ambiguous-suffixes-report.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("iter 127 — Audit report for KI#10-style ambiguous suffix FP pattern\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Total suspicious tokens: {len(suspicious)}\n")
        f.write(f"  HIGH risk (implicits with cross-cat):   {len(high_risk)}\n")
        f.write(f"  MEDIUM risk (explicits with cross-cat): {len(med_risk)}\n")
        f.write(f"  LOW risk (only регис):                  {len(low_risk)}\n\n")
        for label, items in [("HIGH RISK", high_risk), ("MEDIUM RISK", med_risk), ("LOW RISK", low_risk)]:
            f.write(f"\n{'='*80}\n{label}: {len(items)} tokens\n{'='*80}\n")
            for s in items:
                f.write(f"\n[{s['category']}] {s['token_id']}\n")
                f.write(f"  regex.ru      = {s['regex_ru']!r}  (len={len(s['regex_ru'])})\n")
                f.write(f"  rawText       = {s['rawText_ru']!r}\n")
                f.write(f"  template      = {s['rawTextTemplate_ru']!r}\n")
                f.write(f"  block/type    = {s['block']!r} / {s['type']!r}\n")
                if s["cross_matches"]:
                    f.write(f"  cross-cat matches ({s['cross_match_count']} total):\n")
                    for (cat, tid, raw) in s["cross_matches"]:
                        f.write(f"    [{cat}] {tid}: {raw!r}\n")
                if s["regis_matches"]:
                    f.write(f"  регис matches ({s['regis_match_count']} total):\n")
                    for line in s["regis_matches"]:
                        f.write(f"    {line!r}\n")
    print(f"\n\nFull report saved to: {out_path}")


if __name__ == "__main__":
    main()
