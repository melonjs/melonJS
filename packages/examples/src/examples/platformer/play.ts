/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	audio,
	device,
	level,
	plugin,
	Stage,
	VignetteEffect,
} from "melonjs";
import { VirtualJoypad } from "./entities/controls";
import UIContainer from "./entities/HUD";
import { MinimapCamera } from "./entities/minimap";
import { gameState } from "./gameState";

/** draw order for the screen-space overlays — above every level layer */
const HUD_Z = 100;

export class PlayScreen extends Stage {
	private virtualJoypad?: VirtualJoypad;
	private HUD?: UIContainer;

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
		// explicit z: the HUD draws over the level
		app.world.addChild(this.HUD, HUD_Z);

		// display if debugPanel is enabled or on mobile
		if (plugin.cache.debugPanel?.panel.visible || device.touch) {
			if (typeof this.virtualJoypad === "undefined") {
				this.virtualJoypad = new VirtualJoypad();
			}
			app.world.addChild(this.virtualJoypad, HUD_Z);
		}

		// vignette post-effect + built-in color grading (always applied last).
		// No backend check needed: on a renderer without a programmable
		// pipeline (Canvas) the effect self-disables and the scene renders
		// without it, while the color grading still applies.
		app.viewport.addPostEffect(new VignetteEffect(app.renderer));
		app.viewport.colorMatrix.contrast(1.1).saturate(1.1);

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

		// stop some music
		audio.stopTrack();
	}
}
