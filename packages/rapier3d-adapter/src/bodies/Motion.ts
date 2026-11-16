/**
 * Moving bodies in pixels: velocities, forces and torques for the frame, and
 * the speed caps (`maxVelocity`) Rapier has no notion of.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import type { Renderable } from "melonjs";
import { type XYZ, zOf } from "../math/units";
import type { Simulation } from "../Simulation";
import type { Vector3Like } from "../types";

export class Motion {
	/** each body's speed cap, per axis, in pixels per second */
	readonly limits = new Map<Renderable, Vector3Like>();
	private readonly sim: Simulation;
	/** bodies with a force or torque to clear once the frame is stepped */
	private readonly forced = new Set<RAPIER.RigidBody>();

	/**
	 * @param sim - the simulation whose bodies it moves
	 */
	constructor(sim: Simulation) {
		this.sim = sim;
	}

	/**
	 * Set a body's velocity in pixels per second; a `z` left out keeps the
	 * depth velocity.
	 * @param body - the body
	 * @param x - along X
	 * @param y - along Y
	 * @param [z] - along Z
	 */
	setVelocity(body: RAPIER.RigidBody, x: number, y: number, z?: number): void {
		const { units } = this.sim;
		body.setLinvel(
			{
				x: units.toMeters(x),
				y: units.toMeters(y),
				z: typeof z === "number" ? units.toMeters(z) : body.linvel().z,
			},
			true,
		);
	}

	/**
	 * Add a force for this frame, in pixels: at a world point, it also turns
	 * the body. A force or a point with no `z` acts in the plane of the body.
	 * @param body - the body
	 * @param force - the force
	 * @param [point] - where it pushes, in world pixels
	 */
	addForce(body: RAPIER.RigidBody, force: Vector3Like, point?: Vector3Like) {
		const f = this.sim.units.inMeters(force.x, force.y, zOf(force) ?? 0);
		if (point) {
			body.addForceAtPoint(f, this.pointInMeters(body, point), true);
		} else {
			body.addForce(f, true);
		}
		this.forced.add(body);
	}

	/**
	 * Add a torque for this frame: a number about Z, a vector about each axis.
	 * In Rapier's own unit (N·m), not scaled.
	 * @param body - the body
	 * @param torque - the torque
	 */
	addTorque(body: RAPIER.RigidBody, torque: number | Vector3Like): void {
		body.addTorque(
			typeof torque === "number"
				? { x: 0, y: 0, z: torque }
				: { x: torque.x, y: torque.y, z: torque.z ?? 0 },
			true,
		);
		this.forced.add(body);
	}

	/**
	 * A world point in meters; one with no depth is in the plane of the body.
	 * @param body - the body it acts on
	 * @param point - the point in world pixels
	 * @returns the point in meters
	 */
	pointInMeters(body: RAPIER.RigidBody, point: Vector3Like): XYZ {
		const { units } = this.sim;
		const z = point.z;
		return {
			x: units.toMeters(point.x),
			y: units.toMeters(point.y),
			z: typeof z === "number" ? units.toMeters(z) : body.translation().z,
		};
	}

	/** A force is for one frame, across every sub-step: clear them all. */
	clearForces(): void {
		for (const body of this.forced) {
			if (body.isValid()) {
				body.resetForces(false);
				body.resetTorques(false);
			}
		}
		this.forced.clear();
	}

	/** Hold every capped body to its cap. */
	clampVelocities(): void {
		const { units, bodies } = this.sim;
		for (const [renderable, limit] of this.limits) {
			const body = bodies.get(renderable);
			if (!body) continue;
			const v = body.linvel();
			const clamp = (value: number, px: number | undefined) => {
				// no cap on this axis; one that is not a number caps nothing
				// (it would turn the velocity itself into NaN)
				if (typeof px !== "number" || Number.isNaN(px)) return value;
				const m = units.toMeters(Math.abs(px));
				return Math.max(-m, Math.min(m, value));
			};
			const vx = clamp(v.x, limit.x);
			const vy = clamp(v.y, limit.y);
			const vz = clamp(v.z, limit.z);
			if (vx !== v.x || vy !== v.y || vz !== v.z) {
				body.setLinvel({ x: vx, y: vy, z: vz }, false);
			}
		}
	}

	/**
	 * Forget a body that left the world.
	 * @param renderable - its renderable
	 * @param body - the body
	 */
	forget(renderable: Renderable, body: RAPIER.RigidBody): void {
		this.forced.delete(body);
		this.limits.delete(renderable);
	}

	/** Forget every body. */
	clear(): void {
		this.forced.clear();
		this.limits.clear();
	}
}
