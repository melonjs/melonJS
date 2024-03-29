/**
 * calls each of the listeners registered for a given event.
 * @function event.emit
 * @param {string|symbol} eventName - The event name.
 * @param {...*} [args] - arguments to be passed to all listeners
 * @returns {boolean} true if the event had listeners, false otherwise.
 * @example
 * me.event.emit("event-name", a, b, c);
 */
export function emit(eventName: string | symbol, ...args?: any[] | undefined): boolean;
/**
 * Add a listener for a given event.
 * @function event.on
 * @param {string|symbol} eventName - The event name.
 * @param {Function} listener - The listener function.
 * @param {*} [context=this] - The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.on("event-name", myFunction, this);
 */
export function on(eventName: string | symbol, listener: Function, context?: any): typeof EventEmitter;
/**
 * Add a one-time listener for a given event.
 * @function event.once
 * @param {string|symbol} eventName - The event name.
 * @param {Function} listener - The listener function.
 * @param {*} [context=this] - The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.once("event-name", myFunction, this);
 */
export function once(eventName: string | symbol, listener: Function, context?: any): typeof EventEmitter;
/**
 * remove the given listener for a given event.
 * @function event.off
 * @param {string|symbol} eventName - The event name.
 * @param {Function} listener - The listener function.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.off("event-name", myFunction);
 */
export function off(eventName: string | symbol, listener: Function): typeof EventEmitter;
/**
 * event when the DOM is Ready is booting
 * @public
 * @constant
 * @type {string}
 * @name DOM_READY
 * @memberof event
 * @see event.on
 */
export const DOM_READY: string;
/**
 * event when the system is booting
 * @public
 * @constant
 * @type {string}
 * @name BOOT
 * @memberof event
 * @see event.on
 */
export const BOOT: string;
/**
 * event generated when the system update the engine and the renderer by one step
 * @public
 * @constant
 * @type {string}
 * @name TICK
 * @memberof event
 * @see event.on
 */
export const TICK: string;
/**
 * event generated when the main browser or window is losing focus
 * @public
 * @constant
 * @type {string}
 * @name BLUR
 * @memberof event
 * @see event.on
 */
export const BLUR: string;
/**
 * event generated when the main browser or window is gaining back focus
 * @public
 * @constant
 * @type {string}
 * @name FOCUS
 * @memberof event
 * @see event.on
 */
export const FOCUS: string;
/**
 * event when the game is paused <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type {string}
 * @name STATE_PAUSE
 * @memberof event
 * @see event.on
 */
export const STATE_PAUSE: string;
/**
 * event for when the game is resumed <br>
 * Data passed : {number} time in ms the game was paused
 * @public
 * @constant
 * @type {string}
 * @name STATE_RESUME
 * @memberof event
 * @see event.on
 */
export const STATE_RESUME: string;
/**
 * event when the game is stopped <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type {string}
 * @name STATE_STOP
 * @memberof event
 * @see event.on
 */
export const STATE_STOP: string;
/**
 * event for when the game is restarted <br>
 * Data passed : {number} time in ms the game was stopped
 * @public
 * @constant
 * @type {string}
 * @name STATE_RESTART
 * @memberof event
 * @see event.on
 */
export const STATE_RESTART: string;
/**
 * event for when the changing to a different stage
 * @public
 * @constant
 * @type {string}
 * @name STATE_CHANGE
 * @memberof event
 * @see event.on
 */
export const STATE_CHANGE: string;
/**
 * event for when a stage is resetted
 * @public
 * @constant
 * @type {string}
 * @name STAGE_RESET
 * @memberof event
 * @see event.on
*/
export const STAGE_RESET: string;
/**
 * event for when the video is initialized<br>
 * Data passed : {Renderer} the renderer instance created
 * @public
 * @constant
 * @type {string}
 * @name VIDEO_INIT
 * @memberof event
 * @see video.init
 * @see event.on
 */
export const VIDEO_INIT: string;
/**
 * event for when the game manager is initialized <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type {string}
 * @name GAME_INIT
 * @memberof event
 * @see event.on
 */
export const GAME_INIT: string;
/**
 * event for when the game manager is resetted <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type {string}
 * @name GAME_RESET
 * @memberof event
 * @see event.on
 */
