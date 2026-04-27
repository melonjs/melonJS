# Changelog

## 1.0.1

### Bug Fixes
- Switched from `execSync` with template-literal commands to `spawnSync` with argument arrays, so project paths containing spaces or shell metacharacters are no longer subject to shell interpolation
- Replaced the `rm -rf` / `rmdir` shell-out used to clean the cloned `.git` directory with `fs.rmSync({ recursive: true, force: true })` for a fully cross-platform, shell-free path
- The `git clone` fallback now reports an error and exits non-zero on failure instead of silently continuing into a missing `package.json`

## 1.0.0

- Initial release
