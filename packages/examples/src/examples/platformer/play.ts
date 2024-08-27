import { Stage, audio, device, game, level, plugin } from "melonjs";
import UIContainer from "./entities/HUD";
import { VirtualJoypad } from "./entities/controls";
import { gameState } from "./gameState";

export class PlayScreen extends Stage {
	private virtualJoypad?: VirtualJoypad;
	private HUD?: UIContainer;

	/**
	 *  action to perform on state change
	 */
	override onResetEvent() {
		// load a level
		level.load("map1");

		// reset the score
		gameState.data.score = 0;

		// add our HUD to the game world
		if (typeof this.HUD === "undefined") {
			this.HUD = new UIContainer();
		}
		game.world.addChild(this.HUD);

		// display if debugPanel is enabled or on mobile
		if (plugin.cache.debugPanel?.panel.visible || device.touch) {
			if (typeof this.virtualJoypad === "undefined") {
				this.virtualJoypad = new VirtualJoypad();
			}
			game.world.addChild(this.virtualJoypad);
		}

		// play some music
		audio.playTrack("dst-gameforest");
	}

	/**
	 *  action to perform on state change
	 */
	override onDestroyEvent() {
		// remove the HUD from the game world
		if (this.HUD) {
			game.world.removeChild(this.HUD);
		}

		// remove the joypad if initially added
		if (this.virtualJoypad && game.world.hasChild(this.virtualJoypad)) {
			game.world.removeChild(this.virtualJoypad);
		}

		// stop some music
		audio.stopTrack();
	}
}
