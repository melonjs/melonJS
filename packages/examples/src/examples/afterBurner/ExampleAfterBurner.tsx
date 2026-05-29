/**
 * melonJS — AfterBurner Clone showcase.
 *
 * Behind-the-plane arcade shooter built on Camera3d + 3D Mesh rendering.
 * Player jet sits in the screen plane (XY), enemies fly toward the
 * camera from the horizon (high z → low z), bullets fly away from the
 * camera (low z → high z). Camera is always behind+slightly-above the
 * player.
 *
 * Module layout — keeps the file count modest while letting each
 * concern stand alone:
 * - `constants.ts` — gameplay tuning + axis vectors + asset paths
 * - `types.ts` — shared interfaces (BulletMover, EnemyMover, ExhaustPuff)
 * - `textures.ts` — canvas-based laser-bolt + exhaust-puff factories
 * - `color.ts` — HSL→RGB tint helper
 * - `SkyboxStage.ts` — sky/ground gradient + speed-line backdrop
 * - `GameController.ts` — per-frame tick (player, enemies, bullets,
 *   exhaust, collision, score, camera follow)
 *
 * Controls: arrow keys / WASD to maneuver, space to fire, R to restart.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d as Camera3dClass,
	loader,
	plugin,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import { SPEEDER_ASSET_BASE, SPEEDER_MODEL } from "./constants";
import { GameController } from "./GameController";
import { SkyboxStage } from "./SkyboxStage";

const createGame = () => {
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.WEBGL,
		scale: "auto",
		cameraClass: Camera3dClass,
	});

	// world.backgroundColor stays transparent (alpha 0) — the SkyboxStage
	// paints the actual visible background each frame
	app.world.backgroundColor.setColor(0, 0, 0, 0);

	// Register the debug panel and open it by default. The `S` key (its
	// usual toggle) is bound by `GameController` for WASD-down movement,
	// so the panel would never come up via keyboard here — calling
	// `show()` directly side-steps that conflict.
	plugin.register(DebugPanelPlugin, "debugPanel");
	(plugin.cache.debugPanel as DebugPanelPlugin).show();

	loader.preload(
		[
			{
				name: SPEEDER_MODEL,
				type: "obj",
				src: `${SPEEDER_ASSET_BASE}${SPEEDER_MODEL}.obj`,
			},
			{
				name: SPEEDER_MODEL,
				type: "mtl",
				src: `${SPEEDER_ASSET_BASE}${SPEEDER_MODEL}.mtl`,
			},
		],
		() => {
			// swap in the gradient-painting stage as the default
			state.set(state.DEFAULT, new SkyboxStage());
			state.change(state.DEFAULT, true);

			const controller = new GameController(app);
			app.world.addChild(controller);
		},
	);
};

export const ExampleAfterBurner = createExampleComponent(createGame);
