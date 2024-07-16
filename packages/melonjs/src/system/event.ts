/**
 * an event system based on nodeJS EventEmitter interface
 */

import Pointer from "../input/pointer.js";
import { Vector2d } from "../math/vector2d.ts";
import { Draggable } from "../renderable/draggable.js";
import Stage from "../state/stage.js";
import Renderer from "../video/renderer.js";
import { EventEmitter } from "./eventEmitter.js";

/**
 * event when the DOM is Ready is booting
 * @see event.on
 */
export const DOM_READY = "dom_ready";

/**
 * event when the system is booting
 * @see event.on
 */
export const BOOT = "me.boot";

/**
 * event generated when the system update the engine and the renderer by one step
 * @see event.on
 */
export const TICK = "me.tick";

/**
 * event generated when the main browser or window is losing focus
 * @see event.on
 */
export const BLUR = "me.blur";

/**
 * event generated when the main browser or window is gaining back focus
 * @see event.on
 */
export const FOCUS = "me.focus";

/**
 * event when the game is paused <br>
 * Data passed : none <br>
 * @see event.on
 */
export const STATE_PAUSE = "me.state.onPause";

/**
 * event for when the game is resumed <br>
 * Data passed : {number} time in ms the game was paused
 * @see event.on
 */
export const STATE_RESUME = "me.state.onResume";

/**
 * event when the game is stopped <br>
 * Data passed : none <br>
 * @see event.on
 */
export const STATE_STOP = "me.state.onStop";

/**
 * event for when the game is restarted <br>
 * Data passed : {number} time in ms the game was stopped
 * @see event.on
 */
export const STATE_RESTART = "me.state.onRestart";

/**
 * event for when the changing to a different stage
 * @see event.on
 */
export const STATE_CHANGE = "me.state.onChange";

/**
 * event for when a stage is resetted
 * @see event.on
 */
export const STAGE_RESET = "me.stage.onReset";

/**
 * event for when the video is initialized<br>
 * Data passed : {Renderer} the renderer instance created
 * @see video.init
 * @see event.on
 */
export const VIDEO_INIT = "me.video.onInit";

/**
 * event for when the game manager is initialized <br>
 * Data passed : none <br>
 * @see event.on
 */
export const GAME_INIT = "me.game.onInit";

/**
 * event for when the game manager is resetted <br>
 * Data passed : none <br>
 * @see event.on
 */
export const GAME_RESET = "me.game.onReset";

/**
 * event for when the engine is about to start a new game loop
 * Data passed : {number} time the current time stamp
 * @see event.on
 */
export const GAME_BEFORE_UPDATE = "me.game.beforeUpdate";

/**
 * event for the end of the update loop
 * Data passed : {number} time the current time stamp
 * @see event.on
 */
export const GAME_AFTER_UPDATE = "me.game.afterUpdate";

/**
 * Event for when the game is updated (will be impacted by frame skip, frame interpolation and pause/resume state) <br>
 * Data passed : {number} time the current time stamp
 * @see event.on
 */
export const GAME_UPDATE = "me.game.onUpdate";

/**
 * Event for the end of the draw loop
 * Data passed : {number} time the current time stamp
 * @see event.on
 */
export const GAME_BEFORE_DRAW = "me.game.beforeDraw";

/**
 * Event for the start of the draw loop
 * Data passed : {number} time the current time stamp
 * @see event.on
 */
export const GAME_AFTER_DRAW = "me.game.afterDraw";

/**
 * Event for when the physic world is updated
 * Data passed : {number} time the current time stamp
 * @see event.on
 */
export const WORLD_STEP = "me.world.step";

/**
 * Event for when a level is loaded <br>
 * Data passed : {string} Level Name
 * @see event.on
 */
export const LEVEL_LOADED = "me.game.onLevelLoaded";

/**
 * Event for when everything has loaded <br>
 * Data passed : none <br>
 * @see event.on
 */
export const LOADER_COMPLETE = "me.loader.onload";

/**
 * Event for displaying a load progress indicator <br>
 * Data passed : {number} [0 .. 1], {Resource} resource object<br>
 * @see event.on
 */
export const LOADER_PROGRESS = "me.loader.onProgress";

