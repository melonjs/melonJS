# Alex the Allegator 4 — asset conversion

These scripts generate `public/assets/alex4/` from two sources:

- the original game, "Alex the Allegator 4" by Johan Peitz / Free Lunch Design
  (2003, GPL): `alex4src_data.zip` from
  <https://sourceforge.net/projects/allegator/files/Alex4/source%20and%20data/>
- Alex4 Web Edition, the melonJS 0.9 remake:
  <https://github.com/mixelstudio/Alex4-WE>

```sh
unzip alex4src_data.zip -d /tmp/alex4
git clone https://github.com/mixelstudio/Alex4-WE /tmp/alex4-we

# sprite atlas, tileset, bitmap fonts, sounds (needs Pillow and ffmpeg)
python3 build_assets.py /tmp/alex4/alex4src/data /tmp/alex4-we/data ../../public/assets/alex4

# Tiled maps
python3 build_levels.py /tmp/alex4/alex4src/data ../../public/assets/alex4/map
```

- `allegro_dat.py` reads the password-protected Allegro 4 datafiles
- `maps.py` reads the original levels (`maps.dat`)
- `build_assets.py` converts the original bitmaps (4x, original palette) into
  a texture atlas and a tileset, widens the treetops of the cut scenes, adds
  the missing punctuation to the Alex4-WE bitmap fonts, converts the sound
  effects Alex4-WE did not have, and renders the intro and outro songs from
  the original music module (needs ffmpeg built with libopenmpt)
- `build_levels.py` converts the 12 levels and the scenes of the intro and
  the outro from the original data. Every map
  gets the same layers: the parallax images, a "Foreground" tile layer, a
  "collision" object layer (solid rectangles and the breakable blocks) and an
  "entities" object layer matched to the classes registered in `createGame.ts`

Like the original game, these scripts and the files they produce are GPL —
see `packages/examples/LICENSE.md`.
