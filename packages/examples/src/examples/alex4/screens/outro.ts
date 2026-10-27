/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 *
 * The ending: a port of the original outro script (SCR_OUTRO), played on
 * the outro map, with the speech bubbles of the original script engine.
 */
import {
	type Application,
	audio,
	level,
	Renderable,
	type Renderer,
	Stage,
	state,
} from "melonjs";
import { PALETTE, SCALE, TICK_MS } from "../constants";
import { confirmPressed, justPressed, syncControls } from "../controls";
import { gameState, saveProgress } from "../gameState";
import { drawLabel, drawSprite, drawText } from "../gfx";
import { takeSpawns } from "../play/spawns";
import { stopMusic } from "./music";

type Side = "left" | "right";
type Step =
	| ["set", string, number, number, Side | "rotate"]
	| ["move", string, number, number]
	| ["del", string]
	| ["run", number]
	| ["say", number, number, Side, string[], number]
	| ["sfx", string, boolean]
	| ["stop", string];

/** script object name -> sprite */
const SPRITES: Record<string, string> = {
	alex: "alex",
	lola: "lola",
	ball: "hero_ball",
	ship0: "ship0",
	ship1: "ship1",
	ufo0: "ufo0",
	ufo1: "ufo1",
	beam: "ufobeam",
	drumcan1: "drumcan",
	drumcan2: "drumcan",
};

const SCRIPT: Step[] = [
	["set", "ship0", 160, 64, "left"],
	["set", "drumcan1", 112, 16, "left"],
	["set", "drumcan2", 112, 32, "left"],
	["set", "beam", 40, -120, "right"],
	["set", "ufo0", 11, -30, "right"],
	["set", "ufo1", 39, -14, "right"],
	["set", "alex", 48, 64, "right"],
	["set", "lola", 144, 32, "left"],
	["run", 11],
	["say", 60, 60, "left", ["Lola! Are", "you ok?"], 2000],
	// Lola rolls into the drum cans
	["del", "lola"],
	["set", "ball", 144, 32, "rotate"],
	["move", "ball", -2, 0],
	["run", 10],
	["sfx", "crush", false],
	["move", "drumcan1", -2, -1],
	["move", "drumcan2", -1, -2],
	["run", 16],
	["del", "ball"],
	["set", "lola", 94, 32, "left"],
	["move", "lola", -1, 2],
	["run", 16],
	["move", "lola", 0, 0],
	["move", "drumcan1", 0, 0],
	["move", "drumcan2", 0, 0],
	["say", 80, 50, "right", ["I'm fine. You came", "just in time!"], 2000],
	["say", 60, 60, "left", ["I'm so happy", "to see you!"], 2000],
	["say", 80, 50, "right", ["Thank you for", "saving me."], 2000],
	["sfx", "engine", true],
	["say", 60, 60, "left", ["Wait, what's", "that sound?"], 2000],
	// the UFO comes down and beams Alex up
	["move", "ufo0", 0, 1],
	["move", "ufo1", 0, 1],
	["move", "beam", 0, 1],
	["run", 30],
	["move", "ufo0", 0, 0],
	["move", "ufo1", 0, 0],
	["move", "beam", 0, 0],
	["run", 50],
	["sfx", "energy", true],
	["move", "beam", 0, 1],
	["run", 90],
	["move", "beam", 0, 0],
	["say", 80, 50, "right", ["Alex!"], 1000],
	["say", 60, 60, "left", ["Lola!"], 1000],
	["move", "beam", 0, -1],
	["move", "alex", 0, -1],
	["run", 100],
	["stop", "energy"],
	["move", "ufo0", 0, -1],
	["move", "ufo1", 0, -1],
	["run", 30],
	["move", "ufo0", 0, 0],
	["move", "ufo1", 0, 0],
	["move", "beam", 0, 0],
	["move", "alex", 0, 0],
	["stop", "engine"],
	["say", 80, 50, "right", ["I'll save you!"], 1000],
	// Lola takes the ship
	["sfx", "ship", false],
	["set", "ship0", 160, 64, "left"],
	["move", "ship0", -2, 0],
	["run", 43],
	["move", "ship0", 0, 0],
	["say", 80, 50, "right", ["Yay!"], 500],
	["set", "ship1", 74, 64, "left"],
	["del", "ship0"],
	["del", "lola"],
	["run", 50],
	["sfx", "ship", false],
	["move", "ship1", -1, 0],
	["run", 16],
	["move", "ship1", -2, -1],
	["run", 8],
	["move", "ship1", -2, -2],
	["run", 8],
	["move", "ship1", -2, -3],
	["run", 50],
];

type ScriptObject = {
	sprite: string;
	x: number;
	y: number;
	vx: number;
	vy: number;
	dir: Side | "rotate";
	order: number;
};

class OutroPlayer extends Renderable {
	private objects = new Map<string, ScriptObject>();
	private pc = 0;
	private runTicks = 0;
	private waitMs = 0;
	private accumulator = 0;
	private ticks = 0;
	private bubble:
		| { x: number; y: number; side: Side; lines: string[] }
		| undefined;
	private finished = false;
	private order = 0;

