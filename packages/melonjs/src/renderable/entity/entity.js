import { polygonPool } from "../../geometries/polygon.ts";
import { warning } from "../../lang/console.js";
import { vector2dPool } from "../../math/vector2d.ts";
import Body from "../../physics/builtin/body.js";
import Renderable from "../renderable.js";
import Sprite from "../sprite.js";

/**
 * @import {Line} from "./../../geometries/line.ts";
 * @import {Rect} from "./../../geometries/rectangle.ts";
 * @import {Ellipse} from "./../../geometries/ellipse.ts";
 * @import {Polygon} from "../../geometries/polygon.ts";
 * @import {Bounds} from "./../../physics/bounds.ts";
 * @import CanvasRenderer from "./../../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../../video/webgl/webgl_renderer.js";
 **/

/**
 * a Generic Object Entity
 * @deprecated since 18.1.0 — use {@link Sprite} or {@link Renderable} combined with {@link Body} instead.
 *
 * ### Why Entity is deprecated
 *
 * `Entity` introduced an unnecessary extra layer: it wrapped a child {@link Renderable} (typically a {@link Sprite})
 * inside a parent object that also held a {@link Body}. This design led to a number of long-standing issues:
 *
 * - **Anchor point confusion** — Entity used its own anchor point to position the child renderable relative to the
 *   body bounds, which behaved differently from the standard {@link Renderable} anchor point. This caused
 *   persistent alignment bugs with bounds and rendering (see issues #848, #834, #754, #580, #922).
 * - **Indirect API** — animations, flipping, tinting, and other visual operations had to go through
 *   `this.renderable` instead of being called directly, making the API more verbose and error-prone.
 * - **Custom rendering pipeline** — Entity overrode `preDraw`/`draw` with a custom coordinate system that
 *   differed from the rest of the engine, making it harder to reason about positioning and transforms.
 *
 * ### The Sprite + Body approach
 *
 * The recommended replacement is to extend {@link Sprite} (for animated/image-based objects) or
 * {@link Renderable} (for custom-drawn objects) directly, and attach a {@link Body} in the constructor.
 * This approach:
 *
 * - Uses the **standard rendering pipeline** — no custom `preDraw` or coordinate system surprises.
 * - Provides a **direct API** — call `this.flipX()`, `this.setCurrentAnimation()`, `this.tint` directly.
 * - Aligns with **industry conventions** — attaching a physics body to a renderable is the standard pattern
 *   used by other game engines.
 * - Gives **full control** over body shape and position within the sprite frame.
 *
 * ### Migration Guide
 *
 * #### Example 1 — Animated Sprite with physics (using a texture atlas)
 * ```js
 * class PlayerSprite extends me.Sprite {
 *     constructor(x, y, settings) {
 *         // create the Sprite using atlas animation frames
 *         super(x, y, {
 *             ...game.texture.getAnimationSettings([
 *                 "walk0001.png", "walk0002.png", "walk0003.png"
 *             ]),
 *             anchorPoint: { x: 0.5, y: 1.0 }
 *         });
 *
 *         // add a physic body (use Tiled shapes if available, or define your own)
 *         this.body = new me.Body(this,
 *             settings.shapes || new me.Rect(0, 0, settings.width, settings.height)
 *         );
 *         this.body.collisionType = me.collision.types.PLAYER_OBJECT;
 *         this.body.setMaxVelocity(3, 15);
 *         this.body.setFriction(0.4, 0);
 *
 *         // define animations (called directly on the sprite, not on this.renderable)
 *         this.addAnimation("walk", ["walk0001.png", "walk0002.png", "walk0003.png"]);
 *         this.setCurrentAnimation("walk");
 *     }
 *
 *     update(dt) {
 *         // input handling, animations, etc. — all directly on `this`
 *         if (me.input.isKeyPressed("right")) {
 *             this.body.force.x = this.body.maxVel.x;
 *             this.flipX(false);
 *         }
 *         return super.update(dt);
 *     }
 *
 *     onCollision(response, other) {
 *         return true; // solid
 *     }
 * }
 * ```
 *
 * #### Example 2 — Sprite with physics (using a standalone spritesheet image)
 * ```js
 * class EnemySprite extends me.Sprite {
 *     constructor(x, y, settings) {
 *         super(x, y, Object.assign({
 *             image: "enemy_spritesheet",
 *             framewidth: 32,
 *             frameheight: 32,
 *         }, settings));
 *
 *         // add a physic body
 *         this.body = new me.Body(this, new me.Rect(0, 0, this.width, this.height));
 *         this.body.collisionType = me.collision.types.ENEMY_OBJECT;
 *         this.body.setMaxVelocity(1, 1);
 *         this.body.gravityScale = 0;
 *
 *         this.addAnimation("walk", [0, 1, 2, 3]);
 *         this.addAnimation("dead", [4]);
 *         this.setCurrentAnimation("walk");
 *     }
 *
 *     onCollision(response, other) {
 *         return false;
 *     }
 * }
 * ```
 *
 * #### Example 3 — Custom-drawn Renderable with physics
 * ```js
 * class CustomBall extends me.Renderable {
 *     constructor(x, y, radius) {
 *         super(x, y, radius * 2, radius * 2);
 *         this.radius = radius;
 *
 *         // add a physic body with a circular shape
 *         this.body = new me.Body(this, new me.Ellipse(radius, radius, radius * 2, radius * 2));
 *         this.body.collisionType = me.collision.types.ENEMY_OBJECT;
 *         this.body.setMaxVelocity(4, 4);
 *         this.body.gravityScale = 0;
 *         this.body.force.set(
 *             me.Math.randomFloat(-4, 4),
 *             me.Math.randomFloat(-4, 4)
 *         );
 *     }
 *
 *     update(dt) {
 *         return super.update(dt);
 *     }
 *
 *     draw(renderer) {
 *         renderer.setColor("#FF0000");
 *         renderer.fillEllipse(
 *             this.width / 2, this.height / 2,
 *             this.radius, this.radius
 *         );
 *     }
 *
 *     onCollision(response, other) {
 *         // bounce off on collision
 *         this.body.force.x = -this.body.force.x;
 *         this.body.force.y = -this.body.force.y;
 *         return false;
 *     }
 * }
 * ```
 *
 * @see Sprite
 * @see Renderable
 * @see Body
 * @category Game Objects
 */
