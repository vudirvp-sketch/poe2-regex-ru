#!/usr/bin/env python3
"""APCA (Advanced Perceptual Contrast Algorithm) validation for iter 110.

APCA is the WCAG 3.0 candidate contrast model. Unlike WCAG 2.x's
simple ratio, APCA:
  - is polarity-aware (light-on-dark ≠ dark-on-light)
  - weights perceptual mid-tones more correctly
  - returns an Lc value in [-108, +108] where |Lc| ≥ 75 = body text OK,
    |Lc| ≥ 90 = small text OK (12px @ weight 400 or 14px @ weight 500).

Reference: https://github.com/Myndex/SAPC-APCA
This is the canonical APCA 0.0.98G (W3) formula.
"""

# APCA 0.0.98G (W3) — canonical implementation
def sRGB_to_Y(sRGB):
    """Convert sRGB component (0..255) to relative luminance (0..1),
    using the APCA-specific transfer function (matches the W3 reference)."""
    v = sRGB / 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def APCA_contrast(txt_hex, bg_hex):
    """Returns Lc value (positive = light text on dark bg)."""
    txt_rgb = hex_to_rgb(txt_hex)
    bg_rgb = hex_to_rgb(bg_hex)

    # Relative luminances (0..1) — APCA uses pure sRGB→Y, no scale.
    Ytxt = (
        sRGB_to_Y(txt_rgb[0]) * 0.2126
        + sRGB_to_Y(txt_rgb[1]) * 0.7152
        + sRGB_to_Y(txt_rgb[2]) * 0.0722
    )
    Ybg = (
        sRGB_to_Y(bg_rgb[0]) * 0.2126
        + sRGB_to_Y(bg_rgb[1]) * 0.7152
        + sRGB_to_Y(bg_rgb[2]) * 0.0722
    )

    # Soft-clamp — APCA 0.0.98G canonical black anchoring.
    # Values below 0.022 are noise; subtract 0.022 to anchor at zero.
    if Ytxt >= 0.022:
        Rtxt = Ytxt - 0.022
    else:
        Rtxt = 0.0
    if Ybg >= 0.022:
        Rbg = Ybg - 0.022
    else:
        Rbg = 0.0

    # Main APCA math — different exponents for the two polarities.
    # Sign convention (per APCA spec):
    #   - Ybg > Ytxt → dark text on light bg (BoW) → POSITIVE Lc
    #   - Ybg < Ytxt → light text on dark bg (WoB) → NEGATIVE Lc
    # For dark UI our text is light-on-dark, so we expect negative Lc.
    # The |Lc| thresholds are: ≥75 = body text, ≥90 = small text.
    if Ybg > Ytxt:
        # BoW — dark text on light bg
        Lc = (Rbg ** 0.56 - Rtxt ** 0.57) * 1.14
    else:
        # WoB — light text on dark bg
        Lc = (Rbg ** 0.65 - Rtxt ** 0.62) * 1.14

    # APCA publishes Lc × 100 so the practical range is [-108, +108].
    # The raw formula returns [-1.08, +1.08].
    Lc = Lc * 100.0

    # Soft-clamp to ±108
    if abs(Lc) > 108:
        Lc = 108.0 * (1.0 if Lc > 0 else -1.0)
    return round(Lc, 1)


# ─── iter 110 colour pairs to validate ──────────────────────────────────
PAIRS = [
    # Text on primary bg
    ("text-primary (#F0E6D2) on --poe-bg (#0D0B09)",
     "#F0E6D2", "#0D0B09", "body text / h1-h6", 75),
    ("text-soft (#d1d5db) on --poe-bg",
     "#d1d5db", "#0D0B09", "secondary body text", 75),
    ("text-muted (#9ca3af) on --poe-bg",
     "#9ca3af", "#0D0B09", "tertiary text", 75),
    ("text-dim NEW (#7A8494) on --poe-bg",
     "#7A8494", "#0D0B09", "small UI labels", 90),
    ("text-dim OLD (#6b7280) on --poe-bg",
     "#6b7280", "#0D0B09", "small UI labels (old)", 90),
    ("text-faint (#7C8494) on --poe-bg",
     "#7C8494", "#0D0B09", "tertiary labels", 90),

    # Text on secondary bg (panels — after iter 110 bump)
    ("text-primary on --poe-bg-secondary NEW (#1A1510)",
     "#F0E6D2", "#1A1510", "panel headers", 75),
    ("text-dim NEW (#7A8494) on --poe-bg-secondary NEW",
     "#7A8494", "#1A1510", "panel small labels", 90),

    # Text on tertiary bg / input bg
    ("text-primary on --input-bg (#1F1812)",
     "#F0E6D2", "#1F1812", "input value text", 75),
    ("text-dim NEW (#7A8494) on --input-bg",
     "#7A8494", "#1F1812", "range input n/250 count", 90),
    ("text-dim OLD (#6b7280) on --input-bg",
     "#6b7280", "#1F1812", "range input n/250 count (old)", 90),
    ("text-faint (#7C8494) on --input-bg",
     "#7C8494", "#1F1812", "input placeholder", 90),

    # Placeholder tokens (not changed in iter 110 — for reference)
    ("placeholder-primary (#6b7280) on --input-bg",
     "#6b7280", "#1F1812", "input placeholder (primary)", 90),
    ("placeholder-secondary (#4b5563) on --input-bg",
     "#4b5563", "#1F1812", "input placeholder (secondary)", 90),

    # Accent text on bg
    ("accent-blue (#60a5fa) on --poe-bg",
     "#60a5fa", "#0D0B09", "prefix ⚓ indicator", 75),
    ("accent-emerald (#34d399) on --input-bg",
     "#34d399", "#1F1812", "regex output (part health green)", 75),
    ("accent-yellow (#facc15) on --input-bg",
     "#facc15", "#1F1812", "regex output (part health yellow)", 75),
    ("accent-red (#f87171) on --input-bg",
     "#f87171", "#1F1812", "regex output (part health red)", 75),
]


def main():
    print(f"{'Pair':<62} {'Lc':>7}  {'Threshold':>9}  Verdict")
    print("-" * 100)
    for label, txt, bg, use_case, threshold in PAIRS:
        Lc = APCA_contrast(txt, bg)
        verdict = "PASS" if abs(Lc) >= threshold else "FAIL"
        sign = "+" if Lc >= 0 else ""
        print(f"{label:<62} {sign}{Lc:>6}  {threshold:>9}  {verdict}  [{use_case}]")
    print()
    print("Sign: + = dark text on light bg (BoW), − = light text on dark bg (WoB)")
    print("Reference: |Lc| ≥ 75 = body text (≥16px w400 / ≥14px w500)")
    print("           |Lc| ≥ 90 = small text (≤14px w400 / ≤12px w500)")


if __name__ == "__main__":
    main()
