"""Build the Alex4 Tiled maps for the melonJS example.

levels 1-6  : the Alex4-WE hand-made Tiled maps, brought up to date
levels 7-12 : converted from the original game (`maps.dat`)
intro, outro: the scenes of the intro and the outro (SCRIPTMAP0 and SCRIPTMAP1
              in `data.dat`)

Every map gets the same layout: three parallax image layers, the
"Foreground" tile layer, a "collision" object layer (solid rectangles plus
the breakable blocks) and an "entities" object layer.
"""
import os
import struct
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allegro_dat import parse_dat, password, unpack_file  # noqa: E402
from maps import load_maps  # noqa: E402
from tmxread import layers as read_layers  # noqa: E402

ORIG, WE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
T = 64          # tile size in pixels (4x the original 16)
H = 8           # map height in tiles: 7 rows, plus one under the HUD
ROWS = 7

# original map codes (map.h)
ITEMS = {1: "egg", 4: "oneup", 7: "star", 8: "cherry", 9: "heart", 10: "lola"}
T_DEAD, T_EXIT, T_SPIN, T_BRK = 2, 3, 5, 6
T_WATER, T_SURFACE = 201, 202
ACTORS = {101: "enemy1", 102: "enemy2", 103: "crusher", 104: "spikefish", 105: "jellyfish",
          106: "cannon", 151: "boss1", 152: "boss2"}

# Alex4-WE object names -> the names registered by the example
WE_NAMES = {"playerspawnpoint": "player", "cherryentity": "cherry", "heartentity": "heart",
            "starentity": "star", "1upentity": "oneup", "rollblockentity": "spin",
            "enemy1entity": "enemy1", "enemy2entity": "enemy2", "boss1entity": "boss1",
            "canonentity": "cannon", "spikeentity": "spike", "tmxlevelentity": "exit"}

# the width of the screen, in tiles (832 pixels)
WIDE = 13

TILESET_WE = dict(name="a4_tileset", image="a4_tileset.png", w=640, h=480, count=63, columns=9, spacing=1, margin=1)
TILESET_ORIG = dict(name="a4_tiles", image="a4_tiles.png", w=768, h=512, count=96, columns=12, spacing=0, margin=0)


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def props_xml(props, indent):
    out = [f"{indent}<properties>"]
    for k, v in props.items():
        t = ' type="int"' if isinstance(v, int) else ""
        out.append(f'{indent} <property name="{k}"{t} value="{esc(str(v))}"/>')
    out.append(f"{indent}</properties>")
    return out


def merge_rects(solid, w):
    """greedy merge of solid cells into rectangles: rows first, then columns"""
    runs = []
    for y in range(ROWS):
        x = 0
        while x < w:
            if solid[y * w + x]:
                s = x
                while x < w and solid[y * w + x]:
                    x += 1
                runs.append([s, y, x - s, 1])
            else:
                x += 1
    merged = []
    for r in runs:
        for m in merged:
            if m[0] == r[0] and m[2] == r[2] and m[1] + m[3] == r[1]:
                m[3] += 1
                break
        else:
            merged.append(r)
    return merged


def object_xml(oid, o):
    attrs = f'id="{oid}"'
    if o.get("name"):
        attrs += f' name="{o["name"]}"'
    attrs += f' x="{o["x"]}" y="{o["y"]}" width="{o.get("w", T)}" height="{o.get("h", T)}"'
    if not o.get("props"):
        return [f"  <object {attrs}/>"]
    return [f"  <object {attrs}>", *props_xml(o["props"], "   "), "  </object>"]


