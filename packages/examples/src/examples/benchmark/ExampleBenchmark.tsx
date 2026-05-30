/**
 * melonJS — performance benchmark (animated sprite stress test) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	device,
	event,
	game,
	input,
	loader,
	plugin,
	ScaleMethods,
	Text,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import { assets } from "./assets";
import { Fruit } from "./Fruit";

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
			// `parent: "screen"` — without this the engine falls back to
			// `document.body`, and on this page body has no flow content
			// (#screen is `position: fixed`, so it's pulled out of the
			// flow). Initial body.height matches Vite's transient overlay
			// (~814 px) and then collapses to ~43 px once that clears,
			// taking the Flex-scaled canvas with it (the user-reported
			// "screen became a horizontal banner").
			parent: "screen",
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

		// add hint text
		const hint = new Text(game.viewport.width / 2, 20, {
			font: "Arial",
			size: "16px",
			fillStyle: "#ffffff",
			textAlign: "center",
			text: "Tap or Click to spawn more sprites",
		});
		hint.floating = true;
		hint.setOpacity(0.6);
		game.world.addChild(hint, Infinity);

		addFruits(FRUIT_STEP, "watermelon");
	});
};

export const ExampleBenchmark = createExampleComponent(createGame);
