# Changelog

## 1.3.0 - _2026-11-16_

### Changed
- gzip and zlib are decompressed with [fflate](https://github.com/101arrowz/fflate) instead of pako: the plugin is about 16 KB minified instead of 59 KB
- base64 is decoded with `atob`, or by the plugin itself where the runtime has none, instead of js-base64

### Performance
- gzip layer data decompresses about a quarter faster

### Fixed
- A damaged compressed layer throws an `Error` naming the plugin and the problem, instead of pako's bare string or `TypeError`

## 1.2.2 - _2026-11-14_

### Fixed
- Installing the plugin no longer asks for Node 24. Its `package.json` declared `engines: { node: ">=24.0.0" }`, so npm warned on an older Node and Yarn 1 refused to install it; the plugin runs in the browser

## 1.2.1 - _2026-08-21_

### Changed
- The plugin now logs its name, version and homepage on registration, matching the startup banner the other melonJS plugins print.

## 1.2.0

### New Features
- Added zstd decompression support via [fzstd](https://github.com/101arrowz/fzstd)
- Migrated to melonJS monorepo
- Replaced rollup build with esbuild (matching other monorepo packages)

### Improvements
- Log plugin name, version and homepage to console on registration
- Fixed Uint32Array construction to account for byteOffset/byteLength
- Set esbuild target to es2022
- Updated Node.js engine requirement to >= 20

## 1.1.2

### Improvements
- Updated dependencies

## 1.1.1

### Bug Fixes
- Fix compatibility with melonJS version 15.2.1 and higher

## 1.1.0

### New Features
- Add declaration files for TypeScript

## 1.0.3

### Bug Fixes
- Fix package build distribution path in package.json

## 1.0.2

### Bug Fixes
- Fix gzip compressed map support (thanks @bjorn)
