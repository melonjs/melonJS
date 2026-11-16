/**
 * melonJS — Starsweep: a panel-powering maze game in space.
 *
 * Guide Bolt, a little sweeper robot, around floating space stations and
 * power up every deck panel while monsters roam. Wobblers wander, munchers
 * eat the power back off, chasers come for you and drones fly over the
 * gaps. Frozen panels keep you sliding, conveyor pads push you, damaged
 * panels drop away behind you, goo slows the monsters and switches open
 * gates. Zap the monsters, grab power-ups, and don't fall off into space.
 *
 * The levels are Tiled maps (`public/assets/starsweep/levels/*.tmj`),
 * loaded with the engine's Tiled loader: see `levels.ts` for how to edit
 * them, and run `pnpm check:starsweep` to check them. Bolt and the portals
 * are objects in each map's `actors` layer, built by the classes
 * registered in `objects.ts`. The monsters find
 * their way with `@melonjs/pathfinding-plugin`, and every route they plan
 * is drawn on the board (see `monsters.ts` and `navigation.ts`). Portrait,
 * for phones held upright. On touch screens the `@melonjs/gamepad-plugin`
 * virtual gamepad (a stick and a ZAP button) sits under the board and
 * presses the same keys as the keyboard.
 *
 * The characters are sprites from one sheet, `cast.png`, baked from
 * Kenney's Monster Builder Pack (CC0) with every animation in its JSON (see
 * `cast.ts`; `pnpm bake:starsweep` bakes it again). On GPU renderers a
 * custom nebula shader animates the sky, bloom, vignette and chromatic
 * aberration post-effects polish the frame,
 * and a second, 3D camera draws star dust and novas behind the game (see
 * `fx.ts`). Every sound is synthesised with `audio.tone` / `audio.noise`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Application, loader, registerTiledObjectClass, state } from "melonjs";
import { createExampleComponent } from "../utils";
import { BACKGROUND, HEIGHT, WIDTH } from "./config/layout";
import { CAST } from "./entities/Actor";
import { Bolt } from "./entities/Bolt";
import { Portal } from "./entities/Portal";
import { controls } from "./input/Controls";
import {
	LEVEL_FILES,
	levelFromTiled,
	TILESET_FILE,
	type TiledMap,
	type TiledTileset,
} from "./rules/levels";
import { PlayScreen } from "./scenes/PlayScreen";
import { TitleScreen } from "./scenes/TitleScreen";
import { FONT } from "./utils/draw";

const createGame = async () => {
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		scale: "auto",
		backgroundColor: BACKGROUND,
		// smooth cartoon art: soft edges, and parts drawn smaller than
		// the atlas stay clean
		antiAlias: true,
		textureFilter: "linear-mipmap",
	});
	await app.init();

	const base = import.meta.env.BASE_URL;
	const levelDir = `${base}assets/starsweep/levels/`;
	await loader.preload([
		// the characters, and their animations
		{ name: CAST, type: "image", src: `${base}assets/starsweep/cast.png` },
		{ name: CAST, type: "json", src: `${base}assets/starsweep/cast.json` },
		// Kenney Future (CC0), shared with the UI example
		{
			name: FONT,
			type: "fontface",
			src: `${base}assets/ui/font/kenvector_future.woff2`,
		},
		// the levels, edited in Tiled, the tileset they share and its image
		{ name: TILESET_FILE, type: "tsx", src: `${levelDir}${TILESET_FILE}.tsj` },
		{
			name: TILESET_FILE,
			type: "image",
			src: `${levelDir}${TILESET_FILE}.png`,
		},
		...LEVEL_FILES.map((name) => ({
			name,
			type: "tmx",
			src: `${levelDir}${name}.tmj`,
		})),
	]);

	// turn each Tiled map into a level the game can play
	const tileset = loader.getTMX(TILESET_FILE) as TiledTileset;
	const levels = LEVEL_FILES.map((name) =>
		levelFromTiled(loader.getTMX(name) as TiledMap, tileset, name),
	);

	// the classes the maps' objects are built with: `level.load` makes a Bolt
	// and the portals where each map's `actors` layer puts them
	registerTiledObjectClass("Bolt", Bolt);
	registerTiledObjectClass("Portal", Portal);
	state.set(state.MENU, new TitleScreen());
	state.set(state.PLAY, new PlayScreen(levels));
	state.transition("fade", BACKGROUND, 250);
	controls.bind();
	state.change(state.MENU);

	// release the keys and listeners when leaving the example
	return () => controls.unbind();
};

/** the Starsweep example, as a component of the examples site */
export const ExampleStarsweep = createExampleComponent(createGame);
