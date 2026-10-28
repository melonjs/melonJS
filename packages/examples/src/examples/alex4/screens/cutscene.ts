/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Application,
	audio,
	BitmapText,
	ColorLayer,
	input,
	level,
	type Renderable,
	Sprite,
	Stage,
	Tween,
	timer,
	UIPanel,
} from "melonjs";
import { FADE_COLOR, PALETTE, WIDTH } from "../constants";
import { bindPads, bindTap, NEXT_PAD, unbindPads, unbindTap } from "../gamepad";
import { gameState } from "../gameState";
import { shaders } from "../shaders";

// the scripts place things in pixels of the original screen, 4 times smaller
const SCALE = 4;

/** our screen in those pixels: as tall as the original, and wider */
export const SCREEN_W = WIDTH / SCALE;

// the scripts move things one step every 20ms
const STEP = 20;

// and fade in or out of a scene in three steps of 100ms
const FADE = 300;

// the backgrounds of the scenes away from the map go over it, and its water
const BACKDROP_Z = 6;

export type Facing = "left" | "right";

/*---------------------------------------------------------------------

	A cut scene, played like the scripts of the original game: things
	are placed and moved around the screen, people talk in speech
	bubbles, and scenes fade one into the other. Everything happens at
	a set time of its scene, as in the original.

  ---------------------------------------------------------------------	*/

export abstract class Cutscene extends Stage {
	protected app!: Application;
	private map: string;
	private song: string;
	private timers: number[] = [];
	private sounds: [name: string, id: number][] = [];
	private moves: [actor: Renderable, tween: Tween][] = [];
	// what the current scene added, cleared by the next one
	private cast: Renderable[] = [];
	private running = false;

	/**
	 * @param map - the map the scenes take place in
	 * @param song - played once, from the start
	 */
	constructor(map: string, song: string) {
		super();
		this.map = map;
		this.song = song;
	}

	/** what happens, and when */
	protected abstract play(): void;

	override onResetEvent(app: Application) {
		this.app = app;
		this.running = true;

		input.bindKey(input.KEY.ESC, "skip", true);
		input.bindKey(input.KEY.ENTER, "start", true);
		input.bindKey(input.KEY.X, "jump", true);
		input.bindKey(input.KEY.SPACE, "jump", true);
		bindPads(NEXT_PAD);
		// a click or a tap is a jump
		bindTap(app, input.KEY.X);

		level.load(this.map, {
			container: app.world,
			onLoaded: () => {
				shaders.sway(app.world);
				this.sound(this.song);
				this.play();
			},
		});
	}

	/** run something in some time, counted from the start of the scene */
	protected at(ms: number, fn: () => void) {
		this.timers.push(timer.setTimeout(fn, ms));
	}

	/** add something to the current scene */
	protected add<T extends Renderable>(renderable: T, z: number) {
		this.cast.push(renderable);
		this.app.world.addChild(renderable, z);
		return renderable;
	}

	/** take something out of the scene, if it is still there */
	protected remove(renderable: Renderable) {
		this.cast = this.cast.filter((r) => r !== renderable);
		// and stop it, if it was still going somewhere
		for (const [actor, tween] of this.moves) {
			if (actor === renderable) {
				tween.stop();
			}
		}
		this.moves = this.moves.filter(([actor]) => actor !== renderable);
		if (this.app.world.hasChild(renderable)) {
			this.app.world.removeChild(renderable);
		}
	}

	/**
	 * someone, or something, placed by its top left corner. The pictures all
	 * face left, as in the original.
	 */
	protected actor(
		region: string,
		x: number,
		y: number,
		facing: Facing = "left",
		z = 10,
	) {
		const sprite = new Sprite(x * SCALE, y * SCALE, {
			image: gameState.atlas,
			region,
			anchorPoint: { x: 0, y: 0 },
		});
		sprite.flipX(facing === "right");
		return this.add(sprite, z);
	}

	/** an actor going through some pictures, one every `delay` ms */
	protected animated(
		frames: string[],
		delay: number,
		x: number,
		y: number,
		facing: Facing = "left",
		z = 10,
	) {
		const sprite = new Sprite(x * SCALE, y * SCALE, {
			...gameState.atlas.getAnimationSettings(frames),
			anchorPoint: { x: 0, y: 0 },
		});
		sprite.addAnimation("play", frames, delay);
		sprite.setCurrentAnimation("play");
		sprite.flipX(facing === "right");
		return this.add(sprite, z);
	}