export const GAME_RESET: string;
/**
 * event for when the engine is about to start a new game loop
 * Data passed : {number} time the current time stamp
 * @public
 * @constant
 * @type {string}
 * @name GAME_BEFORE_UPDATE
 * @memberof event
 * @see event.on
 */
export const GAME_BEFORE_UPDATE: string;
/**
 * event for the end of the update loop
 * Data passed : {number} time the current time stamp
 * @public
 * @constant
 * @type {string}
 * @name GAME_AFTER_UPDATE
 * @memberof event
 * @see event.on
 */
export const GAME_AFTER_UPDATE: string;
/**
 * Event for when the game is updated (will be impacted by frame skip, frame interpolation and pause/resume state) <br>
 * Data passed : {number} time the current time stamp
 * @public
 * @constant
 * @type {string}
 * @name GAME_UPDATE
 * @memberof event
 * @see event.on
 */
export const GAME_UPDATE: string;
/**
 * Event for the end of the draw loop
 * Data passed : {number} time the current time stamp
 * @public
 * @constant
 * @type {string}
 * @name GAME_BEFORE_DRAW
 * @memberof event
 * @see event.on
 */
export const GAME_BEFORE_DRAW: string;
/**
 * Event for the start of the draw loop
 * Data passed : {number} time the current time stamp
 * @public
 * @constant
 * @type {string}
 * @name GAME_AFTER_DRAW
 * @memberof event
 * @see event.on
 */
export const GAME_AFTER_DRAW: string;
/**
 * Event for when the physic world is updated
 * Data passed : {number} time the current time stamp
 * @public
 * @constant
 * @type {string}
 * @name WORLD_STEP
 * @memberof event
 * @see event.on
 */
export const WORLD_STEP: string;
/**
 * Event for when a level is loaded <br>
 * Data passed : {string} Level Name
 * @public
 * @constant
 * @type {string}
 * @name LEVEL_LOADED
 * @memberof event
 * @see event.on
 */
export const LEVEL_LOADED: string;
/**
 * Event for when everything has loaded <br>
 * Data passed : none <br>
 * @public
 * @constant
 * @type {string}
 * @name LOADER_COMPLETE
 * @memberof event
 * @see event.on
 */
export const LOADER_COMPLETE: string;
/**
 * Event for displaying a load progress indicator <br>
 * Data passed : {number} [0 .. 1], {Resource} resource object<br>
 * @public
 * @constant
 * @type {string}
 * @name LOADER_PROGRESS
 * @memberof event
 * @see event.on
 */
export const LOADER_PROGRESS: string;
/**
 * Event for when an error occur during preloading <br>
 * Data passed : {Resource} resource object<br>
 * @public
 * @constant
 * @type {string}
 * @name LOADER_ERROR
 * @memberof event
 * @see event.on
 */
export const LOADER_ERROR: string;
/**
 * Event for pressing a binded key <br>
 * Data passed : {string} user-defined action, {number} keyCode,
 * {boolean} edge state <br>
 * Edge-state is for detecting "locked" key bindings. When a locked key
 * is pressed and held, the first event will have the third argument
 * set true. Subsequent events will continue firing with the third
 * argument set false.
 * @public
 * @constant
 * @type {string}
 * @name KEYDOWN
 * @memberof event
 * @see event.on
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
export const KEYDOWN: string;
/**
 * Event for releasing a binded key <br>
 * Data passed : {string} user-defined action, {number} keyCode
 * @public
 * @constant
 * @type {string}
 * @name KEYUP
 * @memberof event
 * @see event.on
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
export const KEYUP: string;
/**
 * Event for when a gamepad is connected <br>
 * Data passed : {object} gamepad object
 * @public
 * @constant
 * @type {string}
 * @name GAMEPAD_CONNECTED
 * @memberof event
 * @see event.on
 */
export const GAMEPAD_CONNECTED: string;
/**
 * Event for when a gamepad is disconnected <br>
 * Data passed : {object} gamepad object
 * @public
 * @constant
 * @type {string}
 * @name GAMEPAD_DISCONNECTED
 * @memberof event
 * @see event.on
 */
