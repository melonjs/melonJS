/**
 * melonJS — Glowpaint: a tile-painting maze game.
 *
 * Guide Lumi, a little spark, around floating mazes and light every tile
 * while ink creatures roam. Blots wander, smudges unpaint what you lit
 * and hunters chase you. Ice keeps you sliding, arrow pads push you,
 * cracked tiles crumble behind you. Shoot sparks to pop the ink, grab
 * power-ups, and don't fall off the edge.
 *
 * No image or audio files: the board and characters are drawn from
 * shapes, and every sound is synthesised with `audio.tone` / `audio.noise`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Application, save, state } from "melonjs";
import { createExampleComponent } from "../utils";
import { HEIGHT, HISCORE_KEY, WIDTH } from "./field";
import { controls, PlayScreen, TitleScreen } from "./scenes";

const createGame = async () => {
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		scale: "auto",
		backgroundColor: "#0b0a24",
	});
	await app.init();

	// keep the best score between visits
	save.add({ [HISCORE_KEY]: 0 });

	state.set(state.MENU, new TitleScreen());
	state.set(state.PLAY, new PlayScreen());
	state.transition("fade", "#0b0a24", 250);
	controls.bind();
	state.change(state.MENU);

	// release the keys and listeners when leaving the example
	return () => controls.unbind();
};

export const ExampleGlowpaint = createExampleComponent(createGame);
