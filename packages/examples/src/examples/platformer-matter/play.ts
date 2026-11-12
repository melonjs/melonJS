/**
 * melonJS — Platformer (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { GamepadPlugin } from "@melonjs/gamepad-plugin";
import {
	type Application,
	audio,
	ColorMatrix,
	device,
	level,
	plugin,
	type ShaderEffect,
	Stage,
	VignetteEffect,
} from "melonjs";
import UIContainer from "./entities/HUD";
import { MinimapCamera } from "./entities/minimap";
import { gameState } from "./gameState";

// identity color matrix used to reset the viewport between state changes
const IDENTITY_COLOR_MATRIX = new ColorMatrix();

export class PlayScreen extends Stage {
	private HUD?: UIContainer;
	private vignette?: ShaderEffect;

	/**
	 *  action to perform on state change
	 */
	override onResetEvent(app: Application) {
		// load a level
		level.load("map1");

		// add a minimap camera (reuse if already present)
		if (!this.cameras.has("minimap")) {
			this.cameras.set("minimap", new MinimapCamera());
		}

		// reset the score
		gameState.data.score = 0;

		// add our HUD to the game world
		if (typeof this.HUD === "undefined") {
			this.HUD = new UIContainer();
		}
		app.world.addChild(this.HUD);

		// the touch controls, also shown on a desktop with the debug panel open
		const gamepad = plugin.cache.gamepad as GamepadPlugin | undefined;
		if (gamepad) {
			gamepad.enabled =
				device.touch || plugin.cache.debugPanel?.panel.visible === true;
		}

		// Vignette post-effect, cached across resets so we don't stack a
		// new VignetteEffect per restart. No backend check needed: on a
		// renderer without a programmable pipeline (Canvas) the effect
		// self-disables and the scene renders without it. Same goes for
		// the color grading — set from the identity each time so contrast
		// and saturation don't compound on each level reload.
		if (!this.vignette) {
			this.vignette = new VignetteEffect(app.renderer);
		}
		if (!app.viewport.postEffects.includes(this.vignette)) {
			app.viewport.addPostEffect(this.vignette);
		}
		app.viewport.colorMatrix
			.copy(IDENTITY_COLOR_MATRIX)
			.contrast(1.1)
			.saturate(1.1);

		// play some music
		audio.playTrack("dst-gameforest");
	}

	/**
	 *  action to perform on state change
	 */
	override onDestroyEvent(app: Application) {
		// remove the HUD from the game world
		if (this.HUD) {
			app.world.removeChild(this.HUD);
		}

		// clear post-effects + color grading so a subsequent onResetEvent
		// starts from a clean slate
		if (this.vignette && app.viewport.postEffects.includes(this.vignette)) {
			app.viewport.removePostEffect(this.vignette);
		}
		app.viewport.colorMatrix.copy(IDENTITY_COLOR_MATRIX);

		// remove the minimap camera so it doesn't accumulate across resets
		this.cameras.delete("minimap");

		// stop some music
		audio.stopTrack();
	}
}
