# melonJS Spine Plugin

a [Spine](http://en.esotericsoftware.com/spine-in-depth) 4.x plugin implementation for [melonJS 2](http://www.melonjs.org)

![melonjs-spine-gif](https://github.com/melonjs/spine-plugin/assets/4033090/dc259c8e-def6-419e-83a9-cda374715686)

>Note: although functional, this plugin is still a work in progress. Feedback and especially contributions are welcome!

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/es6-boilerplate/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/spine-plugin)](https://www.npmjs.com/package/@melonjs/spine-plugin)
[![jsDeliver](https://data.jsdelivr.com/v1/package/npm/@melonjs/spine-plugin/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@melonjs/spine-plugin)


## Installation
-------------------------------------------------------------------------------
this plugin is already bundled with the required Spine [4.x runtime](package.json#dependencies), so there is no need to install it separately.
>Note: this plugin requires melonJS version 15.12 or higher.

To install the plugin using npm :

`$ [sudo] npm install @melonjs/spine-plugin`

Then import and use the plugin in your project. For example:
```JavaScript
import { SpinePlugin } from '@melonjs/spine-plugin';
import * as me from 'melonjs';

// register the plugin
me.plugin.register(SpinePlugin);

// prepare/declare assets for the preloader
const DataManifest = [
    {
        "name": "alien-ess.json",
        "type": "spine",
        "src": "data/spine/alien-ess.json"
    },
    {
        "name": "alien.atlas",
        "type": "spine",
        "src": "data/spine/alien.atlas"
    },
];

// import default Spine class
import Spine from '@melonjs/spine-plugin';

// preload assets
me.loader.preload(DataManifest, async function() {

    // create a new Spine Renderable
    let spineAlien = new Spine(100, 100, {atlasFile: "alien.atlas", jsonFile: "alien-ess.json"});

    // set default animation
    spineAlien.setAnimation(0, "death", true);

    // add it to the game world
    me.game.world.addChild(spineAlien);

}
```
>Note: use "spine" as a value for the `type` property to indicate which assets and are actual Spine assets and to be loaded using the plugin (requires version 1.4.0 or higher of the Spine plugin)

for more details, see a complete usage example in the [test](test) folder

## Compatibility
-------------------------------------------------------------------------------

below is the compatibility version matrix :

| melonJS | @melonjs/spine-plugin | spine-runtime |
|---|---|---|
| v15.12.x (or higher) | v1.x | v4.1, v4.2-beta |

>Note: the current version of the spine-plugin is bundled with the 4.2.x beta version of the Spine runtime, which is for now backward compatible with the Spine 4.1 runtime (from a player/rendering point of view). 

## Questions, need help ?
-------------------------------------------------------------------------------
If you need technical support, you can contact us through the following channels :
* Forums: with melonJS 2 we moved to a new discourse [forum](https://melonjs.discourse.group), but we can still also find the previous one [here](http://www.html5gamedevs.com/forum/32-melonjs/)
* Chat: come and chat with us on [discord](https://discord.gg/aur7JMk), or [gitter](https://gitter.im/melonjs/public)
* we tried to keep our [wikipage](https://github.com/melonjs/melonJS/wiki) up-to-date with useful links, tutorials, and anything related melonJS.