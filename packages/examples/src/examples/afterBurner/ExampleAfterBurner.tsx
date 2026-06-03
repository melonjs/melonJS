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
 * Controls: arrow keys / WASD to maneuver, space to fire, R to restart, F to toggle fullscreen.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	audio,
	Camera3d,
	event,
	input,
	loader,
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
	// AfterBurner requires WebGL — `renderer: video.WEBGL` throws (post
	// #1479) when the browser/GPU can't provide a context (driver
	// blocklisted, software fallback failing the perf-caveat check, etc.).
	// Surface a clear browser-level message to the user instead of
	// letting the React tree render a stuck blank canvas with an obscure
	// error buried in the dev console.
	let app: Application;
	try {
		app = new Application(1024, 576, {
			parent: "screen",
			renderer: video.WEBGL,
			scale: "auto",
			cameraClass: Camera3d,
		});
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"AfterBurner couldn't start: WebGL isn't available in this browser.\n\n" +
				"This showcase uses Camera3d + 3D mesh rendering, which require a " +
				"WebGL-capable browser/GPU. Try enabling hardware acceleration in " +
				"your browser settings, or open this example in a different browser.\n\n" +
				`Details: ${reason}`,
		);
		// Re-throw so the React example boundary doesn't think we
		// initialized successfully — the gallery's error tile is the right
		// fallback UI.
		throw err;
	}

	// world.backgroundColor stays transparent (alpha 0) — the SkyboxStage
	// paints the actual visible background each frame
	app.world.backgroundColor.setColor(0, 0, 0, 0);

	// Audio init — mp3 preferred (universal), m4a as a fallback for
	// AAC-only browsers, ogg last for the Firefox/Linux path. Howler
	// will try them in order and use the first one it can decode.
	audio.init("mp3,m4a,ogg");

	// hoisted so both the preload callback (assigns it) and the teardown
	// closure (reads it for `event.off`) can see the same reference
	let onKeyDown:
		| ((action: string | undefined, keyCode: number) => void)
		| undefined;

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
			// F toggles fullscreen for this app's canvas parent. Registered
			// INSIDE the preload callback (not at createGame's sync tail)
			// so it survives the React StrictMode dev double-mount cycle:
			// utils.tsx runs teardown on the first unmount, then the
			// canvas remount path doesn't re-run createGame — registering
			// here instead means the listener installs after StrictMode
			// settles, alongside the rest of the game-running state.
			onKeyDown = (_action, keyCode) => {
				if (keyCode === input.KEY.F) {
					if (!app.isFullscreen()) app.requestFullscreen();
					else app.exitFullscreen();
				}
			};
			event.on(event.KEYDOWN, onKeyDown);

			audio.playTrack(BGM_NAME, 0.45);
		},
	);

	// Teardown — same-tab navigation back to the example index
	// triggers this; without it the looping music keeps playing after
	// the canvas is detached, and the F-key handler would leak across
	// remounts (stacking up duplicate fullscreen toggles per press).
	// `onKeyDown` is undefined if teardown fires before preload
	// completes (StrictMode dev unmount path); skip the off in that
	// case — the closure was never registered.
	return () => {
		if (onKeyDown !== undefined) event.off(event.KEYDOWN, onKeyDown);
		audio.stopTrack();
	};
};

export const ExampleAfterBurner = createExampleComponent(createGame);
