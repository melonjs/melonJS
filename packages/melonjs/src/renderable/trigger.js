import FadeEffect from "../camera/effects/fade_effect.ts";
import MaskEffect from "../camera/effects/mask_effect.ts";
import { polygonPool } from "../geometries/polygon.ts";
import { LEVEL_LOAD_OPTIONS, level } from "./../level/level.js";
import { vector2dPool } from "../math/vector2d.ts";
import { boundsPool } from "./../physics/bounds.ts";
import { collision } from "./../physics/collision.js";
import { defer } from "./../utils/function.ts";
import Renderable from "./renderable.js";

/**
 * additional import for TypeScript
 * @import ResponseObject from "./../physics/response.js";
 * @import {Color} from "../math/color.ts";
 * @import Container from "./container.js";
 * @import {MaskCenter, MaskShape} from "../camera/effects/mask_effect.ts";
 * @import {Line} from "../geometries/line.ts";
 * @import {Vector3d} from "../math/vector3d.ts";
 * @import {Polygon} from "../geometries/polygon.ts";
 * @import {Rect} from "../geometries/rectangle.ts";
 */

/**
 * What a trigger carries from its own settings into `level.load()`.
 *
 * Derived from {@link LEVEL_LOAD_OPTIONS} rather than restated, which is the
 * whole point: an option added to a level format is named once, beside the code
 * that reads it, and arrives here for free. The previous hand-written list had
 * fallen three releases behind the glTF path, so a Tiled-authored trigger
 * loaded its scene at the default scale and handedness whatever the map said
 * (#1649).
 *
 * Two exclusions and two additions:
 * - `async` is the trigger's own to set. On the transition path it awaits the
 *   load to time its reveal; on the direct path it does not await at all. An
 *   authored value would break the first and mean nothing in the second.
 * - `type` and `to` are the trigger's own settings rather than the director's,
 *   and are carried for `triggerEvent` to read back at fire time.
 *
 * Built on FIRST USE, not at module scope: `level` reaches the level formats,
 * which reach the renderables, which reach this module, so reading the export
 * while that cycle is still unwinding throws on the temporal dead zone. A
 * trigger cannot be constructed before the modules have settled, so by the
 * time this runs the contract is there.
 * @returns {ReadonlyArray<string>} the settings a trigger forwards
 * @ignore
 */
let forwardedSettings;
const getForwardedSettings = () => {
	if (forwardedSettings === undefined) {
		forwardedSettings = Object.freeze([
			...LEVEL_LOAD_OPTIONS.filter((option) => {
				return option !== "async";
			}),
			"type",
			"to",
		]);
	}
	return forwardedSettings;
};

/**
 * Trigger an event when colliding with another object.
 * Supports both fade and mask-based transitions when loading a new level.
 * @category Game Objects
 */
