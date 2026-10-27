"""Build the Alex4 Tiled maps for the melonJS example.

levels 1-6  : the Alex4-WE hand-made Tiled maps, modernized
levels 7-12 : converted from the original Alex4 `maps.dat`
outro       : the outro scene map (SCRIPTMAP1 in `data.dat`)
"""
import sys, os, struct, re
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allegro_dat import parse_dat, unpack_file, password
from maps import load_maps
from tmxread import layers as read_layers

ORIG, WE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
T = 64          # tile size in pixels
H = 8           # map height in tiles (7 rows + status bar row)

# original map codes
I_EGG, I_1UP, I_STAR, I_CHERRY, I_HEART, I_LOLA = 1, 4, 7, 8, 9, 10
T_DEAD, T_EXIT, T_SPIN, T_BRK = 2, 3, 5, 6
T_WATER, T_SURFACE = 201, 202
ITEMS = {I_EGG: "egg", I_1UP: "oneup", I_STAR: "star", I_CHERRY: "cherry", I_HEART: "heart", I_LOLA: "lola"}
ACTORS = {101: "enemy1", 102: "enemy2", 103: "crusher", 104: "spikefish", 105: "jellyfish",
          106: "cannon", 151: "boss1", 152: "boss2"}
# WE object names -> example class names
WE_NAMES = {"playerspawnpoint": "player", "cherryentity": "cherry", "heartentity": "heart",
            "starentity": "star", "1upentity": "oneup", "rollblockentity": "spin",
            "enemy1entity": "enemy1", "enemy2entity": "enemy2", "boss1entity": "boss1",
            "canonentity": "cannon", "spikeentity": "spike", "lets_go_msg": "letsgo",
            "tmxlevelentity": "exit"}

TILESET_WE = dict(name="a4_tileset", image="a4_tileset.png", w=640, h=480, count=63, columns=9, spacing=1, margin=1)
TILESET_ORIG = dict(name="a4_tiles", image="a4_tiles.png", w=768, h=512, count=96, columns=12, spacing=0, margin=0)
META = dict(name="metatiles", image="metatiles64x64.png", w=384, h=64, count=6, columns=6, spacing=0, margin=0,
            props={0: "solid", 5: "breakable"})
SOLID, BREAKABLE = 0, 5


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def tileset_xml(ts, firstgid):
    out = [f' <tileset firstgid="{firstgid}" name="{ts["name"]}" tilewidth="{T}" tileheight="{T}" '
           f'spacing="{ts["spacing"]}" margin="{ts["margin"]}" tilecount="{ts["count"]}" columns="{ts["columns"]}">',
           f'  <image source="{ts["image"]}" width="{ts["w"]}" height="{ts["h"]}"/>']
    for tid, kind in ts.get("props", {}).items():
        out += [f'  <tile id="{tid}">', '   <properties>',
                f'    <property name="type" value="{kind}"/>', '   </properties>', '  </tile>']
    out.append(" </tileset>")
    return out


def layer_xml(lid, name, w, gids, visible=True):
    rows = [",".join(str(g) for g in gids[y*w:(y+1)*w]) for y in range(H)]
    return [f' <layer id="{lid}" name="{name}" width="{w}" height="{H}"' + ("" if visible else ' visible="0"') + ">",
            '  <data encoding="csv">', ",\n".join(rows), "</data>", " </layer>"]


def write_tmx(path, w, props, tileset, fg, coll, objects, background=True):
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           f'<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" '
           f'width="{w}" height="{H}" tilewidth="{T}" tileheight="{T}" infinite="0" '
           f'backgroundcolor="#dfedd2" nextlayerid="8" nextobjectid="{len(objects)+1}">',
           " <properties>"]
    for k, v in props.items():
        t = ' type="int"' if isinstance(v, int) else ""
        out.append(f'  <property name="{k}"{t} value="{esc(str(v))}"/>')
    out.append(" </properties>")
    out += tileset_xml(tileset, 1)
    meta_gid = tileset["count"] + 1
    out += tileset_xml(META, meta_gid)
    lid = 1
    if background:
        # bottom-aligned parallax strips, as drawn by the original game
        for name, img, iw, ih, ratio, oy, rep in (
                ("background", "../img/layer1.png", 256, 256, 0.25, 0, 'repeatx="1" repeaty="1"'),
                ("hills", "../img/layer2.png", 320, 384, 0.35, 480 - 384, 'repeatx="1"'),
                ("grass", "../img/layer3.png", 640, 480, 0.5, 0, 'repeatx="1"')):
            out += [f' <imagelayer id="{lid}" name="{name}" offsety="{oy}" parallaxx="{ratio}" parallaxy="0" {rep}>',
                    f'  <image source="{img}" width="{iw}" height="{ih}"/>', " </imagelayer>"]
            lid += 1
    out += layer_xml(lid, "Foreground", w, fg); lid += 1
    out += layer_xml(lid, "Collision", w, [0 if c is None else meta_gid + c for c in coll], visible=False); lid += 1
    out.append(f' <objectgroup id="{lid}" name="Entities">')
    for i, o in enumerate(objects, 1):
        attrs = f'id="{i}" name="{o["name"]}" x="{o["x"]}" y="{o["y"]}" width="{o.get("w", T)}" height="{o.get("h", T)}"'
        p = o.get("props")
        if p:
            out.append(f"  <object {attrs}>")
            out.append("   <properties>")
            for k, v in p.items():
                t = ' type="int"' if isinstance(v, int) else ""
                out.append(f'    <property name="{k}"{t} value="{esc(str(v))}"/>')
            out += ["   </properties>", "  </object>"]
        else:
            out.append(f"  <object {attrs}/>")
    out += [" </objectgroup>", "</map>", ""]
    open(path, "w").write("\n".join(out))


