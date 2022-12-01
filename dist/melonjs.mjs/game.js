/*!
 * melonJS Game Engine - v14.1.2
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
import { on, BOOT } from './system/event.js';
import Application from './application/application.js';

/**
 * game is a default instance of a melonJS Application and represents your current game,
 * it contains all the objects, tilemap layers, current viewport, collision map, etc...<br>
 * @namespace game
 * @see Application
 */

// create a default melonJS application instance
let game = new Application();

 // initialize the game manager on system boot
on(BOOT, () => {
    // initialize the default game instance
    game.init();
});

var game$1 = game;

export { game$1 as default };
