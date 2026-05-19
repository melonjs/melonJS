/**
 * melonJS — Plinko (Planck) example: PlayScreen.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

import type { Container } from "melonjs";
import { type Application, Stage } from "melonjs";
import { BakedStatics } from "./entities/bakedStatics";
import { reapPendingBalls } from "./entities/ball";
import { DropZone } from "./entities/dropZone";
import { HUDContainer } from "./entities/hud";
import { buildPegField } from "./entities/peg";
import { buildSlots } from "./entities/slot";
import { buildWalls } from "./entities/wall";
import { resetGameState } from "./gameState";

export class PlayScreen extends Stage {
	private appRef: Application | undefined;

	override onResetEvent(app: Application) {
		this.appRef = app;
		resetGameState();

		// TEMP DEBUG — call `__childDump()` from the console to print
		// the world's children grouped by class name.
		(globalThis as unknown as { __childDump?: () => void }).__childDump =
			() => {
				const counts = new Map<string, number>();
				const walk = (c: Container) => {
					const children = c.getChildren();
					for (const child of children) {
						const name = child.constructor.name;
						counts.set(name, (counts.get(name) ?? 0) + 1);
						if (typeof (child as Container).getChildren === "function") {
							walk(child as Container);
						}
					}
				};
				walk(app.world);
				const rows = Array.from(counts.entries())
					.sort((a, b) => b[1] - a[1])
					.map(([k, v]) => `${k}=${v}`);
				console.log("[children]", rows.join(" "));
			};

		// Layer 1 — single pre-baked backdrop (depth -100) covering
		// the synthwave background + side walls + base pegs. Replaces
		// ~700 per-frame draw calls with one drawImage.
		app.world.addChild(new BakedStatics());

		// Layer 2 — static play geometry (depth 0). Order doesn't matter
		// because pegs, walls, and slots don't visually overlap.
		for (const peg of buildPegField()) {
			app.world.addChild(peg);
		}
		for (const wall of buildWalls()) {
			app.world.addChild(wall);
		}
		for (const slot of buildSlots()) {
			app.world.addChild(slot);
		}

		// Drop zone — invisible click target above the peg field.
		app.world.addChild(new DropZone());

		// HUD — depth 100, drawn on top of everything.
		app.world.addChild(new HUDContainer());
	}

	override update(dt: number): boolean {
		// Reap Balls that collided with a slot sensor last frame.
		// Doing this here (rather than inside the collision handler)
		// avoids mutating the world container mid-physics-step, which
		// would otherwise invalidate iterators in the adapter's
		// contact-list walk.
		if (this.appRef) {
			reapPendingBalls(this.appRef.world);
		}
		return super.update(dt);
	}
}
