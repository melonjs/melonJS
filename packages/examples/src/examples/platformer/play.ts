import { type Application, audio, device, level, plugin, Stage } from "melonjs";
import { VirtualJoypad } from "./entities/controls";
import UIContainer from "./entities/HUD";
import { MinimapCamera } from "./entities/minimap";
import { gameState } from "./gameState";

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
		app.world.addChild(this.HUD);

		// display if debugPanel is enabled or on mobile
		if (plugin.cache.debugPanel?.panel.visible || device.touch) {
			if (typeof this.virtualJoypad === "undefined") {
				this.virtualJoypad = new VirtualJoypad();
			}
			app.world.addChild(this.virtualJoypad);
		}

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
