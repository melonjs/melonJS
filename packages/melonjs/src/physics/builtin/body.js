import { Ellipse } from "../../geometries/ellipse.ts";
import { Line, linePool } from "../../geometries/line.ts";
import { Point, pointPool } from "../../geometries/point.ts";
import { Polygon, polygonPool } from "../../geometries/polygon.ts";
import { Rect } from "../../geometries/rectangle.ts";
import { clamp } from "../../math/math.ts";
import { vector2dPool } from "../../math/vector2d.ts";
import pool from "../../system/legacy_pool.js";
import timer from "../../system/timer.ts";
import { remove } from "../../utils/array.ts";
import { Bounds, boundsPool } from "../bounds.ts";
import { collision } from "../collision.js";

/**
 * @import Entity from "../../renderable/entity/entity.js";
 * @import Container from "../../renderable/container.js";
 * @import Renderable from "../../renderable/renderable.js";
 * @import Sprite from "../../renderable/sprite.js";
 * @import NineSliceSprite from "../../renderable/nineslicesprite.js";
 * @import {Vector2d} from "../../math/vector2d.js";
 * @import ResponseObject from "../response.js";
 **/

/**
 * a Generic Physic Body Object with some physic properties and behavior functionality, to add as a member of a Renderable.
 * @category Physics
 * @see Renderable.body
 */
