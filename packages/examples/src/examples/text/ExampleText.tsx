/**
 * melonJS — Text + BitmapText rendering example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { Application, loader, plugin, state, video } from "melonjs";
import { createExampleComponent } from "../utils.tsx";
import { TextScreen } from "./text.ts";

const base = `${import.meta.env.BASE_URL}assets/text/`;

const createGame = () => {
	// authored at 2× (1280×960) so the canvas renders close to native pixels on
	// a HiDPI display, minimising the upscale blur of a low-res backing store
	const _app = new Application(1280, 960, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
		// nearest-neighbour sampling keeps the pixel bitmap fonts crisp and avoids
		// atlas glyph bleeding; at ~native scale the web/system fonts stay sharp too
		antiAlias: false,
	});

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// set all resources to be loaded
	loader.preload(
		[
			// pixel bitmap fonts (frostyfreeze, BMFont XML → converted to .fnt)
			{ name: "minogram", type: "image", src: `${base}minogram.png` },
			{ name: "minogram", type: "binary", src: `${base}minogram.fnt` },
			{ name: "thick", type: "image", src: `${base}thick.png` },
			{ name: "thick", type: "binary", src: `${base}thick.fnt` },
			// nine-slice dialogue panel
			{ name: "panel", type: "image", src: `${base}panel.png` },
			// loaded web font (used via font-family "kenpixel")
			{
				name: "kenpixel",
				type: "fontface",
				src: `${base}kenvector_future.woff2`,
			},
		],
		() => {
			state.set(state.PLAY, new TextScreen());
			state.change(state.PLAY);
		},
	);
};

export const ExampleText = createExampleComponent(createGame);
