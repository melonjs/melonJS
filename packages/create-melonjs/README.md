# create-melonjs

Scaffold a new [melonJS](https://github.com/melonjs/melonJS) game project in seconds.

## Usage

```bash
npm create melonjs my-game
cd my-game
npm install
npm run dev
```

This downloads the [melonJS TypeScript boilerplate](https://github.com/melonjs/typescript-boilerplate) and sets up a ready-to-run game project with:

- [melonJS](https://github.com/melonjs/melonJS) — lightweight HTML5 game engine
- [TypeScript](https://www.typescriptlang.org) — type-safe JavaScript (also works with plain JS)
- [Vite](https://vitejs.dev) — fast dev server and bundler
- [Debug plugin](https://github.com/melonjs/debug-plugin) — auto-loaded in development mode

## Templates

Pick a different starter with `--template <name>` (or `-t`):

```bash
npm create melonjs my-game --template capacitor
```

| name | source | description |
| --- | --- | --- |
| `default` | [`melonjs/typescript-boilerplate`](https://github.com/melonjs/typescript-boilerplate) | Plain TypeScript + Vite (used when no `--template` flag is passed). |
| `capacitor` | [`melonjs/typescript-boilerplate-capacitor`](https://github.com/melonjs/typescript-boilerplate-capacitor) | TypeScript + Vite + [Capacitor](https://capacitorjs.com/) wrapper for iOS / Android, pre-wired with [`@melonjs/capacitor-plugin`](https://github.com/melonjs/melonJS/tree/master/packages/capacitor-plugin). |

## Links

- [melonJS Documentation](https://melonjs.github.io/melonJS/)
- [Examples](https://melonjs.github.io/melonJS/examples/)
- [Discord](https://discord.gg/aur7JMk)
