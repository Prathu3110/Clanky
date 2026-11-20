"""Clanky ghost sprite generator: 32x32 pixel ghosts, 4 variants x 16 states, light + dark sheets."""
import json, os, sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)
N = 32
BASE_DY = 1  # resting baseline offset

STATUS = {"sky": "#A9CBE3", "butter": "#F6E3A1", "tangerine": "#F2A65A", "sage": "#A8BFA0", "rust": "#B5534A"}
INK = "#2A2420"
GOLD = "#EDB53C"
WHITE = "#FFFFFF"

GHOSTS = {
    "ivory":  dict(name="Clanky (Look's own)", body="#FAF4E6", shade="#D6C8B0", out=INK, feat=INK, white=WHITE, a1="#F2A65A", a2=None,
                   rim=None, glow="#FFF1CF", strong=False),
    "cobalt": dict(name="Butler", body="#3468CE", shade="#244EA6", out=INK, feat="#1D1B2B", white=WHITE, a1=GOLD, a2=None,
                   rim="#A9C2F5", glow="#5E8EF2", strong=True),
    "green":  dict(name="Teacher", body="#30945F", shade="#207048", out=INK, feat=INK, white=WHITE, a1=GOLD, a2=None,
                   rim="#93DDB3", glow="#4FC987", strong=True),
    "pink":   dict(name="Sassy", body="#FF4F9A", shade="#D62E76", out=INK, feat=INK, white=WHITE, a1=GOLD, a2="#F2A65A",
                   rim=None, glow="#FF80B8", strong=False),
}

# ---------------------------------------------------------------- shapes
HEAD = {5: (12, 19), 6: (10, 21), 7: (9, 22), 8: (8, 23), 9: (7, 24), 10: (7, 24)}
HEM = [1, 2, 3, 3, 2]  # scallop depth profile, period 5 -> 4 scallops over 20px

def body_mask(phase):
    m = set()
    for y, (a, b) in HEAD.items():
        m |= {(x, y) for x in range(a, b + 1)}
    for y in range(11, 25):
        m |= {(x, y) for x in range(6, 26)}
    for x in range(6, 26):
        h = HEM[(x - 6 + phase) % 5]
        for y in range(25, 25 + h):
            m.add((x, y))
    return m

def rect(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}

def mirror(px):
    return {(31 - x, y) for x, y in px}

# arm poses -> (pixel set, hand anchor (tip x, top y))
ARMS_L = {
    "rest": rect(4, 16, 5, 17),
    "up": rect(4, 12, 5, 13),
    "up2": rect(3, 10, 4, 11) | {(5, 12)},
    "pump": rect(4, 11, 5, 12) | rect(3, 9, 4, 10),
}
ARMS_R = {
    "rest": (rect(26, 16, 27, 17), (27, 16)),
    "up": (rect(26, 12, 27, 13), (27, 12)),
    "up2": (rect(27, 10, 28, 11) | {(26, 12)}, (28, 10)),
    "point": (rect(26, 16, 28, 17), (28, 16)),
    "point2": (rect(26, 16, 29, 17), (29, 16)),
    "pump": (rect(26, 11, 27, 12) | rect(27, 9, 28, 10), (28, 9)),
}