	constructor() {
		super(0, 0, 640, 480);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		if (justPressed("escape")) {
			this.end();
			return true;
		}
		if (this.finished) {
			if (confirmPressed()) {
				this.end();
			}
			return true;
		}
		confirmPressed();
		this.accumulator += dt;
		while (this.accumulator >= TICK_MS && !this.finished) {
			this.accumulator -= TICK_MS;
			this.step();
		}
		return true;
	}

	private end() {
		for (const s of ["engine", "energy"]) {
			audio.stop(s);
		}
		state.change(state.CREDITS, false);
	}

	/** advance the script by one 20 ms tick */
	private step() {
		if (this.waitMs > 0) {
			this.waitMs -= TICK_MS;
			if (this.waitMs <= 0) this.bubble = undefined;
			return;
		}
		if (this.runTicks > 0) {
			this.runTicks--;
			this.ticks++;
			for (const o of this.objects.values()) {
				o.x += o.vx;
				o.y += o.vy;
			}
			return;
		}
		// run instant commands until a blocking one
		while (this.pc < SCRIPT.length) {
			const cmd = SCRIPT[this.pc++];
			switch (cmd[0]) {
				case "set": {
					const [, name, x, y, dir] = cmd;
					const prev = this.objects.get(name);
					this.objects.set(name, {
						sprite: SPRITES[name],
						x,
						y,
						vx: 0,
						vy: 0,
						dir,
						order: prev?.order ?? this.order++,
					});
					break;
				}
				case "move": {
					const o = this.objects.get(cmd[1]);
					if (o) {
						o.vx = cmd[2];
						o.vy = cmd[3];
					}
					break;
				}
				case "del":
					this.objects.delete(cmd[1]);
					break;
				case "sfx":
					audio.play(cmd[1], cmd[2]);
					break;
				case "stop":
					audio.stop(cmd[1]);
					break;
				case "run":
					this.runTicks = cmd[1];
					return;
				case "say":
					this.bubble = { x: cmd[1], y: cmd[2], side: cmd[3], lines: cmd[4] };
					this.waitMs = cmd[5];
					return;
			}
		}
		this.finished = true;
		saveProgress();
	}

	override draw(renderer: Renderer) {
		// newest objects first, as the original linked list was drawn
		const list = [...this.objects.values()].sort((a, b) => b.order - a.order);
		for (const o of list) {
			if (o.dir === "rotate") {
				drawSprite(renderer, o.sprite, o.x, o.y, {
					angle: (-8 * this.ticks * Math.PI * 2) / 256,
				});
			} else {
				drawSprite(renderer, o.sprite, o.x, o.y, { flipX: o.dir === "right" });
			}
		}
		if (this.bubble) {
			this.drawBubble(renderer, this.bubble);
		}
		if (this.finished) {
			drawLabel(renderer, "THE END ?", 320, 150, 40, "center");
			drawLabel(renderer, `SCORE ${gameState.score}`, 320, 220, 32, "center");
			drawLabel(renderer, "PRESS JUMP", 320, 400, 32, "center");
		}
	}

	/** a speech bubble pointing at (x, y), in original pixels */
	private drawBubble(
		renderer: Renderer,
		b: { x: number; y: number; side: Side; lines: string[] },
	) {
		const glyph = 16;
		const w = Math.max(...b.lines.map((l) => l.length)) * glyph + 16;
		const h = b.lines.length * glyph + 12;
		const px = b.x * SCALE;
		const py = b.y * SCALE;
		let bx = b.side === "left" ? px - 24 : px - w + 24;
		bx = Math.max(4, Math.min(bx, 636 - w));
		const by = py - h - 24;
		// light border, dark inside: the font glyphs are light
		renderer.setColor(PALETTE[3]);
		renderer.fillRect(bx - 4, by - 4, w + 8, h + 8);
		renderer.setColor(PALETTE[0]);
		renderer.fillRect(bx, by, w, h);
		// the tail
		for (let i = 0; i < 6; i++) {
			renderer.setColor(PALETTE[3]);
			renderer.fillRect(
				px - 2 + (b.side === "left" ? -i * 2 : i * 2),
				by + h + i * 4,
				8,
				4,
			);
		}
		b.lines.forEach((line, i) => {
			drawText(renderer, line, bx + 8, by + 6 + i * glyph, 32, "left", 0.5);
		});
	}
}

export class OutroScreen extends Stage {
	override onResetEvent(app: Application) {
		syncControls();
		stopMusic();
		level.load("a4_outro", {
			onLoaded: () => {
				takeSpawns(app.world);
				app.viewport.moveTo(0, 0);
				app.world.addChild(new OutroPlayer(), 50);
				audio.playTrack("level_song");
			},
		});
	}

	override onDestroyEvent() {
		stopMusic();
	}
}