def runs(cells, w, pred):
    """merge horizontal runs of matching cells -> (x, y, length, value)"""
    res = []
    for y in range(7):
        x = 0
        while x < w:
            v = pred(x, y)
            if v:
                s = x
                while x < w and pred(x, y) == v:
                    x += 1
                res.append((s, y, x - s, v))
            else:
                x += 1
    return res


def convert_original(m, levelid, path, letsgo=True):
    w, c = m["w"], m["cells"]
    cell = lambda x, y: c[(y*w + x)*4:(y*w + x)*4 + 4]
    fg = [0]*(w*H); coll = [None]*(w*H); objs = []
    for y in range(7):
        for x in range(w):
            tile, mask, typ, item = cell(x, y)
            fg[y*w + x] = tile
            if typ == T_BRK:
                coll[y*w + x] = BREAKABLE
            elif mask:
                coll[y*w + x] = SOLID
            if item in ITEMS:
                objs.append(dict(name=ITEMS[item], x=x*T, y=y*T))
            if typ in ACTORS:
                objs.append(dict(name=ACTORS[typ], x=x*T, y=y*T))
            elif typ == T_SPIN:
                objs.append(dict(name="spin", x=x*T, y=y*T))
            elif typ == T_EXIT:
                objs.append(dict(name="exit", x=x*T, y=y*T))
    for x, y, n, v in runs(c, w, lambda x, y: cell(x, y)[2] == T_DEAD):
        objs.append(dict(name="spike", x=x*T, y=y*T, w=n*T))
    for x, y, n, v in runs(c, w, lambda x, y: cell(x, y)[2] if cell(x, y)[2] in (T_WATER, T_SURFACE) else 0):
        objs.append(dict(name="water", x=x*T, y=y*T, w=n*T, props={"surface": int(v == T_SURFACE)}))
    sx, sy = m["start"]
    objs.insert(0, dict(name="player", x=abs(sx)*T, y=sy*T, props={"facing": "left" if sx < 0 else "right"}))
    if letsgo:
        objs.append(dict(name="letsgo", x=0, y=0))
    flags = m["flags"]
    props = {"label": m["name"], "levelid": levelid, "win": flags[4], "boss": flags[3]}
    write_tmx(path, w, props, TILESET_ORIG, fg, coll, objs, background=True)
    return objs


def modernize_we(src, orig, levelid, path):
    root = ET.parse(src).getroot()
    w = int(root.get("width"))
    L = read_layers(src)
    fg = list(L["Foreground"][2])
    meta_first = 64
    coll = [None if g == 0 else g - meta_first for g in L["Collision"][2]]
    objs = []
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
            if name == "exit" and ob["x"] >= w*T:
                continue  # unreachable WE exit on the boss level
            objs.append(ob)
    # WE never ported the eggs (no spitting); add them back where the maps line up
    if orig["w"] == w:
        oc = orig["cells"]
        for k in range(len(oc)//4):
            if oc[k*4 + 3] == I_EGG:
                objs.append(dict(name="egg", x=(k % w)*T, y=(k // w)*T))
    flags = orig["flags"]
    label = orig["name"]
    props = {"label": label, "levelid": levelid, "win": flags[4], "boss": flags[3]}
    write_tmx(path, w, props, TILESET_WE, fg, coll, objs, background=True)
    return objs


maps = load_maps(f"{ORIG}/maps.dat")
for i in range(6):
    o = modernize_we(f"{WE}/level/a4_level{i+1}.tmx", maps[i], i + 1, f"{OUT}/a4_level{i+1}.tmx")
    print("WE   ", i + 1, maps[i]["name"], len(o))
for i in range(6, 12):
    o = convert_original(maps[i], i + 1, f"{OUT}/a4_level{i+1}.tmx")
    print("ORIG ", i + 1, maps[i]["name"], len(o))

# outro scene
for t, p, d in parse_dat(unpack_file(f"{ORIG}/data.dat", password())):
    if p.get("NAME") == "SCRIPTMAP1":
        h = d[6:102]
        w, hh = struct.unpack("<ii", h[64:72])
        m = dict(name="outro", w=w, h=hh, flags=[0, 0, 0, 0, 0], start=(3, 4), cells=d[102:102 + w*hh*4])
        convert_original(m, 13, f"{OUT}/a4_outro.tmx", letsgo=False)
        print("outro", w, hh)
