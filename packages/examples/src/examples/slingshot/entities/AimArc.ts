/**
 * melonJS — Slingshot: the dotted arc a pet will fly along, shown while it
 * is pulled back.
 *
 * The dots are one `InstancedMesh`: one sphere drawn many times in a single
 * call, each copy placed by its own transform and faded by its own colour.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Color,
	InstancedMesh,
	Matrix3d,
	type Vector3d,
	type World,
} from "melonjs";
import { GRAVITY } from "../constants";

const DOTS = 18;
// the time between two dots along the flight, in seconds
const STEP = 0.05;

export class AimArc {
	private readonly dots: InstancedMesh;
	private readonly placement = new Matrix3d();

	/**
	 * Add the dots to the world, hidden.
	 * @param world - the game world
	 */
	constructor(world: World) {
		// no texture: a mesh without one is plain white
		this.dots = new InstancedMesh(0, 0, {
			model: "sphere",
			width: 9,
			height: 9,
			instanceCount: DOTS,
			instanceColors: true,
			// the fade is in each instance's colour, which the automatic
			// check (the mesh's own alpha) cannot see: blend them all
			transparent: true,
			castGroundShadow: false,
		});
		// fading along the flight, the same every time it is shown
		const fade = new Color();
		for (let i = 0; i < DOTS; i++) {
			this.dots.setInstanceColor(
				i,
				fade.setColor(255, 255, 255, 0.85 - i * 0.04),
			);
		}
		this.dots.alpha = 0;
		world.addChild(this.dots, 0);
	}

	/**
	 * Show the arc from `from`, for a launch at `velocity`.
	 * @param from - where the pet leaves from
	 * @param velocity - its launch velocity
	 */
	show(from: Vector3d, velocity: Vector3d) {
		// an instance is placed in the mesh's own space: world units divided
		// by its scale, Y up (the group sits at the world's origin)
		const s = this.dots.meshScale;
		for (let i = 0; i < DOTS; i++) {
			// where it is after t seconds under gravity alone
			const t = (i + 1) * STEP;
			this.placement
				.identity()
				.translate(
					(from.x + velocity.x * t) / s,
					-(from.y + velocity.y * t + 0.5 * GRAVITY * t * t) / s,
					(from.z + velocity.z * t) / s,
				);
			this.dots.setInstance(i, this.placement);
		}
		this.dots.alpha = 1;
	}

	/** Hide the arc. */
	hide() {
		this.dots.alpha = 0;
	}
}
