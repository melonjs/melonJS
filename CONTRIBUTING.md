![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

# Contributing to melonJS

melonJS is a community-driven project that has been shaped by contributors from around the world since 2011. Whether you're fixing a bug, adding a feature, improving the documentation, or simply helping others on Discord — every contribution matters and helps make the engine better for everyone.

We believe great software is built in the open, and we're always excited to welcome new contributors. No contribution is too small!

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) to keep our community approachable and respectful.

## Reporting issues

Found a bug or have a feature request? [Open an issue](https://github.com/melonjs/melonJS/issues/new) and include:

- A clear description of the problem or suggestion
- Steps to reproduce the issue (if applicable)
- Your browser, OS, and melonJS version
- A minimal code example or link to a reproduction — this helps us fix it faster

Please search [existing issues](https://github.com/melonjs/melonJS/issues) first to avoid duplicates.

## Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) version 20 or higher
- [pnpm](https://pnpm.io/installation) package manager

You can install pnpm using any of these methods:

```bash
# using Homebrew (macOS/Linux)
brew install pnpm

# or using npm
npm install -g pnpm

# or using Corepack (bundled with Node.js)
corepack enable
```

## Setting up the project

melonJS is organized as a monorepo with the following structure:

| Package | Description |
| --- | --- |
| `packages/melonjs` | The core game engine |
| `packages/debug-plugin` | Debug overlay plugin |
| `packages/examples` | Interactive examples and demos |

To get started:

```bash
# 1. Clone the repository
git clone https://github.com/melonjs/melonJS.git
cd melonJS

# 2. Install all dependencies
pnpm install

# 3. Build the library
pnpm build
```

After building, the output files are located in `packages/melonjs/build/`:

| File | Description |
| --- | --- |
| `index.js` | Tree-shakeable ESM bundle |
| `index.js.map` | Source map |
| `*.d.ts` | TypeScript declarations |
| `*.d.ts.map` | TypeScript declaration source maps |

## Development workflow

Start the development server to build the engine, watch for changes, and serve the examples with hot reload:

```bash
pnpm dev
```

This launches a [Vite](https://vite.dev) dev server. Open the URL displayed in your terminal to browse the included examples (platformer, isometric RPG, drag-and-drop, lighting, and more). Any changes you make to the engine source will be reflected immediately.

## Running tests

melonJS uses [Vitest](https://vitest.dev) with [Playwright](https://playwright.dev) for browser-based testing.

```bash
# Run the full test suite
pnpm test

# Run linting (ESLint + Biome)
pnpm lint

# Run type checking
pnpm -F melonjs test:types
```

## Building the documentation

The API documentation is generated with [TypeDoc](https://typedoc.org):

```bash
pnpm doc
```

The output is written to `packages/melonjs/docs/` and can be viewed by opening `index.html` in your browser.

## Code style

melonJS uses [ESLint](https://eslint.org) and [Biome](https://biomejs.dev) to enforce consistent code style. Running `pnpm lint` will check your code against the project's rules. Key conventions:

- Use tabs for indentation
- Use strict equality (`===`)
- Follow the existing patterns in the codebase
- If you fix a bug, consider adding a test to prevent it from recurring

## Submitting changes

1. Fork the repository and create a new branch from `master`
2. Make your changes and ensure `pnpm lint` and `pnpm test` pass
3. Write a clear commit message describing **what** you changed and **why**
4. Open a Pull Request against the `master` branch

Not sure where to start?

- Browse [open issues](https://github.com/melonjs/melonJS/issues) for bugs to fix or features to implement
- Check our [discussions](https://github.com/melonjs/melonJS/discussions/categories/ideas) for ideas and feature requests
- Improving documentation and examples is always welcome

## Questions, need help?

- [Discord](https://discord.gg/aur7JMk) — chat with the team and community
- [Wiki](https://github.com/melonjs/melonJS/wiki) — guides, tutorials, and resources
- [Discussions](https://github.com/melonjs/melonJS/discussions) — ask questions and share ideas

## Contributors

<a href="https://github.com/melonjs/melonJS/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=melonJS/melonjs"/>
</a>

## Sponsors

Support the development of melonJS by [becoming a sponsor](https://github.com/sponsors/melonjs). Get your logo in our README with a link to your site or become a backer and get your name in the [BACKERS](BACKERS.md) list. Any level of support is really appreciated and goes a long way!

[![Melon Gaming](https://user-images.githubusercontent.com/4033090/136695857-d098c27d-f4b2-4c71-8574-b5f4291779cb.png "Melon Gaming")](https://www.melongaming.com)

[![Altbyte Pte Ltd](https://user-images.githubusercontent.com/4033090/136692693-35dca8aa-5012-4a37-9ea2-51640d2e6d73.png "AltByte")](https://www.altbyte.com)
