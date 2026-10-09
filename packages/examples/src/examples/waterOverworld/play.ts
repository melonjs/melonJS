/**
 * melonJS — Water Overworld example (shader builtins showcase).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import * as me from "melonjs";
import { WaterTextureObj } from "./entities.js";

export class WaterOverworldStage extends me.Stage {
	override onResetEvent() {
		// the TMX places everything except the water: decor sprite layers,
		// the animated props, the player and the world collision
		me.level.load("level1");

		me.game.viewport.fadeOut("#000000", 2000);

		// the refracting pond, over the scene (z 20), scaled like the
		// original demo
		me.game.world.addChild(
			new WaterTextureObj(480, 301, {
				inspectors: {
					scale: { x: 2.032, y: 2.032 },
				},
			}),
			20,
		);
	}
}
