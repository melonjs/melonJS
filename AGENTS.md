# melonJS — working in this repository

Instructions for coding agents (and people) working **on** melonJS: the
engine, its plugins and adapters, and the examples. For a game that *uses*
melonJS, copy `packages/melonjs/skills/AGENTS.md` into that game instead.

## Read the skills before writing engine-facing code

The engine ships task-oriented guides under
[`packages/melonjs/skills/`](packages/melonjs/skills/), one per subsystem, each
ending with a symptom → cause table. They are written for code that uses the
engine, which is exactly what an example, a plugin or a test is.

**Before writing an example, a plugin, a test or an engine feature, read the
router, [`packages/melonjs/skills/melonjs/SKILL.md`](packages/melonjs/skills/melonjs/SKILL.md),
then the one or two skills it points at.** Its "Prefer built-in features"
section lists what not to hand-roll: `ParticleEmitter` and `Trail`, `Tween`,
`TextureAtlas`, the `ShaderEffect` presets, the UI widgets, `BitmapText`,
`viewport.shake` / `fadeIn` / `fadeOut`, `save`, `state.pause()`, Tiled tile
layers read and changed with `cellAt` / `setTile`. An example that re-implements
one of them teaches the wrong thing.

For anything the skills do not cover, read the source under
`packages/melonjs/src/`, whose public API is documented with TSDoc, or the
generated index, <https://melonjs.github.io/melonJS/llms.txt>.

## Repository layout

A pnpm workspace (`packages/*`), built with Turborepo. Node 24 or later.

| Package | What it is |
| --- | --- |
| `packages/melonjs` | the engine: `src/`, browser tests in `tests/`, the skills in `skills/` |
| `packages/examples` | the examples site (Vite + React): one folder per example in `src/examples/`, registered in `src/main.tsx` |
| `packages/debug-plugin` | the debug panel |
| `packages/gamepad-plugin` | on-screen touch controls reported as a gamepad |
| `packages/spine-plugin` | Spine skeletal animation |
| `packages/tiled-inflate-plugin` | compressed Tiled maps |
| `packages/capacitor-plugin` | Capacitor lifecycle and hardware back button |
| `packages/matter-adapter`, `packages/planck-adapter` | physics engines that replace the built-in world |
| `packages/create-melonjs` | the project scaffolder |
| `packages/tsconfig` | shared TypeScript configuration |

## Commands

```bash
pnpm install
pnpm build                             # every package (Turborepo)
pnpm dev                               # engine in watch mode + the examples site
pnpm test                              # the engine's browser tests (Vitest + Playwright)
pnpm -F @melonjs/gamepad-plugin test   # one package's tests (those that have them)
pnpm lint                              # build, ESLint, Biome and the type checks
pnpm -F melonjs test:types             # the engine's type check alone
pnpm doc                               # the API docs, into packages/melonjs/docs/
```

Tests run in Chromium through Playwright: a renderer, a pointer and a canvas are
real, so test through them rather than mocking them.

## Conventions

- Tabs, strict equality, and the patterns of the code around the change; Biome
  and ESLint enforce the rest. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Changelogs.** Each package has its own `CHANGELOG.md`. A user-facing change
  goes under the `_unreleased_` heading of the package it changes, written as
  `CONTRIBUTING.md` describes. Examples, tests and internals stay out of it.
- **Public API.** Document it with TSDoc. A plugin's new public type also needs
  exporting from `packages/melonjs/scripts/docs/api-entry.ts`, or the API site
  leaves it out; `pnpm doc` shows the result.
- **Skills are part of the change.** A change to what an engine or plugin API
  does, or a new one, updates the skill that covers it in the same change:
  usage, pitfalls and symptom rows. Keep a skill's `description` within 1024
  characters.
- **Examples.** Build the example with `createExampleComponent` from
  `src/examples/utils.tsx`, put its assets in
  `packages/examples/public/assets/<example>/`, and credit any third-party asset,
  with its license, in `packages/examples/LICENSE.md`. An example shows how the
  engine is meant to be used, so it uses the engine's features rather than its
  own versions of them (see the skills above).

## Branches, pull requests and releases

- Work on a branch from `master`. Commit and push when asked, and only open a
  pull request, merge or publish when asked to. Pull requests follow
  `.github/pull_request_template.md`.
- A package is released by a small pull request that sets its `package.json`
  version and dates its changelog section, then the **Publish to npm** GitHub
  Action (`publish.yml`, run by hand with the package name, a dry run first).
  It publishes with npm provenance.
