/**
 * The joints `world.addJoint()` makes between bodies.
 *
 * A `"hinge"` is a Rapier revolute joint about `axis` (default Z), a `"rope"`
 * a rope joint, a `"weld"` a fixed joint and a `"slider"` a prismatic joint
 * along `axis` (default X). The bodies are joined as they stand, however each
 * is turned: a weld and a slider keep the turn between them, and a hinge
 * leaves them only the turn about its axis.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3d } from "melonjs";
import type { XYZ } from "../math/units";
import type { Simulation } from "../Simulation";
import type { Rapier3dJointDefinition, Vector3Like } from "../types";

const NO_TURN = { x: 0, y: 0, z: 0, w: 1 };

export class Joints {
	private readonly sim: Simulation;
	/** the joints made here that are still alive */
	private readonly made = new Set<RAPIER.ImpulseJoint>();

	/**
	 * @param sim - the simulation whose bodies it joins
	 */
	constructor(sim: Simulation) {
		this.sim = sim;
	}

	/**
	 * Make a joint between two bodies. Anchors are in each renderable's own
	 * space, relative to its `pos`, in pixels, and the axis in `a`'s; a `z`
	 * left out is `0`.
	 * @param def - what to join, and how, in pixels and radians
	 * @returns the Rapier joint
	 */
	add(def: Rapier3dJointDefinition): RAPIER.ImpulseJoint {
		const { bodies, rapier, units, world } = this.sim;
		const bodyA = bodies.get(def.a);
		const bodyB = bodies.get(def.b);
		if (bodyA === undefined || bodyB === undefined) {
			throw new Error(
				"@melonjs/rapier3d-adapter: addJoint() needs both renderables to have a body in the world; add them with addChild() first.",
			);
		}
		const { JointData } = rapier;
		const anchorB = this.localAnchor(def.anchorB);
		// no anchor on `a`: the point of `a` under b's anchor, so nothing moves
		// when the joint is made; a rope joins the two centres
		const anchorA =
			def.anchorA === undefined && def.type !== "rope"
				? localPoint(bodyA, worldPoint(bodyB, anchorB))
				: this.localAnchor(def.anchorA);
		// the defaults resolved here are written back, so the same joint is
		// made again when the world rebuilds it
		def.anchorA ??= {
			x: units.toPixels(anchorA.x),
			y: units.toPixels(anchorA.y),
			z: units.toPixels(anchorA.z),
		};
		def.anchorB ??= { x: 0, y: 0, z: 0 };
		// the turn that brings b's space onto a's, as the two stand
		const aInB = turnOf(bodyB).invert().multiply(turnOf(bodyA));

		let data: RAPIER.JointData;
		switch (def.type) {
			case "hinge": {
				// the same axis in the world, in each body's own space: the same
				// vector in both when they are turned alike, or apart about the
				// axis only, as a 2D hinge is
				const axis = unitAxis(def.axis, { x: 0, y: 0, z: 1 });
				data = JointData.revoluteWithAxes(
					anchorA,
					anchorB,
					axis,
					aInB.apply(new Vector3d(axis.x, axis.y, axis.z)),
				);
				break;
			}
			case "rope": {
				if (def.maxLength === undefined) {
					const pa = worldPoint(bodyA, anchorA);
					const pb = worldPoint(bodyB, anchorB);
					def.maxLength = units.toPixels(
						Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z),
					);
				}
				data = JointData.rope(units.toMeters(def.maxLength), anchorA, anchorB);
				break;
			}
			case "weld":
				// welded as they stand: A's frame is A, B's frame is the turn
				// that brings B onto A
				data = JointData.fixed(anchorA, NO_TURN, anchorB, aInB);
				break;
			case "slider":
				data = JointData.prismatic(
					anchorA,
					anchorB,
					unitAxis(def.axis, { x: 1, y: 0, z: 0 }),
				);
				break;
			default:
				throw new Error(
					`@melonjs/rapier3d-adapter: unknown joint type "${String((def as { type: unknown }).type)}"; use "hinge", "rope", "weld" or "slider".`,
				);
		}

		const joint = world.createImpulseJoint(data, bodyA, bodyB, true);
		if (def.type === "slider") {
			// Rapier gives both bodies the same frame, which would turn b onto
			// a: b's frame is a's as b sees it, so b keeps its turn
			const frame = joint.frameX1();
			joint.setFrameX2(
				aInB
					.clone()
					.multiply(new Quaternion(frame.x, frame.y, frame.z, frame.w)),
			);
		}
		joint.setContactsEnabled(def.collideConnected === true);
		if (
			def.limits !== undefined &&
			(def.type === "hinge" || def.type === "slider")
		) {
			// radians for a hinge, meters along the axis for a slider
			const scale = def.type === "slider" ? 1 / units.pixelsPerMeter : 1;
			(joint as RAPIER.UnitImpulseJoint).setLimits(
				def.limits.min * scale,
				def.limits.max * scale,
			);
		}
		this.made.add(joint);
		return joint;
	}

	/**
	 * Remove a joint made here. A joint already gone, with one of its bodies,
	 * is ignored.
	 * @param joint - the Rapier joint
	 */
	remove(joint: RAPIER.ImpulseJoint): void {
		if (this.made.delete(joint) && joint.isValid()) {
			this.sim.world.removeImpulseJoint(joint, true);
		}
	}

	/**
	 * Forget the joints of a body about to be removed: Rapier removes them
	 * with it.
	 * @param body - the body
	 */
	forgetJointsOf(body: RAPIER.RigidBody): void {
		for (const joint of this.made) {
			if (
				!joint.isValid() ||
				joint.body1().handle === body.handle ||
				joint.body2().handle === body.handle
			) {
				this.made.delete(joint);
			}
		}
	}

	/** Forget every joint. */
	clear(): void {
		this.made.clear();
	}

	/**
	 * A joint anchor in pixels as a point on its body in meters. No anchor is
	 * the body's origin, its renderable's `pos`.
	 * @param anchor - the anchor in pixels, or undefined
	 * @returns the body-local anchor
	 */
	private localAnchor(anchor?: Vector3Like): XYZ {
		if (anchor === undefined) {
			return { x: 0, y: 0, z: 0 };
		}
		return this.sim.units.inMeters(anchor.x, anchor.y, anchor.z ?? 0);
	}
}

