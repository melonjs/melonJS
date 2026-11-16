# melonJS Tiled Inflate Plugin
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/tiled-inflate-plugin)](https://www.npmjs.com/package/@melonjs/tiled-inflate-plugin)
[![jsDeliver](https://data.jsdelivr.com/v1/package/npm/@melonjs/tiled-inflate-plugin/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@melonjs/tiled-inflate-plugin)

Compressed [Tiled](https://www.mapeditor.org/) maps for [melonJS](https://melonjs.org/) games.

Tiled can save a tile layer's data compressed (the map's *Tile Layer Format* property). melonJS reads CSV and uncompressed base64 layers on its own; this plugin adds the compressed ones.

- gzip, zlib and zstd layer data, in `.tmx` and `.tmj` maps, finite or infinite
- gzip and zlib checksums checked: a damaged map throws an error saying what is wrong, instead of loading with the wrong tiles
- base64 decoded with `atob`, or by the plugin itself on a runtime that has none
- small: [fflate](https://github.com/101arrowz/fflate) for gzip and zlib, [fzstd](https://github.com/101arrowz/fzstd) for zstd

## Install

```sh
npm install melonjs @melonjs/tiled-inflate-plugin
```

## Quick start

```js
import { plugin } from "melonjs";
import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";

// register the plugin before loading any compressed Tiled maps
plugin.register(TiledInflatePlugin);
```

Maps then load as usual, compressed or not.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `No inflate function set` when a map loads | The map has compressed layers and the plugin is not registered: register it before the map loads |
| `@melonjs/tiled-inflate-plugin: cannot read zlib compressed layer data: …` | That layer's data is damaged (a checksum or its length does not match), cut short, or not base64: save the map again from Tiled |
| `Tiled layer compression "…" is not supported` | The map was written by another tool, with a compression Tiled does not offer: save it from Tiled with gzip, zlib or zstd |
| A zstd map loads with the wrong tiles | zstd data as Tiled writes it has no checksum, so damage can go unnoticed: save the map again, or use gzip or zlib, which are checked |

A `.tmx` map is read while it preloads: its error is then the `cause` of the loader's `Failed loading resource …`. A `.tmj` map is read by `level.load`, which throws it.

## Developing

`pnpm -F @melonjs/tiled-inflate-plugin test` runs the tests: maps saved by Tiled in every layer format, damaged copies of them, and the decoders on their own. The maps in `tests/fixtures` are written by Tiled itself, from `tests/fixtures/generate.tiled.js`: run `Tiled --evaluate generate.tiled.js "$PWD"` in that folder.

## License

[MIT](LICENSE)