export default class Trigger extends Renderable {
	/**
	 * @param {number} x - the x coordinates of the trigger area
	 * @param {number} y - the y coordinates of the trigger area
	 * @param {Object} settings - trigger settings
	 * @param {number} [settings.width] - width of the trigger area
	 * @param {number} [settings.height] - height of the trigger area
	 * @param {Rect[]|Polygon[]|Line[]|Ellipse[]} [settings.shapes] - collision shape(s) that will trigger the event
	 * @param {number} [settings.duration] - Transition duration (in ms)
	 * @param {string|Color} [settings.color] - Transition color (also accepts legacy `fade` property)
	 * @param {string} [settings.transition="fade"] - Transition type: "fade" for a color fade, "mask" for a shape-based mask transition
	 * @param {MaskShape|"touching"} [settings.shape] - Mask shape for the "mask" transition type: an `Ellipse` (an iris) or a `Polygon`, an image or the name of a preloaded one (its silhouette), a `Sprite`, or `"touching"` for the silhouette of the object that set the trigger off. See {@link MaskEffect}
	 * @param {MaskCenter|"touching"} [settings.center] - Where the mask closes and opens: a renderable, a point on screen, or `"touching"` for the object that set the trigger off. The centre of the screen by default
	 * @param {boolean} [settings.invert=false] - Make the mask the cover rather than the window: filled with the color, it grows out of `center` until it covers the screen
	 * @param {string} [settings.event="level"] - the type of event to trigger (only "level" supported for now)
	 * @param {string} [settings.to] - level to load if level trigger
	 * @param {string|Container} [settings.container] - Target container. See {@link level.load}
	 * @param {Function} [settings.onLoaded] - Level loaded callback. See {@link level.load}
	 * @param {boolean} [settings.flatten] - Flatten all objects into the target container. See {@link level.load}
	 * @param {boolean} [settings.setViewportBounds] - Resize the viewport to match the level. See {@link level.load}
	 * @param {number} [settings.scale] - Pixels per glTF unit. See {@link level.load}
	 * @param {boolean} [settings.rightHanded] - Convert the glTF scene to the engine's Y-down coordinates. See {@link level.load}
	 * @param {boolean} [settings.lights] - Load the glTF scene's lights. See {@link level.load}
	 * @param {number} [settings.lightIntensityScale] - Scale the glTF lights' authored intensity. See {@link level.load}
	 * @param {boolean} [settings.castGroundShadow] - Enable ground shadows for glTF meshes. See {@link level.load}
	 * @param {number} [settings.shadowGroundY] - World Y for glTF ground shadows. See {@link level.load}
	 * @param {number} [settings.shadowOpacity] - How dark those blobs are. See {@link level.load}
	 * @param {number} [settings.shadowScale] - Blob footprint multiplier. See {@link level.load}
	 * @param {number} [settings.shadowOffset] - Slide them along the light, in blob radii. See {@link level.load}
	 * @param {number} [settings.shadowStretch] - Lengthen them along it. See {@link level.load}
	 * @param {number} [settings.shadowDirectionX] - X of the ground direction they are cast along. See {@link level.load}
	 * @param {number} [settings.shadowDirectionZ] - Z of that direction. See {@link level.load}
	 * @param {number[]|Vector3d} [settings.shadowGroundNormal] - Up normal of the floor, for a scene that is not level. See {@link level.load}
	 * @param {Light3d} [settings.shadowLight] - A light to take the shadow direction from. See {@link level.load}
	 * @example
	 * // fade transition (default)
	 * world.addChild(new Trigger(x, y, {
	 *     shapes: [new Rect(0, 0, 100, 100)],
	 *     color: "#000",
	 *     duration: 250,
	 *     to: "mymap2",
	 * }));
	 * @example
	 * // mask transition with iris (ellipse) shape
	 * world.addChild(new Trigger(x, y, {
	 *     shapes: [new Rect(0, 0, 100, 100)],
	 *     transition: "mask",
	 *     shape: new Ellipse(0, 0, 1, 1),
	 *     color: "#000",
	 *     duration: 500,
	 *     to: "mymap2",
	 * }));
	 * @example
	 * // the player's own silhouette, closing on the player as it walks in
	 * world.addChild(new Trigger(x, y, {
	 *     shapes: [new Rect(0, 0, 100, 100)],
	 *     transition: "mask",
	 *     shape: "touching",
	 *     center: "touching",
	 *     color: "#000",
	 *     duration: 300,
	 *     to: "mymap2",
	 * }));
	 * @example
	 * // a preloaded star image, growing out of the player until it covers
	 * // the screen. In Tiled, the same as properties of the trigger object:
	 * // transition "mask", shape "star_mask", center "touching", invert true
	 * world.addChild(new Trigger(x, y, {
	 *     shapes: [new Rect(0, 0, 100, 100)],
	 *     transition: "mask",
	 *     shape: "star_mask",
	 *     center: "touching",
	 *     invert: true,
	 *     color: "#000",
	 *     duration: 400,
	 *     to: "mymap2",
	 * }));
	 * @example
	 * // mask transition with diamond polygon
	 * world.addChild(new Trigger(x, y, {
	 *     shapes: [new Rect(0, 0, 100, 100)],
	 *     transition: "mask",
	 *     shape: new Polygon(0, 0, [
	 *         { x: 0, y: -1 }, { x: 1, y: 0 },
	 *         { x: 0, y: 1 }, { x: -1, y: 0 },
	 *     ]),
	 *     color: "#000",
	 *     duration: 400,
	 *     to: "mymap2",
	 * }));
	 */
	constructor(x, y, settings) {
		super(x, y, settings.width || 0, settings.height || 0);

		this.anchorPoint.set(0, 0);

		this.color = settings.color || settings.fade;
		this.duration = settings.duration;
		this.transition = settings.transition || "fade";
		this.transitionShape = settings.shape;
		this.transitionCenter = settings.center;
		this.transitionInvert = settings.invert === true;
		this.fading = false;

		// Tiled settings
		this.name = "Trigger";
		this.type = settings.type;
		this.id = settings.id;
		this.gotolevel = settings.to;

		// collect the defined trigger settings
		this.triggerSettings = {
			event: "level",
		};

		for (const property of getForwardedSettings()) {
			if (typeof settings[property] !== "undefined") {
				this.triggerSettings[property] = settings[property];
			}
		}

		// add and configure the physic body
		let shape = settings.shapes;
		if (typeof shape === "undefined") {
			shape = polygonPool.get(0, 0, [
				vector2dPool.get(0, 0),
				vector2dPool.get(this.width, 0),
				vector2dPool.get(this.width, this.height),
			]);
		}
		// declarative body — adapter-portable, auto-registered on addChild.
		// `isSensor: true` makes the trigger explicitly a detection-only
		// volume. Under the builtin adapter this is a no-op for triggers
		// (the SAT detector already skipped push-out because Trigger
		// doesn't define `onCollision`); under Matter it is required —
		// matter's solver always resolves contacts unless the body is
		// flagged as a sensor.
		this.bodyDef = {
			type: "static",
			shapes: Array.isArray(shape) ? shape : [shape],
			collisionType: collision.types.ACTION_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
			isSensor: true,
		};
		// Size from the union of all shapes' bounds (the body itself
		// isn't constructed until auto-registration runs on addChild).
		const bounds = boundsPool.get();
		bounds.addShapes(this.bodyDef.shapes, true);
		this.resize(bounds.width, bounds.height);
		boundsPool.release(bounds);
	}

