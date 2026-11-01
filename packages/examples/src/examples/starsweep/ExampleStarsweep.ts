/**
 * melonJS — Starsweep: a panel-powering maze game in space.
 *
 * Guide Bolt, a little sweeper robot, around floating space stations and
 * power up every deck panel while monsters roam. Wobblers wander, munchers
 * eat the power back off and chasers come for you. Frozen panels keep you
 * sliding, conveyor pads push you, damaged panels drop away behind you.
 * Zap the monsters, grab power-ups, and don't fall off into space.
 *
 * The characters are put together from Kenney's Monster Builder Pack
 * (CC0); the station is drawn from shapes, and every sound is synthesised
 * with `audio.tone` / `audio.noise`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Application, loader, save, state } from "melonjs";
import { createExampleComponent } from "../utils";
import { ATLAS } from "./characters";
import { HEIGHT, HISCORE_KEY, WIDTH } from "./field";
import { controls, PlayScreen, TitleScreen } from "./scenes";

const createGame = async () => {
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		scale: "auto",
		backgroundColor: "#0b0a24",
		// smooth cartoon art: soft edges, and parts drawn smaller than
		// the atlas stay clean
		antiAlias: true,
		textureFilter: "linear-mipmap",
	});
	await app.init();

	// keep the best score between visits
	save.add({ [HISCORE_KEY]: 0 });

	const base = `${import.meta.env.BASE_URL}assets/starsweep/`;
	await new Promise<void>((resolve) => {
		loader.preload(
			[{ name: ATLAS, type: "image", src: `${base}monsters.png` }],
			() => resolve(),
		);
	});

	state.set(state.MENU, new TitleScreen());
	state.set(state.PLAY, new PlayScreen());
	state.transition("fade", "#0b0a24", 250);
	controls.bind();
	state.change(state.MENU);

	// release the keys and listeners when leaving the example
	return () => controls.unbind();
};

export const ExampleStarsweep = createExampleComponent(createGame);
