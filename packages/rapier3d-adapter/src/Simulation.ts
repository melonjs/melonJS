/**
 * What every part of the adapter shares: the Rapier module, the units, the
 * Rapier world, and which body and colliders each renderable has.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import type { Renderable } from "melonjs";
import type { ColliderEntry } from "./colliders/types";
import type { Units } from "./math/units";

export class Simulation {
	readonly rapier: typeof RAPIER;
	readonly units: Units;
	/** The Rapier world: made by {@link open}, freed by {@link close}. */
	world!: RAPIER.World;
	/** true between {@link open} and {@link close}: the Rapier world exists */
	alive = false;

	/** each renderable's body */
	readonly bodies = new Map<Renderable, RAPIER.RigidBody>();
	/** each renderable's colliders, one per active shape */
	readonly collidersOf = new Map<Renderable, RAPIER.Collider[]>();
	/** collider handle -> its renderable, shape and box */
	readonly colliders = new Map<number, ColliderEntry>();

	/**
	 * @param rapier - the loaded Rapier module
	 * @param units - the scale between pixels and meters
	 */
	constructor(rapier: typeof RAPIER, units: Units) {
		this.rapier = rapier;
		this.units = units;
	}

	/**
	 * Make the Rapier world.
	 * @param gravity - its gravity, in meters per second²
	 */
	open(gravity: RAPIER.Vector) {
		this.world = new this.rapier.World(gravity);
		this.alive = true;
	}

	/** Free the Rapier world, and forget every body and collider. */
	close() {
		this.alive = false;
		// Rapier's objects live in WebAssembly memory, which the garbage
		// collector does not reclaim: they are freed here
		this.world.free();
		this.bodies.clear();
		this.collidersOf.clear();
		this.colliders.clear();
	}
}
