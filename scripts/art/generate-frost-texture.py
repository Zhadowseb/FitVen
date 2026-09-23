"""Generates the frost texture laid over a frozen friend tile.

Why a picture and not vectors: real frost is soft light, glow, uneven haze
and thousands of fine branches, and drawn as SVG lines it read as a diagram
of ice rather than ice. This grows it instead - frost ferns branching in from
the edges, clouding, a glassy rim and icicles - with blur for the glow, and
writes a transparent PNG the tile shows behind its text.

    python scripts/art/generate-frost-texture.py

Writes src/Resources/Images/Frost/frost-a.png and frost-b.png (two variants,
so neighbouring frozen tiles do not match). Deterministic: the same seed
gives the same file. Needs Pillow and numpy.

The texture is 3x a 148 x 170 dp tile and stretched to whatever height the
tile ends up; the frost is all at the edges, where a few percent of stretch
does not show.
"""

import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCALE = 3
TILE_W, TILE_H = 148, 170
W, H = TILE_W * SCALE, TILE_H * SCALE
RADIUS = 20 * SCALE
RIM = 7 * SCALE
SUPER = 2  # branches are drawn at twice the size, then shrunk, for smooth edges

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "src", "Resources", "Images", "Frost")

ICE = np.array([169, 220, 255], dtype=np.float32)
WHITE = np.array([244, 251, 255], dtype=np.float32)


def rounded_rect_distance(width, height, radius):
    """Distance from every pixel to the tile's rounded edge, inside positive."""
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    xs += 0.5
    ys += 0.5
    qx = np.abs(xs - width / 2) - (width / 2 - radius)
    qy = np.abs(ys - height / 2) - (height / 2 - radius)
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0))
    inside = np.minimum(np.maximum(qx, qy), 0)
    return -(outside + inside - radius)


def value_noise(width, height, cells, rng):
    grid = rng.random((cells + 1, int(cells * height / width) + 2)).astype(np.float32)
    image = Image.fromarray((grid * 255).astype(np.uint8).T)
    return np.asarray(image.resize((width, height), Image.BICUBIC), dtype=np.float32) / 255


def fractal_noise(width, height, rng, octaves=5):
    total = np.zeros((height, width), dtype=np.float32)
    weight = 0.0
    for octave in range(octaves):
        amplitude = 0.55 ** octave
        total += value_noise(width, height, 4 * 2 ** octave, rng) * amplitude
        weight += amplitude
    total /= weight
    return (total - total.min()) / (total.max() - total.min() + 1e-6)


def draw_branch(draw, rng, x, y, angle, length, width, depth, intensity):
    """A frost fern: a wavering stem that sprouts side branches as it grows."""
    steps = max(3, int(length / (6 * SUPER)))
    step = length / steps
    points = [(x, y)]
    heading = angle

    for index in range(steps):
        heading += rng.uniform(-0.3, 0.3)
        x += math.cos(heading) * step
        y += math.sin(heading) * step
        points.append((x, y))

        progress = (index + 1) / steps
        if depth > 0 and index < steps - 1 and rng.random() < 0.8:
            for side in (-1, 1):
                if rng.random() < 0.8:
                    draw_branch(
                        draw,
                        rng,
                        x,
                        y,
                        heading + side * rng.uniform(0.55, 1.2),
                        length * rng.uniform(0.25, 0.45) * (1 - progress * 0.5),
                        max(1, width * 0.65),
                        depth - 1,
                        intensity * rng.uniform(0.7, 0.95),
                    )

    draw.line(points, fill=int(255 * intensity), width=max(1, int(round(width))), joint="curve")


