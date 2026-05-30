/**
 * Floating container that holds the three backdrop layers
 * (SkyGradient, MountainHorizon, GroundGrid). Marking it `floating`
 * makes the engine's `Container.draw` wrap our draw with a `save()`
 * + `setProjection(viewport.screenProjection)` + `restore()` once
 * per frame instead of once per child — same gain we'd get from
 * managing the projection swap manually, but free.
 *
 * The camera roll rotation is also applied once here, so each layer
 * just renders its geometry without thinking about projection or
 * rotation. Sort key sits well above gameplay depth so painter sort
 * paints us first (behind everything).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import {
	type Application,
	type Camera3d,
	type CanvasRenderer,
	Container,
	type WebGLRenderer,
} from "melonjs";
import type { Camera3dWithRoll } from "../types";
import { GroundGrid } from "./GroundGrid";
import { MountainHorizon } from "./MountainHorizon";
import { SkyGradient } from "./SkyGradient";

type Renderer = CanvasRenderer | WebGLRenderer;

// Sort key for the backdrop. Has to be larger (= farther from camera
// under painter's-sort = drawn first) than every gameplay element.
// Enemies spawn at z=3000, despawn at z=4000; staying well past that
// keeps us decisively first in the sort order. Exported so the
// stage can pass it as the second arg of `addChild` — calling
// `world.addChild(backdrop)` without a z lets the world's default
// `autoDepth = true` overwrite our value with the child-count
// index, which lands us at z = 1 and paints the backdrop on TOP of
// every gameplay element. (Bug we just hit.)
export const BACKDROP_DEPTH = 10000;

export class BackdropContainer extends Container {
	readonly grid: GroundGrid;
	readonly mountains: MountainHorizon;
	readonly sky: SkyGradient;

	constructor(app: Application) {
		super(0, 0, 1, 1);
		this.floating = true;
		this.alwaysUpdate = true;
		// Insertion order = z-paint order within this container —
		// SkyGradient first, then mountains over horizon, then ground
		// grid on top. `app` is forwarded into MountainHorizon so it
		// can resolve the canvas dimensions for its bake without
		// reaching for a global `game` reference (deprecated).
		this.sky = new SkyGradient();
		this.mountains = new MountainHorizon(app);
		this.grid = new GroundGrid();
		this.addChild(this.sky);
		this.addChild(this.mountains);
		this.addChild(this.grid);
	}

	override draw(renderer: Renderer, viewport: Camera3d): void {
		// Apply camera roll once for the whole backdrop. The engine
		// already wrapped us with `setProjection(screenProjection)` +
		// `resetTransform` because we're floating, so we're free to
		// translate/rotate from identity.
		const w = renderer.width;
		const h = renderer.height;
		const roll = (viewport as Partial<Camera3dWithRoll>).roll ?? 0;
		if (roll !== 0) {
			renderer.translate(w / 2, h / 2);
			renderer.rotate(roll);
			renderer.translate(-w / 2, -h / 2);
		}
		// Children render in this rotated screen-space frame; no
		// per-child projection or rotation is needed.
		super.draw(renderer, viewport);
	}
}