export default class Body {
	/**
	 * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} ancestor - the parent object this body is attached to
	 * @param {Rect|Rect[]|Polygon|Polygon[]|Line|Line[]|Ellipse|Ellipse[]|Point|Point[]|Bounds|Bounds[]|object} [shapes] - a initial shape, list of shapes, or JSON object defining the body
	 * @param {Function} [onBodyUpdate] - callback for when the body is updated (e.g. add/remove shapes)
	 */
	constructor(ancestor, shapes, onBodyUpdate) {
		/**
		 * a reference to the parent object that contains this body,
		 * or undefined if it has not been added to one.
		 * @public
		 * @type {Renderable|Container|Entity|Sprite|NineSliceSprite}
		 * @default undefined
		 */
		this.ancestor = ancestor;

		if (typeof this.bounds === "undefined") {
			/**
			 * The AABB bounds box representing this body
			 * @public
			 * @type {Bounds}
			 */
			this.bounds = boundsPool.get();
		}

		if (typeof this.shapes === "undefined") {
			/**
			 * The collision shapes of the body
			 * @ignore
			 * @type {Polygon[]|Line[]|Ellipse[]|Point|Point[]}
			 */
			this.shapes = [];
		}

		/**
		 * The body collision mask, that defines what should collide with what.<br>
		 * (by default will collide with all entities)
		 * @ignore
		 * @type {number}
		 * @default collision.types.ALL_OBJECT
		 * @see collision.types
		 */
		this.collisionMask = collision.types.ALL_OBJECT;

		/**
		 * define the collision type of the body for collision filtering
		 * @public
		 * @type {number}
		 * @default collision.types.ENEMY_OBJECT
		 * @see collision.types
		 * @example
		 * // set the body collision type
		 * body.collisionType = me.collision.types.PLAYER_OBJECT;
		 */
		this.collisionType = collision.types.ENEMY_OBJECT;

		if (typeof this.vel === "undefined") {
			/**
			 * The current velocity of the body.
			 * See to apply a force if you need to modify a body velocity
			 * @see Body.force
			 * @public
			 * @type {Vector2d}
			 * @default <0,0>
			 */
			this.vel = vector2dPool.get();
		}
		this.vel.set(0, 0);

		if (typeof this.force === "undefined") {
			/**
			 * body force to apply to this the body in the current step.
			 * (any positive or negative force will be cancelled after every world/body update cycle)
			 * @public
			 * @type {Vector2d}
			 * @default <0,0>
			 * @see Body.setMaxVelocity
			 * @example
			 * // define a default maximum acceleration, initial force and friction
			 * this.body.force.set(1, 0);
			 * this.body.friction.set(0.4, 0);
			 * this.body.setMaxVelocity(3, 15);
			 *
			 * // apply a positive or negative force when pressing left of right key
			 * update(dt) {
			 *     if (me.input.isKeyPressed("left"))    {
			 *          this.body.force.x = -this.body.maxVel.x;
			 *      } else if (me.input.isKeyPressed("right")) {
			 *         this.body.force.x = this.body.maxVel.x;
			 *     }
			 * }
			 */
			this.force = vector2dPool.get();
		}
		this.force.set(0, 0);

		if (typeof this.friction === "undefined") {
			/**
			 * body friction
			 * @public
			 * @type {Vector2d}
			 * @default <0,0>
			 */
			this.friction = vector2dPool.get();
		}
		this.friction.set(0, 0);

		/**
		 * the body bounciness level when colliding with other solid bodies :
		 * a value of 0 will not bounce, a value of 1 will fully rebound.
		 * @public
		 * @type {number}
		 * @default 0
		 */
		this.bounce = 0;

		/**
		 * the body mass
		 * @public
		 * @type {number}
		 * @default 1
		 */
		this.mass = 1;

		/**
		 * Current rotation angle (radians). Visual-only under the built-in
		 * SAT solver — the collision shapes themselves are NOT rotated by
		 * angular integration; only `renderable.currentTransform` is.
		 * Defaults to `0` and is integrated each step from
		 * {@link Body#angularVelocity}. Set directly via
		 * {@link Body#setAngle} or as a side effect of integration.
		 * @public
		 * @type {number}
		 * @default 0
		 * @example
		 * // teleport the sprite to face down-right (45°):
		 * sprite.body.angle = Math.PI / 4;
		 */
		this.angle = 0;

		/**
		 * Angular velocity in radians per frame. Default `0` — bodies that
		 * never touch the angular API pay no integration cost. See
		 * {@link Body#setAngularVelocity} and {@link Body#applyTorque}.
		 * @public
		 * @type {number}
		 * @default 0
		 * @example
		 * // continuously spin a pickup at ~3°/frame (~180°/sec at 60fps):
		 * pickup.body.angularVelocity = 0.05;
		 */
		this.angularVelocity = 0;

		/**
		 * Per-step exponential decay applied to {@link Body#angularVelocity}
		 * — analog of `frictionAir` for rotation. `0` = no damping
		 * (bodies spin forever); `1` = full damping per step (rotation
		 * stops instantly). Typical values are small (`0.01` – `0.05`)
		 * so spin decays naturally over a few seconds. Negative values
		 * are ignored (treated as `0`); values `> 1` flip the sign each
		 * step (overdamped — usually a foot-gun).
		 * @public
		 * @type {number}
		 * @default 0
		 * @example
		 * // dynamite barrel spins on impact then slows to a stop:
		 * barrel.body.angularDrag = 0.02;
		 * barrel.body.applyTorque(120);
		 */
		this.angularDrag = 0;

		/**
		 * Moment-of-inertia analog used when converting force-at-offset
		 * and torque into angular velocity: `Δω = τ / pseudoInertia`.
		 * Defaults to a geometry-derived approximation
		 * `(width² + height²) / 12` matching the moment of inertia of a
		 * unit-mass rectangle. Override directly to make a body harder or
		 * easier to spin. Auto-recomputed after every {@link Body#addShape}
		 * call — manual overrides must come AFTER the body is fully built.
		 * @public
		 * @type {number}
		 * @default `(width² + height²) / 12`
		 * @example
		 * // a heavy boss is hard to knock around:
		 * boss.body.addShape(new me.Rect(0, 0, 64, 64));
		 * boss.body.pseudoInertia *= 10;
		 */
		this.pseudoInertia = 1;

		if (typeof this.maxVel === "undefined") {
			/**
			 * max velocity (to limit body velocity)
			 * @public
			 * @type {Vector2d}
			 * @default <490,490>
			 */
			this.maxVel = vector2dPool.get();
		}
		// cap by default to half the default gravity force
		this.maxVel.set(490, 490);

		/**
		 * Either this body is a static body or not.
		 * A static body is completely fixed and can never change position or angle.
		 * @readonly
		 * @public
		 * @type {boolean}
		 * @default false
		 */
		this.isStatic = false;

		/**
		 * Whether this body is a sensor. A sensor detects collisions and
		 * fires the `onCollision*` events on the renderable, but does not
		 * physically respond to the contact (the SAT solver skips the
		 * positional push-out). Useful for triggers, ground-snap assists,
		 * etc. — same role as Matter's `isSensor`.
		 * @public
		 * @type {boolean}
		 * @default false
		 */
		this.isSensor = false;

		/**
		 * The degree to which this body is affected by the world gravity
		 * @public
		 * @see {@link World.gravity}
		 * @type {number}
		 * @default 1.0
		 */
		this.gravityScale = 1.0;

		/**
		 * If true this body won't be affected by the world gravity
		 * @public
		 * @see {@link World.gravity}
		 * @type {boolean}
		 * @default false
		 */
		this.ignoreGravity = false;

		/**
		 * falling state of the body<br>
		 * true if the object is falling<br>
		 * false if the object is standing on something<br>
		 * @readonly
		 * @public
		 * @type {boolean}
		 * @default false
		 */
		this.falling = false;

		/**
		 * jumping state of the body<br>
		 * equal true if the body is jumping<br>
		 * @readonly
		 * @public
		 * @type {boolean}
		 * @default false
		 */
		this.jumping = false;

		if (typeof onBodyUpdate === "function") {
			this.onBodyUpdate = onBodyUpdate;
		}

		this.bounds.clear();

		// parses the given shapes array and add them
		if (typeof shapes !== "undefined") {
			if (Array.isArray(shapes)) {
				for (let s = 0; s < shapes.length; s++) {
					this.addShape(shapes[s]);
				}
			} else {
				this.addShape(shapes);
			}
		}

		// automatically enable physic when a body is added to a renderable
		this.ancestor.isKinematic = false;
	}

