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
	audio,
	Camera3d as Camera3dClass,
	loader,
	plugin,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import {
	BGM_NAME,
	BGM_PATH,
	SPEEDER_ASSET_BASE,
	SPEEDER_MODEL,
} from "./constants";
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

	// Audio init — mp3 preferred (universal), m4a as a fallback for
	// AAC-only browsers, ogg last for the Firefox/Linux path. Howler
	// will try them in order and use the first one it can decode.
	audio.init("mp3,m4a,ogg");

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
			// background music loop — the loader picks the first
			// extension from the `audio.init` list whose source the
			// browser can decode.
			{
				name: BGM_NAME,
				type: "audio",
				src: BGM_PATH,
			},
		],
		() => {
			// swap in the gradient-painting stage as the default
			state.set(state.DEFAULT, new SkyboxStage());
			state.change(state.DEFAULT, true);

			const controller = new GameController(app);
			app.world.addChild(controller);

			// Start the music loop via `playTrack` (not `play`) — that
			// registers BGM_NAME as the engine's currentTrack, which
			// in turn hooks the engine's built-in pause-on-blur
			// behavior (Application.pauseOnBlur=true by default →
			// state.pause(true) → audio.pauseTrack). Volume kept
			// moderate so the procedural SFX layer over it without
			// ducking.
			audio.playTrack(BGM_NAME, 0.45);
		},
	);

	// Teardown — same-tab navigation back to the example index
	// triggers this; without it the looping music keeps playing after
	// the canvas is detached.
	return () => {
		audio.stopTrack();
	};
};

export const ExampleAfterBurner = createExampleComponent(createGame);
