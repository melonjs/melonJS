
# Contribute
-------------------------------------------------------------------------------
Thank you for your interest in contributing to melonJS !

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

If this is your first time contributing to an open source project on GitHub, please have a look at [this free tutorial](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github).

## Building melonJS

To build your own version of melonJS you will need to install :

- The [Node.js](http://nodejs.org/) JavaScript runtime and the [NPM](https://npmjs.org/) package manager

Once Node.js and NPM have been installed, you need to install build dependencies,
by executing the following in the folder where you cloned the repository :

    $ [sudo] npm install

Then build the melonJS source by running:

    $ npm run build

The generated files will be available under the `build` directory :
- `melonjs.module.js` : plain ES6 module
- `melonjs.mjs` : a ES6 chunk directory used for tree-shaking

If you need to create the corresponding typing you can use the follwing :

    $ npm run types

This will generate all the `.d.ts` file under the `dist/types` directory.

To run the melonJS test suite simply use the following:

    $ npm run test

This will run the jasmine spec tests with the output displayed on the shell. Do
note that the latest Chrome version is required, as the test unit will run the
Browser in a headless mode (in case of failed tests, upgrade your browser).

Last but not least, if you really want to contribute, but not sure how, you can
always check our [discussions](https://github.com/melonjs/melonJS/discussions/categories/ideas) list to get some idea on where to start.

## Building the documentation

Similarly, you can build your own copy of the docs locally by running :

    $ npm run doc-local

The documentation will be generated under the `docs` directory, and can be accessed using :

    $ npm run serve

## WIP Builds

latest WIP builds are available under [`dist`](dist/) in the [master](https://github.com/melonjs/melonJS/tree/master) branch.

## Questions, need help ?

If you need technical support, you can contact us through the following channels :
* Forums: with melonJS 2 we moved to a new discourse [forum](https://melonjs.discourse.group), but we can still also find the previous one [here](http://www.html5gamedevs.com/forum/32-melonjs/)
* Chat: come and chat with us on [discord](https://discord.gg/aur7JMk), or [gitter](https://gitter.im/melonjs/public)
* we tried to keep our [wikipage](https://github.com/melonjs/melonJS/wiki) up-to-date with useful links, tutorials, and anything related melonJS.

## Contributors

<a href = "https://github.com/melonjs/melonJS/graphs/contributors">
  <img src = "https://contrib.rocks/image?repo=melonJS/melonjs"/>
</a>

## Sponsors

Support the development of melonJS by [becoming a sponsor](https://github.com/sponsors/melonjs). Get your logo in our README with a link to your site or become a backer and get your name in the [BACKERS](BACKERS.md) list. Any level of support is really appreciated and goes a long way !

[![Melon Gaming](https://user-images.githubusercontent.com/4033090/136695857-d098c27d-f4b2-4c71-8574-b5f4291779cb.png "Melon Gaming")](https://www.melongaming.com)

[![Altbyte Pte Ltd](https://user-images.githubusercontent.com/4033090/136692693-35dca8aa-5012-4a37-9ea2-51640d2e6d73.png "AltByte")](https://www.altbyte.com)
