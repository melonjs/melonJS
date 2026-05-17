/**
 * melonJS — Pool (Matter) example: Application bootstrap.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Wires up the matter-physics adapter (zero-gravity, top-down), the
 * camera vignette post-effect, the debug-panel plugin, and kicks off
 * the asset preload + state transition into `PlayScreen`.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { MatterAdapter } from "@melonjs/matter-adapter";
import {
	Application,
	loader,
	plugin,
	state,
	VignetteEffect,
	video,
} from "melonjs";
import { VIEWPORT_H, VIEWPORT_W } from "./constants";
import { PlayScreen } from "./play";
import { resources } from "./resources";

export const createGame = () => {
	// Pool table is top-down, so we run matter with **zero gravity** —
	// frictionAir on each ball provides the table-felt drag that brings
	// balls to rest. No vertical-axis force needed.
	const _app = new Application(VIEWPORT_W, VIEWPORT_H, {
		parent: "screen",
		scaleMethod: "fit",
		renderer: video.AUTO,
		preferWebGL1: false,
		subPixel: false,
		highPrecisionShader: false,
		// Anti-aliasing smooths the painted edges on the table sprite,
		// the procedural cue stick, and the strokes on the aim line +
		// ghost ball outline. The viewport scales to fit the browser
		// window so sub-pixel positions are unavoidable; without AA the
		// rail/pocket edges shimmer when the canvas size doesn't land
		// on an integer multiple of the source 1280×723.
		antiAlias: true,
		// Run matter with 2 physics substeps per frame. At max-power break
		// shots the cue ball moves ~30 px/frame and BALL_RADIUS=16, so a
		// single-step narrow phase can miss a ball-on-ball or ball-on-
		// rail contact and the cue tunnels through. Two substeps caps
		// per-tick motion at ~15 px (< 1 radius) at the cost of running
		// the solver twice — pool only has 16 bodies, so the perf hit
		// is unmeasurable.
		physic: new MatterAdapter({ gravity: { x: 0, y: 0 }, subSteps: 2 }),
	});

	// Vignette as a camera post-effect — uses the engine's built-in
	// `VignetteEffect` shader (WebGL fragment pass) which darkens UV
	// edges procedurally. Way cleaner than a fullscreen overlay
	// renderable and resolution-independent. `strength=0.18` is subtle
	// enough that the corner pockets stay readable; `size=22` keeps the
	// dark falloff confined to the outer ~25% of the viewport.
	_app.viewport.shader = new VignetteEffect(video.renderer, {
		strength: 0.18,
		size: 22.0,
	});

	// register the debug plugin — press 'S' in-game to toggle the panel
	// (collision bodies, FPS, draw-call counts, etc.)
	plugin.register(DebugPanelPlugin, "debugPanel");

	// allow cross-origin asset loading (same as the matter platformer)
	loader.setOptions({ crossOrigin: "anonymous" });

	loader.preload(resources, () => {
		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY);
	});
};
