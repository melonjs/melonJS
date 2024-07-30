
# Contribute
-------------------------------------------------------------------------------
Thank you for your interest in contributing to melonJS !

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

If this is your first time contributing to an open source project on GitHub, please have a look at [this free tutorial](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github).

## Developing melonJS
The only things you need to start developing melonJS is [Node.js](http://nodejs.org/) and [pnpm](https://pnpm.io/installation). melonJS uses [Corepack](https://nodejs.org/api/corepack.html) to manage the package manager version. Follow the instructions to [install pnpm using Corepack](https://pnpm.io/installation#using-corepack). Run `pnpm install` to install third party dependencies.

You can start development mode by running `pnpm dev` which will build melonJS and the docs on every file change and start a Vite dev server with the examples so you can test out your changes in real time.

## Building melonJS
Build the melonJS source by running:

    pnpm build

The generated files will be available under the `build` directory:
- `index.js`: melonJS ESM bundle
- `index.js.map`: source map of the bundle
- `*.d.ts`: TS declaration files
- `*.d.ts.map`: TS declaration source maps

To run the melonJS test suite use the following:

    pnpm test

Last but not least, if you really want to contribute, but not sure how, you can
always check our [discussions](https://github.com/melonjs/melonJS/discussions/categories/ideas) list to get some idea on where to start.

## Building the documentation

Similarly, you can build your own copy of the docs locally by running :

    $ pnpm doc

The documentation will be generated under the `docs` directory, and can be accessed by opening index.html in your web browser.

## Questions, need help ?

If you need technical support, you can contact us through the following channels :
* Forums: you can find us [here](https://www.html5gamedevs.com/forum/32-melonjs/) on the html5gamedevs forum
* Chat: come and chat with us on [discord](https://discord.gg/aur7JMk)
* Wiki: we tried to keep our [wikipage](https://github.com/melonjs/melonJS/wiki) up-to-date with useful links, tutorials, and anything related melonJS.

## Contributors

<a href = "https://github.com/melonjs/melonJS/graphs/contributors">
  <img src = "https://contrib.rocks/image?repo=melonJS/melonjs"/>
</a>

## Sponsors

Support the development of melonJS by [becoming a sponsor](https://github.com/sponsors/melonjs). Get your logo in our README with a link to your site or become a backer and get your name in the [BACKERS](BACKERS.md) list. Any level of support is really appreciated and goes a long way !

[![Melon Gaming](https://user-images.githubusercontent.com/4033090/136695857-d098c27d-f4b2-4c71-8574-b5f4291779cb.png "Melon Gaming")](https://www.melongaming.com)

[![Altbyte Pte Ltd](https://user-images.githubusercontent.com/4033090/136692693-35dca8aa-5012-4a37-9ea2-51640d2e6d73.png "AltByte")](https://www.altbyte.com)
