import EventEmitter from "eventemitter3";

/**
* an event system based on nodeJS EventEmitter interface
* @namespace event
* @memberOf me
*/

// internal instance of the event emiter
var eventEmitter = new EventEmitter();

/**
 * event when the system is booting
 * @public
 * @constant
 * @type String
 * @name BOOT
 * @memberOf me.event
 * @see me.event.on
 */
export const BOOT = "me.boot";

/**
 * event when the game is paused <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name STATE_PAUSE
 * @memberOf me.event
 * @see me.event.on
 */
export const STATE_PAUSE = "me.state.onPause";

/**
 * event for when the game is resumed <br>
 * Data passed : {Number} time in ms the game was paused
 * @public
 * @constant
 * @type String
 * @name STATE_RESUME
 * @memberOf me.event
 * @see me.event.on
 */
export const STATE_RESUME = "me.state.onResume";

/**
 * event when the game is stopped <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name STATE_STOP
 * @memberOf me.event
 * @see me.event.on
 */
export const STATE_STOP = "me.state.onStop";

/**
 * event for when the game is restarted <br>
 * Data passed : {Number} time in ms the game was stopped
 * @public
 * @constant
 * @type String
 * @name STATE_RESTART
 * @memberOf me.event
 * @see me.event.on
 */
export const STATE_RESTART = "me.state.onRestart";

/**
 * event for when the video is initialized<br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name VIDEO_INIT
 * @memberOf me.event
 * @see me.video.init
 * @see me.event.on
 */
export const VIDEO_INIT = "me.video.onInit";

/**
 * event for when the game manager is initialized <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name GAME_INIT
 * @memberOf me.event
 * @see me.event.on
 */
export const GAME_INIT = "me.game.onInit";

/**
 * event for when the game manager is resetted <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name GAME_RESET
 * @memberOf me.event
 * @see me.event.on
 */
export const GAME_RESET = "me.game.onReset";

/**
 * eventfor the start of the update loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_BEFORE_UPDATE
 * @memberOf me.event
 * @see me.event.on
 */
export const GAME_BEFORE_UPDATE = "me.game.beforeUpdate";

/**
 * event for the end of the update loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_AFTER_UPDATE
 * @memberOf me.event
 * @see me.event.on
 */
export const GAME_AFTER_UPDATE = "me.game.afterUpdate";

/**
 * Event for when the game manager is updated (start of the update loop) <br>
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_UPDATE
 * @memberOf me.event
 * @see me.event.on
 */
export const GAME_UPDATE = "me.game.onUpdate";

/**
 * Event for the end of the draw loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_BEFORE_DRAW
 * @memberOf me.event
 * @see me.event.on
 */
export const GAME_BEFORE_DRAW = "me.game.beforeDraw";

/**
 * Event for the start of the draw loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_AFTER_DRAW
 * @memberOf me.event
 * @see me.event.on
 */
export const GAME_AFTER_DRAW = "me.game.afterDraw";

/**
 * Event for when a level is loaded <br>
 * Data passed : {String} Level Name
 * @public
 * @constant
 * @type String
 * @name LEVEL_LOADED
 * @memberOf me.event
 * @see me.event.on
 */
export const LEVEL_LOADED = "me.game.onLevelLoaded";

/**
 * Event for when everything has loaded <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name LOADER_COMPLETE
 * @memberOf me.event
 * @see me.event.on
 */
export const LOADER_COMPLETE = "me.loader.onload";

/**
 * Event for displaying a load progress indicator <br>
 * Data passed : {Number} [0 .. 1], {Resource} resource object<br>
 * @public
 * @constant
 * @type String
 * @name LOADER_PROGRESS
 * @memberOf me.event
 * @see me.event.on
 */
export const LOADER_PROGRESS = "me.loader.onProgress";

/**
 * Event for pressing a binded key <br>
 * Data passed : {String} user-defined action, {Number} keyCode,
 * {Boolean} edge state <br>
 * Edge-state is for detecting "locked" key bindings. When a locked key
 * is pressed and held, the first event will have the third argument
 * set true. Subsequent events will continue firing with the third
 * argument set false.
 * @public
 * @constant
 * @type String
 * @name KEYDOWN
 * @memberOf me.event
 * @see me.event.on
 * @example
 * me.input.bindKey(me.input.KEY.X, "jump", true); // Edge-triggered
 * me.input.bindKey(me.input.KEY.Z, "shoot"); // Level-triggered
 * me.event.on(me.event.KEYDOWN, (action, keyCode, edge) => {
 *   // Checking bound keys
 *   if (action === "jump") {
 *       if (edge) {
 *           this.doJump();
 *       }
 *
 *       // Make character fall slower when holding the jump key
 *       this.vel.y = this.body.gravity;
 *   }
 * });
 */
export const KEYDOWN = "me.input.keydown";

/**
 * Event for releasing a binded key <br>
 * Data passed : {String} user-defined action, {Number} keyCode
 * @public
 * @constant
 * @type String
 * @name KEYUP
 * @memberOf me.event
 * @see me.event.on
 * @example
 * me.event.on(me.event.KEYUP, (action, keyCode) => {
 *   // Checking unbound keys
 *   if (keyCode == me.input.KEY.ESC) {
 *       if (me.state.isPaused()) {
 *           me.state.resume();
 *       }
 *       else {
 *           me.state.pause();
 *       }
 *   }
 * });
 */
export const KEYUP = "me.input.keyup";

/**
 * Event for when a gamepad is connected <br>
 * Data passed : {Object} gamepad object
 * @public
 * @constant
 * @type String
 * @name GAMEPAD_CONNECTED
 * @memberOf me.event
 * @see me.event.on
 */
