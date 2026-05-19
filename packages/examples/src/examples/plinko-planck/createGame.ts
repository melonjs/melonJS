/**
 * melonJS — Plinko (Planck) example: Application bootstrap.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Wires up the planck-physics adapter, the CRT scanline + vignette
 * viewport post-effect, the debug-panel plugin, and kicks off the
 * (empty) preload + state transition into `PlayScreen`.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { PlanckAdapter } from "@melonjs/planck-adapter";
import {
	Application,
	loader,
	plugin,
	ScanlineEffect,
	state,
	video,
} from "melonjs";
import {
	GRAVITY_Y,
	PIXELS_PER_METER,
	VIEWPORT_H,
	VIEWPORT_W,
} from "./constants";
import { PlayScreen } from "./play";
import { resources } from "./resources";

export const createGame = () => {
	// Scale relative to the `#screen` flex container (which sits
	// below the 41px example topbar) rather than the default
	// `window` parent. Without an explicit scaleTarget the engine's
	// `fit` math uses the full window height, so on portrait
	// examples like this one the canvas overshoots the topbar.
	const scaleTarget = document.getElementById("screen") ?? undefined;
	const _app = new Application(VIEWPORT_W, VIEWPORT_H, {
		parent: "screen",
		scaleMethod: "fit",
		scaleTarget,
		renderer: video.AUTO,
		preferWebGL1: false,
		subPixel: false,
		highPrecisionShader: false,
		// Anti-aliasing smooths every procedural draw call — the peg
		// glow rings, ball rim, slot wall caps. With AA off the
		// concentric-circle glow technique aliases hard along its
		// radial edge and looks crunchy at the viewport's fit scale.
		antiAlias: true,
		// Run planck with 2 physics substeps per frame. The ball can
		// reach ~25 px/frame during the freefall section, and with
		// PEG_RADIUS=6 a single-step narrow phase can miss a peg-on-
		// ball contact and the ball tunnels past the row. Two substeps
		// caps per-tick motion at ~12 px (< 1 peg radius + 1 ball
		// radius) at the cost of running the solver twice.
		physic: new PlanckAdapter({
			gravity: { x: 0, y: GRAVITY_Y },
			pixelsPerMeter: PIXELS_PER_METER,
			subSteps: 2,
		}),
	});

	// CRT-monitor post-effect on the camera. Scanlines for the
	// "old arcade screen" vibe; subtle vignette to focus the eye
	// on the play field. Kept light — anything higher than ~0.1
	// noticeably dims the neon palette below it.
	_app.viewport.shader = new ScanlineEffect(video.renderer, {
		opacity: 0.09,
		vignetteStrength: 0.18,
	});

	// register the debug plugin — press 'S' in-game to toggle the panel
	// (collision bodies, FPS, draw-call counts, etc.). Useful when
	// tuning the peg layout or the ball-peg restitution.
	plugin.register(DebugPanelPlugin, "debugPanel");

	loader.preload(resources, () => {
		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY);
	});
};
