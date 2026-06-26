#!/usr/bin/env python3
"""
Apply KI#13 fix to public/generated/waystone.json and waystone-desecrated.json.

Changes:
1. Remove tokens whose familyKey.ru matches WAYSTONE_IMPLICIT_SET_FAMILY_KEYS
   (BTS stats that get added to implicits behind the scenes — not searchable).
2. Add new implicit token `Редкость монстров: +##%` with regex `'едкость монстров'`
   (placed between `item_rarity` and `pack_size` to match `generateWaystoneImplicitTokens`).

BTS family keys (matching normalized `##` → `#`, collapse whitespace, trim):
- 'На #% больше находимых в области путевых камней'
- '#% увеличение количества путевых камней, находимых в области'
- 'На #% больше редкости находимых в этой области предметов'
- 'На #% больше размера групп монстров'
- '#% увеличение эффективности монстров'
- 'На #% больше эффективности монстров'
- 'На #% больше волшебных и редких монстров'
- '#% увеличение количества редких монстров'
- '#% увеличение количества волшебных монстров'
- 'На #% больше шанса появления свойств у редких монстров'

Usage:
    python3 scripts/apply-ki13-fix.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / 'public' / 'generated'

BTS_FAMILY_KEYS = [
    'На #% больше находимых в области путевых камней',
    '#% увеличение количества путевых камней, находимых в области',
    'На #% больше редкости находимых в этой области предметов',
    'На #% больше размера групп монстров',
    '#% увеличение эффективности монстров',
    'На #% больше эффективности монстров',
    'На #% больше волшебных и редких монстров',
    '#% увеличение количества редких монстров',
    '#% увеличение количества волшебных монстров',
    'На #% больше шанса появления свойств у редких монстров',
]


def normalize_key(s: str) -> str:
    """Normalize a familyKey the same way `isImplicitSetBonus` does."""
    return s.replace('##', '#').replace(r'\s+', ' ').strip()


def is_bts_token(token: dict) -> bool:
    """Check if a token's familyKey matches a BTS family key."""
    fk = token.get('familyKey', {}).get('ru', '')
    if not fk:
        return False
    norm_fk = normalize_key(fk)
    return norm_fk in BTS_FAMILY_KEYS


def make_monster_rarity_implicit(category: str, origin: str) -> dict:
    """Create the new `Редкость монстров: +##%` implicit token.
    Matches the structure produced by generateWaystoneImplicitTokens() in normalize.ts.
    """
    return {
        "id": f"{category}.implicit.monster_rarity",
        "category": category,
        "origin": origin,
        "rawText": {"ru": "Редкость монстров: +##%"},
        "rawTextTemplate": {"ru": "Редкость монстров: +##%"},
        "familyKey": {"ru": "Редкость монстров: +##%"},
        "regex": {"ru": "едкость монстров"},
        "regexPrefix": {"ru": ""},
        "hasMultiPlaceholder": False,
        "genderForms": {"ru": {}},
        "affix": "implicit",
        "tags": [],
        "ranges": [[0, 999]],
        "values": [],
        "hasYofication": True,
        "yoficationPositions": [8],
        "level": 1,
    }


