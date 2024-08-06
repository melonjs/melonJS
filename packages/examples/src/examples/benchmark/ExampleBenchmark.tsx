import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	ScaleMethods,
	device,
	event,
	game,
	input,
	loader,
	plugin,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import { Fruit } from "./Fruit";
import { assets } from "./assets";

const FRUIT_STEP = 50;

function addFruits(numberOfFruits: number, fruitType?: string) {
	const selectedFruitType =
		fruitType || assets[Math.floor(Math.random() * assets.length)].name;
	for (let i = 0; i < numberOfFruits; i++) {
		game.world.addChild(new Fruit(selectedFruitType));
	}
}

const createGame = () => {
	// Initialize the video.
	if (
		!video.init(1024, 768, {
			scaleMethod: ScaleMethods.Flex,
			renderer: video.AUTO,
			transparent: false,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// load our monster image and populate the game world
	loader.preload(assets, () => {
		// add some keyboard shortcuts
		event.on(event.KEYDOWN, (_, keyCode) => {
			// toggle fullscreen on/off
			if (keyCode === input.KEY.F) {
				if (!device.isFullscreen()) {
					device.requestFullscreen();
				} else {
					device.exitFullscreen();
				}
			}

			if (keyCode === input.KEY.ENTER || keyCode === input.KEY.SPACE) {
				addFruits(FRUIT_STEP);
			}
		});

		// register on pointer down
		input.registerPointerEvent("pointerdown", game.viewport, () => {
			addFruits(FRUIT_STEP);
		});

		// reset/empty the game world
		game.world.reset();

		addFruits(FRUIT_STEP, "watermelon");
	});
};

export const ExampleBenchmark = createExampleComponent(createGame);
