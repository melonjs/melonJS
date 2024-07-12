import { Sprite, Stage, audio, game, loader } from "melonjs";
import { HUDContainer } from "./HUD";
import { MoleManager } from "./manager";

// list of y position where to create background and grass elements
const y_pos = [0, 127, 255, 383, 511, 639];

export class PlayScreen extends Stage {
	/**
	 * action to perform on state change
	 */
	onResetEvent() {
		game.reset();

		// add the background & foreground sprite elements
		y_pos.forEach((y, i) => {
			// create a background sprite
			const background = new Sprite(0, y, {
				image: loader.getImage("background"),
			});
			// create the grass sprite, alternate between the upper and lower one
			const grass = new Sprite(0, y, {
				image: loader.getImage(i % 2 === 0 ? "grass_upper" : "grass_lower"),
			});
			// set default anchor points
			background.anchorPoint.set(0, 0);
			grass.anchorPoint.set(0, 0);
			// add the game world
			game.world.addChild(background, 0);
			game.world.addChild(grass, i * 10 + 10);
		});

		// instantiate the mole Manager
		const moleManager = new MoleManager(0, 0);
		game.world.addChild(moleManager, 0);

		// add our HUD (scores/hiscore)
		this.HUD = new HUDContainer();
		game.world.addChild(this.HUD);

		// start the main soundtrack
		audio.playTrack("whack");
	}

	/**
	 * action to perform when leaving this screen (state change)
	 */
	onDestroyEvent() {
		// remove the HUD from the game world
		game.world.removeChild(this.HUD);

		// stop some music
		audio.stopTrack();
	}
}