export const GAMEPAD_CONNECTED = "gamepad.connected";

/**
 * Event for when a gamepad is disconnected <br>
 * Data passed : {Object} gamepad object
 * @public
 * @constant
 * @type String
 * @name GAMEPAD_DISCONNECTED
 * @memberOf me.event
 * @see me.event.on
 */
export const GAMEPAD_DISCONNECTED = "gamepad.disconnected";

/**
 * Event for when gamepad button/axis state is updated <br>
 * Data passed : {Number} index <br>
 * Data passed : {String} type : "axes" or "buttons" <br>
 * Data passed : {Number} button <br>
 * Data passed : {Number} current.value <br>
 * Data passed : {Boolean} current.pressed
 * @public
 * @constant
 * @type String
 * @name GAMEPAD_UPDATE
 * @memberOf me.event
 * @see me.event.on
 */
export const GAMEPAD_UPDATE = "gamepad.update";

/**
 * Event for pointermove events on the screen area <br>
 * Data passed : {me.Pointer} a Pointer object
 * @public
 * @constant
 * @type String
 * @name POINTERMOVE
 * @memberOf me.event
 * @see me.event.on
 */
export const POINTERMOVE = "me.event.pointermove";

/**
 * Event for dragstart events on a Draggable entity <br>
 * Data passed:
 * {Object} the drag event <br>
 * {Object} the Draggable entity
 * @public
 * @constant
 * @type String
 * @name DRAGSTART
 * @memberOf me.event
 * @see me.event.on
 */
export const DRAGSTART = "me.game.dragstart";

/**
 * Event for dragend events on a Draggable entity <br>
 * Data passed:
 * {Object} the drag event <br>
 * {Object} the Draggable entity
 * @public
 * @constant
 * @type String
 * @name DRAGEND
 * @memberOf me.event
 * @see me.event.on
 */
export const DRAGEND = "me.game.dragend";

/**
 * Event for when the (browser) window is resized <br>
 * Data passed : {Event} Event object
 * @public
 * @constant
 * @type String
 * @name WINDOW_ONRESIZE
 * @memberOf me.event
 * @see me.event.on
 */
export const WINDOW_ONRESIZE = "window.onresize";

/**
 * Event for when the canvas is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event).<br>
 * Data passed : {Number} canvas width <br>
 * Data passed : {Number} canvas height
 * @public
 * @constant
 * @type String
 * @name CANVAS_ONRESIZE
 * @memberOf me.event
 * @see me.event.on
 */
export const CANVAS_ONRESIZE = "canvas.onresize";

/**
 * Event for when the viewport is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event, when using the `flex` scaling mode is used and after the viewport was updated).<br>
 * Data passed : {Number} viewport width <br>
 * Data passed : {Number} viewport height
 * @public
 * @constant
 * @type String
 * @name VIEWPORT_ONRESIZE
 * @memberOf me.event
 * @see me.event.on
 */
export const VIEWPORT_ONRESIZE = "viewport.onresize";

/**
 * Event for when the device is rotated <br>
 * Data passed : {Event} Event object <br>
 * @public
 * @constant
 * @type String
 * @name WINDOW_ONORIENTATION_CHANGE
 * @memberOf me.event
 * @see me.event.on
 */
export const WINDOW_ONORIENTATION_CHANGE = "window.orientationchange";

/**
 * Event for when the (browser) window is scrolled <br>
 * Data passed : {Event} Event object
 * @public
 * @constant
 * @type String
 * @name WINDOW_ONSCROLL
 * @memberOf me.event
 * @see me.event.on
 */
export const WINDOW_ONSCROLL = "window.onscroll";

/**
 * Event for when the viewport position is updated <br>
 * Data passed : {me.Vector2d} viewport position vector
 * @public
 * @constant
 * @type String
 * @name VIEWPORT_ONCHANGE
 * @memberOf me.event
 * @see me.event.on
 */
export const VIEWPORT_ONCHANGE = "viewport.onchange";

/**
 * Event for when WebGL context is lost <br>
 * Data passed : {me.WebGLRenderer} the current webgl renderer instance`
 * @public
 * @constant
 * @type String
 * @name WEBGL_ONCONTEXT_LOST
 * @memberOf me.event
 * @see me.event.on
 */
export const WEBGL_ONCONTEXT_LOST = "renderer.webglcontextlost";

/**
 * Event for when WebGL context is restored <br>
 * Data passed : {me.WebGLRenderer} the current webgl renderer instance`
 * @public
 * @constant
 * @type String
 * @name WEBGL_ONCONTEXT_RESTORED
 * @memberOf me.event
 * @see me.event.on
 */
export const WEBGL_ONCONTEXT_RESTORED = "renderer.webglcontextrestored";

/**
 * calls each of the listeners registered for a given event.
 * @function me.event.emit
 * @param {(String|Symbol)} event The event name.
 * @param {...*} arguments arguments to be passed to all listeners
 * @return true if the event had listeners, false otherwise.
 * @example
 * me.event.emit("event-name", a, b, c);
 */
export function emit(eventName, ...args) {
    return eventEmitter.emit(eventName, ...args);
};

/**
 * Add a listener for a given event.
 * @function me.event.on
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.on("event-name", myFunction, this);
 */
export function on(eventName, listener, context) {
    return eventEmitter.on(eventName, listener, context);
};

/**
 * Add a one-time listener for a given event.
 * @function me.event.once
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.once("event-name", myFunction, this);
 */
export function once(eventName, listener, context) {
    return eventEmitter.once(eventName, listener, context);
};

/**
 * remove the given listener for a given event.
 * @function me.event.off
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.off("event-name", myFunction);
 */
export function off(eventName, listener) {
    return eventEmitter.off(eventName, listener);
};