def grow_ferns(rng):
    size = (W * SUPER, H * SUPER)
    layer = Image.new("L", size, 0)
    draw = ImageDraw.Draw(layer)
    rim = RIM * SUPER
    radius = RADIUS * SUPER

    def seed_edge(span, place, inward, low, high, spacing):
        distance = radius + rng.uniform(0, spacing)
        while distance < span - radius:
            x, y = place(distance)
            draw_branch(
                draw,
                rng,
                x,
                y,
                math.radians(inward + rng.uniform(-40, 40)),
                rng.uniform(low, high) * SUPER * SCALE,
                1.5 * SUPER,
                3,
                rng.uniform(0.3, 0.7),
            )
            distance += rng.uniform(spacing * 0.35, spacing * 0.8)

    width, height = size
    spacing = 12 * SUPER * SCALE
    seed_edge(height, lambda d: (rim, d), 0, 7, 17, spacing)
    seed_edge(height, lambda d: (width - rim, d), 180, 7, 17, spacing)
    # The status line sits just above the bottom edge: frost there stays low
    # enough to read over.
    seed_edge(width, lambda d: (d, height - rim), -90, 5, 11, spacing)
    # The top holds the music line and the avatar: the frost there stays low.
    seed_edge(width, lambda d: (d, rim), 90, 4, 8, spacing)

    inset = radius * (1 - math.sqrt(0.5)) + rim * 0.5
    corners = [
        (inset, inset, 45, 0.75),
        (width - inset, inset, 135, 0.75),
        (inset, height - inset, -45, 0.95),
        (width - inset, height - inset, -135, 0.95),
    ]
    for cx, cy, angle, reach in corners:
        for branch in range(13):
            draw_branch(
                draw,
                rng,
                cx + rng.uniform(-4, 4) * SUPER * SCALE,
                cy + rng.uniform(-4, 4) * SUPER * SCALE,
                math.radians(angle + (branch - 6) * 8 + rng.uniform(-8, 8)),
                rng.uniform(20, 38) * reach * SUPER * SCALE,
                2.0 * SUPER,
                3,
                rng.uniform(0.5, 0.95),
            )

    return np.asarray(layer.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255


def hang_icicles(rng):
    size = (W * SUPER, H * SUPER)
    body = Image.new("L", size, 0)
    shine = Image.new("L", size, 0)
    body_draw = ImageDraw.Draw(body)
    shine_draw = ImageDraw.Draw(shine)
    top = (RIM - 1) * SUPER * SCALE / SCALE
    x = RADIUS * SUPER + rng.uniform(0, 6 * SUPER * SCALE)

    while x < W * SUPER - RADIUS * SUPER:
        is_long = rng.random() < 0.25
        length = (rng.uniform(7, 13) if is_long else rng.uniform(2, 6)) * SUPER * SCALE
        half = (rng.uniform(1.8, 3) if is_long else rng.uniform(0.9, 1.8)) * SUPER * SCALE
        # A drop, point down, built from a curve on each side.
        left = [(x - half + (half * 0.9) * (t ** 1.6), top + length * t) for t in np.linspace(0, 1, 14)]
        right = [(x + half - (half * 1.05) * (t ** 1.4), top + length * t) for t in np.linspace(1, 0, 14)]
        body_draw.polygon(left + right, fill=int(255 * rng.uniform(0.45, 1.0)))
        if is_long:
            shine_draw.line(
                [(x - half * 0.35, top + 2 * SUPER), (x - half * 0.1, top + length * 0.65)],
                fill=255,
                width=max(1, int(1.2 * SUPER)),
            )
        # Some hang together, most apart.
        gap = rng.uniform(1, 3) if rng.random() < 0.35 else rng.uniform(6, 16)
        x += half * 2 + gap * SUPER * SCALE

    fade = np.clip(1 - (np.mgrid[0:H * SUPER, 0:W * SUPER][0] - top) / (14 * SUPER * SCALE), 0.2, 1)
    body_array = np.asarray(body, dtype=np.float32) / 255 * fade
    body_image = Image.fromarray((body_array * 255).astype(np.uint8))
    return (
        np.asarray(body_image.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255,
        np.asarray(shine.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255,
    )


def blur(array, radius):
    image = Image.fromarray((np.clip(array, 0, 1) * 255).astype(np.uint8))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255


def screen(*layers):
    result = np.zeros_like(layers[0])
    for layer in layers:
        result = 1 - (1 - result) * (1 - np.clip(layer, 0, 1))
    return result


def build(seed):
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    distance = rounded_rect_distance(W, H, RADIUS)
    inside = distance > 0
    noise = fractal_noise(W, H, np_rng)
    grain = fractal_noise(W, H, np_rng, octaves=3)

    # Frost clouding the glass from every edge, patchy, gone by the middle,
    # and thickest in the corners.
    haze = np.clip(1 - distance / (26 * SCALE), 0, 1) ** 1.8 * (0.25 + 0.75 * noise) * 0.55
    ys_, xs_ = np.mgrid[0:H, 0:W].astype(np.float32)
    corner_distance = np.minimum.reduce([
        np.hypot(xs_ - cx, ys_ - cy) for cx in (0, W) for cy in (0, H)
    ])
    corner_cloud = np.clip(1 - corner_distance / (48 * SCALE), 0, 1) ** 1.6 * (0.35 + 0.65 * noise) * 0.5
    haze = screen(haze, corner_cloud)

    # The rim: a band of ice with a bright outer edge and a softer inner one,
    # brightest at the top left where the light comes from.
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)  # noqa: also used below
    light = np.clip(1.25 - (xs / W + ys / H) * 0.75, 0.45, 1.25)
    rim_band = (distance < RIM).astype(np.float32) * (0.32 + 0.3 * grain) * light
    outer_edge = np.exp(-((distance - 1.5) ** 2) / 3.0) * 0.9 * light
    inner_edge = np.exp(-((distance - RIM) ** 2) / 4.0) * 0.5
    rim = blur(rim_band, 1.2) + outer_edge + inner_edge

    ferns = grow_ferns(rng)
    reach = np.clip(1.2 - distance / (42 * SCALE), 0, 1)
    ferns *= reach * (0.7 + 0.3 * noise)
    fern_glow = blur(ferns, 2.5) * 0.7 + blur(ferns, 8) * 0.4

    icicles, icicle_shine = hang_icicles(rng)
    icicle_glow = blur(icicles, 2.5) * 0.5

    speck_density = np.clip(1 - distance / (30 * SCALE), 0, 1) ** 2 * 0.09
    specks = (np_rng.random((H, W)) < speck_density).astype(np.float32)
    specks = np.clip(blur(specks, 0.7) * 2.2, 0, 1) * (0.4 + 0.6 * grain)

    # Keep the middle of the tile clear where the name and the status line
    # are, whatever grew towards it.
    text_band = np.exp(-(((ys / H) - 0.7) ** 2) / 0.012) * np.exp(-(((xs / W) - 0.5) ** 2) / 0.09)
    clear = 1 - 0.75 * text_band

    alpha = screen(haze, rim, ferns * 0.9 * clear, fern_glow * clear, specks * 0.7, icicles * 0.85, icicle_glow)
    alpha *= inside

    # Where it is dense it is white; where it is thin, it is the blue of ice.
    whiteness = np.clip(alpha * 1.25 + icicle_shine * 0.6, 0, 1)[..., None]
    colour = ICE + (WHITE - ICE) * whiteness
    rgba = np.dstack([colour, np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, seed in (("frost-a.png", 7), ("frost-b.png", 23)):
        path = os.path.join(OUT_DIR, name)
        build(seed).save(path, optimize=True)
        print(f"{path}  {os.path.getsize(path) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
