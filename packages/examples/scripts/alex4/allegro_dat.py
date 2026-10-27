"""Read the Allegro 4 datafiles of the original Alex the Allegator 4.

The files are password protected Allegro packfiles: every byte is XORed with
the password (the magic number too, which is then XORed with a hash of the
password), and the content is LZSS compressed. The password is stored garbled
in the game source (main.c, `init_string`).
"""
import struct
import sys


def password():
    s = bytearray(b"[YhJPJKUSY`0-'\"7 ")
    for i in range(len(s)):
        s[i] ^= (53 + i) & 0xFF
    return bytes(s)


def encrypt_id(x, pw, new_format=True):
    mask = 0
    for i, c in enumerate(pw):
        mask ^= c << ((i & 3) * 8)
    pos = 0
    for i in range(4):
        mask ^= pw[pos] << (24 - i * 8)
        pos += 1
        if pos >= len(pw):
            pos = 0
    if new_format:
        mask ^= 42
    return (x ^ mask) & 0xFFFFFFFF


def lzss(data):
    """Allegro's LZSS decoder (4096 byte ring buffer, 18 byte matches)"""
    N, F, TH = 4096, 18, 2
    buf = bytearray(N)
    r = N - F
    out = bytearray()
    i = 0
    flags = 0
    while True:
        flags >>= 1
        if not (flags & 256):
            if i >= len(data):
                break
            flags = data[i] | 0xFF00
            i += 1
        if flags & 1:
            if i >= len(data):
                break
            c = data[i]
            i += 1
            out.append(c)
            buf[r] = c
            r = (r + 1) & (N - 1)
        else:
            if i + 1 >= len(data):
                break
            a, b = data[i], data[i + 1]
            i += 2
            a |= (b & 0xF0) << 4
            b = (b & 0x0F) + TH
            for k in range(b + 1):
                c = buf[(a + k) & (N - 1)]
                out.append(c)
                buf[r] = c
                r = (r + 1) & (N - 1)
    return bytes(out)


def unpack_file(path, pw):
    raw = bytearray(open(path, "rb").read())
    for i in range(len(raw)):
        raw[i] ^= pw[i % len(pw)]
    magic = encrypt_id(struct.unpack(">I", bytes(raw[:4]))[0], pw)
    body = bytes(raw[4:])
    if magic == 0x736C6821:  # "slh!" packed
        return lzss(body)
    if magic == 0x736C682E:  # "slh." not packed
        return body
    raise ValueError("not an Allegro packfile (or wrong password): %x" % magic)


def parse_dat(data):
    """list of (type, properties, data) for each object of a datafile"""
    assert data[:4] == b"ALL.", data[:4]
    n = struct.unpack(">i", data[4:8])[0]
    p = 8
    objs = []
    for _ in range(n):
        props = {}
        while True:
            t = data[p:p + 4]
            p += 4
            if t != b"prop":
                break
            pt = data[p:p + 4].decode()
            sz = struct.unpack(">i", data[p + 4:p + 8])[0]
            p += 8
            props[pt] = data[p:p + sz].decode("latin1")
            p += sz
        cs, us = struct.unpack(">ii", data[p:p + 8])
        p += 8
        if cs < 0:
            d = lzss(data[p:p - cs])[:us]
            p += -cs
        else:
            d = data[p:p + cs]
            p += cs
        objs.append((t.decode(), props, d))
    return objs


if __name__ == "__main__":
    for t, props, d in parse_dat(unpack_file(sys.argv[1], password())):
        print(t, props.get("NAME"), len(d))