export default class Entity extends Renderable {
	static _deprecationWarned = false;

	/**
	 * @param {number} x - the x coordinates of the entity object
	 * @param {number} y - the y coordinates of the entity object
	 * @param {object} settings - Entity properties, to be defined through Tiled or when calling the entity constructor
	 * <img src="../../images/object_properties.png"/>
	 * @param {number} settings.width - the physical width the entity takes up in game
	 * @param {number} settings.height - the physical height the entity takes up in game
	 * @param {string} [settings.name] - object entity name
	 * @param {string} [settings.id] - object unique IDs
	 * @param {Image|string} [settings.image] - resource name of a spritesheet to use for the entity renderable component
	 * @param {Vector2d} [settings.anchorPoint=0.0] - Entity anchor point
	 * @param {number} [settings.framewidth=settings.width] - width of a single frame in the given spritesheet
	 * @param {number} [settings.frameheight=settings.width] - height of a single frame in the given spritesheet
	 * @param {string} [settings.type] - object type
	 * @param {number} [settings.collisionMask] - Mask collision detection for this object
	 * @param {Rect[]|Polygon[]|Line[]|Ellipse[]} [settings.shapes] - the initial list of collision shapes (usually populated through Tiled)
	 * @deprecated since 18.1.0 — see the class-level documentation for migration examples
	 */
	constructor(x, y, settings) {
		// deprecation warning (once per session)
		if (!Entity._deprecationWarned) {
			warning("me.Entity", "me.Sprite combined with me.Body", "18.1.0");
			Entity._deprecationWarned = true;
		}

		// call the super constructor
		super(x, y, settings.width, settings.height);

		/**
		 * The array of renderable children of this entity.
		 * @ignore
		 */
		this.children = [];

		if (settings.image) {
			// set the frame size to the given entity size, if not defined in settings
			settings.framewidth = settings.framewidth || settings.width;
			settings.frameheight = settings.frameheight || settings.height;
			this.renderable = new Sprite(0, 0, settings);
		}

		// Update anchorPoint
		if (settings.anchorPoint) {
			this.anchorPoint.setMuted(settings.anchorPoint.x, settings.anchorPoint.y);
		} else {
			// for backward compatibility
			this.anchorPoint.setMuted(0, 0);
		}

		// set the sprite name if specified
		if (typeof settings.name === "string") {
			this.name = settings.name;
		}

		/**
		 * object type (as defined in Tiled)
		 * @type {string}
		 */
		this.type = settings.type || "";

		/**
		 * object unique ID (as defined in Tiled)
		 * @type {number}
		 */
		this.id = settings.id || "";

		/**
		 * dead/living state of the entity<br>
		 * default value : true
		 * @type {boolean}
		 */
		this.alive = true;

		// initialize the default body
		if (typeof settings.shapes === "undefined") {
			settings.shapes = polygonPool.get(0, 0, [
				vector2dPool.get(0, 0),
				vector2dPool.get(this.width, 0),
				vector2dPool.get(this.width, this.height),
				vector2dPool.get(0, this.height),
			]);
		}

		/**
		 * the entity body object
		 * @type {Body}
		 */
		this.body = new Body(this, settings.shapes, () => {
			return this.onBodyUpdate();
		});

		// resize the entity if required
		if (this.width === 0 && this.height === 0) {
			this.resize(this.body.getBounds().width, this.body.getBounds().height);
		}

		// set the  collision mask and type (if defined)
		this.body.setCollisionMask(settings.collisionMask);
		this.body.setCollisionType(settings.collisionType);

		// disable for entities
		this.autoTransform = false;
	}