	/**
	 * set the body as a static body
	 * static body do not move automatically and do not check against collision with others
	 * @param {boolean} [isStatic=true]
	 */
	setStatic(isStatic = true) {
		this.isStatic = isStatic === true;
	}

	/**
	 * set this body's linear velocity. Portable across physics adapters —
	 * under the builtin adapter this mutates `body.vel`; under Matter it
	 * delegates to `Matter.Body.setVelocity`.
	 * @param {number} x - velocity along the X axis
	 * @param {number} y - velocity along the Y axis
	 */
	setVelocity(x, y) {
		this.vel.set(x, y);
	}

	/**
	 * read this body's linear velocity into an optional output vector.
	 * @param {Vector2d} [out] - vector to write into; a new Vector2d is
	 * allocated when omitted
	 * @returns {Vector2d}
	 */
	getVelocity(out) {
		return (out ?? vector2dPool.get()).copy(this.vel);
	}

	/**
	 * accumulate a force on this body for the current step. Repeated calls
	 * within a single update add together; the engine clears the
	 * accumulator at the end of each integration step. Force magnitude
	 * conventions differ between adapters — consult the active adapter's
	 * docs for tuning ranges (builtin: px/frame²; Matter: Newtonian
	 * `force/mass·dt²`, typically ~100× smaller than builtin).
	 * @param {number} x - force along the X axis
	 * @param {number} y - force along the Y axis
	 * @param {number} [pointX] - world X of the application point; when
	 *   present (along with `pointY`) and different from the body centroid,
	 *   the resulting lever arm generates a torque
	 *   `τ = (r.x · F.y) − (r.y · F.x)` that bumps {@link Body#angularVelocity}
	 *   by `τ / pseudoInertia`. Omit both `pointX` and `pointY` for the
	 *   linear-only behaviour that's compatible with code written before
	 *   the angular API was added.
	 * @param {number} [pointY] - world Y of the application point
	 * @example
	 * // pure linear thrust (2-arg form, unchanged behaviour):
	 * ship.body.applyForce(0, -0.05);
	 *
	 * // off-centre push on a crate: the contact point at the top of the
	 * // crate is above its centroid, so the same horizontal force now
	 * // both translates AND tips the crate forward.
	 * const topX = crate.pos.x + crate.width / 2;
	 * const topY = crate.pos.y;
	 * crate.body.applyForce(1.5, 0, topX, topY);
	 *
	 * // wind pushing on the top of a flag-pole: pole tilts, base stays put
	 * // (only meaningful here if the base is anchored / static).
	 * pole.body.applyForce(0.3, 0, pole.pos.x + pole.width / 2, pole.pos.y);
	 */
	applyForce(x, y, pointX, pointY) {
		this.force.x += x;
		this.force.y += y;
		if (typeof pointX === "number" && typeof pointY === "number") {
			// Lever arm r = point - centroid. Centroid is the geometric
			// center of the body's bounds.
			const bounds = this.bounds;
			const rx = pointX - bounds.centerX;
			const ry = pointY - bounds.centerY;
			// Z-component of r × F.
			const torque = rx * y - ry * x;
			// Guard against division by zero / negative inertia
			// (pseudoInertia is a user-tunable; nonsense values must
			// not crash the integrator).
			if (this.pseudoInertia > 0) {
				this.angularVelocity += torque / this.pseudoInertia;
			}
		}
	}

	/**
	 * Apply an instantaneous angular impulse: `Δω = τ / pseudoInertia`.
	 * The angular analog of {@link Body#applyImpulse} — bypasses the
	 * lever-arm computation in {@link Body#applyForce} for the
	 * "just spin this up directly" case (a power-up's intrinsic spin,
	 * an explicit thruster, a knockback spin effect on hit).
	 * @param {number} torque - angular impulse magnitude. Positive values
	 *   produce clockwise rotation on screen (matching the Y-down canvas
	 *   convention); negative values rotate counter-clockwise.
	 * @example
	 * // give a pickup a one-shot spin-up when collected:
	 * pickup.body.applyTorque(80);
	 *
	 * // explosion knockback that both pushes and spins:
	 * crate.body.applyImpulse(impulseX, impulseY);
	 * crate.body.applyTorque((Math.random() - 0.5) * 100);
	 */
	applyTorque(torque) {
		if (this.pseudoInertia > 0) {
			this.angularVelocity += torque / this.pseudoInertia;
		}
	}

