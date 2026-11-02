/**
 * melonJS — Starsweep: title and play screens.
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
	save,
	state,
	Text,
	type TMXLayer,
} from "melonjs";
import { Actor, GLOW } from "./cast";
import { Controls } from "./controls";
import {
	drawGlow,
	drawPanelDetail,
	drawSky,
	drawSlab,
	FONT,
	makeStars,
	type Renderer,
	type Star,
	TILE,
} from "./draw";
import { Field, HEIGHT, HISCORE_KEY, OX, OY, WIDTH } from "./field";
import {
	addLayerFx,
	addVignette,
	DeepSpace,
	Effects,
	GAME_LAYER,
	makeSpaceCamera,
	NebulaBackdrop,
	SPACE_LAYER,
	SpaceBackdrop,
} from "./fx";
import * as sfx from "./sfx";

/** shared by both screens; bound once in `ExampleStarsweep` */
export const controls = new Controls();

/**
 * Sets a screen up in two layers.
 *
 * - **Space**, behind: the shader nebula and, when the renderer can do 3D,
 *   the star dust and novas. These are on the space visibility layer, which
 *   only the space camera (a `Camera3d`) draws, and it draws first.
 * - **The game**, in front: a container for everything else, drawn by the
 *   stage's ordinary 2D camera, which leaves the space layer out. The bloom
 *   and the hit aberration are on this container, so the space shows
 *   through around the game (see `addLayerFx`).
 * @returns the game's container, the nebula (null when the drawn sky should
 * be used instead), and the 3D space (null without a 3D camera)
 */