	/**
	 * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
	 * @type {Renderable}
	 */

	get renderable() {
		return this.children[0];
	}

	set renderable(value) {
		if (value instanceof Renderable) {
			this.children[0] = value;
			this.children[0].ancestor = this;
			// auto-align: inherit renderable's anchor if entity is still at default
			if (this.anchorPoint.x === 0 && this.anchorPoint.y === 0) {
				this.anchorPoint.setMuted(value.anchorPoint.x, value.anchorPoint.y);
			}
			this.updateBounds();
		} else {
			throw new Error(value + "should extend me.Renderable");
		}
	}

	/** @ignore */
	update(dt) {
		if (this.renderable) {
			this.isDirty |= this.renderable.update(dt);
		}
		return super.update(dt);
	}

	/**
	 * update the bounding box for this entity.
	 * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
	 * @returns {Bounds} this entity bounding box Rectangle object
	 */
	updateBounds(absolute = true) {
		const bounds = this.getBounds();

		bounds.clear();
		bounds.addFrame(0, 0, this.width, this.height);

		// add each renderable bounds
		if (this.children && this.children.length > 0) {
			bounds.addBounds(this.children[0].getBounds());
		}

		if (this.body) {
			bounds.addBounds(this.body.getBounds());
		}

		if (absolute === true) {
			const absPos = this.getAbsolutePosition();
			bounds.centerOn(
				absPos.x + bounds.x + bounds.width / 2,
				absPos.y + bounds.y + bounds.height / 2,
			);
		}

		return bounds;
	}

	/**
	 * update the bounds when the body is modified
	 */
	onBodyUpdate() {
		this.updateBounds();
	}

	preDraw(renderer) {
		renderer.save();

		// translate to the entity position
		renderer.translate(
			this.pos.x + this.body.getBounds().x,
			this.pos.y + this.body.getBounds().y,
		);

		if (this.renderable instanceof Renderable) {
			// draw the child renderable's anchorPoint at the entity's
			// anchor point.  the entity's anchor point is a scale from
			// body position to body width/height
			renderer.translate(
				this.anchorPoint.x * this.body.getBounds().width,
				this.anchorPoint.y * this.body.getBounds().height,
			);
		}
	}

	/**
	 * draw this entity (automatically called by melonJS)
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the viewport to (re)draw
	 */
	draw(renderer, viewport) {
		const renderable = this.renderable;
		if (renderable instanceof Renderable) {
			// predraw (apply transforms)
			renderable.preDraw(renderer);

			// draw the object
			renderable.draw(renderer, viewport);

			// postdraw (clean-up);
			renderable.postDraw(renderer);
		}
	}

	/**
	 * Destroy function
	 * @ignore
	 */
	destroy() {
		// free some property objects
		if (this.renderable) {
			this.renderable.destroy.apply(this.renderable, arguments);
			this.children.splice(0, 1);
		}

		// call the parent destroy method
		super.destroy(arguments);
	}

	/**
	 * onDeactivateEvent Notification function
	 */
	onDeactivateEvent() {
		if (this.renderable && this.renderable.onDeactivateEvent) {
			this.renderable.onDeactivateEvent();
		}
	}
}
