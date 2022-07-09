import * as event from "./system/event.js";
import Application from "./application/application.js";

/**
 * game is a default instance of a melonJS Application and represents your current game,
 * it contains all the objects, tilemap layers, current viewport, collision map, etc...<br>
 * @namespace game
 * @see Application
 */

// create a default melonJS application instance
let game = new Application();

 // initialize the game manager on system boot
event.on(event.BOOT, () => {
    // initialize the default game instance
    game.init();
});

export default game;
