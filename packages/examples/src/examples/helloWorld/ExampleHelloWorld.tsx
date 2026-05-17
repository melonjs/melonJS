/**
 * melonJS — Hello World (minimal getting-started) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Application, Text } from "melonjs";
import { createExampleComponent } from "../utils";

export const ExampleHelloWorld = createExampleComponent(() => {
	// create a new Application instance
	const app = new Application(1218, 562, {
		parent: "screen",
		scale: "auto",
		backgroundColor: "#202020",
	});

	// set a gray background color
	app.world.backgroundColor.parseCSS("#202020");

	// add a text object in the center of the display
	app.world.addChild(
		new Text(609, 281, {
			font: "Arial",
			size: 160,
			fillStyle: "#FFFFFF",
			textBaseline: "middle",
			textAlign: "center",
			text: "Hello World !",
		}),
	);
});
