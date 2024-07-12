import { Text, game, video } from "melonjs";
import { createExampleComponent } from "../utils";

export const ExampleHelloWorld = createExampleComponent(() => {
	// Initialize the video.
	video.init(1218, 562, { parent: "screen", scale: "auto" });

	// set a gray background color
	game.world.backgroundColor.parseCSS("#202020");

	// add a text object in the center of the display
	game.world.addChild(
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