	/**
	 * Set angular velocity directly. Bypasses inertia — the value is the
	 * actual rad/frame that integration will apply next step. Use this
	 * for "set and hold" rotation (a coin that always spins at the same
	 * rate); use {@link Body#applyTorque} for impulse-style spin-up.
	 * @param {number} omega - target angular velocity (rad / frame)
	 * @example
	 * // make a fan blade spin at a fixed rate:
	 * fan.body.setAngularVelocity(0.1);  // ~6°/frame
	 */
	setAngularVelocity(omega) {
		this.angularVelocity = omega;
	}

	/**
	 * Read current angular velocity (rad / frame).
	 * @returns {number}
	 * @example
	 * // freeze rotation if the body is spinning too fast:
	 * if (Math.abs(body.getAngularVelocity()) > 2) {
	 *     body.setAngularVelocity(0);
	 * }
	 */
	getAngularVelocity() {
		return this.angularVelocity;
	}

	/**
	 * Set absolute rotation angle (radians). Updates the body's `angle`
	 * field and re-syncs the renderable's `currentTransform` immediately
	 * so the visual rotation reflects the new value without waiting for
	 * the next integration step.
	 * @param {number} rad - target angle in radians
	 * @example
	 * // turret aims at the player every frame:
	 * const dx = player.centerX - turret.centerX;
	 * const dy = player.centerY - turret.centerY;
	 * turret.body.setAngle(Math.atan2(dy, dx));
	 */
	setAngle(rad) {
		this.angle = rad;
		// Force a transform sync so visual rotation tracks the new angle
		// even when angular velocity is zero (the integrator block in
		// `update()` is gated on `angularVelocity !== 0 || angle !== 0`,
		// so a setAngle(nonzero) call alone still triggers the sync next
		// frame; doing it here makes a manual setAngle visible without
		// requiring an `update()` call in between).
		this._syncAngleTransform();
	}

	/**
	 * Read absolute rotation angle (radians).
	 * @returns {number}
	 */
	getAngle() {
		return this.angle;
	}

	/**
	 * Sync `this.angle` to the renderable's `currentTransform`. Pivot is
	 * the body's bounds center (matches the matter adapter's rotation
	 * pivot — see `MatterAdapter.syncFromPhysics`). Internal helper used
	 * by both the per-step integrator and {@link Body#setAngle}.
	 * @ignore
	 */
	_syncAngleTransform() {
		const t = this.ancestor?.currentTransform;
		if (!t) {
			return;
		}
		const bounds = this.bounds;
		// Pivot is body-local: subtract the renderable's pos so the
		// translate is in the local frame of the renderable.
		const cx = bounds.centerX - this.ancestor.pos.x;
		const cy = bounds.centerY - this.ancestor.pos.y;
		t.identity();
		if (this.angle !== 0) {
			if (cx !== 0 || cy !== 0) {
				t.translate(cx, cy);
				t.rotate(this.angle);
				t.translate(-cx, -cy);
			} else {
				t.rotate(this.angle);
			}
		}
	}

	/**
	 * apply an instantaneous impulse to this body — a single-step velocity
	 * change scaled by inverse mass (`dv = J / m`). Useful for one-shot
	 * events like a cue strike, projectile launch, or knockback, where
	 * mass should influence the resulting velocity change. Repeated calls
	 * within a single update accumulate. Static bodies (mass 0) ignore
	 * the call. Identical signature on the Matter adapter, where the
	 * adapter integrates the impulse the same way (matter has no native
	 * `applyImpulse`).
	 * @param {number} x - impulse along the X axis
	 * @param {number} y - impulse along the Y axis
	 */
	applyImpulse(x, y) {
		const invMass = this.mass > 0 ? 1 / this.mass : 0;
		this.vel.x += x * invMass;
		this.vel.y += y * invMass;
	}

	/**
	 * set this body's mass. Useful for variable-mass entities (projectiles
	 * loaded with ammo, weight pickups, characters carrying objects).
	 * Mass affects `applyImpulse` (via `dv = J / m`) and the proportional
	 * push-out response in dynamic-dynamic collisions. A mass of 0 makes
	 * the body inert to forces and impulses (without going static).
	 * @param {number} m - new mass, non-negative
	 */
	setMass(m) {
		this.mass = m;
	}