def patch_file(filepath: Path, category: str, origin: str) -> dict:
    """Patch a single waystone JSON file. Returns stats."""
    print(f'\n=== Patching {filepath.name} ===')
    with filepath.open('r', encoding='utf-8') as f:
        data = json.load(f)

    tokens = data.get('tokens', [])
    initial_count = len(tokens)

    # Identify BTS tokens to remove
    bts_tokens = [t for t in tokens if is_bts_token(t)]
    bts_ids = {t.get('id', '') for t in bts_tokens}
    bts_family_keys = sorted({t.get('familyKey', {}).get('ru', '') for t in bts_tokens})

    print(f'  Total tokens before: {initial_count}')
    print(f'  BTS tokens to remove: {len(bts_tokens)}')
    if bts_family_keys:
        print(f'  BTS family keys found:')
        for k in bts_family_keys:
            count = sum(1 for t in bts_tokens if t.get('familyKey', {}).get('ru', '') == k)
            print(f'    - {k!r}  (count={count})')

    # Remove BTS tokens
    kept_tokens = [t for t in tokens if not is_bts_token(t)]
    print(f'  Tokens after BTS removal: {len(kept_tokens)}')

    # Check if monster_rarity implicit already exists (idempotency)
    has_monster_rarity = any(
        t.get('id', '') == f'{category}.implicit.monster_rarity'
        for t in kept_tokens
    )
    if has_monster_rarity:
        print(f'  monster_rarity implicit already exists — skipping insertion')
    else:
        # Find the position of `item_rarity` implicit to insert monster_rarity after it
        item_rarity_idx = next(
            (i for i, t in enumerate(kept_tokens)
             if t.get('id', '') == f'{category}.implicit.item_rarity'),
            None,
        )
        new_implicit = make_monster_rarity_implicit(category, origin)
        if item_rarity_idx is not None:
            kept_tokens.insert(item_rarity_idx + 1, new_implicit)
            print(f'  Inserted monster_rarity implicit at position {item_rarity_idx + 1} (after item_rarity)')
        else:
            # Fallback: append at end
            kept_tokens.append(new_implicit)
            print(f'  WARNING: item_rarity implicit not found — appended monster_rarity at end')

    # Update tokens in data
    data['tokens'] = kept_tokens

    # Also remove any optimization entries that reference removed BTS token IDs
    opt_entries = data.get('optimizations', [])
    if opt_entries:
        initial_opt_count = len(opt_entries)
        # Each opt entry has a `tokenIds` array — filter out entries where ALL tokenIds are BTS
        # OR remove BTS token IDs from each entry's tokenIds array
        kept_opt = []
        for opt in opt_entries:
            tids = opt.get('tokenIds', [])
            kept_tids = [tid for tid in tids if tid not in bts_ids]
            if kept_tids:
                opt['tokenIds'] = kept_tids
                kept_opt.append(opt)
            else:
                print(f'  DROPPED opt entry: all tokenIds were BTS (family={opt.get("familyKey", {}).get("ru", "")!r})')
        data['optimizations'] = kept_opt
        print(f'  Opt entries: {initial_opt_count} → {len(kept_opt)}')

    # Update version timestamp
    from datetime import datetime, timezone
    data['version'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

    # Write back with stable formatting (2-space indent, ensure_ascii=False)
    with filepath.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    # Validate JSON
    with filepath.open('r', encoding='utf-8') as f:
        json.load(f)
    print(f'  ✅ File written and validated. Final token count: {len(kept_tokens)}')

    return {
        'initial_count': initial_count,
        'final_count': len(kept_tokens),
        'bts_removed': len(bts_tokens),
        'bts_family_keys': bts_family_keys,
        'monster_rarity_added': not has_monster_rarity,
    }


def main():
    stats = {}
    stats['waystone'] = patch_file(
        GENERATED / 'waystone.json',
        category='waystone',
        origin='normal',
    )
    stats['waystone-desecrated'] = patch_file(
        GENERATED / 'waystone-desecrated.json',
        category='waystone-desecrated',
        origin='desecrated',
    )

    # Final summary
    print('\n' + '=' * 60)
    print('KI#13 fix summary:')
    print('=' * 60)
    for fname, s in stats.items():
        print(f'\n{fname}:')
        print(f'  Tokens: {s["initial_count"]} → {s["final_count"]} (removed {s["bts_removed"]} BTS)')
        print(f'  monster_rarity implicit added: {s["monster_rarity_added"]}')

    # Verify: check that no BTS family keys remain
    print('\n=== Verification: no BTS family keys remain ===')
    for fname in ['waystone.json', 'waystone-desecrated.json']:
        with (GENERATED / fname).open('r', encoding='utf-8') as f:
            data = json.load(f)
        family_keys = {t.get('familyKey', {}).get('ru', '') for t in data['tokens']}
        remaining = [k for k in BTS_FAMILY_KEYS if k in family_keys]
        if remaining:
            print(f'  ❌ {fname}: BTS keys still present: {remaining}')
            sys.exit(1)
        else:
            print(f'  ✅ {fname}: no BTS family keys remain')

    # Verify: check monster_rarity implicit is present
    print('\n=== Verification: monster_rarity implicit present ===')
    for fname in ['waystone.json', 'waystone-desecrated.json']:
        with (GENERATED / fname).open('r', encoding='utf-8') as f:
            data = json.load(f)
        has_mr = any(
            t.get('id', '') == f'{fname.replace(".json", "")}.implicit.monster_rarity'
            for t in data['tokens']
        )
        if has_mr:
            print(f'  ✅ {fname}: monster_rarity implicit present')
        else:
            print(f'  ❌ {fname}: monster_rarity implicit MISSING')
            sys.exit(1)


if __name__ == '__main__':
    main()
