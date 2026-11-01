/**
 * melonJS — Starsweep: title and play screens.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	Renderable,
	Stage,
	save,
	state,
	Text,
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
import { Field, HEIGHT, HISCORE_KEY, WIDTH } from "./field";
import { Cruisers, NebulaBackdrop, setupScreenFx } from "./fx";
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
		const cols = 14;
		const x0 = (WIDTH - cols * TILE) / 2;
		const y0 = 338;
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
		controls.attach();

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
		text(76, 84, "#3b1f8a", "STARSWEEP").pos.x += 5;
		text(70, 84, "#fff2a8", "STARSWEEP");
		text(172, 22, "#c9c3ff", "Power up every panel. Dodge the monsters!");
		text(214, 17, "#8f88c9", "Move: arrows / WASD, or drag anywhere", false);
		text(240, 17, "#8f88c9", "Shoot: Space / X, or tap.   Pause: P", false);
		const best = (save as unknown as Record<string, number>)[HISCORE_KEY] ?? 0;
		text(430, 20, "#ffd23d", `HI ${best.toString().padStart(6, "0")}`);
		const prompt = text(500, 26, "#ffffff", "Tap or press Enter to start");
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
	override onResetEvent(app: Application) {
		app.reset();
		const field = new Field(controls);
		field.onExit = () => state.change(state.MENU);
		app.world.addChild(field, 0);
		field.sky = addSpace(app, { every: [10, 18], sizes: [70, 110], first: 4 });
		controls.attach();
		for (const t of field.hud) {
			app.world.addChild(t, 10);
		}
		field.newGame();
	}
}
