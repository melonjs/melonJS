/**
 * melonJS — Platformer (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
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
	WebGLRenderer,
} from "melonjs";
import { VirtualJoypad } from "./entities/controls";
import UIContainer from "./entities/HUD";
import { MinimapCamera } from "./entities/minimap";
import { gameState } from "./gameState";

// identity color matrix used to reset the viewport between state changes
const IDENTITY_COLOR_MATRIX = new ColorMatrix();

export class PlayScreen extends Stage {
	private virtualJoypad?: VirtualJoypad;
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

		// display if debugPanel is enabled or on mobile
		if (plugin.cache.debugPanel?.panel.visible || device.touch) {
			if (typeof this.virtualJoypad === "undefined") {
				this.virtualJoypad = new VirtualJoypad();
			}
			app.world.addChild(this.virtualJoypad);
		}

		// Vignette post-effect (WebGL only). Cache the effect across resets
		// so we don't stack a new VignetteEffect per restart. Same goes for
		// the color grading — set from the identity each time so contrast
		// and saturation don't compound on each level reload.
		if (app.renderer instanceof WebGLRenderer) {
			if (!this.vignette) {
				this.vignette = new VignetteEffect(app.renderer);
			}
			if (!app.viewport.postEffects.includes(this.vignette)) {
				app.viewport.addPostEffect(this.vignette);
			}
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

		// remove the joypad if initially added
		if (this.virtualJoypad && app.world.hasChild(this.virtualJoypad)) {
			app.world.removeChild(this.virtualJoypad);
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
