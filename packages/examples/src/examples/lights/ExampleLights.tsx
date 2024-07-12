import {
	Light2d,
	Sprite,
	Stage,
	game,
	input,
	loader,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import wallpaper from "./assets/pixel-art-16-bit-sega-streets-of-rage-city-wallpaper.jpg";

class PlayScreen extends Stage {
	/**
	 *  action to perform on state change
	 */
	onResetEvent() {
		// background sprite
		const bg_sprite = new Sprite(
			game.viewport.width / 2,
			game.viewport.height / 2,
			{
				image: "background",
				anchorPoint: { x: 0.5, y: 0.5 },
			},
		);
		bg_sprite.scale(2);

		// add to the game world
		game.world.addChild(bg_sprite);

		// stage light system
		const whiteLight = new Light2d(
			game.viewport.width / 2,
			game.viewport.height / 2,
			200,
			140,
			"#fff",
			0.7,
		);

		// darker ambient light
		this.ambientLight.parseCSS("#1117");
		// spot light
		this.lights.set("whiteLight", whiteLight);

		// light follow the mouse
		input.registerPointerEvent("pointermove", game.viewport, (event) => {
			whiteLight.centerOn(event.gameX, event.gameY);
		});
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		scaleMethod: "flex",
		renderer: video.WEBGL,
	});

	// set the "Play/Ingame" Screen Object
	state.set(state.PLAY, new PlayScreen());

	loader.preload(
		[
			{
				name: "background",
				type: "image",
				src: wallpaper,
			},
		],
		() => {
			state.change(state.PLAY);
		},
	);
};

export const ExampleLights = createExampleComponent(createGame);
