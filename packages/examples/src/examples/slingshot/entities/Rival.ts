/**
 * melonJS — Slingshot: a rival, one of the animals perched on the towers.
 *
 * Its body is the `ConvexHull3d` of its own model, so it tumbles as the
 * shape it is drawn. It is knocked out when it lands on the ground or is
 * struck hard, which its `onCollisionStart` hook tells from the speed of the
 * two bodies (`getVelocity3d`).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
import {
	type CollisionResponse,
	ConvexHull3d,
	Mesh,
	type Renderable,
	Tween,
	Vector3d,
} from "melonjs";
import { AXIS_Y, GROUND_Y, KNOCKOUT_SPEED, RIVAL_SIZE } from "../constants";
import type { Perch } from "./towers";

/** what a rival needs from the round it plays in */
export interface RivalHost {
	adapter: Rapier3dAdapter;
	// landing on this knocks a rival out
	ground: Renderable;
	knockOut(rival: Rival): void;
}

// scratch velocities, shared by every rival
const velocityA = new Vector3d();
const velocityB = new Vector3d();

export class Rival extends Mesh {
	private readonly host: RivalHost;

	/**
	 * @param name - the Kenney animal's model
	 * @param perch - where on the towers it sits
	 * @param host - the round it plays in
	 */
	constructor(name: string, perch: Perch, host: RivalHost) {
		super(perch.x, perch.y, {
			model: name,
			// its texture is the one its material names
			material: name,
			width: RIVAL_SIZE,
			height: RIVAL_SIZE,
			lit: true,
			castGroundShadow: true,
			shadowGroundY: GROUND_Y,
		});
		this.host = host;
		this.name = name;
		// facing the slingshot, turned a little toward the camera
		this.rotate((Math.PI * 4) / 3, AXIS_Y);
		this.bodyDef = {
			type: "dynamic",
			shapes: [ConvexHull3d.fromMesh(this)],
			density: 1,
			friction: 0.6,
		};
	}

	/**
	 * Out once it lands on the ground, or is struck hard.
	 * @param _response - the contact
	 * @param other - what it touched
	 */
	onCollisionStart(_response: CollisionResponse, other: Renderable) {
		if (
			other === this.host.ground ||
			this.speedAgainst(other) >= KNOCKOUT_SPEED
		) {
			this.host.knockOut(this);
		}
	}

	/** A red flash, then it fades away and leaves the field. */
	fadeOut() {
		this.tint.setColor(255, 120, 120);
		new Tween(this)
			.to({ alpha: 0 }, { duration: 450, delay: 150 })
			.onComplete(() => {
				this.ancestor?.removeChild(this);
			})
			.start();
	}

	/**
	 * How fast it and `other` meet: the distance between their velocities.
	 * @param other - the body it touched
	 * @returns a speed, in pixels per second
	 */
	private speedAgainst(other: Renderable) {
		const { adapter } = this.host;
		return adapter
			.getVelocity3d(this, velocityA)
			.distance(adapter.getVelocity3d(other, velocityB));
	}
}