export const GAMEPAD_DISCONNECTED: string;
/**
 * Event for when gamepad button/axis state is updated <br>
 * Data passed : {number} index <br>
 * Data passed : {string} type : "axes" or "buttons" <br>
 * Data passed : {number} button <br>
 * Data passed : {number} current.value <br>
 * Data passed : {boolean} current.pressed
 * @public
 * @constant
 * @type {string}
 * @name GAMEPAD_UPDATE
 * @memberof event
 * @see event.on
 */
export const GAMEPAD_UPDATE: string;
/**
 * Event for pointermove events on the screen area <br>
 * Data passed : {me.Pointer} a Pointer object
 * @public
 * @constant
 * @type {string}
 * @name POINTERMOVE
 * @memberof event
 * @see event.on
 */
export const POINTERMOVE: string;
/**
 * Event for onPointerLockChange event <br>
 * Data passed : {boolean} pointer lock status (true/false)
 * @public
 * @constant
 * @type {string}
 * @name POINTERLOCKCHANGE
 * @memberof event
 * @see event.on
 */
export const POINTERLOCKCHANGE: string;
/**
 * Event for dragstart events on a Draggable entity <br>
 * Data passed:
 * {object} the drag event <br>
 * {object} the Draggable entity
 * @public
 * @constant
 * @type {string}
 * @name DRAGSTART
 * @memberof event
 * @see event.on
 */
export const DRAGSTART: string;
/**
 * Event for dragend events on a Draggable entity <br>
 * Data passed:
 * {object} the drag event <br>
 * {object} the Draggable entity
 * @public
 * @constant
 * @type {string}
 * @name DRAGEND
 * @memberof event
 * @see event.on
 */
export const DRAGEND: string;
/**
 * Event for when the (browser) window is resized <br>
 * Data passed : {Event} Event object
 * @public
 * @constant
 * @type {string}
 * @name WINDOW_ONRESIZE
 * @memberof event
 * @see event.on
 */
export const WINDOW_ONRESIZE: string;
/**
 * Event for when the canvas is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event).<br>
 * Data passed : {number} canvas width <br>
 * Data passed : {number} canvas height
 * @public
 * @constant
 * @type {string}
 * @name CANVAS_ONRESIZE
 * @memberof event
 * @see event.on
 */
export const CANVAS_ONRESIZE: string;
/**
 * Event for when the viewport is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event, when using the `flex` scaling mode is used and after the viewport was updated).<br>
 * Data passed : {number} viewport width <br>
 * Data passed : {number} viewport height <br>
 * Data passed : {Camera2d} a reference to the camera viewport being resized
 * @public
 * @constant
 * @type {string}
 * @name VIEWPORT_ONRESIZE
 * @memberof event
 * @see event.on
 */
export const VIEWPORT_ONRESIZE: string;
/**
 * Event for when the device is rotated <br>
 * Data passed : {Event} Event object <br>
 * @public
 * @constant
 * @type {string}
 * @name WINDOW_ONORIENTATION_CHANGE
 * @memberof event
 * @see event.on
 */
export const WINDOW_ONORIENTATION_CHANGE: string;
/**
 * Event for when the (browser) window is scrolled <br>
 * Data passed : {Event} Event object
 * @public
 * @constant
 * @type {string}
 * @name WINDOW_ONSCROLL
 * @memberof event
 * @see event.on
 */
export const WINDOW_ONSCROLL: string;
/**
 * Event for when the viewport position is updated <br>
 * Data passed : {me.Vector2d} viewport position vector
 * @public
 * @constant
 * @type {string}
 * @name VIEWPORT_ONCHANGE
 * @memberof event
 * @see event.on
 */
export const VIEWPORT_ONCHANGE: string;
/**
 * Event for when the current context is lost <br>
 * Data passed : {me.Renderer} the current renderer instance
 * @public
 * @constant
 * @type {string}
 * @name WEBGL_ONCONTEXT_LOST
 * @memberof event
 * @see event.on
 */
export const ONCONTEXT_LOST: string;
/**
 * Event for when the current context is restored <br>
 * Data passed : {me.Renderer} the current renderer instance`
 * @public
 * @constant
 * @type {string}
 * @name ONCONTEXT_RESTORED
 * @memberof event
 * @see event.on
 */
export const ONCONTEXT_RESTORED: string;
import EventEmitter from "eventemitter3";
