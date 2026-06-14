# melonJS Spine Plugin

A [Spine](http://en.esotericsoftware.com/spine-in-depth) 4.x runtime integration for the [melonJS](http://www.melonjs.org) game engine, using the official [@esotericsoftware/spine-webgl](https://www.npmjs.com/package/@esotericsoftware/spine-webgl) and [@esotericsoftware/spine-canvas](https://www.npmjs.com/package/@esotericsoftware/spine-canvas) runtimes.

![melonjs-spine-gif](https://github.com/melonjs/spine-plugin/assets/4033090/dc259c8e-def6-419e-83a9-cda374715686)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/packages/spine-plugin/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/spine-plugin)](https://www.npmjs.com/package/@melonjs/spine-plugin)
[![Spine Runtime](https://img.shields.io/badge/spine--runtime-4.3-orange)](http://esotericsoftware.com/spine-runtimes)

[Live Example](https://melonjs.github.io/melonJS/examples/#/spine) — 15 official Spine characters including spineboy, raptor, owl, dragon, and more

## Features
-------------------------------------------------------------------------------
- **WebGL rendering** via custom `SpineBatcher` extending melonJS `Batcher` with two-color tinting and indexed drawing
- **Canvas rendering** with full mesh, clipping, tinting, and blend mode support
- **Spine physics** support — native Y-down handling via the official `Skeleton.yDown` runtime switch, including physics force direction vectors (`windX/Y`, `gravityX/Y`)
- **Two-color tinting** (dark/light color) using Spine's official shader
- **Blend modes** (Normal, Additive, Multiply, Screen) with premultiplied alpha support
- **Clipping attachments** via melonJS masking (canvas) and Spine's SkeletonClipping (WebGL)
- **Skin support** including mix-and-match skin combining via `setCombinedSkin()`
- **Animation state events** (start, end, complete, event, interrupt, dispose)
- **Skeleton introspection** — `findBone()`, `findSlot()`, `findConstraint()`, `getAnimationNames()`, `getSkinNames()`
- **Spine 4.3 Slider constraints** — full runtime support; all constraint classes (`Slider`/`SliderData`/`SliderTimeline`/`SliderMixTimeline`, plus `IkConstraint`, `TransformConstraint`, `PathConstraint`, `PhysicsConstraint`) re-exported for one-import `instanceof` narrowing of `findConstraint()` results
- **Animation queuing** — `setAnimation()`, `addAnimation()`, `setEmptyAnimation()`
- **Debug rendering** for bones, regions, meshes, and clipping areas
- **Auto-detection** of mesh attachments for optimized canvas rendering (fast path for region-only skeletons)
- **Binary skeleton** (.skel) and JSON skeleton loading via melonJS preloader
- **Integrated** with melonJS batcher system — no manual GL state management

## Installation
-------------------------------------------------------------------------------
This plugin is already bundled with the required Spine [4.x runtime](package.json#dependencies), so there is no need to install it separately.
>Note: this plugin requires melonJS version 19.7.1 or higher.

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

// create a new Application
const app = new me.Application(800, 600, {
    parent: "screen",
    renderer: me.video.AUTO,
});

// preload assets
me.loader.preload(DataManifest, function() {

    // create a new Spine Renderable
    let spineAlien = new Spine(100, 100, {atlasFile: "alien.atlas", jsonFile: "alien-ess.json"});

    // set default animation
    spineAlien.setAnimation(0, "death", true);

    // add it to the game world
    app.world.addChild(spineAlien);

});
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
| `findConstraint(constraintName)` | Find a constraint by name (IK / Transform / Path / Physics / **Slider**) — added in 3.1.0 |
| `getConstraintNames()` | Get the list of constraint names available in the skeleton — added in 3.1.0 |
| `setToSetupPose()` | Reset skeleton to setup pose |
| `setSkeleton(atlasFile, jsonFile)` | Load a skeleton (if not set via constructor) |

### Spine 4.3 Slider constraints

Spine 4.3 introduced [Slider constraints](https://esotericsoftware.com/blog/Spine-4.3-released#slider-constraints) — a pre-baked animation indexed by a numeric `time` value, optionally driven by a bone's rotation. The plugin re-exports the Spine runtime's Slider classes (and the four pre-existing constraint classes) alongside the default `Spine` export so consumers can do `instanceof Slider` (or `instanceof IkConstraint`, etc.) without a second import from `@esotericsoftware/spine-core`:

```javascript
import Spine, {
    // 4.3 Slider classes
    Slider, SliderData, SliderTimeline, SliderMixTimeline,
    // other constraint classes — for narrowing findConstraint() results
    IkConstraint, TransformConstraint, PathConstraint, PhysicsConstraint,
} from "@melonjs/spine-plugin";

const diamond = new Spine(750, 600, { atlasFile: "diamond-pma.atlas", jsonFile: "diamond-pro.json" });
diamond.setAnimation(0, "idle-rotating", true);

// query the "rotation" Slider constraint
const slider = diamond.findConstraint("rotation");
if (slider instanceof Slider) {
    // scrub a slider manually (disable bone auto-driving first)
    slider.bone = null;
    slider.pose.time = 1.0;   // jump to t=1s in the slider's animation
    slider.pose.mix = 1.0;    // 0..1 — how much of the slider pose to apply
}
```

See the [diamond example](https://melonjs.github.io/melonJS/examples/#/spine) for an interactive demo.

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
| v3.x.x | v19.7.1 (or higher) | v4.3.x |
| v2.2.x | v18.3.0 (or higher) | v4.2.x |
| v2.1.x | v18.3.0 (or higher) | v4.2.x |
| v2.0.x | v18.2.1 (or higher) | v4.2.x |
| v2.0.0 | v18.2.0 (or higher) | v4.2.x |
| v1.5.x | v15.12.0 (or higher)| v4.1, v4.2-beta |

> **Note:** skeleton data is editor-version locked — plugin 3.x requires assets exported from a Spine **4.3** editor; 4.2 exports will not load (and vice-versa on plugin 2.x).

## Questions, need help ?
-------------------------------------------------------------------------------
If you need technical support, you can contact us through the following channels:
* Chat: come and chat with us on [discord](https://discord.gg/aur7JMk)
* We tried to keep our [wiki](https://github.com/melonjs/melonJS/wiki) up-to-date with useful links, tutorials, and anything related to melonJS.
