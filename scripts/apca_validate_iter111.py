#!/usr/bin/env python3
"""
APCA 0.0.98G canonical validator for iter 111 contrast verification.

Verifies contrast pairs after:
  - KI#3 fix: --placeholder-secondary #4b5563 -> #7A8494 (consolidated with --text-dim)
  - KI#4 fix: --text-faint consolidated into --text-dim (alias)
  - KI#5 partial: font-medium on RegexOutput critical 12px text-dim labels

APCA formula (per APCA-W3 / Myndex SAPC-APCA 0.0.98G):
  1. sRGB -> relative luminance Y (0..1) via inverse sRGB companding.
  2. Soft-clamp Y at 0.022 (avoid div-by-zero on near-black).
  3. Polarity-aware Lc:
       Light text on dark bg  -> Lc = (Yt^0.78 - Yb^0.78) * 1.65 * 100  (negative sign per APCA-W3 convention)
       Dark text on light bg  -> Lc = (Yb^0.78 - Yt^0.78) * 1.45 * 100  (positive)
  4. Soft-clamp at +-108.

APCA thresholds (per APCA-W3):
  Body text >=16px weight >=400      : Lc >= 75 (|Lc|)
  Small text <=14px weight <500      : Lc >= 90 (|Lc|)
  Small text <=14px weight >=500     : Lc >= 75 (|Lc|)  -- heavier weight compensates
  Non-text (borders, icons)          : Lc >= 60 (|Lc|)

WCAG 2.x AA mapping (rough):
  4.5:1 contrast  ~  Lc ~ -75 for body text on dark bg
"""
from __future__ import annotations

# --- APCA core ---------------------------------------------------------------

def srgb_to_y(hex_str: str) -> float:
    """sRGB hex -> relative luminance Y (0..1)."""
    h = hex_str.lstrip('#')
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def wcag_contrast(text_hex: str, bg_hex: str) -> float:
    """WCAG 2.x contrast ratio (1.0 .. 21.0)."""
    yt = srgb_to_y(text_hex) + 0.05
    yb = srgb_to_y(bg_hex) + 0.05
    return max(yt, yb) / min(yt, yb)


def apca_lc(text_hex: str, bg_hex: str) -> float:
    """APCA Lc value. Negative = light text on dark bg (per APCA-W3 sign convention)."""
    yt = srgb_to_y(text_hex)
    yb = srgb_to_y(bg_hex)
    # Soft clamp at 0.022 (canonical black anchoring)
    if yt < 0.022:
        yt = 0.022
    if yb < 0.022:
        yb = 0.022
    if yb > yt:
        # Dark text on light bg -> positive Lc per APCA-W3 convention
        lc = (yb ** 0.78 - yt ** 0.78) * 1.45 * 100
    else:
        # Light text on dark bg -> negative Lc per APCA-W3 convention
        lc = -((yt ** 0.78 - yb ** 0.78) * 1.65 * 100)
    # Soft clamp at +-108
    if abs(lc) < 7:
        lc = 0.0
    elif lc > 108:
        lc = 108
    elif lc < -108:
        lc = -108
    return lc


# --- Iter 111 palette --------------------------------------------------------

# Backgrounds (unchanged from iter 110)
BG_POE       = '#0D0B09'   # --poe-bg
BG_PANEL     = '#1A1510'   # --poe-bg-secondary / --panel-bg (iter 110)
BG_INPUT     = '#1F1812'   # --poe-bg-tertiary / --input-bg

# Text tokens
TEXT_PRIMARY   = '#F0E6D2'  # --text-primary  (iter 109)
TEXT_SOFT      = '#d1d5db'  # --text-soft
TEXT_MUTED     = '#9ca3af'  # --text-muted-val
TEXT_DIM_ITER111 = '#7A8494'  # --text-dim-val (iter 110, unchanged in iter 111)
TEXT_FAINT_ITER110 = '#7C8494'  # --text-faint-val BEFORE iter 111 (consolidated into dim)
TEXT_FAINT_ITER111 = '#7A8494'  # --text-faint-val AFTER iter 111 (alias of dim)

# Placeholder tokens (iter 111 change)
PLACEHOLDER_PRIMARY_ITER110    = '#6b7280'   # BEFORE
PLACEHOLDER_PRIMARY_ITER111    = '#7A8494'   # AFTER (consolidated with text-dim)
PLACEHOLDER_SECONDARY_ITER110  = '#4b5563'   # BEFORE  -- KI#3 FAIL
PLACEHOLDER_SECONDARY_ITER111  = '#7A8494'   # AFTER   -- consolidated with text-dim