	/**
	 * set this body's restitution / bounce factor. `0` = no bounce (energy
	 * absorbed on contact); `1` = perfect elastic rebound; values in
	 * between dampen the rebound. Applied by `Body.respondToCollision` —
	 * see `BuiltinAdapter` docs for the cancellation math.
	 *
	 * Matches the `bodyDef.restitution` field name used at registration
	 * time; the body-side property has historically been called `bounce`,
	 * which is the canonical legacy name and is preserved.
	 * @param {number} r - restitution factor, typically in [0, 1]
	 */
	setBounce(r) {
		this.bounce = r;
	}

	/**
	 * set this body's per-body gravity multiplier. `1` = world gravity
	 * (default), `0` = ignore world gravity (e.g. flying enemy, underwater
	 * float), `2` = 2× gravity (heavy-feel objects). Multiplied with the
	 * world's `gravity.y` each frame inside `applyGravity`.
	 * @param {number} scale - gravity scale factor
	 */
	setGravityScale(scale) {
		this.gravityScale = scale;
	}

	/**
	 * toggle this body between solid and sensor. Sensor bodies still emit
	 * collision events (`onCollisionStart`, `onCollisionActive`,
	 * `onCollisionEnd`) but the solver does not physically resolve the
	 * contact — same semantics as Matter's `isSensor`. Useful for one-way
	 * platforms, trigger zones, and ground-snap assists.
	 * @param {boolean} [isSensor=true]
	 */
	setSensor(isSensor = true) {
		this.isSensor = isSensor === true;
	}

	/**
	 * add a collision shape to this body <br>
	 * (note: me.Rect objects will be converted to me.Polygon before being added)
	 * @param {Rect|Polygon|Line|Ellipse|Point|Point[]|Bounds|object} shape - a shape or JSON object
	 * @returns {number} the shape array length
	 * @example
	 * // add a rectangle shape
	 * this.body.addShape(new me.Rect(0, 0, image.width, image.height));
	 * // add a shape from a JSON object
	 * this.body.addShape(me.loader.getJSON("shapesdef").banana);
	 */
	addShape(shape) {
		if (shape instanceof Rect || shape instanceof Bounds) {
			const poly = shape.toPolygon();
			this.shapes.push(poly);
			// update the body bounds
			this.bounds.add(poly.points);
			this.bounds.translate(poly.pos);
		} else if (shape instanceof Ellipse) {
			if (!this.shapes.includes(shape)) {
				// see removeShape
				this.shapes.push(shape);
			}
			// update the body bounds
			this.bounds.addBounds(shape.getBounds());
			// use bounds position as ellipse position is center
			this.bounds.translate(shape.getBounds().x, shape.getBounds().y);
		} else if (shape instanceof Polygon) {
			if (!this.shapes.includes(shape)) {
				// see removeShape
				this.shapes.push(shape);
			}
			// update the body bounds
			this.bounds.add(shape.points);
			this.bounds.translate(shape.pos);
		} else if (shape instanceof Point) {
			if (!this.shapes.includes(shape)) {
				// see removeShape
				this.shapes.push(shape);
			}
			this.bounds.addPoint(shape);
		} else {
			// JSON object
			this.fromJSON(shape);
		}

		// Refresh the bounds-derived `pseudoInertia` default whenever the
		// body's geometry changes. The user can still override it manually
		// after `addShape` if they need a stiffer / floppier body.
		this._recomputePseudoInertia();

		if (typeof this.onBodyUpdate === "function") {
			this.onBodyUpdate(this);
		}

		// return the length of the shape list
		return this.shapes.length;
	}

	/**
	 * Recompute the default `pseudoInertia` from the current bounds.
	 * Uses the moment-of-inertia formula for a unit-mass rectangle —
	 * `(width² + height²) / 12` — which gives a value that scales
	 * sensibly with body size: a small body resists rotation less, a
	 * large body more. Clamped to a minimum of 1 to keep divisions
	 * well-defined even on degenerate 0-size bodies.
	 * @ignore
	 */
	_recomputePseudoInertia() {
		const w = this.bounds.width;
		const h = this.bounds.height;
		this.pseudoInertia = Math.max(1, (w * w + h * h) / 12);
	}

	/**
	 * set the body vertices to the given one
	 * @param {Vector2d[]} vertices - an array of me.Vector2d points defining a convex hull
	 * @param {number} [index=0] - the shape object for which to set the vertices
	 * @param {boolean} [clear=true] - either to reset the body definition before adding the new vertices
	 */
	setVertices(vertices, index = 0, clear = true) {
		const polygon = this.getShape(index);
		if (polygon instanceof Polygon) {
			polygon.setShape(0, 0, vertices);
		} else {
			// this will replace any other non polygon shape type if defined
			this.shapes[index] = polygonPool.get(0, 0, vertices);
		}

		// update the body bounds to take in account the new vertices
		this.bounds.add(this.shapes[index].points, clear);

		if (typeof this.onBodyUpdate === "function") {
			this.onBodyUpdate(this);
		}
	}

