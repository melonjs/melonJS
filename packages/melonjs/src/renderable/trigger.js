import FadeEffect from "../camera/effects/fade_effect.ts";
import MaskEffect from "../camera/effects/mask_effect.ts";
import { polygonPool } from "../geometries/polygon.ts";
import { level } from "./../level/level.js";
import { vector2dPool } from "../math/vector2d.ts";
import { boundsPool } from "./../physics/bounds.ts";
import { collision } from "./../physics/collision.js";
import Renderable from "./renderable.js";

/**
 * additional import for TypeScript
 * @import ResponseObject from "./../physics/response.js";
 */

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
	 * @param {Ellipse|Polygon} [settings.shape] - Mask shape for "mask" transition type (e.g. an Ellipse for iris, a Polygon for diamond/star)
	 * @param {string} [settings.event="level"] - the type of event to trigger (only "level" supported for now)
	 * @param {string} [settings.to] - level to load if level trigger
	 * @param {string|Container} [settings.container] - Target container. See {@link level.load}
	 * @param {Function} [settings.onLoaded] - Level loaded callback. See {@link level.load}
	 * @param {boolean} [settings.flatten] - Flatten all objects into the target container. See {@link level.load}
	 * @param {boolean} [settings.setViewportBounds] - Resize the viewport to match the level. See {@link level.load}
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

		for (const property of [
			"type",
			"container",
			"onLoaded",
			"flatten",
			"setViewportBounds",
			"to",
		]) {
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
	 */
	triggerEvent() {
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
					const shape = this.transitionShape;

					// wrap the user's onLoaded to add the reveal effect
					const userOnLoaded = settings.onLoaded;
					settings.onLoaded = function (levelId) {
						// re-read viewport after game.reset reassigns it
						const vp = app.viewport;
						// reveal effect (same type as hide)
						if (useMask) {
							vp.addCameraEffect(
								new MaskEffect(vp, {
									shape,
									color,
									duration,
									direction: "reveal",
								}),
							);
						} else {
							vp.addCameraEffect(
								new FadeEffect(vp, {
									color,
									duration,
									direction: "out",
								}),
							);
						}
						// call the user's onLoaded if any
						if (typeof userOnLoaded === "function") {
							userOnLoaded.call(this, levelId);
						}
					};
					const onComplete = () => {
						level.load(gotolevel, settings);
					};

					// hide effect, then load level + reveal
					if (useMask) {
						viewport.addCameraEffect(
							new MaskEffect(viewport, {
								shape,
								color,
								duration,
								direction: "hide",
								onComplete,
							}),
						);
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
	onCollisionStart() {
		if (this.name === "Trigger") {
			this.triggerEvent();
		}
	}
}