	/**
	 * @ignore
	 * @internal
	 */
	getTriggerSettings() {
		const world = this.ancestor.getRootAncestor();
		if (typeof this.triggerSettings.container === "string") {
			this.triggerSettings.container = world.getChildByName(
				this.triggerSettings.container,
			)[0];
		}
		return this.triggerSettings;
	}

	/**
	 * Trigger this event. Override in subclasses to customize behavior.
	 * @protected
	 * @param {Renderable} [other] - the object that set the trigger off, which
	 * a mask transition's `shape` and `center` of `"touching"` stand for
	 */
	triggerEvent(other) {
		const triggerSettings = this.getTriggerSettings();
		const world = this.ancestor.getRootAncestor();
		const app = world.app;
		const viewport = app.viewport;

		if (triggerSettings.event === "level") {
			this.gotolevel = triggerSettings.to;
			if (this.color && this.duration) {
				if (!this.fading) {
					this.fading = true;
					const gotolevel = this.gotolevel;
					const settings = this.getTriggerSettings();
					const color = this.color;
					const duration = this.duration;
					const useMask = this.transition === "mask" && this.transitionShape;
					// "touching" is the object that walked in; with none (an
					// event fired by hand), the mask's own default, an iris on
					// the centre of the screen
					const shape =
						this.transitionShape === "touching" ? other : this.transitionShape;
					const center =
						this.transitionCenter === "touching"
							? other
							: this.transitionCenter;
					// the reveal, read from the hide as it completes: the shape
					// and the point it settled when it started, from an object
					// the level change destroys
					let hide;
					let reveal;

					// Await the load rather than intercepting the caller's
					// `onLoaded`: the reveal used to be injected by wrapping
					// `settings.onLoaded` and calling the user's through it,
					// which meant rewriting an option the caller passed in.
					const onComplete = () => {
						reveal = hide?.reverseOptions();
						level
							.load(gotolevel, { ...settings, async: true })
							.then(() => {
								// re-read AFTER the load: `game.reset()` reassigns
								// `app.viewport`, so a viewport captured before it
								// is stale by the time the reveal runs
								const vp = app.viewport;
								// reveal effect (same type as hide)
								if (useMask) {
									vp.addCameraEffect(new MaskEffect(vp, reveal));
								} else {
									vp.addCameraEffect(
										new FadeEffect(vp, {
											color,
											duration,
											direction: "out",
										}),
									);
								}
							})
							.catch((error) => {
								// rethrow on an empty stack, so a failed transition
								// surfaces as an uncaught error rather than a silent
								// unhandled rejection
								defer(() => {
									throw error;
								}, null);
							});
					};

					// hide effect, then load level + reveal
					if (useMask) {
						hide = new MaskEffect(viewport, {
							shape,
							color,
							duration,
							direction: "hide",
							center,
							invert: this.transitionInvert,
							onComplete,
						});
						viewport.addCameraEffect(hide);
					} else {
						viewport.addCameraEffect(
							new FadeEffect(viewport, {
								color,
								duration,
								direction: "in",
								onComplete,
							}),
						);
					}
				}
			} else {
				level.load(this.gotolevel, triggerSettings);
			}
		} else {
			throw new Error("Trigger invalid type");
		}
	}

	/**
	 * Fire the trigger when an entity first enters the trigger zone.
	 * Using `onCollisionStart` rather than `onCollision` so the event
	 * runs exactly once per entry — under the legacy alias this would
	 * fire every frame the entity was inside the trigger.
	 */
	onCollisionStart(_response, other) {
		if (this.name === "Trigger") {
			this.triggerEvent(other);
		}
	}
}
