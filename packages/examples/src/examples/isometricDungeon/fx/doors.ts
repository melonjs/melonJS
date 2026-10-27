/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, ParticleEmitter } from "melonjs";
import { FRAME_W, PARTICLES } from "../constants";
import { sparkTexture } from "./chests";

// how high the doorway's lintel is above its floor, in pixels
const LINTEL = 66;
// a wall's outward side on screen, below the horizontal: atan(1 / 2)
const OUTWARD = Math.atan2(1, 2);
const DUST = "#d9ccb2";

// The dust of a door swinging open, for a door tile at (x, y) whose doorway
// runs from `a` to `b` along its cell edge (Tiled units out of 64)
export function doorDust(
	app: Application,
	x: number,
	y: number,
	depth: number,
	facing: "N" | "W",
	[a, b]: readonly number[],
) {
	// the doorway's floor line, a diagonal on screen: from u = a to u = b,
	// (u, 224 + u / 2) on a north wall and mirrored on a west one
	const left = x + (facing === "N" ? a : FRAME_W - b);
	const width = b - a;
	const top = y + 224 + a / 2 - 1;
	const height = (b - a) / 2;

	// pushed out of the front of the doorway, rising slowly and thinning as
	// it spreads. A north wall faces down left on screen, a west one down
	// right (a particle's angle is counterclockwise, from the right)
	const cloud = new ParticleEmitter(left, top, {
		image: sparkTexture(),
		width,
		height,
		tint: DUST,
		totalParticles: 30,
		angle: facing === "N" ? Math.PI + OUTWARD : -OUTWARD,
		angleVariation: 0.8,
		speed: 0.6,
		speedVariation: 0.35,
		gravity: -0.004,
		minLife: 700,
		maxLife: 1300,
		minStartScale: 0.7,
		maxStartScale: 1.1,
		minEndScale: 2.0,
		maxEndScale: 2.8,
		autoDestroyOnComplete: true,
	});

	// and grit falling from the lintel, across the part of the arch that is
	// open all the way up (the near jamb hides the rest)
	const from = a + width / 3;
	const grit = new ParticleEmitter(
		x + (facing === "N" ? from : FRAME_W - b),
		y + 224 + from / 2 - LINTEL,
		{
			image: sparkTexture(),
			width: b - from,
			height: (b - from) / 2,
			tint: "#8f8170",
			totalParticles: 12,
			angle: -Math.PI / 2,
			angleVariation: 0.3,
			speed: 0.2,
			speedVariation: 0.15,
			gravity: 0.07,
			minLife: 450,
			maxLife: 750,
			minStartScale: 0.2,
			maxStartScale: 0.35,
			minEndScale: 0.15,
			maxEndScale: 0.25,
			autoDestroyOnComplete: true,
		},
	);

	for (const emitter of [cloud, grit]) {
		// an emitter sorts by the top of its spawn area, down on the floor,
		// far below the top of the door's image that everything here sorts
		// by: line it up with its door instead, a pixel lower so it is
		// drawn over it
		emitter.sortOffset = y + 1 - emitter.pos.y;
		emitter.visibilityLayer = PARTICLES;
		app.world.addChild(emitter, depth);
		emitter.burstParticles();
	}
}
