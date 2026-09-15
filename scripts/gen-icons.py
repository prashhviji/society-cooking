"""Generate the Cookwise PWA icons into `public/icons/`.

A deep-green rounded square with a white leaf mark. Everything is drawn at 4x
and downsampled, so the curves stay clean at 48 px.

Run it with the ML virtualenv (the only place Pillow is installed):

    ml/.venv/Scripts/python scripts/gen-icons.py     # Windows
    ml/.venv/bin/python scripts/gen-icons.py         # macOS / Linux

Outputs: icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png.
`public/icons/icon.svg` is hand-written and is not regenerated here.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "icons"

GREEN = (31, 107, 69, 255)  # --green-700 / --primary  #1f6b45

WHITE = (255, 255, 255, 255)

SS = 4  # supersampling factor


def leaf_mask(size: int, scale: float) -> Image.Image:
    """A vesica-piscis leaf pointing up-right, as an L-mode mask."""
    canvas = size * 2  # rotate inside a larger square to avoid clipping
    radius = size * scale * 0.72
    offset = radius * 0.42
    cx = cy = canvas / 2

    def circle(dx: float, dy: float) -> Image.Image:
        img = Image.new("L", (canvas, canvas), 0)
        ImageDraw.Draw(img).ellipse(
            [cx + dx - radius, cy + dy - radius, cx + dx + radius, cy + dy + radius],
            fill=255,
        )
        return img

    # Intersection of two offset circles = a pointed leaf.
    mask = ImageChops.darker(circle(-offset, -offset), circle(offset, offset))
    mask = mask.rotate(0, resample=Image.BICUBIC)
    return mask.crop(
        (
            int(cx - size / 2),
            int(cy - size / 2),
            int(cx + size / 2),
            int(cy + size / 2),
        )
    )


def draw_mark(img: Image.Image, size: int, scale: float) -> None:
    """Paint the white leaf with a green midrib onto `img`."""
    mask = leaf_mask(size, scale)

    # The midrib is drawn on its own layer and clipped to the leaf, so it never
    # spills past the tips.
    layer = Image.new("RGBA", (size, size), WHITE)
    draw = ImageDraw.Draw(layer)
    half = size * scale * 0.46
    cx = cy = size / 2
    draw.line(
        [(cx - half, cy + half), (cx + half, cy - half)],
        fill=GREEN,
        width=max(2, int(size * scale * 0.07)),
    )
    img.paste(layer, (0, 0), mask)


def make_icon(size: int, *, corner: float, mark_scale: float) -> Image.Image:
    """`corner` is the corner radius as a fraction of the side (0 = square)."""
    n = size * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if corner > 0:
        draw.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * corner), fill=GREEN)
    else:
        draw.rectangle([0, 0, n - 1, n - 1], fill=GREEN)

    draw_mark(img, n, mark_scale)
    return img.resize((size, size), Image.LANCZOS)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = [
        # name, size, corner radius fraction, mark scale
        ("icon-192.png", 192, 0.22, 0.56),
        ("icon-512.png", 512, 0.22, 0.56),
        # Maskable icons are cropped to a circle of ~80% width by the launcher,
        # so the background is full-bleed and the mark stays in the safe zone.
        ("maskable-512.png", 512, 0.0, 0.40),
        # iOS applies its own mask; a full-bleed square avoids a double corner.
        ("apple-touch-icon.png", 180, 0.0, 0.56),
    ]

    for name, size, corner, mark_scale in targets:
        icon = make_icon(size, corner=corner, mark_scale=mark_scale)
        path = OUT_DIR / name
        icon.save(path, format="PNG", optimize=True)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
