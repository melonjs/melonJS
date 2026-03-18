# @melonjs/tiled-inflate-plugin

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
