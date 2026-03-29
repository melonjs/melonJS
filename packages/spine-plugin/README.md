# melonJS Spine Plugin

A [Spine](http://en.esotericsoftware.com/spine-in-depth) 4.2 runtime integration for the [melonJS](http://www.melonjs.org) game engine, using the official [@esotericsoftware/spine-webgl](https://www.npmjs.com/package/@esotericsoftware/spine-webgl) and [@esotericsoftware/spine-canvas](https://www.npmjs.com/package/@esotericsoftware/spine-canvas) runtimes.

![melonjs-spine-gif](https://github.com/melonjs/spine-plugin/assets/4033090/dc259c8e-def6-419e-83a9-cda374715686)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/packages/spine-plugin/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/spine-plugin)](https://www.npmjs.com/package/@melonjs/spine-plugin)
[![Spine Runtime](https://img.shields.io/badge/spine--runtime-4.2-orange)](http://esotericsoftware.com/spine-runtimes)

[Live Example](https://melonjs.github.io/melonJS/examples/#/spine) — 17 official Spine characters including spineboy, raptor, owl, dragon, and more

## Features
-------------------------------------------------------------------------------
- **WebGL rendering** via custom `SpineBatcher` extending melonJS `Batcher` with two-color tinting and indexed drawing
- **Canvas rendering** with full mesh, clipping, tinting, and blend mode support
- **Spine 4.2 physics** support with automatic gravity correction for Y-down coordinate system
- **Two-color tinting** (dark/light color) using Spine's official shader
- **Blend modes** (Normal, Additive, Multiply, Screen) with premultiplied alpha support
- **Clipping attachments** via melonJS masking (canvas) and Spine's SkeletonClipping (WebGL)
- **Skin support** including mix-and-match skin combining via `setCombinedSkin()`
- **Animation state events** (start, end, complete, event, interrupt, dispose)
- **Skeleton introspection** — `findBone()`, `findSlot()`, `getAnimationNames()`, `getSkinNames()`
- **Animation queuing** — `setAnimation()`, `addAnimation()`, `setEmptyAnimation()`
- **Debug rendering** for bones, regions, meshes, and clipping areas
- **Auto-detection** of mesh attachments for optimized canvas rendering (fast path for region-only skeletons)
- **Binary skeleton** (.skel) and JSON skeleton loading via melonJS preloader
- **Integrated** with melonJS batcher system — no manual GL state management

## Installation
-------------------------------------------------------------------------------
This plugin is already bundled with the required Spine [4.x runtime](package.json#dependencies), so there is no need to install it separately.
>Note: this plugin requires melonJS version 18.2.1 or higher.

To install the plugin using npm:

`$ npm install @melonjs/spine-plugin`

Then import and use the plugin in your project. For example:
```JavaScript
import Spine, { SpinePlugin } from '@melonjs/spine-plugin';
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
>Note: use "spine" as a value for the `type` property to indicate which assets are actual Spine assets and to be loaded using the plugin

## API
-------------------------------------------------------------------------------

### Animation
| Method | Description |
|---|---|
| `setAnimation(trackIndex, name, loop)` | Set the current animation for a track |
| `setAnimationByIndex(trackIndex, index, loop)` | Set animation by index |
| `addAnimation(trackIndex, name, loop, delay)` | Queue an animation after the current one |
| `setEmptyAnimation(trackIndex, mixDuration)` | Clear a track with optional mix out |
| `isCurrentAnimation(name)` | Check if a specific animation is playing |
| `setDefaultMixTime(mixTime)` | Set default mix duration between animations |
| `setTransitionMixTime(from, to, mixTime)` | Set mix duration between two specific animations |
| `addAnimationListener(listener)` | Register animation event callbacks |
| `removeAnimationListener(listener)` | Remove a registered listener |
| `getAnimationNames()` | Get list of available animation names |

### Skins
| Method | Description |
|---|---|
| `setSkinByName(skinName)` | Set a skin by name |
| `setCombinedSkin(name, ...skinNames)` | Combine multiple skins (mix-and-match) |
| `getSkinNames()` | Get list of available skin names |

### Skeleton
| Method | Description |
|---|---|
| `findBone(boneName)` | Find a bone by name |
| `findSlot(slotName)` | Find a slot by name |
| `setToSetupPose()` | Reset skeleton to setup pose |
| `setSkeleton(atlasFile, jsonFile)` | Load a skeleton (if not set via constructor) |

### Transform
| Method | Description |
|---|---|
| `flipX(flip)` | Flip horizontally |
| `flipY(flip)` | Flip vertically |
| `scale(x, y)` | Scale the skeleton |
| `rotate(angle)` | Rotate the skeleton |

## Compatibility
-------------------------------------------------------------------------------

| @melonjs/spine-plugin | melonJS | spine-runtime |
|---|---|---|
| v2.0.x | v18.2.1 (or higher) | v4.2.x |
| v1.5.x | v15.12.x — v18.0.x | v4.1, v4.2-beta |

## Questions, need help ?
-------------------------------------------------------------------------------
If you need technical support, you can contact us through the following channels:
* Chat: come and chat with us on [discord](https://discord.gg/aur7JMk)
* We tried to keep our [wiki](https://github.com/melonjs/melonJS/wiki) up-to-date with useful links, tutorials, and anything related to melonJS.