def outline_of(mask):
    return {(x, y) for x, y in mask if any((x + dx, y + dy) not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}

def ring(px, occupied):
    r = set()
    for x, y in px:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in occupied and q not in px:
                    r.add(q)
    return r

# ---------------------------------------------------------------- face parts
def eye_px(kind):
    """Left-eye pixels relative to anchor -> list of (dx,dy,role). role 'E' = eye colour, 'W' glint, 'F' feature/lid."""
    if kind == "open":   return [(x, y, "E") for x in (0, 1) for y in (0, 1, 2) if (x, y) != (0, 0)] + [(0, 0, "W")]
    if kind == "lid":    return [(0, 0, "F"), (1, 0, "F"), (0, 1, "W"), (1, 1, "E"), (0, 2, "E"), (1, 2, "E")]
    if kind == "up":     return [(x, y, "E") for x in (0, 1) for y in (-1, 0, 1) if (x, y) != (0, -1)] + [(0, -1, "W")]
    if kind == "wide":   return [(x, y, "E") for x in (0, 1) for y in (-1, 0, 1, 2) if (x, y) != (0, -1)] + [(0, -1, "W")]
    if kind == "blink":  return [(0, 2, "F"), (1, 2, "F")]
    if kind == "closed": return [(0, 1, "F"), (1, 1, "F")]
    if kind == "sleep":  return [(0, 2, "F"), (1, 2, "F"), (-1, 1, "F")]
    if kind == "happy":  return [(0, 1, "F"), (1, 0, "F"), (2, 1, "F")]
    if kind == "worried":return [(0, 1, "W"), (1, 1, "E"), (0, 2, "E"), (1, 2, "E"), (0, -1, "F"), (1, -2, "F")]
    if kind == "determined": return [(0, 0, "W"), (1, 0, "E"), (0, 1, "E"), (1, 1, "E"), (0, 2, "E"), (1, 2, "E"), (-1, -2, "F"), (0, -2, "F"), (1, -1, "F")]
    if kind == "x":      return [(0, 0, "F"), (2, 0, "F"), (1, 1, "F"), (0, 2, "F"), (2, 2, "F")]
    raise ValueError(kind)

MOUTHS = {
    "flat": [(0, 0), (1, 0), (2, 0), (3, 0)],
    "smile": [(0, 0), (3, 0), (1, 1), (2, 1)],
    "grin": [(0, 0), (1, 0), (2, 0), (3, 0), (1, 1), (2, 1)],
    "o": [(1, 0), (2, 0), (1, 1), (2, 1)],
    "open": [(0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1)],
    "wavy": [(0, 1), (1, 0), (2, 1), (3, 0)],
    "tiny": [(1, 0), (2, 0)],
    "frown": [(1, 0), (2, 0), (0, 1), (3, 1)],
    "smirk": [(0, 0), (1, 0), (2, 0), (3, -1)],
    "smallsmile": [(0, 0), (1, 1), (2, 1), (3, 0)],
}

# extras (final coords, not bobbing) -> set of pixels; drawn with a1 fill + outline
def glyph(rows, x0, y0):
    return {(x0 + x, y0 + y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "#"}

def dots(n):  # thinking "..."
    s = set()
    for i in range(n):
        s |= rect(20 + 4 * i, 1, 21 + 4 * i, 2)
    return s

QMARK = ["###", "..#", ".##", "...", ".#."]
BANG = ["##", "##", "##", "..", "##"]
ZED = ["###", ".#.", "###"]
PLUS = [".#.", "###", ".#."]
DOT = ["#"]
ARC1 = ["#.", ".#", ".#", "#."]
ARC2 = ["#..", ".#.", "..#", "..#", ".#.", "#.."]
STAR = ["..#..", ".###.", "#####", ".###.", ".#.#."]
SPARK = ["#.#", ".#.", "#.#"]

def E(rows, x, y, fill="a1"):
    return (glyph(rows, x, y), fill)

DROP = (glyph([".#", "##", "##"], 3, 8), "white")

# ---------------------------------------------------------------- states
# each frame: dict(eyes, gaze, mouth, dy, dx, ph, al, ar, light, ex, flick, brow)
def F(**k):
    d = dict(eyes="open", gaze=(0, 0), mouth="smile", dy=0, dx=0, ph=0, al="rest", ar="rest", light=None, ex=[], flick=False, brow="arch", ms=200)
    d.update(k)
    return d

STATES = [
    ("idle", "Slow 1px bob with a hem sway; blinks on frame 4.",
     [F(ph=0, ms=500), F(ph=1, dy=1, ms=500), F(ph=2, dy=1, ms=500), F(ph=1, eyes="blink", ms=140)]),
    ("listening", "Eyes widen, mouth makes a small 'o'; sound arcs pulse beside the head. Status: sky.",
     [F(eyes="wide", mouth="o", light="sky", ex=[E(ARC1, 27, 10)], ms=260),
      F(eyes="wide", mouth="o", light="sky", ph=1, ex=[E(ARC1, 27, 10), E(ARC2, 29, 9)], ms=260),
      F(eyes="wide", mouth="o", light="sky", ph=2, ex=[E(ARC1, 27, 10)], ms=260)]),
    ("thinking", "Eyes look up, hem ripples fast, a dot-matrix '…' fills one dot at a time. Status: butter.",
     [F(eyes="up", mouth="flat", light="butter", ph=0, ex=[(dots(1), "a1")], ms=140),
      F(eyes="up", mouth="flat", light="butter", ph=2, ex=[(dots(2), "a1")], ms=140),
      F(eyes="up", gaze=(1, 0), mouth="flat", light="butter", ph=4, ex=[(dots(3), "a1")], ms=140),
      F(eyes="up", gaze=(1, 0), mouth="flat", light="butter", ph=1, ex=[(dots(3), "a1")], ms=140)]),
    ("talking", "Mouth cycles closed / half / open in time with speech; tiny bob. Status: sky.",
     [F(mouth="flat", light="sky", ms=120), F(mouth="grin", light="sky", dy=1, ph=1, ms=120), F(mouth="open", light="sky", ms=120), F(mouth="grin", light="sky", dy=1, ph=1, ms=120)]),
    ("working", "Eyes glance toward the app it is driving, sparks at the hand, status light blinks. Status: tangerine.",
     [F(eyes="open", gaze=(1, 1), mouth="flat", light="tangerine", ar="point", ex=[E(SPARK, 29, 12)], ms=180),
      F(eyes="open", gaze=(1, 1), mouth="flat", light=None, ar="point", ph=1, ms=180),
      F(eyes="open", gaze=(1, 1), mouth="flat", light="tangerine", ar="point", ex=[E(DOT, 30, 19)], ph=2, ms=180),
      F(eyes="open", gaze=(1, 1), mouth="flat", light=None, ar="point", ph=1, ms=180)]),
    ("pointing", "Right arm jabs toward the target (3px -> 4px), eyes follow. Status: tangerine.",
     [F(gaze=(1, 0), ar="point", light="tangerine", ms=240), F(gaze=(1, 0), ar="point2", light="tangerine", dx=1, ms=240), F(gaze=(1, 0), ar="point", light="tangerine", ph=1, ms=240)]),
    ("waiting", "Looks at you, a '?' blinks above the head, status light pulses. Waiting for your OK. Status: tangerine.",
     [F(eyes="wide", mouth="tiny", light="tangerine", brow="both", ex=[E(QMARK, 25, 0)], ms=400),
      F(eyes="wide", mouth="tiny", light=None, brow="both", ph=1, ex=[E(QMARK, 25, 0)], ms=400),
      F(eyes="blink", mouth="tiny", light="tangerine", brow="both", ph=2, ms=160)]),
    ("done", "Happy ^^ eyes, 1px hop, one sparkle. Status: sage.",
     [F(eyes="happy", mouth="grin", light="sage", ms=180), F(eyes="happy", mouth="grin", light="sage", dy=-1, al="up", ar="up", ex=[E(PLUS, 26, 2)], ms=180),
      F(eyes="happy", mouth="grin", light="sage", ph=1, ex=[E(DOT, 27, 3)], ms=300)]),
    ("error", "Worried brows, wavy mouth, a 1px head shake and a sweat drop. Status: rust.",
     [F(eyes="worried", mouth="wavy", light="rust", brow="worried", dx=-1, ex=[DROP], ms=110),
      F(eyes="worried", mouth="wavy", light="rust", brow="worried", dx=1, ex=[DROP], ms=110),
      F(eyes="worried", mouth="frown", light="rust", brow="worried", ex=[DROP], ms=500)]),
    ("asleep", "Eyes shut, slow breathing bob, 'z's rise and fade. Light off.",
     [F(eyes="sleep", mouth="o", brow="none", ex=[E(ZED, 24, 6)], ms=700), F(eyes="sleep", mouth="tiny", brow="none", dy=1, ex=[E(ZED, 26, 2)], ms=700),
      F(eyes="sleep", mouth="o", brow="none", dy=1, ex=[E(ZED, 27, 0), E(DOT, 24, 7)], ms=700)]),
    ("wave", "Right arm swings between two raised positions. Status: sky.",
     [F(eyes="happy", mouth="grin", ar="up", light="sky", ms=200), F(eyes="happy", mouth="grin", ar="up2", light="sky", ms=200),
      F(eyes="happy", mouth="grin", ar="up", light="sky", ph=1, ms=200), F(eyes="happy", mouth="grin", ar="up2", light="sky", ph=1, ms=200)]),
    ("hype", "Both arms up, hop, sparkles swap sides. Status: tangerine.",
     [F(eyes="happy", mouth="open", al="up", ar="up", light="tangerine", ex=[E(PLUS, 1, 3)], ms=150),
      F(eyes="happy", mouth="open", al="up2", ar="up2", dy=-1, light="tangerine", ex=[E(PLUS, 28, 4), E(DOT, 2, 9)], ms=150),
      F(eyes="happy", mouth="grin", al="up", ar="up", light="tangerine", ph=1, ex=[E(SPARK, 1, 2)], ms=150)]),
    ("remind", "A '!' bounces above the head while the left arm lifts like a raised finger. Status: butter.",
     [F(eyes="wide", mouth="smallsmile", al="up", light="butter", brow="both", ex=[E(BANG, 26, 1)], ms=260),
      F(eyes="wide", mouth="smallsmile", al="up2", light="butter", brow="both", ex=[E(BANG, 26, 0)], ms=260),
      F(eyes="open", mouth="smallsmile", al="up", light="butter", ph=1, ex=[E(BANG, 26, 1)], ms=260)]),
    ("motivate", "Determined brows, fist-pump on the right with a pixel star. Status: sage.",
     [F(eyes="determined", mouth="grin", ar="up", light="sage", brow="determined", ms=200),
      F(eyes="determined", mouth="open", ar="pump", light="sage", brow="determined", dy=-1, ex=[E(STAR, 25, 1)], ms=200),
      F(eyes="determined", mouth="grin", ar="up", light="sage", brow="determined", ph=1, ms=300)]),
    ("long-wait", "Slow figure-eight drift (key poses; tween at whole pixels), eyes wander. Status: butter.",
     [F(mouth="flat", light="butter", gaze=(-1, 0), dx=0, dy=0, ms=500), F(mouth="flat", light="butter", gaze=(0, -1), eyes="open", dx=1, dy=-1, ph=1, ms=500),
      F(mouth="flat", light="butter", gaze=(1, 0), dx=0, dy=0, ph=2, ms=500), F(mouth="flat", light="butter", gaze=(0, -1), dx=-1, dy=-1, ph=1, ms=500)]),
    ("offline", "Ghost flicker (dithered frames), worried face, status light in rust. Pair with a 'Reconnecting…' label.",
     [F(eyes="worried", mouth="flat", brow="worried", light="rust", ms=700), F(eyes="worried", mouth="flat", brow="worried", light="rust", flick=True, ms=80),
      F(eyes="worried", mouth="flat", brow="worried", light="rust", dx=1, ms=140), F(eyes="worried", mouth="flat", brow="worried", light=None, flick=True, ms=80)]),
]

# ---------------------------------------------------------------- per-ghost layout
EYE_ANCHOR = {"ivory": (11, 12), "cobalt": (11, 12), "green": (10, 12), "pink": None}
MOUTH_ANCHOR = {"ivory": (14, 16), "cobalt": (14, 15), "green": (14, 18), "pink": (14, 16)}
DEFAULT_MOUTH = {"cobalt": {"smile": "smallsmile"}, "pink": {"smile": "smirk", "smallsmile": "smirk"}}

def build(gk, fr):
    g = GHOSTS[gk]
    grid = {}  # (x,y) -> role
    phase = fr["ph"]
    mask = body_mask(phase)
    mask |= ARMS_L[fr["al"]]
    arm_r, hand = ARMS_R[fr["ar"]]
    mask |= arm_r
    # accessories that join the silhouette
    acc_fill = {}
    if gk == "cobalt":
        cloth = rect(1, 17, 4, 24) - {(1, 24)}
        mask |= cloth
        acc_fill.update({p: "white" for p in rect(2, 18, 3, 23)})
        acc_fill[(2, 23)] = "out"
    if gk == "green":
        cap = rect(8, 2, 23, 4)
        mask |= cap
        hx, hy = hand
        chalk = rect(hx, hy - 6, hx + 2, hy - 1)
        mask |= chalk
        acc_fill.update({p: "white" for p in rect(hx + 1, hy - 5, hx + 1, hy - 2)})
    if gk == "ivory":
        bulb = rect(13, 0, 18, 3) - {(13, 0), (18, 0), (13, 3), (18, 3)}
        stem = rect(15, 4, 16, 4)
        mask |= bulb | stem
    outl = outline_of(mask)
    # rows' right extent for shading
    right = {}
    for x, y in mask:
        right[y] = max(right.get(y, -1), x)
    for p in mask:
        x, y = p
        if p in outl:
            grid[p] = "out"
            continue
        r = right[y] - x
        if r <= 2:
            grid[p] = "shade"
        elif r <= 4 and (x + y) % 2 == 0:
            grid[p] = "shade"
        else:
            grid[p] = "body"
    # arms are solid outline (nubs)
    for p in ARMS_L[fr["al"]] | arm_r:
        grid[p] = "out"
    for p, role in acc_fill.items():
        grid[p] = role

    # ---- ghost-specific paint
    if gk == "ivory":
        light = fr["light"]
        for p in rect(14, 1, 17, 2):
            grid[p] = "light" if light else "shade"
        grid[(14, 1)] = "white" if light else "body"
        for p in rect(15, 4, 16, 4):
            grid[p] = "out"
        for p in [(8, 15), (9, 15), (22, 15), (23, 15)]:
            grid[p] = "a1"
    if gk == "green":
        for p in rect(9, 3, 22, 3) | rect(11, 6, 20, 6):
            grid[p] = "feat"
        for y in range(4, 10):
            grid[(22, y)] = "a1"
        grid[(21, 9)] = "a1"
        grid[(21, 10)] = "a1"; grid[(22, 10)] = "a1"
        # glasses
        ring_l = {(x, y) for x in range(8, 14) for y in range(11, 17) if (x in (8, 13) or y in (11, 16))} - {(8, 11), (13, 11), (8, 16), (13, 16)}
        for p in ring_l | mirror(ring_l) | rect(14, 12, 17, 12) | {(7, 12), (24, 12)}:
            grid[p] = "feat"
    if gk == "cobalt":
        for y in range(18, 25):
            for x in range(7, 25):
                if grid.get((x, y)) in ("body", "shade"):
                    grid[(x, y)] = "white" if 14 <= x <= 17 else "feat"
        for p in [(15, 20), (16, 20), (15, 22), (16, 22)]:
            grid[p] = "feat"
        bow = [(12, 17), (13, 17), (18, 17), (19, 17), (12, 18), (13, 18), (14, 18), (15, 18), (16, 18), (17, 18), (18, 18), (19, 18), (15, 17), (16, 17)]
        for p in bow:
            grid[p] = "a1"
        grid[(14, 17)] = "feat"; grid[(17, 17)] = "feat"
    if gk == "pink":
        for y in (18, 19):
            for x in range(7, 25):
                if grid.get((x, y)) in ("body", "shade"):
                    grid[(x, y)] = "a2"
        for x in range(8, 25, 3):
            grid[(x, 19)] = "shade"
        for p in rect(19, 20, 20, 23):
            grid[p] = "a2"
        grid[(20, 23)] = "shade"
        # sunglasses
        for p in rect(8, 11, 23, 11):
            grid[p] = "a1"
        for p in rect(9, 12, 14, 13) | rect(17, 12, 22, 13):
            grid[p] = "feat"
        shine = 0 if fr["ph"] % 2 == 0 else 1
        grid[(10 + shine, 12)] = "white"
        grid[(18 + shine, 12)] = "white"
        brow = fr["brow"]
        bl = {"arch": [], "both": [(10, 9), (11, 9), (12, 9), (13, 10)], "worried": [(10, 10), (11, 10), (12, 9), (13, 9)],
              "determined": [(10, 9), (11, 9), (12, 10), (13, 10)], "none": []}[brow]
        br = {"arch": [(18, 9), (19, 8), (20, 8), (21, 8), (22, 9)], "both": [(18, 10), (19, 9), (20, 9), (21, 9)],
              "worried": mirror_list([(10, 10), (11, 10), (12, 9), (13, 9)]), "determined": mirror_list([(10, 9), (11, 9), (12, 10), (13, 10)]), "none": []}[brow]
        for p in bl + br:
            grid[p] = "feat"
        if fr["eyes"] in ("sleep", "blink"):
            # lenses dim: show closed line under the glasses
            pass
        # sparkle accessory (twinkles with phase)
        if not fr["ex"]:
            sp = glyph(PLUS, 26, 5) if fr["ph"] % 2 == 0 else {(27, 6)}
            for p in sp:
                if p not in grid:
                    grid[p] = "a1"

    # ---- eyes
    if gk != "pink":
        ax, ay = EYE_ANCHOR[gk]
        kind = fr["eyes"]
        if gk == "cobalt" and kind == "open":
            kind = "lid"
        eye_role = "a1" if gk == "cobalt" else "feat"
        gx, gy = fr["gaze"]
        if gk == "green":  # keep pupils inside the lenses
            gx, gy = max(-1, min(1, gx)), max(0, min(1, gy))
        pts = eye_px(kind)
        for dx, dy, r in pts:
            role = {"E": eye_role, "W": "white", "F": "feat"}[r]
            p1 = (ax + dx + gx, ay + dy + gy)
            p2 = (31 - (ax + dx) + gx, ay + dy + gy)
            grid[p1] = role
            grid[p2] = role if r != "W" else role
    # ---- mouth
    mk = DEFAULT_MOUTH.get(gk, {}).get(fr["mouth"], fr["mouth"])
    if gk == "pink" and fr["mouth"] in ("grin", "open", "o"):
        mk = fr["mouth"]
    mx, my = MOUTH_ANCHOR[gk]
    for dx, dy in MOUTHS[mk]:
        grid[(mx + dx, my + dy)] = "feat"

    # ---- offset (bob / shake)
    ox, oy = fr["dx"], fr["dy"] + BASE_DY
    grid = {(x + ox, y + oy): r for (x, y), r in grid.items()}

    # ---- flicker
    if fr["flick"]:
        grid = {(x, y): r for (x, y), r in grid.items() if (x + y) % 2 == 0}

    # ---- extras (final coords)
    for px, fill in fr["ex"]:
        occ = set(grid)
        for p in px:
            grid[p] = fill
        for p in ring(px, occ) - px:
            if p not in occ and not (abs(p[0] - min(q[0] for q in px)) > 1 and False):
                # 4-neighbour outline only
                if any((p[0] + dx, p[1] + dy) in px for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    grid[p] = "out"
    grid = {p: r for p, r in grid.items() if 0 <= p[0] < N and 0 <= p[1] < N}
    return grid

def mirror_list(l):
    return [(31 - x, y) for x, y in l]

def palette(gk, fr, dark):
    g = GHOSTS[gk]
    light = STATUS.get(fr["light"]) if fr["light"] else g["shade"]
    pal = dict(out=g["out"], feat=g["feat"], body=g["body"], shade=g["shade"], white=g["white"], a1=g["a1"], a2=g["a2"] or g["a1"], light=light)
    if gk == "ivory":
        # extras on Clanky use the live status colour
        if fr["light"]:
            pal["a1x"] = light
    if dark and g["rim"]:
        pal["out"] = g["rim"]
    return pal

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def render(gk, fr, dark):
    grid = build(gk, fr)
    pal = palette(gk, fr, dark)
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    for (x, y), r in grid.items():
        img.putpixel((x, y), hex2rgb(pal[r]) + (255,))
    if dark and not fr["flick"]:
        g = GHOSTS[gk]
        occ = set(grid)
        r1 = ring(occ, occ)
        r2 = ring(r1 | occ, r1 | occ)
        r3 = ring(r2 | r1 | occ, r2 | r1 | occ) if g["strong"] else set()
        gc = hex2rgb(g["glow"])
        a1, a2, a3 = (170, 130, 80) if g["strong"] else (150, 90, 0)
        for (x, y) in r1:
            if 0 <= x < N and 0 <= y < N and (g["strong"] or (x + y) % 2 == 0):
                img.putpixel((x, y), gc + (a1,))
        for (x, y) in r2:
            if 0 <= x < N and 0 <= y < N and ((x + y) % 2 == 0 if g["strong"] else (x % 2 == 0 and y % 2 == 0)):
                img.putpixel((x, y), gc + (a2,))
        for (x, y) in r3:
            if 0 <= x < N and 0 <= y < N and x % 2 == 0 and y % 2 == 0:
                img.putpixel((x, y), gc + (a3,))
    return img, grid

def colours_used(gk, dark):
    s = set()
    for _, _, frames in STATES:
        for fr in frames:
            grid = build(gk, fr)
            pal = palette(gk, fr, dark)
            s |= {(fr["light"] or "off", pal[r]) for r in grid.values()}
    return s

# ---------------------------------------------------------------- cursor 10x10
CUR_BODY = [
    "..........",
    "...oooo...",
    "..obbbso..",
    ".obbbbbso.",
    ".obEbbEso.",
    ".obEbbEso.",
    ".obbbbbso.",
    ".obbbbbso.",
]
CUR_HEM = [[".obobboso.", ".oo.oo.oo."], [".oobbobso.", ".o.oo.oo.."]]

def cursor(gk, phase, dark):
    g = GHOSTS[gk]
    rows = [list(r) for r in CUR_BODY + CUR_HEM[phase]]
    def put(x, y, c): rows[y][x] = c
    eye = "f"
    if gk == "ivory":
        put(4, 0, "l"); put(5, 0, "l")
    if gk == "cobalt":
        eye = "a"
        for x in range(2, 8): put(x, 7, "f")
        put(4, 7, "a"); put(5, 7, "a"); put(3, 7, "a"); put(6, 7, "a")
        put(7, 7, "f")
    if gk == "green":
        for x in range(1, 9): put(x, 0, "f")
        for x in range(3, 7): put(x, 1, "f")
        put(8, 1, "a"); put(8, 2, "a")
    for y in range(10):
        for x in range(10):
            if rows[y][x] == "E":
                rows[y][x] = eye
    if gk == "pink":
        for x in (2, 3, 6, 7): put(x, 4, "f")
        put(4, 4, "f"); put(5, 4, "f")
        for x in (2, 3, 6, 7): put(x, 5, "f")
        put(4, 5, "b"); put(5, 5, "b")
        put(8, 1, "a")
    pal = dict(o=g["out"], f=g["feat"], b=g["body"], s=g["shade"], a=g["a1"], l=STATUS["sky"])
    if dark and g["rim"]:
        pal["o"] = g["rim"]
    img = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    occ = set()
    for y in range(10):
        for x in range(10):
            c = rows[y][x]
            if c != ".":
                img.putpixel((x, y), hex2rgb(pal[c]) + (255,)); occ.add((x, y))
    if dark:
        for (x, y) in ring(occ, occ):
            if 0 <= x < 10 and 0 <= y < 10 and (x + y) % 2 == 0:
                img.putpixel((x, y), hex2rgb(g["glow"]) + (150,))
    return img

# ---------------------------------------------------------------- sheets
ORDER = ["ivory", "cobalt", "green", "pink"]
manifest = {"cell": 32, "columns": 4, "baseline_offset_px": BASE_DY,
            "scales": {"default": 2, "small": 1}, "cursor": {"cell": 10, "scale": 2, "frames": 2, "ms": 400},
            "ghosts": {}, "states": []}
for i, (sid, note, frames) in enumerate(STATES):
    manifest["states"].append({"id": sid, "row": i, "frames": len(frames), "ms": [f["ms"] for f in frames], "loop": True,
                               "status": next((f["light"] for f in frames if f["light"]), None), "note": note})

for gk in ORDER:
    for dark in (False, True):
        sheet = Image.new("RGBA", (N * 4, N * len(STATES)), (0, 0, 0, 0))
        for i, (_, _, frames) in enumerate(STATES):
            for j, fr in enumerate(frames):
                img, _ = render(gk, fr, dark)
                sheet.paste(img, (j * N, i * N), img)
        fn = f"clanky-{gk}-{'dark' if dark else 'light'}.png"
        sheet.save(os.path.join(OUT, fn))
    cols = colours_used(gk, False)
    manifest["ghosts"][gk] = {"personality": GHOSTS[gk]["name"], "sheet_light": f"clanky-{gk}-light.png", "sheet_dark": f"clanky-{gk}-dark.png"}

cs = Image.new("RGBA", (20, 40), (0, 0, 0, 0))
cd = Image.new("RGBA", (20, 40), (0, 0, 0, 0))
for i, gk in enumerate(ORDER):
    for ph in (0, 1):
        a = cursor(gk, ph, False); cs.paste(a, (ph * 10, i * 10), a)
        b = cursor(gk, ph, True); cd.paste(b, (ph * 10, i * 10), b)
cs.save(os.path.join(OUT, "clanky-cursor-light.png"))
cd.save(os.path.join(OUT, "clanky-cursor-dark.png"))
manifest["cursor"].update({"sheet_light": "clanky-cursor-light.png", "sheet_dark": "clanky-cursor-dark.png", "rows": ORDER})
with open(os.path.join(OUT, "clanky-sprites.json"), "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

# colour count audit
for gk in ORDER:
    for dark in (False, True):
        mx = 0
        for _, _, frames in STATES:
            for fr in frames:
                grid = build(gk, fr); pal = palette(gk, fr, dark)
                mx = max(mx, len({pal[r] for r in grid.values()}))
        print(gk, "dark" if dark else "light", "max colours/frame:", mx)

# preview: big contact sheet on white & near-black
def preview(scale=6):
    cw = N * scale
    gap = 8
    W_ = (len(ORDER) * 2) * (4 * cw + gap) + gap
    H_ = len(STATES) * (cw + gap) + gap
    pv = Image.new("RGB", (W_, H_), (255, 255, 255))
    for gi, gk in enumerate(ORDER):
        for di, dark in enumerate((False, True)):
            sh = Image.open(os.path.join(OUT, f"clanky-{gk}-{'dark' if dark else 'light'}.png"))
            sh = sh.resize((sh.width * scale, sh.height * scale), Image.NEAREST)
            x0 = gap + (gi * 2 + di) * (4 * cw + gap)
            bg = Image.new("RGBA", sh.size, (18, 16, 20, 255) if dark else (255, 255, 255, 255))
            bg.alpha_composite(sh)
            pv.paste(bg.convert("RGB"), (x0, gap))
    pv.save(os.path.join(OUT, "_preview.png"))
preview(4)