/**
 * Event for when an error occur during preloading <br>
 * Data passed : {Resource} resource object<br>
 * @see event.on
 */
export const LOADER_ERROR = "me.loader.onError";

/**
 * Event for pressing a binded key <br>
 * Data passed : {string} user-defined action, {number} keyCode,
 * {boolean} edge state <br>
 * Edge-state is for detecting "locked" key bindings. When a locked key
 * is pressed and held, the first event will have the third argument
 * set true. Subsequent events will continue firing with the third
 * argument set false.
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
export const KEYDOWN = "me.input.keydown";

/**
 * Event for releasing a binded key <br>
 * Data passed : {string} user-defined action, {number} keyCode
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
export const KEYUP = "me.input.keyup";

/**
 * Event for when a gamepad is connected <br>
 * Data passed : {object} gamepad object
 * @see event.on
 */
export const GAMEPAD_CONNECTED = "gamepad.connected";

/**
 * Event for when a gamepad is disconnected <br>
 * Data passed : {object} gamepad object
 * @see event.on
 */
export const GAMEPAD_DISCONNECTED = "gamepad.disconnected";

/**
 * Event for when gamepad button/axis state is updated <br>
 * Data passed : {number} index <br>
 * Data passed : {string} type : "axes" or "buttons" <br>
 * Data passed : {number} button <br>
 * Data passed : {number} current.value <br>
 * Data passed : {boolean} current.pressed
 * @see event.on
 */
export const GAMEPAD_UPDATE = "gamepad.update";

/**
 * Event for pointermove events on the screen area <br>
 * Data passed : {me.Pointer} a Pointer object
 * @see event.on
 */
export const POINTERMOVE = "me.event.pointermove";

/**
 * Event for onPointerLockChange event <br>
 * Data passed : {boolean} pointer lock status (true/false)
 * @see event.on
 */
export const POINTERLOCKCHANGE = "me.event.pointerlockChange";

/**
 * Event for dragstart events on a Draggable entity <br>
 * Data passed:
 * {object} the drag event <br>
 * {object} the Draggable entity
 * @see event.on
 */
export const DRAGSTART = "me.game.dragstart";

/**
 * Event for dragend events on a Draggable entity <br>
 * Data passed:
 * {object} the drag event <br>
 * {object} the Draggable entity
 * @see event.on
 */
export const DRAGEND = "me.game.dragend";

/**
 * Event for when the (browser) window is resized <br>
 * Data passed : {Event} Event object
 * @see event.on
 */
export const WINDOW_ONRESIZE = "globalThis.onresize";

/**
 * Event for when the canvas is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event).<br>
 * Data passed : {number} canvas width <br>
 * Data passed : {number} canvas height
 * @see event.on
 */
export const CANVAS_ONRESIZE = "canvas.onresize";

/**
 * Event for when the viewport is resized <br>
 * (this usually follows a WINDOW_ONRESIZE event, when using the `flex` scaling mode is used and after the viewport was updated).<br>
 * Data passed : {number} viewport width <br>
 * Data passed : {number} viewport height <br>
 * Data passed : {Camera2d} a reference to the camera viewport being resized
 * @see event.on
 */
export const VIEWPORT_ONRESIZE = "viewport.onresize";

/**
 * Event for when the device is rotated <br>
 * Data passed : {Event} Event object <br>
 * @see event.on
 */
export const WINDOW_ONORIENTATION_CHANGE = "globalThis.orientationchange";

/**
 * Event for when the (browser) window is scrolled <br>
 * Data passed : {Event} Event object
 * @see event.on
 */
export const WINDOW_ONSCROLL = "globalThis.onscroll";

/**
 * Event for when the viewport position is updated <br>
 * Data passed : {me.Vector2d} viewport position vector
 * @see event.on
 */
export const VIEWPORT_ONCHANGE = "viewport.onchange";

/**
 * Event for when the current context is lost <br>
 * Data passed : {me.Renderer} the current renderer instance
 * @see event.on
 */
export const ONCONTEXT_LOST = "renderer.contextlost";

/**
 * Event for when the current context is restored <br>
 * Data passed : {me.Renderer} the current renderer instance`
 * @see event.on
 */
