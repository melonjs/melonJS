import { Vector2d } from "../../math/vector2d.ts";
import state from "../../state/state.ts";
import Body from "./body.js";
import Detector from "./detector.js";

/**
 * @import Renderable from "../../renderable/renderable.js";
 * @import World from "../world.js";
 * @import { AdapterCapabilities, AdapterOptions, BodyDefinition, BodyShape, PhysicsAdapter } from "../adapter.ts";
 */

/**
 * Default {@link PhysicsAdapter} that wraps melonJS's native SAT-based
 * physics. Owns the active body set, the {@link Detector}, gravity, and
 * the simulation step. Returns the legacy {@link Body} class as its body
 * handle so existing property-based game code (`body.vel.x = 5`,
 * `body.isStatic = true`) keeps working unchanged.
 *
 * Instantiated by default during `Application` construction; user code
 * only touches this directly when explicitly wiring it via
 * `new Application(w, h, { physic: { adapter: new BuiltinAdapter() } })`.
 *
 * @implements {PhysicsAdapter}
 * @category Physics
 */
export default class BuiltinAdapter {
	/**
	 * Short adapter identifier exposed as `world.physic`. Lets user code
	 * branch on the active physics implementation without importing the
	 * concrete adapter class.
	 * @type {string}
	 * @default "builtin"
	 */
	physicLabel = "builtin";

	/**
	 * @param {AdapterOptions} [options]
	 */
	constructor(options = {}) {
		/**
		 * Advertised capabilities; user code may branch on these.
		 * @type {AdapterCapabilities}
		 */
		this.capabilities = {
			constraints: false,
			continuousCollisionDetection: false,
			sleepingBodies: false,
			raycasts: false,
			velocityLimit: true,
			isGrounded: true,
		};

		/**
		 * World gravity. Mutate to change at runtime.
		 * @type {Vector2d}
		 * @default <0, 0.98>
		 */
		this.gravity = options.gravity ?? new Vector2d(0, 0.98);

		/**
		 * Active physics bodies in this simulation.
		 * @type {Set<Body>}
		 */
		this.bodies = new Set();

		/**
		 * Collision detector instance, created in {@link init}.
		 * @type {Detector}
		 */
		this.detector = undefined;

		/**
		 * Back-reference to the owning world, set in {@link init}.
		 * @type {World}
		 * @private
		 */
		this.world = undefined;
	}

	/**
	 * Called once after the adapter is attached to a {@link World}.
	 * @param {World} world
	 */
	init(world) {
		this.world = world;
		this.detector = new Detector(world);
	}

	/**
	 * Release resources.
	 */
	destroy() {
		this.bodies.clear();
	}

	/**
	 * Advance the simulation by one frame.
	 * @param {number} dt - time since the last frame, in ms
	 */
	step(dt) {
		const isPaused = state.isPaused();
		// open the per-frame collision diff so the detector can synthesize
		// start/end events on top of SAT's frame-by-frame overlap reports
		this.detector.beginFrame();
		// iterate through all bodies
		for (const body of this.bodies) {
			const ancestor = body.ancestor;
			if (!body.isStatic && ancestor) {
				// if the game is not paused, and ancestor can be updated
				if (
					!(isPaused && !ancestor.updateWhenPaused) &&
					(ancestor.inViewport || ancestor.alwaysUpdate)
				) {
					this.applyGravity(body);
					if (body.update(dt) === true) {
						ancestor.isDirty = true;
					}
					this.detector.collisions(ancestor);
				}
			}
			// Always clear the force accumulator each step — even for static
			// bodies, out-of-viewport bodies, and paused bodies. Otherwise a
			// stray applyForce call would leak indefinitely and fire as a
			// surprise impulse when the body becomes simulatable again.
			body.force.set(0, 0);
		}
		// fire onCollisionEnd for pairs that separated this step
		this.detector.endFrame();
	}