	/**
	 * add the given vertices to the body shape
	 * @param {Vector2d[]} vertices - an array of me.Vector2d points defining a convex hull
	 * @param {number} [index=0] - the shape object for which to set the vertices
	 */
	addVertices(vertices, index = 0) {
		this.setVertices(vertices, index, false);
	}

	/**
	 * add collision mesh based on a JSON object
	 * (this will also apply any physic properties defined in the given JSON file)
	 * @param {object} json - a JSON object as exported from a Physics Editor tool
	 * @param {string} [id] - an optional shape identifier within the given the json object
	 * @see https://www.codeandweb.com/physicseditor
	 * @returns {number} how many shapes were added to the body
	 * @example
	 * // define the body based on the banana shape
	 * this.body.fromJSON(me.loader.getJSON("shapesdef").banana);
	 * // or ...
	 * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
	 */
	fromJSON(json, id) {
		let data = json;

		if (typeof id !== "undefined") {
			data = json[id];
		}

		// Physic Editor Format (https://www.codeandweb.com/physicseditor)
		if (typeof data === "undefined") {
			throw new Error(
				"Identifier (" + id + ") undefined for the given JSON object)",
			);
		}

		if (data.length) {
			// go through all shapes and add them to the body
			for (let i = 0; i < data.length; i++) {
				this.addVertices(data[i].shape, i);
			}
			// apply density, friction and bounce properties from the first shape
			// Note : how to manage different mass or friction for all different shapes?
			this.mass = data[0].density || 0;
			this.friction.set(data[0].friction || 0, data[0].friction || 0);
			this.bounce = data[0].bounce || 0;
		}

		// return the amount of shapes added to the body
		return data.length;
	}

	/**
	 * return the collision shape at the given index
	 * @param {number} [index=0] - the shape object at the specified index
	 * @returns {Polygon|Line|Ellipse} shape a shape object if defined
	 */
	getShape(index) {
		return this.shapes[index || 0];
	}

	/**
	 * returns the AABB bounding box for this body
	 * @returns {Bounds} bounding box Rectangle object
	 */
	getBounds() {
		return this.bounds;
	}

	/**
	 * remove the specified shape from the body shape list
	 * @param {Polygon|Line|Ellipse} shape - a shape object
	 * @returns {number} the shape array length
	 */
	removeShape(shape) {
		// clear the current bounds
		this.bounds.clear();
		// remove the shape from shape list
		remove(this.shapes, shape);
		// add everything left back
		for (let s = 0; s < this.shapes.length; s++) {
			this.addShape(this.shapes[s]);
		}
		// return the length of the shape list
		return this.shapes.length;
	}

	/**
	 * remove the shape at the given index from the body shape list
	 * @param {number} index - the shape object at the specified index
	 * @returns {number} the shape array length
	 */
	removeShapeAt(index) {
		return this.removeShape(this.getShape(index));
	}

	/**
	 * By default all physic bodies are able to collide with all other bodies, <br>
	 * but it's also possible to specify 'collision filters' to provide a finer <br>
	 * control over which body can collide with each other.
	 * @see collision.types
	 * @param {number} [bitmask = collision.types.ALL_OBJECT] - the collision mask
	 * @example
	 * // filter collision detection with collision shapes, enemies and collectables
	 * body.setCollisionMask(me.collision.types.WORLD_SHAPE | me.collision.types.ENEMY_OBJECT | me.collision.types.COLLECTABLE_OBJECT);
	 * ...
	 * // disable collision detection with all other objects
	 * body.setCollisionMask(me.collision.types.NO_OBJECT);
	 */
	setCollisionMask(bitmask = collision.types.ALL_OBJECT) {
		this.collisionMask = bitmask;
	}

	/**
	 * define the collision type of the body for collision filtering
	 * @see collision.types
	 * @param {number} type - the collision type
	 * @example
	 * // set the body collision type
	 * body.collisionType = me.collision.types.PLAYER_OBJECT;
	 */
	setCollisionType(type) {
		if (typeof type !== "undefined") {
			if (typeof type === "string") {
				if (typeof collision.types[type] !== "undefined") {
					this.collisionType = collision.types[type];
				} else {
					throw new Error("Invalid value for the collisionType property");
				}
			} else if (typeof type === "number") {
				this.collisionType = type;
			} else {
				throw new Error("Invalid value for the collisionType property");
			}
		}
	}

