"""Read the tile layers of a (base64, optionally zlib compressed) TMX map."""
import base64
import re
import struct
import zlib


def layers(path):
    s = open(path).read()
    out = {}
    pattern = (r'<layer name="([^"]+)" width="(\d+)" height="(\d+)"[^>]*>\s*'
               r'<data encoding="base64"(?: compression="(\w+)")?>\s*([^<]+)</data>')
    for m in re.finditer(pattern, s):
        raw = base64.b64decode(m.group(5).strip())
        if m.group(4) == "zlib":
            raw = zlib.decompress(raw)
        w, h = int(m.group(2)), int(m.group(3))
        out[m.group(1)] = (w, h, struct.unpack("<%dI" % (w * h), raw))
    return out
