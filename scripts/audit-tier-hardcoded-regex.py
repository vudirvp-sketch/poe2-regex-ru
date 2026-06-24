#!/usr/bin/env python3
"""
iter 127 — Audit for single-# tokens whose regex hardcoded the tier value.

Pattern: token template uses single `#` (one digit, not `##`), and the regex
contains the actual digit value from rawText. This means the regex is
tier-specific (matches only ONE tier) instead of tier-agnostic (matches the
whole family).

Example bug:
  Token: relic.sanctummonstersreduceddamage1
    rawText:     'Монстры наносят уменьшенный на 6% урон'
    template:    'Монстры наносят уменьшенный на #% урон'  (single #)
    regex:       'на 6%'   ← hardcoded '6', tier-specific
    familyKey:   'Монстры наносят уменьшенный на #% урон'
  Sibling tokens (with ## template) have regex 'монстры наносят уменьшенный на '
  (tier-agnostic). Family optimization entry uses FIRST token's regex → 'на 6%'
  → FN: family filter only matches tier 1, not tiers 2-3.

This is a KI#10-style bug (regex too specific / wrong scope).
"""

import json
import re
from pathlib import Path

GEN_DIR = Path("/home/z/my-project/work/poe2-regex-ru/public/generated")


def audit():
    """Find single-# tokens whose regex contains the rawText's digit value."""
    issues = []

    for json_path in sorted(GEN_DIR.glob("*.json")):
        category = json_path.stem
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        # Build family map: familyKey → list of tokens
        family_map = {}
        for token in data.get("tokens", []):
            fk = token.get("familyKey", {}).get("ru", "")
            if fk:
                family_map.setdefault(fk, []).append(token)

        for token in data.get("tokens", []):
            tmpl = token.get("rawTextTemplate", {}).get("ru", "")
            raw = token.get("rawText", {}).get("ru", "")
            regex = token.get("regex", {}).get("ru", "")
            tid = token.get("id", "")
            fk = token.get("familyKey", {}).get("ru", "")

            # Single-# template (no ##)
            if "##" in tmpl:
                continue
            if "#" not in tmpl:
                continue

            # Extract the digit value from rawText at the position of # in template
            # Find the position of # in template
            hash_pos = tmpl.index("#")
            if hash_pos >= len(raw):
                continue
            # Extract 1-3 digit chars from raw at hash_pos
            m = re.match(r"\d{1,4}", raw[hash_pos:hash_pos+5])
            if not m:
                continue
            digit_value = m.group(0)

            # Check if the regex contains this digit value
            # (This means the regex hardcoded the tier value)
            if digit_value in regex:
                # Also check: are there sibling tokens in the same family with ##?
                siblings = [t for t in family_map.get(fk, []) if t["id"] != tid]
                has_hash_hash_siblings = any(
                    "##" in t.get("rawTextTemplate", {}).get("ru", "")
                    for t in siblings
                )

                # If has ## siblings, the single-# token's regex SHOULD be
                # tier-agnostic (matching all siblings). If it's tier-specific
                # (contains digit), it's a bug.
                if has_hash_hash_siblings:
                    issues.append({
                        "category": category,
                        "token_id": tid,
                        "rawText": raw,
                        "template": tmpl,
                        "regex": regex,
                        "digit_value": digit_value,
                        "familyKey": fk,
                        "siblings": [
                            {
                                "id": t["id"],
                                "regex": t.get("regex", {}).get("ru", ""),
                                "template": t.get("rawTextTemplate", {}).get("ru", ""),
                            }
                            for t in siblings
                        ],
                    })

    return issues


def main():
    print("=" * 80)
    print("iter 127 — Audit for single-# tokens with tier-hardcoded regex (KI#10-pattern)")
    print("=" * 80)

    issues = audit()
    print(f"\nFound {len(issues)} tokens with tier-hardcoded regex.\n")

    for issue in issues:
        print(f"[{issue['category']}] {issue['token_id']}")
        print(f"  rawText:     {issue['rawText']!r}")
        print(f"  template:    {issue['template']!r}")
        print(f"  regex:       {issue['regex']!r}  (contains hardcoded digit {issue['digit_value']!r})")
        print(f"  familyKey:   {issue['familyKey']!r}")
        print(f"  siblings ({len(issue['siblings'])}):")
        for s in issue["siblings"]:
            print(f"    {s['id']}")
            print(f"      regex:    {s['regex']!r}")
            print(f"      template: {s['template']!r}")
        print()

    # Save report
    out_path = Path("/home/z/my-project/scripts/audit-tier-hardcoded-regex-report.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("iter 127 — Audit for single-# tokens with tier-hardcoded regex\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Total tokens with tier-hardcoded regex: {len(issues)}\n\n")
        for issue in issues:
            f.write(f"[{issue['category']}] {issue['token_id']}\n")
            f.write(f"  rawText:     {issue['rawText']!r}\n")
            f.write(f"  template:    {issue['template']!r}\n")
            f.write(f"  regex:       {issue['regex']!r}\n")
            f.write(f"  digit_value: {issue['digit_value']!r}\n")
            f.write(f"  familyKey:   {issue['familyKey']!r}\n")
            f.write(f"  siblings:\n")
            for s in issue["siblings"]:
                f.write(f"    {s['id']}: regex={s['regex']!r}, template={s['template']!r}\n")
            f.write("\n")
    print(f"\nReport saved to: {out_path}")


if __name__ == "__main__":
    main()
