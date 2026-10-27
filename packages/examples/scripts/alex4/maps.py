"""Read the levels of the original game (`data/maps.dat`).

Each map is an "AX4MAP" header, the 32-bit Windows `Tmap` struct (map.h) and
then `width * height` cells of 4 bytes: tile, mask, type and item.
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allegro_dat import parse_dat, password, unpack_file  # noqa: E402


def load_maps(path):
    out = []
    for t, props, d in parse_dat(unpack_file(path, password())):
        if t != "MAP ":
            continue
        assert d[:6] == b"AX4MAP"
        h = d[6:6 + 96]
        name = h[:32].split(b"\0")[0].decode("latin1")
        # map_data_needs_to_be_destroyed, win_conditions_fullfilled,
        # num_enemies, boss_level, win_conditions
        flags = list(h[59:64])
        w, hh = struct.unpack("<ii", h[64:72])
        sx, sy = struct.unpack("<ii", h[88:96])
        cells = d[102:102 + w * hh * 4]
        assert len(cells) == w * hh * 4
        out.append(dict(id=props["NAME"], name=name, flags=flags, w=w, h=hh, start=(sx, sy), cells=cells))
    return out


if __name__ == "__main__":
    for m in load_maps(sys.argv[1]):
        print(m["id"], repr(m["name"]), m["w"], m["h"], m["flags"], m["start"])
