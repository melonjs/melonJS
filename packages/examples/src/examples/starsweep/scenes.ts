/**
 * melonJS — Starsweep: the title and play screens.
 *
 * Both are `Stage`s drawn in two layers: the space behind (a shader nebula
 * and, where the renderer can do 3D, star dust and novas seen by a second,
 * perspective camera) and the game in front. The title shows Bolt running
 * across a strip of deck with monsters after it, the best score, a start
 * button and the credits; the play screen hosts the playing field.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	type Camera3d,
	Container,
	level,
	Renderable,
	Stage,
	state,
	type TMXLayer,
	UITextButton,
} from "melonjs";
import { COLS } from "./board";
import { Actor, GLOW } from "./cast";
import { controls } from "./controls";
import {
	drawGlow,
	drawPanelDetail,
	drawSky,
	drawSlab,
	FONT,
	makeLabel,
	makeStars,
	type Renderer,
	type Star,
} from "./draw";
import { Field } from "./field";
import {
	DeepSpace,
	Effects,
	makeSpaceCamera,
	NebulaBackdrop,
	SPACE_LAYER,
	SpaceBackdrop,
	setupScreenFx,
} from "./fx";
import { BACKGROUND, HEIGHT, OX, OY, STAND_LIFT, TILE, WIDTH } from "./layout";
import { type LevelDef, THEMES } from "./levels";
import { formatScore, loadHiscore } from "./score";
import * as sfx from "./sfx";

/**
 * Sets a screen up in two layers.
 *
 * - **Space**, behind: the shader nebula and, when the renderer can do 3D,
 *   the star dust and novas. These are on the space visibility layer, which
 *   only the space camera (a `Camera3d`) draws, and it draws first.
 * - **The game**, in front: a container for everything else, drawn by the
 *   stage's ordinary 2D camera, which leaves the space layer out. Its bloom
 *   is blended over the space (see `setupScreenFx`).
 * @returns the game's container, the nebula (null when the drawn sky should
 * be used instead), and the 3D space (null without a 3D camera)
 */
const setUpLayers = (app: Application, camera: Camera3d | null) => {
	const world = app.world;
	const game = new Container(0, 0, WIDTH, HEIGHT);
	game.name = "game";
	world.addChild(game, 0);
	setupScreenFx(app, camera);

	let deep: DeepSpace | null = null;
	if (camera) {
		// the world is on both layers, so each camera walks into it
		world.visibilityLayer = 1 | SPACE_LAYER;
		app.viewport.cullMask = ~SPACE_LAYER;
		deep = new DeepSpace(world, camera);
		world.addChild(deep, 0);
	}
	let sky: NebulaBackdrop | null = new NebulaBackdrop(WIDTH, HEIGHT);
	if (!sky.supported) {
		sky = null;
	} else if (camera) {
		// the space camera draws it, as far back as it can see
		sky.visibilityLayer = SPACE_LAYER;
		sky.visibleInAllCameras = true;
		world.addChild(sky, -5000);
	} else {
		world.addChild(sky, -10);
	}
	return { game, sky, deep };
};

/** a stage's settings, with the space camera when the renderer can do 3D */
const withSpaceCamera = () => {
	const camera = makeSpaceCamera(WIDTH, HEIGHT);
	return { camera, settings: camera ? { cameras: [camera] } : {} };
};

/** the title's colours: the cyan and pink themes */
const TITLE = {
	sky: BACKGROUND,
	clouds: THEMES.pink.litSide,
	deepClouds: THEMES.cyan.wallSide,
	novas: [THEMES.pink.lit, THEMES.cyan.lit],
	dust: [THEMES.pink.lit, THEMES.cyan.lit, "#ffffff", THEMES.violet.lit],
	lit: THEMES.cyan.lit,
	litSide: THEMES.cyan.litSide,
};

/** the title's strip of deck: where it is, and its unlit colours */
const DECK = { y: 500, face: "#2b3052", side: "#161a32" };
/** seconds Bolt takes to run across the deck and come round again */
const LAP_TIME = 7;
/** Bolt, then the monsters after it, and how many cells behind each runs */
const RUNNERS = [
	{ kind: "bolt", behind: 0 },
	{ kind: "wobbler", behind: 1.8 },
	{ kind: "muncher", behind: 3.1 },
	{ kind: "chaser", behind: 4.4 },
] as const;

/** A strip of tiles lighting up as Bolt runs over it, monsters in pursuit. */
class TitleBackdrop extends Renderable {
	/** false when a shader sky is drawn behind instead */
	drawnSky = true;
	/** the 3D space behind, for a nova now and then */
	deep: DeepSpace | null = null;
	/** the runners' sprites, for the screen to add */
	readonly runners = RUNNERS.map(({ kind }) => new Actor(`${kind}-walk-right`));