def write_tmx(path, w, props, tileset, fg, solid, breakables, objects):
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           f'<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" '
           f'width="{w}" height="{H}" tilewidth="{T}" tileheight="{T}" infinite="0" backgroundcolor="#dfedd2">',
           *props_xml(props, " "),
           f' <tileset firstgid="1" name="{tileset["name"]}" tilewidth="{T}" tileheight="{T}" '
           f'spacing="{tileset["spacing"]}" margin="{tileset["margin"]}" tilecount="{tileset["count"]}" '
           f'columns="{tileset["columns"]}">',
           f'  <image source="{tileset["image"]}" width="{tileset["w"]}" height="{tileset["h"]}"/>',
           " </tileset>"]
    # the parallax layers, as in Alex4-WE
    for lid, (name, iw, ih, ratio, rep) in enumerate((
            ("layer1", 256, 256, 0.25, 'repeatx="1" repeaty="1"'),
            ("layer2", 320, 384, 0.35, 'repeatx="1"'),
            ("layer3", 640, 480, 0.5, 'repeatx="1"')), 1):
        out += [f' <imagelayer id="{lid}" name="{name}" parallaxx="{ratio}" parallaxy="0" {rep}>',
                f'  <image source="../img/{name}.png" width="{iw}" height="{ih}"/>', " </imagelayer>"]
    rows = [",".join(str(g) for g in fg[y * w:(y + 1) * w]) for y in range(H)]
    out += [f' <layer id="4" name="Foreground" width="{w}" height="{H}">',
            '  <data encoding="csv">', ",\n".join(rows), "</data>", " </layer>"]

    oid = 1
    out.append(' <objectgroup id="5" name="collision">')
    for x, y, rw, rh in merge_rects(solid, w):
        out += object_xml(oid, dict(x=x * T, y=y * T, w=rw * T, h=rh * T))
        oid += 1
    for x, y in breakables:
        out += object_xml(oid, dict(name="breakable", x=x * T, y=y * T))
        oid += 1
    out.append(" </objectgroup>")

    out.append(' <objectgroup id="6" name="entities">')
    for o in objects:
        out += object_xml(oid, o)
        oid += 1
    out += [" </objectgroup>", "</map>", ""]
    open(path, "w").write("\n".join(out))


def patrol(solid, w, tx, ty):
    """the stretch of ground an enemy can walk on from (tx, ty)"""
    def walkable(x):
        return 0 <= x < w and not solid[ty * w + x] and (ty + 1 >= ROWS or solid[(ty + 1) * w + x])
    left = right = tx
    while walkable(left - 1):
        left -= 1
    while walkable(right + 1):
        right += 1
    return left, right


def convert_original(m, levelid, path, scene=False):
    w, c = m["w"], m["cells"]

    def cell(x, y):
        return c[(y * w + x) * 4:(y * w + x) * 4 + 4]

    fg = [0] * (w * H)
    solid = [False] * (w * ROWS)
    breakables = []
    objects = []
    for y in range(ROWS):
        for x in range(w):
            tile, mask, typ, item = cell(x, y)
            fg[y * w + x] = tile
            if typ == T_BRK:
                breakables.append((x, y))
            elif mask:
                solid[y * w + x] = True

    sx, sy = m["start"]
    objects.append(dict(name="player", x=abs(sx) * T, y=sy * T, props={"facing": "left" if sx < 0 else "right"}))
    for y in range(ROWS):
        for x in range(w):
            tile, mask, typ, item = cell(x, y)
            if item in ITEMS:
                objects.append(dict(name=ITEMS[item], x=x * T, y=y * T))
            if typ == T_DEAD:
                objects.append(dict(name="spike", x=x * T, y=y * T))
            elif typ == T_EXIT:
                objects.append(dict(name="exit", x=x * T, y=y * T))
            elif typ == T_SPIN:
                objects.append(dict(name="spin", x=x * T, y=y * T))
            elif typ in (T_WATER, T_SURFACE):
                objects.append(dict(name="water", x=x * T, y=y * T, props={"surface": int(typ == T_SURFACE)}))
            elif typ == 102:
                # big humans walk back and forth on their own platform
                left, right = patrol(solid, w, x, y)
                objects.append(dict(name="enemy2", x=left * T, y=y * T, w=(right - left + 1) * T))
            elif typ in ACTORS:
                objects.append(dict(name=ACTORS[typ], x=x * T, y=y * T))

    if scene:
        # the scenes are cut scenes: only keep the water
        objects = [o for o in objects if o["name"] == "water"]
    flags = m["flags"]
    props = {"label": m["name"], "levelid": levelid, "win": flags[4], "boss": flags[3]}
    write_tmx(path, w, props, TILESET_ORIG, fg, solid, breakables, objects)
    return objects