/**
 * A joint axis as a unit vector, or the default for a missing one.
 * @param axis - the axis given, if any
 * @param fallback - the default
 * @returns a unit vector
 * @throws {Error} for a zero or non-finite axis
 */
function unitAxis(axis: Vector3Like | undefined, fallback: XYZ): XYZ {
	if (axis === undefined) {
		return fallback;
	}
	const z = axis.z ?? 0;
	const length = Math.hypot(axis.x, axis.y, z);
	if (!(length > 0) || !Number.isFinite(length)) {
		throw new Error(
			"@melonjs/rapier3d-adapter: a joint axis needs a length; got a zero or non-finite vector.",
		);
	}
	return { x: axis.x / length, y: axis.y / length, z: z / length };
}

/**
 * A world point as a point on a body, both in meters.
 * @param body - the body
 * @param world - the point in the world
 * @returns the point on the body
 */
function localPoint(body: RAPIER.RigidBody, world: XYZ): XYZ {
	const t = body.translation();
	return turnOf(body).applyInverse(
		new Vector3d(world.x - t.x, world.y - t.y, world.z - t.z),
	);
}

/**
 * A body-local point in world space, both in meters.
 * @param body - the body
 * @param local - the point on the body
 * @returns the point in the world
 */
function worldPoint(body: RAPIER.RigidBody, local: XYZ): XYZ {
	const t = body.translation();
	const p = turnOf(body).apply(new Vector3d(local.x, local.y, local.z));
	return { x: t.x + p.x, y: t.y + p.y, z: t.z + p.z };
}

/**
 * A body's turn, as a quaternion of its own.
 * @param body - the body
 * @returns a new quaternion
 */
function turnOf(body: RAPIER.RigidBody): Quaternion {
	const q = body.rotation();
	return new Quaternion(q.x, q.y, q.z, q.w);
}
