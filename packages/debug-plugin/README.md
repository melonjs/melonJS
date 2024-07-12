# melonJS Debug Plugin
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/es6-boilerplate/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/debug-plugin)](https://www.npmjs.com/package/@melonjs/debug-plugin)
[![jsDeliver](https://data.jsdelivr.com/v1/package/npm/@melonjs/debug-plugin/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@melonjs/debug-plugin)

Installation
-------------------------------------------------------------------------------
`$ [sudo] npm install @melonjs/debug-plugin`

Then import and instantiante the debug plugin in your project. For example:
```JavaScript
import { utils, plugin } from 'melonjs';

// dynamically import the plugin
import("@melonjs/debug-plugin").then((debugPlugin) => {
    // automatically register the debug panel
    utils.function.defer(plugin.register, this, debugPlugin.DebugPanelPlugin, "debugPanel");
});
```

Usage
-------------------------------------------------------------------------------

The Debug Panel is hidden by default and can be displayed using the `S` key, it will then provide the below information :
![debug-panel](https://user-images.githubusercontent.com/4033090/138006717-cf3165a4-a52d-4855-a7c7-16b2a09ed124.png)

* Amount of objects currently active in the current scene
* Amount of draws operation
* Amount of body shape (requires to enable the hitbox checkbox)
* Amount of bounding box
* Amount of sprites objects
* Amount of objects currently inactive in the the object pool
* Heap/memory usage
* Frame update time (in ms)
* Frame draw time (in ms)
* Current fps rate vs target fps

> Note: Heap information requires starting Chrome [with](http://www.chromium.org/developers/how-tos/run-chromium-with-flags) `--enable-precise-memory-info`

Additionally, using the checkbox in the panel it is also possible to draw :
* Shape and Bounding box for all objects
* Current velocity vector
* Quadtree spatial visualization

Questions, need help ?
-------------------------------------------------------------------------------
If you need technical support, you can contact us through the following channels :
* Forums: with melonJS 2 we moved to a new discourse [forum](https://melonjs.discourse.group), but we can still also find the previous one [here](http://www.html5gamedevs.com/forum/32-melonjs/)
* Chat: come and chat with us on [discord](https://discord.gg/aur7JMk)
* we tried to keep our [wikipage](https://github.com/melonjs/melonJS/wiki) up-to-date with useful links, tutorials, and anything related melonJS.