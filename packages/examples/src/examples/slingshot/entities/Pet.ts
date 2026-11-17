/**
 * melonJS — Slingshot: a pet, one of the animals the player launches.
 *
 * It waits in the pouch as a static body, moved by hand while it is pulled;
 * launching it makes it dynamic (`setStatic(false)`) and sends it off with
 * `setVelocity` and `setAngularVelocity`, with Rapier's continuous collision
 * on so a fast pet cannot pass through a thin plank.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
import { ConvexHull3d, Mesh, math, Vector3d } from "melonjs";
import { AXIS_Y, GROUND_Y, PET_SIZE } from "../constants";

export class Pet extends Mesh {
	/**
	 * @param name - the Kenney animal's model
	 * @param x - where it stands, along X
	 * @param y - where it stands, along Y
	 */
	constructor(name: string, x: number, y: number) {
		super(x, y, {
			model: name,
			// its texture is the one its material names
			material: name,
			width: PET_SIZE,
			height: PET_SIZE,
			lit: true,
			castGroundShadow: true,
			shadowGroundY: GROUND_Y,
		});
		this.name = name;
		// facing the towers, turned a little toward the camera
		this.rotate((Math.PI * 2) / 3, AXIS_Y);
	}

	/**
	 * Give the pet its body, for the pouch: static, so it stays where it is
	 * put until it is launched.
	 */
	readyForPouch() {
		this.bodyDef = {
			type: "static",
			// the model's own outline, as it is turned and scaled
			shapes: [ConvexHull3d.fromMesh(this)],
			// the elephant hits hardest
			density: this.name === "animal-elephant" ? 6 : 2.5,
			friction: 0.6,
			restitution: 0.15,
		};
	}

	/**
	 * Send the pet flying.
	 * @param adapter - the physics adapter its body lives in
	 * @param velocity - its launch velocity
	 */
	launch(adapter: Rapier3dAdapter, velocity: Vector3d) {
		adapter.setStatic(this, false);
		(this.body as Rapier3dAdapter.Body).enableCcd(true);
		adapter.setVelocity(this, velocity);
		// a forward roll about the axis across the shot, and a little twist
		const across = Math.hypot(velocity.x, velocity.z) || 1;
		adapter.setAngularVelocity(
			this,
			new Vector3d(
				(-velocity.z / across) * 6,
				math.randomFloat(-1.5, 1.5),
				(velocity.x / across) * 6,
			),
		);
	}
}