def convert_we(src, orig, levelid, path):
    root = ET.parse(src).getroot()
    w = int(root.get("width"))
    layers = read_layers(src)
    fg = list(layers["Foreground"][2])
    # WE collision tiles: metatile 0 is solid, metatile 5 breakable
    coll = layers["Collision"][2]
    solid = [coll[i] == 64 for i in range(w * ROWS)]
    breakables = [(i % w, i // w) for i in range(w * ROWS) if coll[i] == 69]

    objects = []
    for og in root.iter("objectgroup"):
        for o in og.iter("object"):
            name = WE_NAMES.get(o.get("name").lower())
            if name is None:
                continue
            ob = dict(name=name, x=int(o.get("x")), y=int(o.get("y")), w=int(o.get("width")), h=int(o.get("height")))
            props = {p.get("name"): p.get("value") for p in o.iter("property")}
            if name == "spike" and "direction" in props:
                ob["props"] = {"direction": props["direction"]}
            if name == "player":
                ob["props"] = {"facing": "right"}
            if name == "exit" and ob["x"] >= w * T:
                continue  # the unreachable exit of the WE boss level
            if name == "boss1":
                # the WE box is the 128x128 sprite: keep the cell it stands in
                ob.update(y=ob["y"] + ob["h"] - T, w=T, h=T)
            objects.append(ob)
    # WE had no spitting, so it never placed the eggs: put them back
    if orig["w"] == w:
        oc = orig["cells"]
        for k in range(len(oc) // 4):
            if oc[k * 4 + 3] == 1:
                objects.append(dict(name="egg", x=(k % w) * T, y=(k // w) * T))
    flags = orig["flags"]
    props = {"label": orig["name"], "levelid": levelid, "win": flags[4], "boss": flags[3]}
    write_tmx(path, w, props, TILESET_WE, fg, solid, breakables, objects)
    return objects


maps = load_maps(f"{ORIG}/maps.dat")
for i in range(6):
    o = convert_we(f"{WE}/level/a4_level{i + 1}.tmx", maps[i], i + 1, f"{OUT}/a4_level{i + 1}.tmx")
    print("WE  ", i + 1, maps[i]["name"], len(o))
for i in range(6, 12):
    o = convert_original(maps[i], i + 1, f"{OUT}/a4_level{i + 1}.tmx")
    print("ORIG", i + 1, maps[i]["name"], len(o))

SCENES = {"SCRIPTMAP0": "intro", "SCRIPTMAP1": "outro"}
for t, p, d in parse_dat(unpack_file(f"{ORIG}/data.dat", password())):
    name = SCENES.get(p.get("NAME"))
    if name:
        h = d[6:102]
        w, hh = struct.unpack("<ii", h[64:72])
        cells = d[102:102 + w * hh * 4]
        # the scenes were made for a 4:3 screen: repeat their right column to fill a 16:9 one
        rows = [cells[y * w * 4:(y + 1) * w * 4] for y in range(hh)]
        rows = [row + row[-4:] * (WIDE - w) for row in rows]
        m = dict(name=name, w=WIDE, h=hh, flags=[0, 0, 0, 0, 0], start=(3, 4), cells=b"".join(rows))
        convert_original(m, 13, f"{OUT}/a4_{name}.tmx", scene=True)
        print(name, w, hh)