	/**
	 * the built-in function to solve the collision response
	 * @param {ResponseObject} response - the collision response object
	 * @see {@link ResponseObject}
	 */
	respondToCollision(response) {
		// the overlap vector
		const overlap = response.overlapV;
		const overlapN = response.overlapN;

		// determine mass ratio: when both bodies are dynamic, split
		// the response proportionally to mass; otherwise apply full overlap
		const other = response.a === this.ancestor ? response.b : response.a;
		let ratio = 1;
		if (other && other.body && !other.body.isStatic) {
			const totalMass = this.mass + other.body.mass;
			ratio = totalMass > 0 ? other.body.mass / totalMass : 0.5;
		}

		// Move out of the other object shape
		this.ancestor.pos.set(
			this.ancestor.pos.x - overlap.x * ratio,
			this.ancestor.pos.y - overlap.y * ratio,
			this.ancestor.pos.z,
		);

		// cancel the velocity component along the collision normal
		const projVel = this.vel.x * overlapN.x + this.vel.y * overlapN.y;
		if (projVel > 0) {
			if (this.bounce > 0) {
				// reflect velocity along normal with bounce damping
				this.vel.x -= (1 + this.bounce) * projVel * ratio * overlapN.x;
				this.vel.y -= (1 + this.bounce) * projVel * ratio * overlapN.y;
			} else {
				// remove the velocity component along the collision normal
				this.vel.x -= projVel * ratio * overlapN.x;
				this.vel.y -= projVel * ratio * overlapN.y;
			}
		}

		if (overlap.y !== 0 && !this.ignoreGravity) {
			// cancel the falling an jumping flags if necessary
			const dir = this.falling === true ? 1 : this.jumping === true ? -1 : 0;
			this.falling = overlap.y >= dir;
			this.jumping = overlap.y <= -dir;
		}
	}

	/**
	 * The forEach() method executes a provided function once per body shape element. <br>
	 * the callback function is invoked with three arguments: <br>
	 *    - The current element being processed in the array <br>
	 *    - The index of element in the array. <br>
	 *    - The array forEach() was called upon. <br>
	 * @param {Function} callback - function to execute on each element
	 * @param {object} [thisArg] - value to use as this(i.e reference Object) when executing callback.
	 * @example
	 * // iterate through all shapes of the physic body
	 * mySprite.body.forEach((shape) => {
	 *    shape.doSomething();
	 * });
	 * mySprite.body.forEach((shape, index) => { ... });
	 * mySprite.body.forEach((shape, index, array) => { ... });
	 * mySprite.body.forEach((shape, index, array) => { ... }, thisArg);
	 */
	forEach(callback, thisArg) {
		let i = 0;
		const shapes = this.shapes;

		const len = shapes.length;

		if (typeof callback !== "function") {
			throw new Error(callback + " is not a function");
		}

		while (i < len) {
			callback.call(thisArg ?? this, shapes[i], i, shapes);
			i++;
		}
	}

