/**
 * melonJS — Slingshot: the dotted arc a pet will fly along, shown while it
 * is pulled back.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Mesh, type Vector3d, type World } from "melonjs";
import { GRAVITY } from "../constants";

const DOTS = 18;
// the time between two dots along the flight, in seconds
const STEP = 0.05;

export class AimArc {
	private readonly dots: Mesh[];

	/**
	 * Add the dots to the world, hidden.
	 * @param world - the game world
	 */
	constructor(world: World) {
		this.dots = Array.from({ length: DOTS }, () => {
			// no texture: a mesh without one is plain white
			const dot = new Mesh(0, 0, {
				model: "sphere",
				width: 9,
				height: 9,
				castGroundShadow: false,
			});
			dot.alpha = 0;
			world.addChild(dot, 0);
			return dot;
		});
	}

	/**
	 * Show the arc from `from`, for a launch at `velocity`.
	 * @param from - where the pet leaves from
	 * @param velocity - its launch velocity
	 */
	show(from: Vector3d, velocity: Vector3d) {
		this.dots.forEach((dot, i) => {
			// where it is after t seconds under gravity alone
			const t = (i + 1) * STEP;
			dot.pos.set(
				from.x + velocity.x * t,
				from.y + velocity.y * t + 0.5 * GRAVITY * t * t,
			);
			dot.depth = from.z + velocity.z * t;
			// fading along the flight
			dot.alpha = 0.85 - i * 0.04;
		});
	}

	/** Hide the arc. */
	hide() {
		for (const dot of this.dots) {
			dot.alpha = 0;
		}
	}
}