	/**
	 * No-op: BuiltinAdapter mutates `renderable.pos` directly during
	 * {@link step} via `body.update(dt)`, so there is nothing to copy
	 * back after the step.
	 */
	syncFromPhysics() {
		// intentionally empty — see method docs
	}

	/**
	 * Register a body with the simulation. Returns the legacy `Body`
	 * class as the body handle; the field is also written to
	 * `renderable.body` so property-based code keeps working.
	 *
	 * Two entry points converge here:
	 * 1. Explicit (preferred): `world.adapter.addBody(this, { type: "dynamic", shapes: [...] })`
	 * 2. Legacy migration: `this.body = new Body(this, shapes)` already
	 *    created a body but it wasn't registered with the adapter yet;
	 *    we register the existing instance and map any supplied def
	 *    fields onto it.
	 *
	 * Pick ONE registration path per body. Calling `addBody` twice on
	 * the same renderable after it's already adapter-managed throws
	 * — the second call is a programming error.
	 *
	 * @param {Renderable} renderable
	 * @param {BodyDefinition} def
	 * @returns {Body}
	 * @throws {Error} if the renderable is already adapter-managed
	 */
	addBody(renderable, def) {
		let body = renderable.body;
		// Legacy bridge: an existing Body that the adapter doesn't
		// know about yet — register it. The same path catches direct
		// `new Body(...)` constructions that the user wants to migrate
		// to the adapter API without losing the existing instance.
		const isAlreadyAdapterManaged =
			body instanceof Body && this.bodies.has(body);
		if (isAlreadyAdapterManaged) {
			throw new Error(
				"BuiltinAdapter.addBody: renderable is already adapter-managed. " +
					"Use adapter.updateShape() / property mutation / adapter.removeBody() " +
					"first if you need to change the body.",
			);
		}
		if (!(body instanceof Body)) {
			body = new Body(renderable, def.shapes);
			renderable.body = body;
		} else if (Array.isArray(def.shapes) && def.shapes.length > 0) {
			// legacy-bridge path: replace existing shapes if the def
			// provides them (otherwise keep what the user already built)
			body.shapes.length = 0;
			body.getBounds().clear();
			for (const s of def.shapes) {
				body.addShape(s);
			}
		}
		// map portable BodyDefinition fields onto Body properties
		body.setStatic(def.type === "static");
		if (typeof def.collisionType === "number") {
			body.collisionType = def.collisionType;
		}
		if (typeof def.collisionMask === "number") {
			body.collisionMask = def.collisionMask;
		}
		if (def.frictionAir !== undefined) {
			if (typeof def.frictionAir === "number") {
				body.setFriction(def.frictionAir, def.frictionAir);
			} else {
				body.setFriction(def.frictionAir.x, def.frictionAir.y);
			}
		}
		if (typeof def.restitution === "number") {
			body.bounce = def.restitution;
		}
		if (typeof def.density === "number") {
			body.mass = def.density;
		}
		if (typeof def.gravityScale === "number") {
			body.gravityScale = def.gravityScale;
		}
		if (def.maxVelocity !== undefined) {
			body.setMaxVelocity(def.maxVelocity.x, def.maxVelocity.y);
		}
		if (def.isSensor === true) {
			body.isSensor = true;
		}
		this.bodies.add(body);
		return body;
	}

	/**
	 * Unregister a body. Called when the renderable leaves the world.
	 * @param {Renderable} renderable
	 */
	removeBody(renderable) {
		const body = renderable.body;
		if (body instanceof Body) {
			this.bodies.delete(body);
		}
	}

	/**
	 * Replace the body's collision geometry without re-creating the body.
	 * @param {Renderable} renderable
	 * @param {BodyShape[]} shapes
	 */
	updateShape(renderable, shapes) {
		const body = renderable.body;
		if (!(body instanceof Body)) {
			return;
		}
		// clear existing shapes, then add new ones
		body.shapes.length = 0;
		body.getBounds().clear();
		for (const s of shapes) {
			body.addShape(s);
		}
	}

