/**
 * melonJS — Jungle Rabbit showcase.
 *
 * An endless river run built on the 3D tier: a `Camera3d` chase camera, a
 * procedural valley `Mesh` under a travelling water plane, authored glTF
 * scenery stamped out through `InstancedMesh`, and a rigged `GLTFModel` for
 * the rabbit paddling its boat.
 *
 * Module layout:
 * - `resources.ts`    — the asset manifest
 * - `constants.ts`    — tuning
 * - `props.ts`        — the palette strip every model samples
 * - `textures.ts`     — the canvas-baked ground, water and sky textures
 * - `terrain.ts`      — the procedural valley and river surface
 * - `scenery.ts`      — the still backdrop the menus sit on
 * - `TitleStage.ts` / `GameStage.ts` / `GameOverStage.ts` — the three screens
 *
 * Controls: arrows / A D to steer, space to jump.
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
import { initAssets } from "./assets";
import { VIEW_H, VIEW_W } from "./constants";
import { GameOverStage } from "./GameOverStage";
import { GameStage } from "./GameStage";
import { resources } from "./resources";
import { TitleStage } from "./TitleStage";

export const createGame = async () => {
	const app = new Application(VIEW_W, VIEW_H, {
		parent: "screen",
		renderer: video.AUTO,
		scale: "auto",
		cameraClass: Camera3d,
		// chunky upscaled pixels are the look; smoothing would wash the
		// hand-placed 1px details out of every texture
		antiAlias: false,
		textureFilter: "nearest",
		// the boat's blob shadow is opted into per renderable, so the scenery
		// that should not cast one can say so
		castGroundShadow: false,
	});
	await app.init();

	// Toggle with S, or add `#debug` to the URL. Worth having on a scene like
	// this one: the whole point of the instanced sets is that the draw-call
	// count barely moves as the counts grow, and the panel is where you see
	// that rather than take my word for it.
	plugin.register(DebugPanelPlugin, "debugPanel");

	// The 3D tier needs a programmable pipeline. Under the Canvas fallback a
	// Camera3d renders a black frame, which reads as a broken example rather
	// than as an unsupported browser — so say which it is.
	if (app.renderer.shaderLanguage === null) {
		throw new Error(
			"Jungle Rabbit needs WebGL 2 or WebGPU — this browser fell back to Canvas.",
		);
	}

	// Before preloading any audio: the loader builds each track's URL from the
	// formats named here, so an `audio` asset declared without it resolves to
	// nothing.
	audio.init("mp3");

	// Preload through the engine's own loading stage: with no third argument
	// `preload` switches to `state.LOADING` itself and the built-in screen
	// draws the progress bar until the last model is in. Awaited rather than
	// given a callback — the promise form says "nothing below this line runs
	// before the assets are here" in the control flow itself, instead of
	// nesting the whole setup one level deeper.
	await loader.preload(resources);

	// Derived assets, built once now that the cache is full — the stages share
	// these rather than each rebuilding its own.
	initAssets();

	state.set(state.MENU, new TitleStage());
	state.set(state.PLAY, new GameStage());
	state.set(state.GAMEOVER, new GameOverStage());

	// One fade covers every state change, so neither stage has to know about
	// the other.
	//
	// The colour is the built-in loading screen's own background (`#202020`),
	// not a colour of this game's choosing. The first transition runs from the
	// loading screen, and a fade between two DIFFERENT darks reads as a flash
	// of a third colour rather than as a dissolve — the eye tracks the hue
	// change, not the brightness. Matching it means the screen simply holds
	// on one colour from the loader through to the title fading up.
	//
	// It does NOT make the hand-off itself graceful: `DefaultLoadingScreen`
	// removes its logo and progress bar on `LOADER_COMPLETE`, which fires
	// when PRELOADING finishes — before the block below has even configured
	// the transition — so they pop rather than dim. Covering that wants a
	// loading stage of this example's own, which is the same thing
	// `prewarmScene` needs.
	state.transition("fade", "#202020", 420);

	state.change(state.MENU);
};
