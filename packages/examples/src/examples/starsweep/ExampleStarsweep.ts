/**
 * melonJS — Starsweep: a panel-powering maze game in space.
 *
 * Guide Bolt, a little sweeper robot, around floating space stations and
 * power up every deck panel while monsters roam. Wobblers wander, munchers
 * eat the power back off, chasers come for you and drones fly over the
 * gaps. Frozen panels keep you sliding, conveyor pads push you, damaged
 * panels drop away behind you, goo slows the monsters and switches open
 * gates. Zap the monsters, grab power-ups, and don't fall off into space.
 * Portrait, for phones held upright; on touch screens a virtual gamepad
 * (`@melonjs/gamepad-plugin`) presses the same keys as the keyboard.
 *
 * This file loads everything and starts the title screen. The rest, one
 * class per file:
 *
 * - `scenes/`: the screens, as `Stage`s. `TitleScreen` (with its
 *   `TitleBackdrop` and `StartBeacon`), `PlayScreen`, and `layers.ts`, the
 *   two layers both are drawn in.
 * - `game/`: the game as it is played. `Field` runs a run of levels and
 *   puts the rest together: `Station` (the board), `Player` (Bolt) and
 *   `Sparks` (its zaps), `Monsters`, `Navigation` (where monsters can go,
 *   with `@melonjs/pathfinding-plugin`), `Powers` (the power-ups),
 *   `FieldFront` (drawn over the characters) and `movers.ts` (cell-to-cell
 *   walking, shared by Bolt and the monsters).
 * - `entities/`: the characters' sprites. `Actor` (a sprite over the cast
 *   sheet), and `Bolt` and `Portal`, which the maps place (see below).
 * - `rules/`: no engine, so they run in Node too. `board.ts` (the tiles and
 *   how moves go), `levels.ts` (reading a level from its Tiled map) and
 *   `check-levels.ts` (`pnpm check:starsweep`, which checks every level
 *   can be cleared).
 * - `fx/`: what makes it shine. `NebulaBackdrop` (a custom shader sky, its
 *   source in `nebulaShader.ts`), `DeepSpace` (3D star dust and novas, seen
 *   by `spaceCamera.ts`), `Effects` (particle bursts and spark trails),
 *   `SpaceBackdrop` (the planet, and the sky on Canvas) and `screenFx.ts`
 *   (bloom, vignette and chromatic aberration).
 * - `ui/Hud`, `input/Controls`, `audio/sfx.ts` (every sound synthesised
 *   with `audio.tone` / `audio.noise`), `config/layout.ts` (sizes and
 *   places) and `utils/` (drawing helpers, and the saved best score).
 *
 * The levels are Tiled maps (`public/assets/starsweep/levels/*.tmj`);
 * `rules/levels.ts` says how to edit them. Bolt and the portals are objects
 * in each map's `actors` layer: the classes registered below build them
 * when a level loads. The characters are sprites from one sheet,
 * `cast.png`, baked from Kenney's Monster Builder Pack (CC0) with every
 * animation in its JSON (`pnpm bake:starsweep` bakes it again).
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
