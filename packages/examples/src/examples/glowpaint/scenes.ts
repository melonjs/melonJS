/**
 * melonJS — Glowpaint: title and play screens.
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
import { Controls } from "./controls";
import {
	drawEnemy,
	drawLumi,
	drawSky,
	drawSlab,
	makeStars,
	type Renderer,
	type Star,
	TILE,
} from "./draw";
import { Field, HEIGHT, HISCORE_KEY, WIDTH } from "./field";
import * as sfx from "./sfx";

/** shared by both screens; bound once in `ExampleGlowpaint` */
export const controls = new Controls();

/** A strip of tiles lighting up as Lumi runs over it, a blot in pursuit. */
class TitleBackdrop extends Renderable {
	private time = 0;
	private stars: Star[] = makeStars(140, WIDTH, HEIGHT);
	private onStart: () => void;

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
		drawSky(r, "#0b0a24", this.stars, WIDTH, HEIGHT, this.time);
		const cols = 14;
		const x0 = (WIDTH - cols * TILE) / 2;
		const y0 = 330;
		// Lumi loops across the strip; tiles behind it are lit
		const loop = 7;
		const u = (this.time % loop) / loop;
		const lumiX = -1 + u * (cols + 3);
		for (let i = 0; i < cols; i++) {
			const lit = i < lumiX;
			drawSlab(
				r,
				x0 + i * TILE,
				y0,
				lit ? "#2ee6d6" : "#2b3052",
				lit ? "#128a87" : "#161a32",
			);
		}
		const lx = x0 + lumiX * TILE + TILE / 2;
		const hop = Math.abs(Math.sin(this.time * 10)) * 6;
		drawLumi(r, lx, y0 + TILE / 2 - 6 - hop, 1, this.time, { squash: 0.6 });
		drawEnemy(r, "blot", lx - TILE * 2.2, y0 + TILE / 2 - 6, 1, this.time, 1);
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
		controls.reset();

		const text = (
			y: number,
			size: number,
			color: string,
			value: string,
			bold = true,
		) => {
			const t = new Text(WIDTH / 2, y, {
				font: "Arial",
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
		text(76, 84, "#3b1f8a", "GLOWPAINT").pos.x += 5;
		text(70, 84, "#fff2a8", "GLOWPAINT");
		text(172, 22, "#c9c3ff", "Light up every tile. Dodge the ink.");
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
		for (const t of field.hud) {
			app.world.addChild(t, 10);
		}
		field.newGame();
	}
}