export const ONCONTEXT_RESTORED = "renderer.contextrestored";

interface Events {
	[DOM_READY]: () => void;
	[BOOT]: () => void;
	[TICK]: (time: number) => void;
	[BLUR]: () => void;
	[BLUR]: () => void;
	[STATE_PAUSE]: () => void;
	[STATE_RESUME]: (time: number) => void;
	[STATE_STOP]: () => void;
	[STATE_RESTART]: (time: number) => void;
	[STATE_CHANGE]: () => void;
	[STAGE_RESET]: (stage: Stage) => void;
	[VIDEO_INIT]: (renderer: Renderer) => void;
	[GAME_INIT]: () => void;
	[GAME_RESET]: () => void;
	[GAME_BEFORE_UPDATE]: (time: number) => void;
	[GAME_AFTER_UPDATE]: (time: number) => void;
	[GAME_UPDATE]: (time: number) => void;
	[GAME_BEFORE_DRAW]: (time: DOMHighResTimeStamp) => void;
	[GAME_AFTER_DRAW]: (time: DOMHighResTimeStamp) => void;
	[WORLD_STEP]: (dt: number) => void;
	[LEVEL_LOADED]: (levelId: string) => void;
	[LOADER_COMPLETE]: () => void;
	[LOADER_PROGRESS]: (progress: number, resource: unknown) => void;
	[LOADER_ERROR]: (resource: unknown) => void;
	[KEYDOWN]: (
		action: string | undefined,
		keyCode: number,
		edge: boolean,
	) => void;
	[KEYUP]: (action: string | undefined, keyCode: number) => void;
	[GAMEPAD_CONNECTED]: (gamepad: Gamepad) => void;
	[GAMEPAD_DISCONNECTED]: (gamepad: Gamepad) => void;
	[GAMEPAD_UPDATE]: (
		index: string,
		type: "buttons" | "axes",
		button: number,
		current: { value: number; pressed: boolean },
	) => void;
	[POINTERMOVE]: (pointer: Pointer) => void;
	[POINTERLOCKCHANGE]: (locked: boolean) => void;
	[DRAGSTART]: (event: unknown, draggable: Draggable) => void;
	[DRAGEND]: (event: unknown, draggable: Draggable) => void;
	[WINDOW_ONRESIZE]: (event: Event) => void;
	[WINDOW_ONORIENTATION_CHANGE]: (event: Event) => void;
	[WINDOW_ONSCROLL]: (event: Event) => void;
	[CANVAS_ONRESIZE]: (width: number, height: number) => void;
	[VIEWPORT_ONRESIZE]: (width: number, height: number) => void;
	[VIEWPORT_ONCHANGE]: (position: Vector2d) => void;
	[ONCONTEXT_LOST]: (renderer: Renderer) => void;
	[ONCONTEXT_RESTORED]: (renderer: Renderer) => void;
}

export const eventEmitter = new EventEmitter<Events>();

/**
 * Add a listener for a given event.
 * @param eventName - The event name.
 * @param listener - The listener function.
 * @param [context] - The context to invoke the listener with.
 * @example
 * me.event.on("event-name", myFunction, this);
 */
export function on<E extends keyof Events>(
	eventName: E,
	listener: Events[E],
	context?: any,
) {
	eventEmitter.addListener(
		eventName,
		context ? (listener.bind(context) as Events[E]) : listener,
	);
}

/**
 * Add a one-time listener for a given event.
 * @param eventName - The event name.
 * @param listener - The listener function.
 * @param [context] - The context to invoke the listener with.
 * @example
 * me.event.once("event-name", myFunction, this);
 */
export function once<E extends keyof Events>(
	eventName: E,
	listener: Events[E],
	context?: any,
) {
	eventEmitter.addListenerOnce(
		eventName,
		context ? (listener.bind(context) as Events[E]) : listener,
	);
}

/**
 * remove the given listener for a given event.
 * @param eventName - The event name.
 * @param listener - The listener function.
 * @example
 * me.event.off("event-name", myFunction);
 */
export function off<E extends keyof Events>(eventName: E, listener: Events[E]) {
	eventEmitter.removeListener(eventName, listener);
}
