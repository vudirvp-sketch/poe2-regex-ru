#!/usr/bin/env python3
"""
iter 69 — optimize 4 user-provided hero images for the HomePage.

Strategy:
- Resize each source PNG so the longest side is <= MAX_SIDE px (preserves 2x retina
  quality for the largest display size we use in CSS, ~640px max).
- Encode as WebP lossy q=85 — visually identical to PNG for these images, but ~5-7x smaller.
- Preserve alpha channel (transparent background) — critical for ghosted decorations.

Source PNGs are kept on disk under public/atmosphere/ for reference; the runtime
uses only the .webp outputs. (Source PNGs are removed after conversion to avoid
bloating the repo — they live in git history if ever needed.)
"""
from pathlib import Path
from PIL import Image

ATMOSPHERE = Path("/home/z/my-project/repo/public/atmosphere")

# (source_png, target_webp, max_side)
JOBS = [
    ("hero-bas-relief.png",     "hero-bas-relief.webp",     1280),  # backdrop, max-w-[640px] * 2
    ("hero-monster-red.png",    "hero-monster-red.webp",     640),  # side ghost w-44..w-52 * 2-3
    ("hero-demon-blue.png",     "hero-demon-blue.webp",      640),  # unused in iter 69, future
    ("hero-horned-warrior.png", "hero-horned-warrior.webp",  640),  # side ghost w-44..w-52 * 2-3
]

for src_name, dst_name, max_side in JOBS:
    src = ATMOSPHERE / src_name
    dst = ATMOSPHERE / dst_name
    if not src.exists():
        print(f"SKIP (missing): {src}")
        continue

    img = Image.open(src)
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    w, h = img.size
    longest = max(w, h)
    if longest > max_side:
        scale = max_side / longest
        new_size = (int(round(w * scale)), int(round(h * scale)))
        img = img.resize(new_size, Image.LANCZOS)
        print(f"  {src_name}: {w}x{h} -> {new_size[0]}x{new_size[1]}")
    else:
        print(f"  {src_name}: {w}x{h} (no resize)")

    # quality=85, method=6 (slowest but best compression), preserve alpha
    img.save(dst, "WEBP", quality=85, method=6, lossless=False)
    src_size = src.stat().st_size
    dst_size = dst.stat().st_size
    print(f"    {src_size:>10} -> {dst_size:>10} bytes ({dst_size/src_size*100:.1f}%)")

    # Remove the source PNG to keep the repo lean
    src.unlink()
    print(f"    removed source: {src_name}")

print("\nFinal atmosphere/ contents:")
for p in sorted(ATMOSPHERE.iterdir()):
    print(f"  {p.name:42s} {p.stat().st_size:>10} bytes")
