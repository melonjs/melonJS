/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Container,
	Light2d,
	math,
	type TMXObject,
	timer,
	Vector2d,
} from "melonjs";
import {
	FRAME_H,
	FRAME_W,
	SIGHT_SQUASH,
	TORCH_SIGHT_RADIUS,
	WALL_TORCH_COLOR,
	WALL_TORCH_INTENSITY,
	WALL_TORCH_RADIUS,
} from "../constants";
import { torchFlame } from "../fx/flame";
import { breath, flicker } from "../fx/torch";
import { tileOf } from "./usables";

// where the embers are in the torch tile, by the wall it hangs on
const EMBERS = {
	N: [21.7, 180.4],
	W: [106.3, 180.4],
} as const;

// a torch on a wall: its tile, a flame, and a light of its own
export class WallTorch extends Container {
	// where the flame burns, in world coordinates
	readonly flame = new Vector2d();
	// so the torches don't all flicker together
	readonly phase = math.randomFloat(0, 100);
	private light?: Light2d;
	// how far the darkness opens around it, wider than its glow
	private opening?: Light2d;

	constructor(x: number, y: number, settings: TMXObject) {
		// the size of the tile, so it sorts with the wall it hangs on
		super(x, y, FRAME_W, FRAME_H);
		// lined up a pixel lower than that wall, so it is drawn over it
		this.sortOffset = 1;
		// the wall it hangs on, set on its tile in the tileset
		const facing = settings.resolvedProperty("facing") === "W" ? "W" : "N";
		const [ex, ey] = EMBERS[facing];
		this.addChild(tileOf(settings).getRenderable(settings));
		this.addChild(torchFlame(ex, ey));
		this.flame.set(x + ex, y + ey);
	}

	override onActivateEvent() {
		const app = this.parentApp;
		if (!app) {
			return;
		}
		this.light = new Light2d(
			this.flame.x,
			this.flame.y - 8,
			WALL_TORCH_RADIUS,
			WALL_TORCH_RADIUS * 0.65,
			WALL_TORCH_COLOR,
			WALL_TORCH_INTENSITY,
		);
		// its glow fades into the darkness rather than cutting a hard hole
		this.light.softness = 1;
		// over the walls and props, not under them like the hero's torch, so
		// it lights the stone on both sides and whoever walks by
		app.world.addChild(this.light, this.depth + 0.5);
		// a light that only cuts the darkness, and draws nothing
		this.opening = new Light2d(
			this.flame.x,
			this.flame.y,
			TORCH_SIGHT_RADIUS,
			TORCH_SIGHT_RADIUS * SIGHT_SQUASH,
		);
		this.opening.illuminationOnly = true;
		this.opening.softness = 1;
		app.world.addChild(this.opening, this.depth + 0.5);
	}

	override update(dt: number) {
		const seconds = timer.getTime() / 1000 + this.phase;
		if (this.light) {
			this.light.intensity = WALL_TORCH_INTENSITY * flicker(seconds);
		}
		if (this.opening) {
			const radius = TORCH_SIGHT_RADIUS * breath(seconds);
			this.opening.setRadii(radius, radius * SIGHT_SQUASH);
		}
		return super.update(dt);
	}
}
