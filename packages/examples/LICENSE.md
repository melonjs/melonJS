# Examples — License & Credits

## Source code

The MIT License

Copyright (C) 2011 - 2026 AltByte Pte Ltd

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Third-party assets

### `aquarium` example

The texture atlas in `public/assets/aquarium/aquarium.webp` was contributed by
a melonJS user with their aquarium demo (adapted here to the `toFrameTexture`
API). It packs a top-down seabed background ("Free Top-Down Seabed Objects
Pixel Art"), a fish animation sheet, and a water-surface texture. Provided by
the contributor for use in the melonJS examples; refer to the original asset
packs for any upstream attribution terms.

### `pool-matter` example

Pool table backdrop and 16 numbered-ball sprites in
`public/assets/pool-matter/img/` are derived from **"8-ball Pool Assets"**
published by Casino RPG on OpenGameArt.org:

<https://opengameart.org/content/8-ball-pool-assets?destination=node/68636>

These assets are released under **CC0 1.0 Universal (Public Domain
Dedication)** — no attribution legally required, but provided here as a
courtesy to the original creator.

### `multiMaterialMesh` example

Spacecraft 3D models (`craft_speederA`, `craft_speederB`, `craft_racer`,
`craft_miner`) in `public/assets/multiMaterialMesh/` are taken from
**"Space Kit (2.0)"** published by Kenney:

<https://www.kenney.nl/assets/space-kit>

Released under **CC0 1.0 Universal (Public Domain Dedication)** — no
attribution legally required, credited here as a courtesy.

### `waterOverworld` example

The Water Overworld example (`waterOverworld/`) uses the
**"Free Pixel Art Side Scroller Asset Pack (32x32) Overworld"** published by
**GandalfHardcore**, free to use:

<https://gandalfhardcore.itch.io/free-pixel-art-sidescroller-asset-pack-32x32-overworld>

### `materialTextures` example

The models (`crate.obj`, `panel.obj`), their material files and every
texture in `public/assets/materialTextures/` were authored for this
repository — hand-written geometry and procedurally generated maps. No
third-party assets, no attribution required. The ball re-uses the shared
`assets/mesh3d/sphere.obj` primitive from the mesh3d example.

### `gltf` examples

The 3D scenes in `public/assets/gltf/` are authored/assembled from CC0 kits
published by Kenney:

- `platformer-diorama.glb` (**glTF Scene**) — **"Platformer Kit"**
  (<https://www.kenney.nl/assets/platformer-kit>)
- `character.glb` (**glTF Animated Model**) — **"Blocky Characters"**
  (<https://www.kenney.nl/assets/blocky-characters>)

All released under **CC0 1.0 Universal (Public Domain Dedication)** — no
attribution legally required, credited here as a courtesy.

The **Night City Flythrough** example uses no external assets — its city is
generated procedurally from raw mesh data at runtime.

### `text` example

Pixel bitmap fonts `minogram` and `thick` in `public/assets/text/` are from
**"Pixel Bitmap Fonts (PNG + XML)"** by frostyfreeze:

<https://frostyfreeze.itch.io/pixel-bitmap-fonts-png-xml>

Credited here to the author; refer to the pack page for its license terms. The
originals are AngelCode BMFont **XML** (`minogram_6x10` / `thick_8x8`); they were
converted to the `.fnt` text format for this example (the PNG atlases are
unchanged).

The dialogue panel `panel.png` and the web font `kenvector_future.woff2` in the
same folder are from UI packs published by **Kenney** (<https://www.kenney.nl>),
released under **CC0 1.0 Universal (Public Domain Dedication)** — no attribution
legally required, credited here as a courtesy.

### `earthDefender` example

The Earth, the hexagonal glass dome and the five asteroid shapes in
`public/assets/earthDefender/` were modelled for this example and are covered
by the MIT license above, as are the rock colour and normal maps, the nebula,
and everything else the example generates at run time. The saucer, the bomb
and the drone sound come from elsewhere and are credited below.

The flying saucer `ufo.glb` is derived from a model by **RayB2**, released
into the public domain under **CC0 1.0**
(<https://creativecommons.org/publicdomain/zero/1.0/>). It was re-exported for
this example: the open edges filled, and its materials rebuilt as Principled
BSDF so they survive the glTF round trip.

The bomb `bomb.glb` is derived from the **KayKit Mini-Game Variety Pack** by
**Kay Lousberg** (<https://kaylousberg.com>), released under **CC0 1.0**. It was
cut below the band and re-exported so that it stands flat where it lands.

The sound effects in `sfx/` are from the **Sci-Fi Sounds** pack by **Kenney**
(<https://www.kenney.nl>), released under **CC0 1.0**: the saucer's engine note
`earthDefenderUfoDrone.*` is `spaceEngine_003`, and the gun's five takes
`earthDefenderLaser0-4.*` are `laserLarge_000` to `laserLarge_004`, played at
random so the same shot is never heard twice running. Crediting Kenney is explicitly not mandatory and
it is done anyway, as with the other CC0 work here.

It is not the published file: the saucer's drone loops for as long as it is in
the sky, and the original is a one-shot with an attack at the front and a fade
at the back, so looping it pumped. The sustained body was taken, its tail
folded back over its head with an EQUAL-POWER crossfade, and the result
normalised. Equal power rather than linear because the two ends are
uncorrelated noise and a linear fade leaves an audible dip exactly at the loop
point.

The title screen's music `bgm/earthDefenderMenu.*` is the "menu/industry"
track from **"Atmospheric puzzles"** by **legoluft**, the music of the Krank
game, submitted to OpenGameArt by qubodup and released under **CC0 1.0**:

<https://opengameart.org/content/atmospheric-puzzles>

CC0 asks for nothing and it is named anyway. Converted from the pack's OGG to
an additional MP3 for the browsers without Vorbis; neither was otherwise
edited.

The game's music `bgm/earthDefenderBattle.*` is **"Space Boss Battle Theme"**
(Orbital Colossus) by **Matthew Pablo** (<https://www.matthewpablo.com>),
licensed under **Creative Commons Attribution 3.0**
(<https://creativecommons.org/licenses/by/3.0/>):

<https://opengameart.org/content/space-boss-battle-theme>

That license REQUIRES attribution, and the author asks to be credited as
"Music by Matthew Pablo, www.matthewpablo.com", which is why he is named in
the example's Credits panel as well as here. The source MP3 was re-encoded
to a lower bit rate and transcoded to OGG; it was not otherwise edited. Note
the author states the track does not loop seamlessly as published and offers
a loopable version on request.

The display face `font/future-earth.ttf` is the FontStruction **"Future
Earth"** by **V. Sarela**:

<https://fontstruct.com/fontstructions/show/477551>

licensed under **Creative Commons Attribution-NoDerivatives 3.0**
(<http://creativecommons.org/licenses/by-nd/3.0/>). The archive's own
`license.txt` and `readme.txt` ship alongside it, as that license requires.

### `jungleRabbit` example

The 3D models in `public/assets/jungleRabbit/` — boat, carrot, log, rock, palm,
fern, leaves, flowers and bird — were modelled for this example and are covered
by the MIT license above, as is the procedurally generated terrain and water.
The `groundShadows` example borrows the same models rather than shipping its
own, so this covers both.

The music track `bgm/jungle-theme.mp3` is by **Vlad Krotov**, published on
Pixabay:

<https://pixabay.com/users/vladkrotov/>

Released under the **Pixabay Content License** — free for commercial and
non-commercial use, no attribution required. Credited on the example's title
screen and here as a courtesy.

The display face `font/Crang.woff2` was created by **Caveras** with FontStruct:

<https://fontstruct.com/fontstructors/caveras>

⚠️ Released under **CC BY-NC-SA 4.0** — attribution, share-alike, and
**non-commercial use only**. This is the one asset in the examples that is not
free for commercial reuse: if you copy this example into a commercial game, you
must replace this font or obtain a commercial license from the author
(cava@caveras.net). The full license text ships alongside the font as
`font/Crang-LICENSE.txt`.
