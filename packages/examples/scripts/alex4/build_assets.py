"""Build Alex4 assets for the melonJS example from the original Allegro data
and the Alex4-WE web edition assets."""
import sys, os, struct, json, shutil, subprocess, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allegro_dat import parse_dat, unpack_file, password
from PIL import Image

ORIG, WE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SCALE = 4
for d in ("img", "map", "fnt", "bgm", "sfx"):
    os.makedirs(f"{OUT}/{d}", exist_ok=True)

objs = parse_dat(unpack_file(f"{ORIG}/data.dat", password()))
pal = None
bmps = {}
for t, p, d in objs:
    if t == "PAL ":
        pal = [(d[i*4]*255//63, d[i*4+1]*255//63, d[i*4+2]*255//63) for i in range(256)]
for t, p, d in objs:
    if t != "BMP ":
        continue
    bits, w, h = struct.unpack(">hhh", d[:6])
    assert bits == 8
    im = Image.new("RGBA", (w, h))
    im.putdata([(0, 0, 0, 0) if c == 0 else pal[c] + (255,) for c in d[6:6 + w*h]])
    bmps[p["NAME"]] = im

def up(im):
    return im.resize((im.width*SCALE, im.height*SCALE), Image.NEAREST)

# ---- tileset (original tiles, 1-based ids in the maps) -------------------
tiles = sorted(n for n in bmps if n.startswith("TILE"))
COLS = 12
rows = (len(tiles) + COLS - 1) // COLS
ts = Image.new("RGBA", (COLS*64, rows*64))
for i, n in enumerate(tiles):
    ts.paste(up(bmps[n]), ((i % COLS)*64, (i // COLS)*64))
ts.save(f"{OUT}/map/a4_tiles.png", optimize=True)
print("tiles", len(tiles))

# ---- sprite atlas ---------------------------------------------------------
skip = {"BG0", "BG1", "BG2", "INTRO_BG", "ALEX_BG", "CHAIN", "CHOPPER1", "CHOPPER2", "CHOPPER3", "CHOPPER4", "LEVELCOMPLETE", "GAME_OVER", "LETSGO", "ALEX_LOGO", "FLD_LOGO", "SHIP100", "UFO_BIG", "CAGE_BIG", "CAGE_SML1", "CAGE_SML2", "POINTER"}
frames = {}
for n, im in bmps.items():
    if n.startswith("TILE") or n in skip:
        continue
    if n == "WATER":
        for i in range(im.width // 16):
            frames[f"water_{i}"] = im.crop((i*16, 0, i*16+16, 16))
    elif n == "WATER_SURFACE":
        for i in range(im.width // 16):
            frames[f"surface_{i}"] = im.crop((i*16, 0, i*16+16, 16))
    else:
        frames[n.lower()] = im

PAD = 2
items = sorted(frames.items(), key=lambda kv: (-kv[1].height, kv[0]))
W = 1024
x = y = PAD; shelf = 0; place = {}
for n, im in items:
    w, h = im.width*SCALE, im.height*SCALE
    if x + w + PAD > W:
        x = PAD; y += shelf + PAD; shelf = 0
    place[n] = (x, y, w, h)
    x += w + PAD; shelf = max(shelf, h)
H = y + shelf + PAD
H = 1 << (H - 1).bit_length()
atlas = Image.new("RGBA", (W, H))
meta = {}
for n, im in items:
    x, y, w, h = place[n]
    atlas.paste(up(im), (x, y))
    meta[n] = {"frame": {"x": x, "y": y, "w": w, "h": h}, "rotated": False, "trimmed": False,
               "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h}}
atlas.save(f"{OUT}/img/sprites.png", optimize=True)
json.dump({"frames": meta, "meta": {"app": "alex4 build_assets.py", "image": "sprites.png",
           "format": "RGBA8888", "size": {"w": W, "h": H}, "scale": "1"}},
          open(f"{OUT}/img/sprites.json", "w"), indent=1, sort_keys=True)
print("atlas", W, H, len(meta))

# ---- bitmap fonts (fixed pitch, ASCII 32..90) -----------------------------
for size in (32, 40):
    src = f"{WE}/hud/atascii_{size}px.png"
    font = Image.open(src).convert("RGBA")
    w, h = font.size
    # the font has no ' ! , glyphs: draw them in the same 8x8 pixel style
    u = size // 8
    color = (224, 238, 210, 255)
    extra = {"!": ["...##...", "...##...", "...##...", "...##...", "........", "...##...", "........"],
             "'": ["...##...", "...##...", "..##....", "........", "........", "........", "........"],
             ",": ["........", "........", "........", "........", "...##...", "...##...", "..##...."]}
    for ch, rows in extra.items():
        cx = (ord(ch) - 32) * size
        font.paste((0, 0, 0, 0), (cx, 0, cx + size, h))
        for ry, row in enumerate(rows, 1):
            for rx, c in enumerate(row):
                if c == "#":
                    font.paste(color, (cx + rx*u, ry*u, cx + rx*u + u, ry*u + u))
    font.save(f"{OUT}/fnt/atascii{size}.png", optimize=True)
    lines = [f'info face="atascii{size}" size={size} bold=0 italic=0 charset="" unicode=0 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0',
             f"common lineHeight={size} base={size} scaleW={w} scaleH={h} pages=1 packed=0",
             f'page id=0 file="atascii{size}.png"',
             f"chars count={90-32+1}"]
    for c in range(32, 91):
        lines.append(f"char id={c} x={(c-32)*size} y=0 width={size} height={size} xoffset=0 yoffset=0 xadvance={size} page=0 chnl=15")
    open(f"{OUT}/fnt/atascii{size}.fnt", "w").write("\n".join(lines) + "\n")

# ---- WE assets reused as is ----------------------------------------------
for f in ("layer1", "layer2", "layer3"):
    shutil.copy(f"{WE}/background/{f}.png", f"{OUT}/img/{f}.png")
for f in ("hud_egg", "hud_heart", "hud_life", "menu_title", "menu_arrow", "lets_go_msg", "gameover", "levelcomplete"):
    shutil.copy(f"{WE}/hud/{f}.png", f"{OUT}/img/{f}.png")
for f in ("a4_tileset", "metatiles64x64"):
    shutil.copy(f"{WE}/level/{f}.png", f"{OUT}/map/{f}.png")
for f in os.listdir(f"{WE}/audio/music"):
    shutil.copy(f"{WE}/audio/music/{f}", f"{OUT}/bgm/{f}")
for f in os.listdir(f"{WE}/audio/sfx"):
    shutil.copy(f"{WE}/audio/sfx/{f}", f"{OUT}/sfx/{f}")

# ---- missing sound effects from the original sample data -------------------
sfx = {p["NAME"]: d for t, p, d in parse_dat(unpack_file(f"{ORIG}/sfx_22.dat", password())) if t == "SAMP"}
for name in ("spit", "shoot", "ship", "energy"):
    d = sfx[name]
    bits, freq, length = struct.unpack(">hHI", d[:8])
    ch = 2 if bits < 0 else 1
    bits = abs(bits)
    pcm = d[8:8 + length*ch*(bits//8)]
    tmp = f"{OUT}/sfx/{name}.wav"
    with wave.open(tmp, "wb") as wv:
        wv.setnchannels(ch); wv.setsampwidth(bits//8); wv.setframerate(freq); wv.writeframes(pcm)
    for ext, codec in (("ogg", ["-c:a", "libvorbis", "-q:a", "3"]), ("mp3", ["-c:a", "libmp3lame", "-b:a", "64k"])):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, *codec, f"{OUT}/sfx/{name}.{ext}"], check=True)
    os.remove(tmp)
    print("sfx", name, bits, freq, length, ch)