	private time = 0;
	private readonly stars: Star[] = makeStars(140, WIDTH, HEIGHT);
	private nextNova = 1;
	private started = false;

	constructor(private readonly onStart: () => void) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	/** start the game, once: the start button, or a key */
	start() {
		if (!this.started) {
			this.started = true;
			this.onStart();
		}
	}

	override update(dt: number) {
		this.time += dt / 1000;
		controls.poll();
		if (this.time > 0.5 && controls.confirm()) {
			this.start();
		}
		this.nextNova -= dt / 1000;
		if (this.nextNova <= 0) {
			this.nextNova = 2 + Math.random() * 3;
			this.deep?.burst(TITLE.novas[Math.random() < 0.5 ? 0 : 1]);
		}
		const y = DECK.y + TILE / 2 - STAND_LIFT;
		const at = this.boltCell();
		this.runners.forEach((runner, i) => {
			runner.place(OX + (at - RUNNERS[i].behind) * TILE + TILE / 2, y);
		});
		return true;
	}

	/**
	 * Where Bolt is along the deck, in cells: it runs in from off the left,
	 * and out past the right until the last monster has gone too.
	 */
	private boltCell() {
		const start = -1;
		const end = COLS + RUNNERS[RUNNERS.length - 1].behind + 1;
		const u = (this.time % LAP_TIME) / LAP_TIME;
		return start + u * (end - start);
	}

	override draw(r: Renderer) {
		if (this.drawnSky) {
			drawSky(r, TITLE.sky, this.stars, WIDTH, HEIGHT, this.time, TITLE.clouds);
		}
		// the deck lights up behind Bolt
		const lit = this.boltCell();
		for (let i = 0; i < COLS; i++) {
			const on = i < lit;
			const x = OX + i * TILE;
			drawSlab(
				r,
				x,
				DECK.y,
				on ? TITLE.lit : DECK.face,
				on ? TITLE.litSide : DECK.side,
			);
			drawPanelDetail(r, x, DECK.y, on);
		}
		// a glow under each runner; the sprites draw over it
		this.runners.forEach((runner, i) => {
			drawGlow(r, runner.pos.x, runner.pos.y, 26, GLOW[RUNNERS[i].kind], 0.75);
		});
	}
}

/** the title's start button */
const START = { x: WIDTH / 2 - 140, y: 812, width: 280, height: 68 };
/** seconds between two rings of the start button's beacon */
const BEACON_TIME = 1.4;

/** rings pulsing out of the start button, to draw the eye to it */
class StartBeacon extends Renderable {
	private t = 0;

	constructor() {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.floating = true;
	}

	override update(dt: number) {
		this.t = (this.t + dt / 1000) % BEACON_TIME;
		return true;
	}

	override draw(r: Renderer) {
		const k = this.t / BEACON_TIME;
		const grow = 4 + k * 22;
		r.setGlobalAlpha(0.7 * (1 - k));
		r.setColor(THEMES.pink.lit);
		r.lineWidth = 3;
		r.strokeRoundRect(
			START.x - grow,
			START.y - grow,
			START.width + grow * 2,
			START.height + grow * 2,
			18 + grow,
		);
		r.setGlobalAlpha(1);
	}
}

/** The title screen: the game's name, how to play, and a start button. */
export class TitleScreen extends Stage {
	private deep: DeepSpace | null = null;
	private readonly space: Camera3d | null;

	constructor() {
		const { camera, settings } = withSpaceCamera();
		super(settings);
		this.space = camera;
	}