# Accent colors
ACCENT_BLUE     = '#60a5fa'
ACCENT_RED      = '#f87171'
ACCENT_EMERALD  = '#34d399'
ACCENT_YELLOW   = '#facc15'


# --- Verification pairs ------------------------------------------------------

PAIRS = [
    # (label, text_hex, bg_hex, kind)
    # kind: 'body' = >=16px weight >=400 -> need |Lc| >= 75
    #       'small400' = <=14px weight 400 -> need |Lc| >= 90
    #       'small500' = <=14px weight 500 -> need |Lc| >= 75
    #       'non-text' = borders/icons -> need |Lc| >= 60

    # Baseline checks (high-contrast tokens — should PASS)
    ('text-primary on poe-bg',     TEXT_PRIMARY, BG_POE,   'body'),
    ('text-primary on panel-bg',   TEXT_PRIMARY, BG_PANEL, 'body'),
    ('text-primary on input-bg',   TEXT_PRIMARY, BG_INPUT, 'body'),
    ('text-soft on poe-bg',        TEXT_SOFT,    BG_POE,   'body'),
    ('accent-yellow on input-bg',  ACCENT_YELLOW, BG_INPUT, 'body'),

    # KI#5: small text tokens that fail APCA Lc>=90 (no fix in iter 111, document tradeoff)
    ('text-dim on poe-bg (12px w400)',       TEXT_DIM_ITER111, BG_POE,   'small400'),
    ('text-dim on input-bg (12px w400)',     TEXT_DIM_ITER111, BG_INPUT, 'small400'),
    ('text-muted on poe-bg (12px w400)',     TEXT_MUTED,       BG_POE,   'small400'),
    ('accent-blue on poe-bg (12px w400)',    ACCENT_BLUE,      BG_POE,   'small400'),
    ('accent-red on poe-bg (12px w400)',     ACCENT_RED,       BG_POE,   'small400'),
    ('accent-emerald on poe-bg (12px w400)', ACCENT_EMERALD,   BG_POE,   'small400'),

    # With weight 500 (iter 111 KI#5 partial fix) -> threshold drops to 75
    ('text-dim on poe-bg (12px w500)',       TEXT_DIM_ITER111, BG_POE,   'small500'),
    ('text-dim on input-bg (12px w500)',     TEXT_DIM_ITER111, BG_INPUT, 'small500'),

    # KI#4: text-faint BEFORE (iter 110) vs AFTER (iter 111)
    ('text-faint iter110 on poe-bg (12px w400)',  TEXT_FAINT_ITER110, BG_POE,   'small400'),
    ('text-faint iter111 on poe-bg (12px w400)',  TEXT_FAINT_ITER111, BG_POE,   'small400'),

    # KI#3: placeholder-secondary BEFORE (iter 110) vs AFTER (iter 111)
    ('placeholder-secondary iter110 on input-bg', PLACEHOLDER_SECONDARY_ITER110, BG_INPUT, 'small400'),
    ('placeholder-secondary iter111 on input-bg', PLACEHOLDER_SECONDARY_ITER111, BG_INPUT, 'small400'),
    ('placeholder-primary iter110 on input-bg',   PLACEHOLDER_PRIMARY_ITER110,   BG_INPUT, 'small400'),
    ('placeholder-primary iter111 on input-bg',   PLACEHOLDER_PRIMARY_ITER111,   BG_INPUT, 'small400'),
]


# --- Runner ------------------------------------------------------------------

THRESHOLDS = {
    'body':     75,
    'small400': 90,
    'small500': 75,
    'non-text': 60,
}


def main() -> None:
    print(f"{'Pair':<48} {'WCAG':>6} {'APCA Lc':>9} {'Need':>6} {'Status':>8}")
    print('-' * 84)
    for label, text_hex, bg_hex, kind in PAIRS:
        wcag = wcag_contrast(text_hex, bg_hex)
        lc = apca_lc(text_hex, bg_hex)
        need = THRESHOLDS[kind]
        passed = abs(lc) >= need and wcag >= 4.5
        status = 'PASS' if passed else 'FAIL'
        # Show wcag_fail flag if WCAG fails (regardless of APCA)
        wcag_flag = '' if wcag >= 4.5 else ' [WCAG FAIL]'
        print(f"{label:<48} {wcag:>5.2f}:1 {lc:>+9.1f} {need:>5}+ {status:>8}{wcag_flag}")


if __name__ == '__main__':
    main()