	/**
	 * @param {Renderable} renderable
	 * @param {Vector2d} [out]
	 * @returns {Vector2d}
	 */
	getVelocity(renderable, out) {
		const body = renderable.body;
		const target = out ?? new Vector2d();
		// after removeBody the body reference may still dangle on the
		// renderable — return zero so the behaviour matches adapters that
		// fully forget the body (e.g. MatterAdapter clears its bodyMap).
		if (!body || !this.bodies.has(body)) {
			return target.set(0, 0);
		}
		return target.set(body.vel.x, body.vel.y);
	}

	/**
	 * @param {Renderable} renderable
	 * @param {Vector2d} v
	 */
	setVelocity(renderable, v) {
		renderable.body.vel.setV(v);
	}

	/**
	 * @param {Renderable} renderable
	 * @param {Vector2d} force
	 * @param {Vector2d} [point] - world point at which the force is applied;
	 *   when provided and different from the body's centroid, the resulting
	 *   lever arm generates a torque that contributes to
	 *   {@link Body#angularVelocity} via {@link Body#applyForce}'s
	 *   4-argument form. Omit for pure linear force (legacy behavior).
	 */
	applyForce(renderable, force, point) {
		// Delegate to Body so the lever-arm → torque computation lives in
		// one place. The 2-arg call (no point) preserves the pre-angular
		// behavior exactly: just accumulate into the linear force vector.
		if (point) {
			renderable.body.applyForce(force.x, force.y, point.x, point.y);
		} else {
			renderable.body.applyForce(force.x, force.y);
		}
	}

	/**
	 * @param {Renderable} renderable
	 * @param {Vector2d} impulse
	 */
	applyImpulse(renderable, impulse) {
		// impulse = mass * dv  →  dv = impulse / mass
		const body = renderable.body;
		const invMass = body.mass > 0 ? 1 / body.mass : 0;
		body.vel.x += impulse.x * invMass;
		body.vel.y += impulse.y * invMass;
	}

	/**
	 * @param {Renderable} renderable
	 * @param {Vector2d} p
	 */
	setPosition(renderable, p) {
		// `pos` is an ObservableVector3d on Renderable; preserve the
		// existing Z (`pos.z` is the depth field, set independently).
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
	}

	/**
	 * Set absolute body rotation angle (radians). Under BuiltinAdapter
	 * the rotation is **visual only** — SAT collisions remain
	 * axis-aligned against the original shapes — but the renderable's
	 * `currentTransform` is updated so the sprite rotates correctly.
	 * @param {Renderable} renderable
	 * @param {number} angle
	 */
	setAngle(renderable, angle) {
		renderable.body.setAngle(angle);
	}

	/**
	 * Read body rotation angle (radians).
	 * @param {Renderable} renderable
	 * @returns {number}
	 */
	getAngle(renderable) {
		return renderable.body.angle;
	}

	/**
	 * Set body angular velocity (rad / frame). The next call to
	 * {@link Body#update} integrates it into the body's angle and
	 * re-syncs the renderable's transform.
	 * @param {Renderable} renderable
	 * @param {number} omega
	 */
	setAngularVelocity(renderable, omega) {
		renderable.body.setAngularVelocity(omega);
	}

	/**
	 * Read body angular velocity (rad / frame).
	 * @param {Renderable} renderable
	 * @returns {number}
	 */
	getAngularVelocity(renderable) {
		return renderable.body.angularVelocity;
	}

	/**
	 * Apply an angular impulse to the body: `Δω = τ / pseudoInertia`.
	 * @param {Renderable} renderable
	 * @param {number} torque
	 */
	applyTorque(renderable, torque) {
		renderable.body.applyTorque(torque);
	}

	/**
	 * @param {Renderable} renderable
	 * @param {boolean} isStatic
	 */
	setStatic(renderable, isStatic) {
		renderable.body.setStatic(isStatic);
	}

	/**
	 * @param {Renderable} renderable
	 * @param {number} scale
	 */
	setGravityScale(renderable, scale) {
		renderable.body.gravityScale = scale;
	}