	override onResetEvent(app: Application) {
		app.reset();
		const { game, sky, deep } = setUpLayers(app, this.space);
		const backdrop = new TitleBackdrop(() => {
			sfx.sfxStart();
			state.change(state.PLAY);
		});
		game.addChild(backdrop, 0);
		for (const runner of backdrop.runners) {
			game.addChild(runner, 1);
		}
		this.deep = deep;
		backdrop.deep = deep;
		deep?.setColors(TITLE.dust);
		if (sky) {
			sky.setTheme(TITLE.sky, TITLE.clouds, TITLE.deepClouds);
			backdrop.drawnSky = false;
		}
		controls.attach(false);

		const text = (y: number, size: number, color: string, words: string) => {
			const label = makeLabel(WIDTH / 2, y, size, color, "center", words);
			game.addChild(label, 10);
			return label;
		};
		// the title on two lines, each over its own drop shadow
		for (const [y, word] of [
			[110, "STAR"],
			[220, "SWEEP"],
		] as const) {
			text(y + 7, 104, "#3b1f8a", word).pos.x += 6;
			text(y, 104, "#fff2a8", word);
		}
		text(360, 19, "#c9c3ff", "POWER UP EVERY PANEL.");
		text(390, 19, "#c9c3ff", "DODGE THE MONSTERS!");
		text(620, 15, "#8f88c9", "MOVE: DRAG LEFT, ARROWS OR WASD");
		text(646, 15, "#8f88c9", "ZAP: TOUCH RIGHT, SPACE OR X");
		text(740, 22, "#ffd23d", `HI ${formatScore(loadHiscore())}`);
		// the start button, with a beacon pulsing out of it (Enter or Space
		// starts too)
		game.addChild(new StartBeacon(), 9);
		const play = new UITextButton(START.x, START.y, {
			text: "TAP TO START",
			font: FONT,
			fontSize: 26,
			width: START.width,
			height: START.height,
			labelFillStyle: "#ffffff",
			hoverOffColor: "#e8459f",
			hoverOnColor: "#ff6fbd",
			pressedColor: "#b52f7c",
			borderColor: "#fff2a8",
			hoverScale: 1.05,
			pressScale: 0.94,
			onClick: () => {
				backdrop.start();
			},
		});
		play.floating = true;
		game.addChild(play, 10);
		// the credits (see packages/examples/LICENSE.md)
		text(928, 13, "#a59ee0", "MADE WITH MELONJS");
		text(952, 11, "#6f69a8", "CHARACTERS: KENNEY MONSTER BUILDER PACK (CC0)");
		text(970, 11, "#6f69a8", "FONT: KENNEY FUTURE (CC0)");
	}

	override onDestroyEvent() {
		// the dust and novas are persistent, so the next reset keeps them: take them out
		this.deep?.destroy();
		this.deep = null;
	}
}

/** The play screen: the board, the characters, and the field that runs them. */
export class PlayScreen extends Stage {
	private field: Field | null = null;
	/** what this screen put in the world and must take out again */
	private kept: Renderable[] = [];
	private effects: Effects | null = null;
	private deep: DeepSpace | null = null;
	private readonly space: Camera3d | null;

	/**
	 * @param levels - the levels, in play order
	 */
	constructor(private readonly levels: readonly LevelDef[]) {
		const { camera, settings } = withSpaceCamera();
		super(settings);
		this.space = camera;
	}

	override onResetEvent(app: Application) {
		app.reset();
		const world = app.world;
		const { game, sky, deep } = setUpLayers(app, this.space);
		this.deep = deep;
		// `level.load` empties the world of everything not persistent: keep
		// what this screen added, and take it out again when leaving
		for (const child of world.getChildren()) {
			const kept = child as Renderable;
			kept.isPersistent = true;
			this.kept.push(kept);
		}
		// the planet, and the whole sky when there is no shader for it
		const backdrop = new SpaceBackdrop(WIDTH, HEIGHT, sky === null, {
			x: WIDTH - 40,
			y: OY + 70,
		});
		// each level's Tiled map is loaded into this container, at the board's place
		const board = new Container(OX, OY, WIDTH, HEIGHT);
		board.name = "board";
		// Bolt and the monsters, over the board
		const actors = new Container(0, 0, WIDTH, HEIGHT);
		game.addChild(backdrop, -1);
		game.addChild(board, 0);
		game.addChild(actors, 2);
		this.effects = new Effects(game, 3);

		const field = new Field(
			{
				controls,
				effects: this.effects,
				actors,
				backdrop,
				sky,
				space: deep,
				loadBoard: async (file) => {
					await level.load(file, {
						container: board,
						setViewportBounds: false,
						async: true,
					});
					const layer = (name: string) =>
						board.getChildByName(name)[0] as unknown as TMXLayer;
					return { station: layer("station"), power: layer("power") };
				},
			},
			this.levels,
		);
		field.onExit = () => state.change(state.MENU);
		game.addChild(field, 1);
		game.addChild(field.front, 4);
		for (const item of field.hudItems) {
			game.addChild(item, 10);
		}
		this.field = field;
		controls.attach(true);
		field.newGame();
	}

	/** the world pauses with the game, but a stage keeps updating: pause here */
	override update(dt: number) {
		if (
			controls.pause() &&
			(state.isPaused() || this.field?.canPause === true)
		) {
			if (state.isPaused()) {
				state.resume();
			} else {
				state.pause();
			}
		}
		return super.update(dt);
	}

	override onDestroyEvent(app: Application) {
		if (state.isPaused()) {
			state.resume();
		}
		this.effects?.destroy();
		this.deep?.destroy();
		this.deep = null;
		for (const r of this.kept) {
			if (r.ancestor) {
				app.world.removeChild(r);
			}
		}
		this.kept = [];
		this.effects = null;
		this.field = null;
	}
}
