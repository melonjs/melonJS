# melonJS Tiled Inflate Plugin
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/tiled-inflate-plugin)](https://www.npmjs.com/package/@melonjs/tiled-inflate-plugin)
[![jsDeliver](https://data.jsdelivr.com/v1/package/npm/@melonjs/tiled-inflate-plugin/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@melonjs/tiled-inflate-plugin)

A [melonJS](https://github.com/melonjs/melonJS) plugin to enable loading and parsing of compressed [Tiled](https://www.mapeditor.org/) maps.

Supports **gzip**, **zlib**, and **zstd** compressed tile layer data.

## Installation

```bash
npm install @melonjs/tiled-inflate-plugin
# or
pnpm add @melonjs/tiled-inflate-plugin
```

## Usage

```javascript
import { plugin } from "melonjs";
import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";

// register the plugin before loading any compressed Tiled maps
plugin.register(TiledInflatePlugin);
```

Once registered, melonJS will automatically decompress compressed tile layer data when loading Tiled maps.

## Supported Compression Formats

| Format | Supported | Library |
|--------|-----------|---------|
| gzip   | Yes       | [pako](https://github.com/nodeca/pako) |
| zlib   | Yes       | [pako](https://github.com/nodeca/pako) |
| zstd   | Yes       | [fzstd](https://github.com/101arrowz/fzstd) |

## License

[MIT](LICENSE)
