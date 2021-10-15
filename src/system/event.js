import MinPubSub from "minpubsub";

/**
* an event system based on a micro publish/subscribe messaging framework
* @namespace event
* @memberOf me
*/

/**
 * Channel Constant for when the system is booting
 * @public
 * @constant
 * @type String
 * @name BOOT
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const BOOT = "me.boot";


/**
 * Channel Constant when the game is paused <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name STATE_PAUSE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const STATE_PAUSE = "me.state.onPause";

/**
 * Channel Constant for when the game is resumed <br>
 * Data passed : {Number} time in ms the game was paused
 * @public
 * @constant
 * @type String
 * @name STATE_RESUME
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const STATE_RESUME = "me.state.onResume";

/**
 * Channel Constant when the game is stopped <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name STATE_STOP
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const STATE_STOP = "me.state.onStop";

/**
 * Channel Constant for when the game is restarted <br>
 * Data passed : {Number} time in ms the game was stopped
 * @public
 * @constant
 * @type String
 * @name STATE_RESTART
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const STATE_RESTART = "me.state.onRestart";

/**
 * Channel Constant for when the video is initialized<br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name VIDEO_INIT
 * @memberOf me.event
 * @see me.video.init
 * @see me.event.subscribe
 */
export const VIDEO_INIT = "me.video.onInit";


/**
 * Channel Constant for when the game manager is initialized <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name GAME_INIT
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAME_INIT = "me.game.onInit";

/**
 * Channel Constant for when the game manager is resetted <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name GAME_RESET
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAME_RESET = "me.game.onReset";

/**
 * Channel Constant for the start of the update loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_BEFORE_UPDATE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAME_BEFORE_UPDATE = "me.game.beforeUpdate";

/**
 * Channel Constant for the end of the update loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_AFTER_UPDATE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAME_AFTER_UPDATE = "me.game.afterUpdate";

/**
 * Channel Constant for when the game manager is updated (start of the update loop) <br>
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_UPDATE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAME_UPDATE = "me.game.onUpdate";

/**
 * Channel Constant for the end of the draw loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_BEFORE_DRAW
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAME_BEFORE_DRAW = "me.game.beforeDraw";

/**
 * Channel Constant for the start of the draw loop
 * Data passed : {Number} time the current time stamp
 * @public
 * @constant
 * @type String
 * @name GAME_AFTER_DRAW
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAME_AFTER_DRAW = "me.game.afterDraw";


/**
 * Channel Constant for when a level is loaded <br>
 * Data passed : {String} Level Name
 * @public
 * @constant
 * @type String
 * @name LEVEL_LOADED
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const LEVEL_LOADED = "me.game.onLevelLoaded";

/**
 * Channel Constant for when everything has loaded <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type String
 * @name LOADER_COMPLETE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const LOADER_COMPLETE = "me.loader.onload";

/**
 * Channel Constant for displaying a load progress indicator <br>
 * Data passed : {Number} [0 .. 1], {Resource} resource object<br>
 * @public
 * @constant
 * @type String
 * @name LOADER_PROGRESS
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const LOADER_PROGRESS = "me.loader.onProgress";

/**
 * Channel Constant for pressing a binded key <br>
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
 * @see me.event.subscribe
 * @example
 * me.input.bindKey(me.input.KEY.X, "jump", true); // Edge-triggered
 * me.input.bindKey(me.input.KEY.Z, "shoot"); // Level-triggered
 * me.event.subscribe(me.event.KEYDOWN, function (action, keyCode, edge) {
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
 * Channel Constant for releasing a binded key <br>
 * Data passed : {String} user-defined action, {Number} keyCode
 * @public
 * @constant
 * @type String
 * @name KEYUP
 * @memberOf me.event
 * @see me.event.subscribe
 * @example
 * me.event.subscribe(me.event.KEYUP, function (action, keyCode) {
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
 * Channel Constant for when a gamepad is connected <br>
 * Data passed : {Object} gamepad object
 * @public
 * @constant
 * @type String
 * @name GAMEPAD_CONNECTED
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAMEPAD_CONNECTED = "gamepad.connected";

/**
 * Channel Constant for when a gamepad is disconnected <br>
 * Data passed : {Object} gamepad object
 * @public
 * @constant
 * @type String
 * @name GAMEPAD_DISCONNECTED
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const GAMEPAD_DISCONNECTED = "gamepad.disconnected";

/**
 * Channel Constant for when gamepad button/axis state is updated <br>
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
 * @see me.event.subscribe
 */
export const GAMEPAD_UPDATE = "gamepad.update";

