/**
 * melonJS — Starsweep: title and play screens.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	Container,
	level,
	Renderable,
	Stage,
	save,
	state,
	Text,
	type TMXLayer,
} from "melonjs";
import { drawBolt, drawMonster } from "./characters";
import { Controls } from "./controls";
import {
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
	Cruisers,
	Effects,
	NebulaBackdrop,
	SpaceBackdrop,
	setupScreenFx,
} from "./fx";
import * as sfx from "./sfx";

/** shared by both screens; bound once in `ExampleStarsweep` */
export const controls = new Controls();

/**
 * The shader sky and passing 3D ships, on renderers that can do them.
 * Returns the sky, or null when the drawn fallback should be used.
 */
const addSpace = (
	app: Application,
	ships: ConstructorParameters<typeof Cruisers>[2],
): NebulaBackdrop | null => {
	setupScreenFx(app);
	const sky = new NebulaBackdrop(WIDTH, HEIGHT);
	if (!sky.supported) {
		return null;
	}
	app.world.addChild(sky, -10);
	if (Cruisers.supported()) {
		app.world.addChild(new Cruisers(WIDTH, HEIGHT, ships), -5);
	}
	return sky;
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
		return true;
	}

	override draw(r: Renderer) {
		if (this.drawnSky) {
			drawSky(r, "#0b0a24", this.stars, WIDTH, HEIGHT, this.time, "#a12a6f");
		}
		const cols = 11;
		const x0 = (WIDTH - cols * TILE) / 2;
		const y0 = 500;
		// Bolt loops across the deck, powering it up, monsters in pursuit
		const loop = 7;
		const u = (this.time % loop) / loop;
		const boltX = -1 + u * (cols + 5);
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
		const lx = x0 + boltX * TILE + TILE / 2;
		const ly = y0 + TILE / 2 - 4;
		drawBolt(r, lx, ly, 1, this.time, { walking: true });
		drawMonster(r, "wobbler", lx - TILE * 1.8, ly, 1, this.time, 1);
		drawMonster(r, "muncher", lx - TILE * 3.1, ly, 1, this.time, 2);
		drawMonster(r, "chaser", lx - TILE * 4.4, ly, 1, this.time, 3);
	}
}

export class TitleScreen extends Stage {
	private backdrop?: TitleBackdrop;

	override onResetEvent(app: Application) {
		app.reset();
		this.backdrop = new TitleBackdrop(() => {
			sfx.sfxStart();
			state.change(state.PLAY);
		});
		app.world.addChild(this.backdrop, 0);
		const sky = addSpace(app, { every: [5, 9], sizes: [110, 170], first: 0.5 });
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
			app.world.addChild(t, 10);
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
		app.world.addChild(blink, 0);
	}
}

export class PlayScreen extends Stage {
	private field: Field | null = null;
	/** what this screen put in the world and must take out again */
	private kept: Renderable[] = [];
	private effects: Effects | null = null;

	override onResetEvent(app: Application) {
		app.reset();
		const world = app.world;
		const sky = addSpace(app, { every: [10, 18], sizes: [70, 110], first: 4 });
		// `level.load` empties the world of everything not persistent
		for (const child of world.getChildren()) {
			keep(child as Renderable);
			this.kept.push(child as Renderable);
		}
		// the planet, and the whole sky when there is no shader for it
		const backdrop = keep(
			new SpaceBackdrop(WIDTH, HEIGHT, sky === null, {
				x: WIDTH - 40,
				y: OY + 70,
			}),
		);
		// each level's Tiled map is loaded into this container, at the board's place
		const board = keep(new Container(OX, OY, WIDTH, HEIGHT));
		board.name = "board";
		world.addChild(backdrop, -1);
		world.addChild(board, 0);
		this.kept.push(backdrop, board);
		this.effects = new Effects(world, 3);

		const field = new Field({
			controls,
			effects: this.effects,
			backdrop,
			sky,
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
		world.addChild(field, 2);
		this.kept.push(field);
		for (const t of field.hud) {
			world.addChild(t, 10);
			this.kept.push(t);
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