const setUpLayers = (app: Application, camera: Camera3d | null) => {
	const world = app.world;
	const game = new Container(0, 0, WIDTH, HEIGHT);
	game.name = "game";
	world.addChild(game, 0);
	addLayerFx(game);
	addVignette(camera ?? game);

	let deep: DeepSpace | null = null;
	if (camera) {
		// the world is on every layer, so each camera walks into it
		world.visibilityLayer = 1 | SPACE_LAYER | GAME_LAYER;
		game.visibilityLayer = GAME_LAYER;
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

/** the play screen loads a level into the world: keep these across it */
const keep = <T extends { isPersistent: boolean }>(r: T) => {
	r.isPersistent = true;
	return r;
};

/** A strip of tiles lighting up as Bolt runs over it, a blot in pursuit. */
class TitleBackdrop extends Renderable {
	private time = 0;
	private stars: Star[] = makeStars(140, WIDTH, HEIGHT);
	private onStart: () => void;
	/** false when a shader sky is drawn behind instead */
	drawnSky = true;
	/** the 3D space behind, for a nova now and then */
	deep: DeepSpace | null = null;
	private nextNova = 1;
	/** Bolt, then the monsters after it */
	readonly runners = [
		new Actor("bolt-walk-right"),
		new Actor("wobbler-walk-right"),
		new Actor("muncher-walk-right"),
		new Actor("chaser-walk-right"),
	];

	constructor(onStart: () => void) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.onStart = onStart;
	}

	override update(dt: number) {
		this.time += dt / 1000;
		controls.poll();
		if (this.time > 0.5 && controls.confirm()) {
			this.onStart();
		}
		this.nextNova -= dt / 1000;
		if (this.nextNova <= 0) {
			this.nextNova = 2 + Math.random() * 3;
			this.deep?.burst(Math.random() < 0.5 ? "#ff5fb8" : "#2ee6d6");
		}
		const { x, y } = this.boltAt();
		const gaps = [0, 1.8, 3.1, 4.4];
		this.runners.forEach((runner, i) => {
			runner.place(x - TILE * gaps[i], y);
		});
		return true;
	}

	/** Bolt loops across the deck, powering it up, monsters in pursuit */
	private boltAt() {
		const loop = 7;
		const u = (this.time % loop) / loop;
		const tile = -1 + u * (11 + 5);
		return {
			tile,
			x: (WIDTH - 11 * TILE) / 2 + tile * TILE + TILE / 2,
			y: DECK_Y + TILE / 2 - 4,
		};
	}

	override draw(r: Renderer) {
		if (this.drawnSky) {
			drawSky(r, "#0b0a24", this.stars, WIDTH, HEIGHT, this.time, "#a12a6f");
		}
		const cols = 11;
		const x0 = (WIDTH - cols * TILE) / 2;
		const y0 = DECK_Y;
		const boltX = this.boltAt().tile;
		for (let i = 0; i < cols; i++) {
			const lit = i < boltX;
			drawSlab(
				r,
				x0 + i * TILE,
				y0,
				lit ? "#2ee6d6" : "#2b3052",
				lit ? "#128a87" : "#161a32",
			);
			drawPanelDetail(r, x0 + i * TILE, y0, lit);
		}
		// a glow under each runner; the sprites draw over it
		const glows = [GLOW.bolt, GLOW.wobbler, GLOW.muncher, GLOW.chaser];
		this.runners.forEach((runner, i) => {
			drawGlow(r, runner.pos.x, runner.pos.y, 26, glows[i], 0.75);
		});
	}
}

/** the title screen's strip of deck */
const DECK_Y = 500;

export class TitleScreen extends Stage {
	private backdrop?: TitleBackdrop;
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
		this.backdrop = new TitleBackdrop(() => {
			sfx.sfxStart();
			state.change(state.PLAY);
		});
		game.addChild(this.backdrop, 0);
		for (const runner of this.backdrop.runners) {
			runner.isPersistent = false;
			game.addChild(runner, 1);
		}
		this.deep = deep;
		this.backdrop.deep = deep;
		deep?.setColors(["#ff5fb8", "#2ee6d6", "#ffffff", "#b98bff"]);
		if (sky) {
			sky.setTheme("#0b0a24", "#a12a6f", "#2e2766");
			this.backdrop.drawnSky = false;
		}
		controls.attach(false);

		const text = (
			y: number,
			size: number,
			color: string,
			value: string,
			bold = false,
		) => {
			const t = new Text(WIDTH / 2, y, {
				font: FONT,
				size,
				bold,
				fillStyle: color,
				textAlign: "center",
				textBaseline: "top",
				text: value,
			});
			t.floating = true;
			game.addChild(t, 10);
			return t;
		};
		// a drop shadow, then the title over it
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
		const best = (save as unknown as Record<string, number>)[HISCORE_KEY] ?? 0;
		text(740, 22, "#ffd23d", `HI ${best.toString().padStart(6, "0")}`);
		const prompt = text(840, 24, "#ffffff", "TAP TO START");
		prompt.alpha = 1;
		const blink = new (class extends Renderable {
			private t = 0;
			constructor() {
				super(0, 0, 1, 1);
				this.alwaysUpdate = true;
			}
			override update(dt: number) {
				this.t += dt / 1000;
				prompt.alpha = 0.55 + 0.45 * Math.sin(this.t * 4);
				return true;
			}
			override draw() {}
		})();
		game.addChild(blink, 0);
	}

	override onDestroyEvent() {
		// the dust and novas are persistent, so the next reset keeps them: take them out
		this.deep?.destroy();
		this.deep = null;
	}
}

export class PlayScreen extends Stage {
	private field: Field | null = null;
	/** what this screen put in the world and must take out again */
	private kept: Renderable[] = [];
	private effects: Effects | null = null;
	private deep: DeepSpace | null = null;
	private readonly space: Camera3d | null;

	constructor() {
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
			keep(child as Renderable);
			this.kept.push(child as Renderable);
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

		const field = new Field({
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
				// the reset inside level.load drops a z-sort still pending
				// for the objects kept above: sort the world again
				world.sort();
				const layer = (name: string) =>
					board.getChildByName(name)[0] as unknown as TMXLayer;
				return { station: layer("station"), power: layer("power") };
			},
		});
		field.onExit = () => state.change(state.MENU);
		game.addChild(field, 1);
		game.addChild(field.front, 4);
		for (const t of field.hud) {
			game.addChild(t, 10);
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