	/**
	 * Returns true if the any of the shape composing the body contains the given point.
	 * @param {number|Vector2d} x -  x coordinate or a vector point to check
	 * @param {number} [y] -  y coordinate
	 * @returns {boolean} true if contains
	 * @example
	 * if (mySprite.body.contains(10, 10)) {
	 *   // do something
	 * }
	 * // or
	 * if (mySprite.body.contains(myVector2d)) {
	 *   // do something
	 * }
	 */
	contains(...args) {
		let _x;
		let _y;

		if (args.length === 2) {
			// x, y
			[_x, _y] = args;
		} else {
			// vector
			[_x, _y] = [args[0].x, args[0].y];
		}

		if (this.getBounds().contains(_x, _y)) {
			// cannot use forEach here as cannot break out with a return
			for (let i = this.shapes.length, shape; i--, (shape = this.shapes[i]); ) {
				if (shape.contains(_x, _y)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Rotate this body (counter-clockwise) by the specified angle (in radians).
	 * Unless specified the body will be rotated around its center point
	 * @param {number} angle - The angle to rotate (in radians)
	 * @param {Vector2d} [v=Body.getBounds().center] - an optional point to rotate around
	 * @returns {Body} Reference to this object for method chaining
	 */
	rotate(angle, v = this.getBounds().center) {
		if (angle !== 0) {
			this.bounds.clear();
			this.forEach((shape) => {
				shape.rotate(angle, v);
				this.bounds.addBounds(shape.getBounds());
				/*
                if (!(shape instanceof Ellipse)) {
                    // ellipse position is center
                    this.bounds.translate(shape.pos);
                }
                */
			});
			/*
            if (typeof this.onBodyUpdate === "function") {
                this.onBodyUpdate(this);
            }
            */
		}
		return this;
	}

	/**
	 * cap the body velocity (body.maxVel property) to the specified value<br>
	 * @param {number} x - max velocity on x axis
	 * @param {number} y - max velocity on y axis
	 */
	setMaxVelocity(x, y) {
		this.maxVel.x = x;
		this.maxVel.y = y;
	}

	/**
	 * set the body default friction
	 * @param {number} x - horizontal friction
	 * @param {number} y - vertical friction
	 */
	setFriction(x = 0, y = 0) {
		this.friction.x = x;
		this.friction.y = y;
	}

	/**
	 * Updates the parent's position as well as computes the new body's velocity based
	 * on the values of force/friction.  Velocity changes are proportional to the
	 * me.timer.tick value (which can be used to scale velocities).  The approach to moving the
	 * parent renderable is to compute new values of the Body.vel property then add them to
	 * the parent.pos value thus changing the position by the amount of Body.vel each time the
	 * update call is made. <br>
	 * Updates to Body.vel are bounded by maxVel (which defaults to viewport size if not set) <br>
	 * At this time a call to Body.Update does not call the onBodyUpdate callback that is listed in the constructor arguments.
	 * @protected
	 * @param {number} dt - time since the last update in milliseconds.
	 * @returns {boolean} true if resulting velocity is different than 0
	 */
	update() {
		// apply timer.tick to delta time for linear interpolation (when enabled)
		// #761 add delta time in body update
		const deltaTime = /* dt * */ timer.tick;

		// apply force if defined
		if (this.force.x !== 0) {
			this.vel.x += this.force.x * deltaTime;
		}
		if (this.force.y !== 0) {
			this.vel.y += this.force.y * deltaTime;
		}

		// apply friction if defined
		if (this.friction.x > 0) {
			const fx = this.friction.x * deltaTime;
			const nx = this.vel.x + fx;
			const x = this.vel.x - fx;

			this.vel.x = nx < 0 ? nx : x > 0 ? x : 0;
		}
		if (this.friction.y > 0) {
			const fy = this.friction.y * deltaTime;
			const ny = this.vel.y + fy;
			const y = this.vel.y - fy;

			this.vel.y = ny < 0 ? ny : y > 0 ? y : 0;
		}

		// cap velocity
		if (this.vel.y !== 0) {
			this.vel.y = clamp(this.vel.y, -this.maxVel.y, this.maxVel.y);
		}
		if (this.vel.x !== 0) {
			this.vel.x = clamp(this.vel.x, -this.maxVel.x, this.maxVel.x);
		}

		// check if falling / jumping
		this.falling = this.vel.y * Math.sign(this.force.y) > 0;
		this.jumping = this.falling ? false : this.jumping;

		// update the body ancestor position
		this.ancestor.pos.add(this.vel);

		// Angular integration — gated so bodies that never touch the
		// rotation API pay zero cost. The instant either `angle` or
		// `angularVelocity` becomes non-zero (via setAngle, setAngularVelocity,
		// applyTorque, or applyForce-with-offset) the branch fires until
		// both decay back to zero.
		if (this.angularVelocity !== 0 || this.angle !== 0) {
			if (this.angularDrag > 0 && this.angularVelocity !== 0) {
				// Exponential decay matching `frictionAir`'s linear behavior:
				// `omega *= (1 - drag)` each step. Negative drag is gated
				// out (treated as "off") so a typo can't accidentally
				// amplify rotation to infinity. Values > 1 still flip the
				// sign each step — a documented foot-gun, since clamping
				// would silently truncate a legitimate large damping value
				// like 1.5 (which makes physical sense as "overdamped").
				this.angularVelocity *= 1 - this.angularDrag;
			}
			this.angle += this.angularVelocity * deltaTime;
			this._syncAngleTransform();
		}

		// returns true if vel is different from 0
		return this.vel.x !== 0 || this.vel.y !== 0;
	}

	/**
	 * Destroy function<br>
	 * @ignore
	 */
	destroy() {
		// push back instance into object pool
		boundsPool.release(this.bounds);
		vector2dPool.release(this.vel);
		vector2dPool.release(this.force);
		vector2dPool.release(this.friction);
		vector2dPool.release(this.maxVel);
		this.shapes.forEach((shape) => {
			if (shape instanceof Point) {
				pointPool.release(shape);
			} else if (shape instanceof Line) {
				linePool.release(shape);
			} else if (shape instanceof Polygon) {
				polygonPool.release(shape);
			} else {
				pool.push(shape);
			}
		});

		// set to undefined
		this.onBodyUpdate = undefined;
		this.ancestor = undefined;
		this.bounds = undefined;
		this.vel = undefined;
		this.force = undefined;
		this.friction = undefined;
		this.maxVel = undefined;
		this.shapes.length = 0;

		// reset some variable to default
		this.setStatic(false);
	}
}