	/**
	 * @param {Renderable} renderable
	 * @param {number | {x: number, y: number}} friction
	 */
	setFrictionAir(renderable, friction) {
		const body = renderable.body;
		if (typeof friction === "number") {
			body.setFriction(friction, friction);
		} else {
			body.setFriction(friction.x, friction.y);
		}
	}

	/**
	 * @param {Renderable} renderable
	 * @param {{x: number, y: number}} limit
	 */
	setMaxVelocity(renderable, limit) {
		renderable.body.setMaxVelocity(limit.x, limit.y);
	}

	/**
	 * @param {Renderable} renderable
	 * @returns {{x: number, y: number}}
	 */
	getMaxVelocity(renderable) {
		const v = renderable.body.maxVel;
		return { x: v.x, y: v.y };
	}

	/**
	 * @param {Renderable} renderable
	 * @param {number} type
	 */
	setCollisionType(renderable, type) {
		renderable.body.collisionType = type;
	}

	/**
	 * @param {Renderable} renderable
	 * @param {number} mask
	 */
	setCollisionMask(renderable, mask) {
		renderable.body.setCollisionMask(mask);
	}

	/**
	 * Toggle a body between solid and sensor mode. A sensor body still
	 * fires collision events (`onCollisionStart` / `onCollisionActive` /
	 * `onCollisionEnd`) — the SAT detector skips only the positional
	 * push-out (`respondToCollision`). Same semantics as Matter's
	 * `isSensor`, so adapter-agnostic trigger / one-way-platform code
	 * behaves identically on both adapters.
	 * @param {Renderable} renderable
	 * @param {boolean} isSensor
	 */
	setSensor(renderable, isSensor) {
		renderable.body.isSensor = isSensor;
	}

	/**
	 * Adapter-side debug surface: the body's AABB in renderable-local
	 * coordinates. Builtin Body already stores its bounds in local space,
	 * so we just copy into the caller's `out`.
	 * @param {Renderable} renderable
	 * @param {import("../bounds.ts").Bounds} out
	 * @returns {import("../bounds.ts").Bounds | undefined}
	 */
	getBodyAABB(renderable, out) {
		const body = renderable.body;
		if (body === undefined) {
			return undefined;
		}
		const b = body.bounds;
		out.setMinMax(b.min.x, b.min.y, b.max.x, b.max.y);
		return out;
	}

	/**
	 * Adapter-side debug surface: the body's collision shapes in
	 * renderable-local coordinates. Returned array is the body's live
	 * `shapes` list — read-only, callers must not mutate.
	 * @param {Renderable} renderable
	 * @returns {ReadonlyArray<import("../adapter.ts").BodyShape>}
	 */
	getBodyShapes(renderable) {
		return renderable.body?.shapes ?? [];
	}

	/**
	 * Whether the body has at least one active downward-facing contact.
	 * BuiltinAdapter derives this from the SAT body's `falling` flag,
	 * which is updated by the detector each frame: a body is grounded
	 * when it's not currently moving downward off a surface.
	 * @param {Renderable} renderable
	 * @returns {boolean}
	 */
	isGrounded(renderable) {
		const body = renderable.body;
		return !body.falling && !body.jumping;
	}

	/**
	 * Apply gravity to the given body. Backward-compat shim for the
	 * legacy `World.bodyApplyGravity` method.
	 * @param {Body} body
	 */
	applyGravity(body) {
		// `ignoreGravity` is deprecated in favor of `gravityScale = 0`
		// (see Body#ignoreGravity JSDoc). Keep both checks until the
		// legacy field is removed — `gravityScale = 0` is the portable
		// path that also works under matter; `ignoreGravity = true` is
		// the legacy path that only this adapter reads.
		if (body.gravityScale !== 0 && !body.ignoreGravity) {
			body.force.x += body.mass * this.gravity.x * body.gravityScale;
			body.force.y += body.mass * this.gravity.y * body.gravityScale;
		}
	}
}
