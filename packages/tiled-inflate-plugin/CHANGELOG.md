# Changelog

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