	/** move an actor by (dx, dy) on every step, during some steps */
	protected move(actor: Renderable, dx: number, dy: number, steps: number) {
		// relative values: "+8", "-8"
		const by = (d: number) => {
			const distance = d * steps * SCALE;
			return distance < 0 ? `${distance}` : `+${distance}`;
		};
		const tween = new Tween(actor.pos).to(
			{ x: by(dx), y: by(dy) },
			{ duration: steps * STEP },
		);
		this.moves.push([actor, tween]);
		return tween;
	}

	/**
	 * a speech bubble pointing down at (x, y), with its tail to the "left" or
	 * to the "right", or without one (the "text" of the original scripts)
	 */
	protected speak(
		x: number,
		y: number,
		tail: Facing | "none",
		lines: string[],
		ms: number,
	) {
		const width = Math.max(...lines.map((line) => line.length)) * 16 + 24;
		const height = lines.length * 20 + 16;
		// centered above the point, inside the screen
		const left = Math.min(
			Math.max(x * SCALE - width / 2, 16),
			WIDTH - 16 - width,
		);
		const bubble = new UIPanel(left, (y - 10) * SCALE - height, {
			width,
			height,
			fillColor: PALETTE[3],
			borderColor: PALETTE[0],
			borderWidth: 4,
			radius: 8,
		});
		bubble.isClickable = false;
		lines.forEach((line, i) => {
			bubble.addChild(
				new BitmapText(12, 10 + i * 20, {
					font: "atascii32",
					size: 0.5,
					fillStyle: PALETTE[0],
					text: line.toUpperCase(),
				}),
			);
		});
		if (tail !== "none") {
			// over the bottom border, its tip at the point
			bubble.addChild(
				new Sprite((x - 4) * SCALE - left, height - 4, {
					image: gameState.atlas,
					region: tail === "left" ? "bulba_bl" : "bulba_br",
					anchorPoint: { x: 0, y: 0 },
				}),
			);
		}
		this.add(bubble, 20);
		this.at(ms, () => this.remove(bubble));
	}

	/** the treetops, seen from above the jungle */
	protected treetops() {
		this.add(
			new Sprite(0, 0, { image: "treetops", anchorPoint: { x: 0, y: 0 } }),
			BACKDROP_Z,
		);
	}

	/** a plain color, like the darkness of the original */
	protected fill(color: string) {
		this.add(new ColorLayer("fill", color), BACKDROP_Z);
	}

	/**
	 * at the given time, fade out of the scene and into the next one, set up
	 * under the fade: its time starts there (the fade in takes 300ms)
	 */
	protected cut(ms: number, next: () => void) {
		this.at(ms, () => {
			this.app.viewport.fadeIn(FADE_COLOR, FADE, () => {
				// the story may have been skipped in the meantime
				if (!this.running) {
					return;
				}
				for (const renderable of [...this.cast]) {
					this.remove(renderable);
				}
				next();
				this.app.viewport.fadeOut(FADE_COLOR, FADE);
			});
		});
	}

	/** play a sound, stopped at the latest when the story ends */
	protected sound(name: string, volume = 1, loop = false) {
		const id = audio.play(name, loop, null, volume);
		this.sounds.push([name, id]);
		return id;
	}

	/** keep a sound playing in a loop at the given volume, or stop it at 0 */
	protected loop(name: string, volume: number) {
		this.stopSound(name);
		if (volume > 0) {
			this.sound(name, volume, true);
		}
	}

	protected stopSound(name: string) {
		audio.stop(name);
		this.sounds = this.sounds.filter(([sound]) => sound !== name);
	}

	override onDestroyEvent() {
		this.running = false;
		for (const id of this.timers) {
			timer.clearTimeout(id);
		}
		this.timers = [];
		for (const [name, id] of this.sounds) {
			audio.stop(name, id);
		}
		this.sounds = [];
		for (const [, tween] of this.moves) {
			tween.stop();
		}
		this.moves = [];
		this.cast = [];
		for (const key of ["ESC", "ENTER", "X", "SPACE"] as const) {
			input.unbindKey(input.KEY[key]);
		}
		unbindPads(NEXT_PAD);
		unbindTap(this.app);
	}
}