/**
 * Channel Constant for pointermove events on the screen area <br>
 * Data passed : {me.Pointer} a Pointer object
 * @public
 * @constant
 * @type String
 * @name POINTERMOVE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const POINTERMOVE = "me.event.pointermove";

/**
 * Channel Constant for dragstart events on a Draggable entity <br>
 * Data passed:
 * {Object} the drag event <br>
 * {Object} the Draggable entity
 * @public
 * @constant
 * @type String
 * @name DRAGSTART
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const DRAGSTART = "me.game.dragstart";

/**
 * Channel Constant for dragend events on a Draggable entity <br>
 * Data passed:
 * {Object} the drag event <br>
 * {Object} the Draggable entity
 * @public
 * @constant
 * @type String
 * @name DRAGEND
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const DRAGEND = "me.game.dragend";

/**
 * Channel Constant for when the (browser) window is resized <br>
 * Data passed : {Event} Event object
 * @public
 * @constant
 * @type String
 * @name WINDOW_ONRESIZE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const WINDOW_ONRESIZE = "window.onresize";

/**
 * Channel Constant for when the canvas is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event).<br>
 * Data passed : {Number} canvas width <br>
 * Data passed : {Number} canvas height
 * @public
 * @constant
 * @type String
 * @name CANVAS_ONRESIZE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const CANVAS_ONRESIZE = "canvas.onresize";

/**
 * Channel Constant for when the viewport is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event, when using the `flex` scaling mode is used and after the viewport was updated).<br>
 * Data passed : {Number} viewport width <br>
 * Data passed : {Number} viewport height
 * @public
 * @constant
 * @type String
 * @name VIEWPORT_ONRESIZE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const VIEWPORT_ONRESIZE = "viewport.onresize";

/**
 * Channel Constant for when the device is rotated <br>
 * Data passed : {Event} Event object <br>
 * @public
 * @constant
 * @type String
 * @name WINDOW_ONORIENTATION_CHANGE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const WINDOW_ONORIENTATION_CHANGE = "window.orientationchange";

/**
 * Channel Constant for when the (browser) window is scrolled <br>
 * Data passed : {Event} Event object
 * @public
 * @constant
 * @type String
 * @name WINDOW_ONSCROLL
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const WINDOW_ONSCROLL = "window.onscroll";

/**
 * Channel Constant for when the viewport position is updated <br>
 * Data passed : {me.Vector2d} viewport position vector
 * @public
 * @constant
 * @type String
 * @name VIEWPORT_ONCHANGE
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const VIEWPORT_ONCHANGE = "viewport.onchange";

/**
 * Channel Constant for when WebGL context is lost <br>
 * Data passed : {me.WebGLRenderer} the current webgl renderer instance`
 * @public
 * @constant
 * @type String
 * @name WEBGL_ONCONTEXT_LOST
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const WEBGL_ONCONTEXT_LOST = "renderer.webglcontextlost";

/**
 * Channel Constant for when WebGL context is restored <br>
 * Data passed : {me.WebGLRenderer} the current webgl renderer instance`
 * @public
 * @constant
 * @type String
 * @name WEBGL_ONCONTEXT_RESTORED
 * @memberOf me.event
 * @see me.event.subscribe
 */
export const WEBGL_ONCONTEXT_RESTORED = "renderer.webglcontextrestored";

/**
 * Publish some data on a channel
 * @function me.event.publish
 * @param {String} channel The channel to publish on
 * @param {Array} arguments The data to publish
 * @example
 * // Publish stuff on '/some/channel'.
 * // Anything subscribed will be called with a function
 * // signature like: function (a,b,c){ ... }
 * me.event.publish("/some/channel", ["a","b","c"]);
 */
export function publish (channel, data) { MinPubSub.publish(channel, data); };

/**
 * Register a callback on a named channel.
 * @function me.event.subscribe
 * @param {String} channel The channel to subscribe to
 * @param {Function} callback The event handler, any time something is
 * published on a subscribed channel, the callback will be called
 * with the published array as ordered arguments
 * @return {handle} A handle which can be used to unsubscribe this
 * particular subscription
 * @example
 * me.event.subscribe("/some/channel", function (a, b, c){ doSomething(); });
 */
export function subscribe (channel, callback) { return MinPubSub.subscribe(channel, callback); };

/**
 * Disconnect a subscribed function for a channel.
 * @function me.event.unsubscribe
 * @param {Array|String} handle The return value from a subscribe call or the
 * name of a channel as a String
 * @param {Function} [callback] The callback to be unsubscribed.
 * @example
 * var handle = me.event.subscribe("/some/channel", function (){});
 * me.event.unsubscribe(handle);
 *
 * // Or alternatively ...
 *
 * var callback = function (){};
 * me.event.subscribe("/some/channel", callback);
 * me.event.unsubscribe("/some/channel", callback);
 */
export function unsubscribe (handle, callback) { MinPubSub.unsubscribe(handle, callback); };
