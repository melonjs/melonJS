/**
 * The portable `PhysicsBody` helpers, spliced onto a Rapier body so that
 * `renderable.body.setVelocity(x, y, z)` works as on every adapter. The body
 * stays a real `RAPIER.RigidBody`, with all its own methods.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsBody, Renderable, Vector2d, Vector3d } from "melonjs";
import type { CollisionFilters } from "../colliders/CollisionFilters";
import type { Rapier3dAdapter } from "../Rapier3dAdapter";
import type { Simulation } from "../Simulation";
import type { Motion } from "./Motion";
import type { RuntimeOverrides } from "./RuntimeOverrides";

/** what the helpers act through */
export interface HelperContext {
	adapter: Rapier3dAdapter;
	sim: Simulation;
	motion: Motion;
	filters: CollisionFilters;
	overrides: RuntimeOverrides;
}

/**
 * Splice the helpers onto a body.
 * @param ctx - what they act through
 * @param renderable - the body's renderable
 * @param body - the Rapier body
 * @param colliders - its colliders: the live list, which `updateShape()`
 * refills in place
 */
export function spliceHelpers(
	ctx: HelperContext,
	renderable: Renderable,
	body: RAPIER.RigidBody,
	colliders: RAPIER.Collider[],
): void {
	const { adapter, sim, motion, filters, overrides } = ctx;
	const proto = sim.rapier.RigidBody.prototype;
	const helpers: Omit<PhysicsBody, "collisionType" | "collisionMask"> = {
		setVelocity: (x: number, y: number, z?: number) => {
			motion.setVelocity(body, x, y, z);
		},
		getVelocity: (out?: Vector2d): Vector2d => {
			return adapter.getVelocity(renderable, out);
		},
		getVelocity3d: (out?: Vector3d): Vector3d => {
			return adapter.getVelocity3d(renderable, out);
		},
		applyForce: (x: number, y: number, pointX?: number, pointY?: number) => {
			motion.addForce(
				body,
				{ x, y },
				typeof pointX === "number" && typeof pointY === "number"
					? { x: pointX, y: pointY }
					: undefined,
			);
		},
		applyImpulse: (x: number, y: number, z?: number) => {
			// Rapier's own method, which this helper is spliced over
			proto.applyImpulse.call(body, sim.units.inMeters(x, y, z ?? 0), true);
		},
		setSensor: (isSensor = true) => {
			adapter.setSensor(renderable, isSensor);
		},
		setStatic: (isStatic = true) => {
			adapter.setStatic(renderable, isStatic);
		},
		setCollisionMask: (mask: number) => {
			adapter.setCollisionMask(renderable, mask);
		},
		setCollisionType: (type: number) => {
			adapter.setCollisionType(renderable, type);
		},
		/**
		 * Set the body's mass, keeping how it is spread over its shapes: every
		 * collider's density is scaled by the same factor.
		 * @param m - the new mass, in kilograms
		 */
		setMass: (m: number) => {
			const current = body.mass();
			if (current > 0) {
				const k = m / current;
				for (const collider of colliders) {
					collider.setDensity(collider.density() * k);
				}
				body.recomputeMassPropertiesFromColliders();
			}
		},
		setBounce: (r: number) => {
			overrides.of(renderable).restitution = r;
			for (const collider of colliders) {
				collider.setRestitution(r);
			}
		},
		setGravityScale: (scale: number) => {
			adapter.setGravityScale(renderable, scale);
		},
		setAngle: (rad: number) => {
			adapter.setAngle(renderable, rad);
		},
		getAngle: () => {
			return adapter.getAngle(renderable);
		},
		setAngularVelocity: (omega: number) => {
			adapter.setAngularVelocity(renderable, omega);
		},
		getAngularVelocity: () => {
			return adapter.getAngularVelocity(renderable);
		},
		applyTorque: (torque: number) => {
			adapter.applyTorque(renderable, torque);
		},
	};
	Object.assign(body, helpers);

	// `collisionType` / `collisionMask` read the first collider's values and
	// write every collider's, as on the 2D adapters
	const first = () => {
		return colliders[0] as RAPIER.Collider | undefined;
	};
	Object.defineProperties(body, {
		collisionType: {
			get: () => {
				const c = first();
				return c ? (filters.get(c.handle)?.category ?? 0) : 0;
			},
			set: (v: number) => {
				adapter.setCollisionType(renderable, v);
			},
			configurable: true,
			enumerable: true,
		},
		collisionMask: {
			get: () => {
				const c = first();
				return c ? (filters.get(c.handle)?.mask ?? 0) : 0;
			},
			set: (v: number) => {
				adapter.setCollisionMask(renderable, v);
			},
			configurable: true,
			enumerable: true,
		},
	});
}
