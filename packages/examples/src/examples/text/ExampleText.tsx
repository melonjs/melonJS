import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { game, loader, plugin, video } from "melonjs";
import { createExampleComponent } from "../utils.tsx";
import arialfancyFnt from "./arialfancy.fnt?url";
import arialfancyPng from "./arialfancy.png";
import { TextTest } from "./text.ts";
import xolo12Fnt from "./xolo12.fnt?url";
import xolo12Png from "./xolo12.png";

const createGame = () => {
	video.init(640, 480, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
		preferWebGL1: false,
	});

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// set all ressources to be loaded
	loader.preload(
		[
			{ name: "xolo12", type: "image", src: xolo12Png },
			{ name: "xolo12", type: "binary", src: xolo12Fnt },
			{ name: "arialfancy", type: "image", src: arialfancyPng },
			{ name: "arialfancy", type: "binary", src: arialfancyFnt },
		],
		() => {
			game.world.reset();
			game.world.addChild(new TextTest(), 1);
		},
	);
};

export const ExampleText = createExampleComponent(createGame);
