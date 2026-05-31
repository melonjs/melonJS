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
	Camera3d,
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
	// NOTE: an `unmounted` guard around the preload callback would in
	// principle fix the "user navigates away before preload finishes"
	// race that Copilot flagged. It can't be added cleanly today —
	// `examples/utils.tsx` runs `currentTeardown()` on every React
	// useEffect cleanup (including StrictMode's dev double-mount
	// cycle), but the same-example remount branch only reattaches
	// the canvas without re-invoking `createGameFn`. An `unmounted`
	// flag flipped in teardown therefore stays `true` across the
	// StrictMode remount, the preload callback bails for the rest of
	// the session, and the game never starts. Picks up cleanly once
	// the utils.tsx remount path is fixed (separate review thread).
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.WEBGL,
		scale: "auto",
		cameraClass: Camera3d,
	});

	// ─── BENCH for #1468 (POST-refactor) — DELETE before merging ────────
	const r = app.renderer as unknown as {
		drawMesh: (mesh: unknown) => void;
	};
	const origDrawMesh = r.drawMesh.bind(r);
	let meshCalls = 0;
	let meshTimeMs = 0;
	let frames = 0;
	r.drawMesh = (mesh: unknown) => {
		const t0 = performance.now();
		origDrawMesh(mesh);
		meshTimeMs += performance.now() - t0;
		meshCalls++;
	};
	const tickFrames = () => {
		frames++;
		requestAnimationFrame(tickFrames);
	};
	requestAnimationFrame(tickFrames);
	setInterval(() => {
		if (frames > 0 && meshCalls > 0) {
			const callsPerFrame = meshCalls / frames;
			const timePerFrame = meshTimeMs / frames;
			console.log(
				`[BENCH #1468 post-refactor] frames=${frames}  ` +
					`drawMesh/frame=${callsPerFrame.toFixed(1)}  ` +
					`drawMesh time/frame=${timePerFrame.toFixed(3)}ms  ` +
					`(${((timePerFrame / 16.667) * 100).toFixed(1)}% of 60fps budget)  ` +
					`per-call=${((meshTimeMs / meshCalls) * 1000).toFixed(1)}µs`,
			);
		}
		frames = 0;
		meshCalls = 0;
		meshTimeMs = 0;
	}, 2000);
	// ─── END BENCH ──────────────────────────────────────────────────────

	// world.backgroundColor stays transparent (alpha 0) — the SkyboxStage
	// paints the actual visible background each frame
	app.world.backgroundColor.setColor(0, 0, 0, 0);

	// Register the debug panel. Its usual toggle key (`S`) is bound by
	// `GameController` for WASD-down movement, so the panel won't open
	// via keyboard here — toggle it via the debug-plugin button instead.
	plugin.register(DebugPanelPlugin, "debugPanel");

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
