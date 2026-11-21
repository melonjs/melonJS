import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	Container,
	FadeEffect,
	MaskEffect,
	Sprite,
	Stage,
	state,
	TextureAtlas,
	video,
} from "../src/index.js";
import { resetWarnOnce } from "../src/lang/console.js";
import { readPixel } from "./helpers/pixels.js";

/** what the console says, once, when a change finds its sprite gone with a level */
const LET_GO = /went with its level, an iris is used instead/;

/**
 * `state.transition("mask", …, sprite, { center: sprite })` (#1399): the
 * hide closes on the player with the player's own silhouette, and the reveal
 * opens from the same place with the same silhouette, though the state
 * change has destroyed the player in between.
 *
 * And the way to use one for a single change: set it, call `state.change()`,
 * set the usual transition back on the next line.
 *
 * A sprite is let go after one transition only when the change takes it: one
 * the game keeps for itself, outside any level, or a persistent one, is set
 * once and shapes every change.
 */

const DURATION = 60;
const FRAME = 1000 / 60;
const LIMIT = 20000;

// the game loop, run here one frame at a time (see transition-second-change)
let nextFrame = null;
let clock = 0;
const frame = async () => {
	const callback = nextFrame;
	nextFrame = null;
	if (callback !== null) {
		clock += FRAME;
		callback(clock);
	}
	await new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};
const runUntil = async (check) => {
	const end = globalThis.performance.now() + LIMIT;
	while (globalThis.performance.now() < end) {
		try {
			check();
			return;
		} catch {
			await frame();
		}
	}
	check();
};

/** a 20 × 30 image, its left half opaque */
const leftHalf = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 20;
	canvas.height = 30;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#f00";
	ctx.fillRect(0, 0, 10, 30);
	return canvas;
};

/** what is on the camera now, as `Class:direction` */
const effectsOn = (app) => {
	return app.viewport.cameraEffects.map((fx) => {
		return `${fx.constructor.name}:${fx.direction}`;
	});
};

/** the side of a silhouette that holds more of the shape, "left" or "right" */
const heavierSide = (silhouette) => {
	const canvas = silhouette.target.canvas;
	const { width, height } = canvas;
	const { data } = canvas.getContext("2d").getImageData(0, 0, width, height);
	let left = 0;
	let right = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (x < width / 2) {
				left += alpha;
			} else {
				right += alpha;
			}
		}
	}
	return left > right ? "left" : "right";
};

/** a sprite from an atlas, as `atlas.createSpriteFromName()` makes one */
const atlasSprite = () => {
	const atlas = new TextureAtlas(
		{
			frames: [
				{
					filename: "eat_0000",
					frame: { x: 0, y: 0, w: 20, h: 30 },
					rotated: false,
					trimmed: false,
					spriteSourceSize: { x: 0, y: 0, w: 20, h: 30 },
					sourceSize: { w: 20, h: 30 },
				},
			],
			meta: {
				app: "texturepacker",
				image: "eat-sheet.png",
				size: { w: 20, h: 30 },
			},
		},
		leftHalf(),
	);
	return atlas.createSpriteFromName("eat_0000");
};

describe("a mask transition shaped like, and closing on, a sprite", () => {
	let app;
	beforeAll(async () => {
		clock = globalThis.performance.now();
		vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
			(callback) => {
				nextFrame = callback;
				return 1;
			},
		);
		vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
			nextFrame = null;
		});
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});
	afterAll(() => {
		state.transition("fade", "#000", 0);
		app?.destroy();
		vi.restoreAllMocks();
	});

	it("the reveal opens where the hide closed, after the player is gone", async () => {
		let player;
		const start = state.USER + 90;
		const next = state.USER + 91;
		state.set(
			start,
			new Stage({
				onResetEvent(game) {
					player = new Sprite(200, 50, { image: leftHalf() });
					player.anchorPoint.set(0, 0);
					game.world.addChild(player);
				},
			}),
		);
		state.set(next, new Stage());
		state.setTransition(start, false);
		state.change(start, true);
		await runUntil(() => {
			expect(state.isCurrent(start)).toBe(true);
			expect(player?.ancestor).toBeDefined();
		});

		state.transition("mask", "#000", DURATION, player, {
			center: player,
			invert: true,
		});
		state.change(next);

		const hide = app.viewport.getCameraEffect(MaskEffect);
		expect(hide.direction).toBe("hide");
		expect(hide.invert).toBe(true);
		expect(hide._silhouette).toBeDefined();
		// the middle of the player's frame
		expect(hide.center).toEqual({ x: 210, y: 65 });
		const silhouette = hide._silhouette.target.canvas;

		// the switch lands, the player goes with the old stage
		let reveal;
		await runUntil(() => {
			expect(state.isCurrent(next)).toBe(true);
			reveal = app.viewport.cameraEffects.find((fx) => {
				return fx instanceof MaskEffect && fx.direction === "reveal";
			});
			expect(reveal).toBeDefined();
		});
		expect(player.offset).toBeUndefined();
		expect(reveal.invert).toBe(true);
		expect(reveal.center).toEqual({ x: 210, y: 65 });
		expect(reveal._silhouette.target.canvas).toBe(silhouette);

		// just before it ends, nothing is covered any more: drawn over white,
		// every corner and the middle read white
		reveal.tween.stop();
		reveal.progress.value = 0.995;
		const renderer = app.renderer;
		renderer.save();
		renderer.resetTransform();
		renderer.setColor("#ffffff");
		renderer.fillRect(0, 0, 320, 240);
		renderer.restore();
		reveal.draw(renderer, 320, 240);
		for (const [x, y] of [
			[1, 1],
			[318, 1],
			[1, 238],
			[318, 238],
			[160, 120],
		]) {
			expect((await readPixel(renderer, x, y))[0]).toBeGreaterThan(200);
		}
		reveal.progress.value = 1;

		// and the screen ends uncovered
		await runUntil(() => {
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});

		// The player it was given is gone: a later change does not read it
		// again (destroyed, or recycled into something else), but closes an
		// iris on the centre of the screen, and says so
		resetWarnOnce();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		state.setTransition(start, true);
		state.change(start);
		const again = app.viewport.getCameraEffect(MaskEffect);
		expect(again._maskShape?.type).toBe("Ellipse");
		expect(again.center).toBeUndefined();
		expect(again.invert).toBe(true);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toMatch(LET_GO);
		warn.mockRestore();
		await runUntil(() => {
			expect(state.isCurrent(start)).toBe(true);
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});
	});

	it("set for one change, then set back at once: that change is the mask, the next one the usual fade", async () => {
		let player;
		const start = state.USER + 92;
		const next = state.USER + 93;
		const last = state.USER + 94;
		state.set(
			start,
			new Stage({
				onResetEvent(game) {
					player = new Sprite(200, 50, { image: leftHalf() });
					game.world.addChild(player);
				},
			}),
		);
		state.set(next, new Stage());
		state.set(last, new Stage());
		state.setTransition(start, false);
		state.change(start, true);
		await runUntil(() => {
			expect(state.isCurrent(start)).toBe(true);
			expect(player?.ancestor).toBeDefined();
		});

		// the game's usual transition
		state.transition("fade", "#000", DURATION);

		// the player's silhouette, for this change only: the usual one is
		// set back before a single frame of the mask has run
		state.transition("mask", "#000", DURATION, player);
		state.change(next);
		state.transition("fade", "#000", DURATION);

		// the hide was built when the change was asked for, from the mask
		expect(effectsOn(app)).toEqual(["MaskEffect:hide"]);
		const hide = app.viewport.getCameraEffect(MaskEffect);
		expect(hide._silhouette).toBeDefined();
		const silhouette = hide._silhouette.target.canvas;

		// the reveal comes from the hide, not from the settings, which are
		// the fade's by now: the same mask, the same silhouette
		const seen = new Set();
		let reveal;
		await runUntil(() => {
			for (const name of effectsOn(app)) {
				seen.add(name);
			}
			expect(state.isCurrent(next)).toBe(true);
			reveal = app.viewport.cameraEffects.find((fx) => {
				return fx instanceof MaskEffect && fx.direction === "reveal";
			});
			expect(reveal).toBeDefined();
		});
		expect(reveal._silhouette.target.canvas).toBe(silhouette);
		await runUntil(() => {
			for (const name of effectsOn(app)) {
				seen.add(name);
			}
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});
		// on no frame of that transition was a fade on the camera
		expect([...seen].sort()).toEqual(["MaskEffect:hide", "MaskEffect:reveal"]);

		// the next change is the usual fade, both ways, and never a mask
		state.change(last);
		expect(app.viewport.getCameraEffect(FadeEffect)).toBeDefined();
		const seenNext = new Set();
		await runUntil(() => {
			for (const name of effectsOn(app)) {
				seenNext.add(name);
			}
			expect(state.isCurrent(last)).toBe(true);
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});
		expect(seenNext.size).toBeGreaterThan(0);
		for (const name of seenNext) {
			expect(name.startsWith("FadeEffect")).toBe(true);
		}
	});

	describe("set once, for every change", () => {
		// two empty stages to go back and forth between
		const here = state.USER + 95;
		const there = state.USER + 96;
		let warn;
		let current;

		/** change to the other stage, and hand back the hide it starts */
		const change = () => {
			current = current === here ? there : here;
			state.change(current);
			return app.viewport.getCameraEffect(MaskEffect);
		};
		/** let the change land and its reveal end */
		const settle = async () => {
			await runUntil(() => {
				expect(state.isCurrent(current)).toBe(true);
				expect(app.viewport.cameraEffects).toHaveLength(0);
			});
		};
		const isIris = (effect) => {
			return (
				effect._silhouette === undefined &&
				effect._maskShape?.type === "Ellipse"
			);
		};

		beforeAll(async () => {
			state.set(here, new Stage());
			state.set(there, new Stage());
			state.transition("fade", "#000", 0);
			current = here;
			state.change(here, true);
			await runUntil(() => {
				expect(state.isCurrent(here)).toBe(true);
			});
		});
		beforeEach(() => {
			// each test hears what a page hears the first time
			resetWarnOnce();
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		});
		afterEach(async () => {
			warn.mockRestore();
			await settle();
		});
		/** the one thing said: the sprite went with its level */
		const expectLetGoWarning = () => {
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toMatch(LET_GO);
		};

		it("a sprite the game keeps for itself, never in a level, shapes every change", async () => {
			// what `atlas.createSpriteFromName()` gives, set once at startup
			const sprite = atlasSprite();
			state.transition("mask", "#000", DURATION, sprite);

			for (let i = 0; i < 4; i++) {
				const hide = change();
				expect(hide.direction).toBe("hide");
				expect(hide._silhouette, `change ${i + 1}`).toBeDefined();
				await settle();
				// no change destroyed it
				expect(sprite.offset).toBeDefined();
			}
			expect(warn).not.toHaveBeenCalled();
		});

		it("each change draws the frame the sprite shows by then", async () => {
			const sprite = atlasSprite();
			state.transition("mask", "#000", DURATION, sprite);

			// the image's left half is the opaque one
			expect(heavierSide(change()._silhouette)).toBe("left");
			await settle();

			// the game turns its sprite around: the next change is not the
			// picture of the first one, kept, but the sprite read again
			sprite.flipX(true);
			expect(heavierSide(change()._silhouette)).toBe("right");
			await settle();

			sprite.flipX(false);
			expect(heavierSide(change()._silhouette)).toBe("left");
		});

		it("a persistent sprite in the world, and one in a persistent container, are kept", async () => {
			const lone = new Sprite(40, 40, { image: leftHalf() });
			lone.isPersistent = true;
			app.world.addChild(lone);

			const hud = new Container(0, 0, 320, 240);
			hud.isPersistent = true;
			const inHud = new Sprite(100, 100, { image: leftHalf() });
			hud.addChild(inHud);
			app.world.addChild(hud);

			for (const sprite of [lone, inHud]) {
				state.transition("mask", "#000", DURATION, sprite, { center: sprite });
				for (let i = 0; i < 3; i++) {
					const hide = change();
					expect(hide._silhouette, `change ${i + 1}`).toBeDefined();
					expect(hide.center, `change ${i + 1}`).toBeDefined();
					await settle();
					// the change left it in the world
					expect(sprite.ancestor).toBeDefined();
				}
			}
			expect(warn).not.toHaveBeenCalled();

			app.world.removeChildNow(lone);
			app.world.removeChildNow(hud);
		});

		it("a sprite inside a container of the level goes with it, and is let go", async () => {
			const room = new Container(0, 0, 320, 240);
			const inRoom = new Sprite(100, 100, { image: leftHalf() });
			room.addChild(inRoom);
			app.world.addChild(room);
			state.transition("mask", "#000", DURATION, inRoom, { center: inRoom });

			const first = change();
			expect(first._silhouette).toBeDefined();
			expect(first.center).toBeDefined();
			await settle();
			// the change destroyed it
			expect(inRoom.offset).toBeUndefined();

			// nothing is said while it is let go, only once a change misses it
			expect(warn).not.toHaveBeenCalled();
			const second = change();
			expect(isIris(second)).toBe(true);
			expect(second.center).toBeUndefined();
			expectLetGoWarning();
		});

		it("a persistent sprite inside a container of the level is let go with it", async () => {
			// Persistent is a word to the container a renderable is a child
			// of, and the world only asks its own children: the room goes,
			// and what it held is left in a container that is no more.
			// Nothing to keep reading a place on screen from
			const room = new Container(0, 0, 320, 240);
			const inRoom = new Sprite(100, 100, { image: leftHalf() });
			inRoom.isPersistent = true;
			room.addChild(inRoom);
			app.world.addChild(room);
			state.transition("mask", "#000", DURATION, inRoom, { center: inRoom });

			const first = change();
			expect(first._silhouette).toBeDefined();
			expect(first.center).toBeDefined();
			await settle();
			expect(room.ancestor).toBeUndefined();

			// nothing is said while it is let go, only once a change misses it
			expect(warn).not.toHaveBeenCalled();
			const second = change();
			expect(isIris(second)).toBe(true);
			expect(second.center).toBeUndefined();
			expectLetGoWarning();
		});

		it("kept while it is the game's own, let go by the change that finds it in a level", async () => {
			const sprite = atlasSprite();
			state.transition("mask", "#000", DURATION, sprite);
			expect(change()._silhouette).toBeDefined();
			await settle();
			expect(change()._silhouette).toBeDefined();
			await settle();

			// now it joins a level: this change still wears it, and takes it
			app.world.addChild(sprite);
			expect(change()._silhouette).toBeDefined();
			await settle();
			expect(sprite.offset).toBeUndefined();
			expect(warn).not.toHaveBeenCalled();

			expect(isIris(change())).toBe(true);
			expectLetGoWarning();
		});

		it("a sprite in a container that is in no world is kept", async () => {
			const shelf = new Container(0, 0, 100, 100);
			const sprite = new Sprite(10, 10, { image: leftHalf() });
			shelf.addChild(sprite);
			state.transition("mask", "#000", DURATION, sprite);
			for (let i = 0; i < 3; i++) {
				expect(change()._silhouette, `change ${i + 1}`).toBeDefined();
				await settle();
			}
			expect(warn).not.toHaveBeenCalled();
		});

		it("a kept sprite the game destroys later: an iris from then on, not an error", async () => {
			const sprite = atlasSprite();
			state.transition("mask", "#000", DURATION, sprite, { center: sprite });
			expect(change()._silhouette).toBeDefined();
			await settle();

			sprite.destroy();
			const hide = change();
			expect(isIris(hide)).toBe(true);
			await settle();
			expect(isIris(change())).toBe(true);
		});

		it("a level's sprite set again before each change is never warned about", async () => {
			for (let i = 0; i < 3; i++) {
				const player = new Sprite(100, 100, { image: leftHalf() });
				app.world.addChild(player);
				state.transition("mask", "#000", DURATION, player);
				expect(change()._silhouette, `change ${i + 1}`).toBeDefined();
				await settle();
			}
			expect(warn).not.toHaveBeenCalled();
		});

		it("the sprite gone with its level is said once, however many changes follow", async () => {
			const player = new Sprite(100, 100, { image: leftHalf() });
			app.world.addChild(player);
			state.transition("mask", "#000", DURATION, player);
			expect(change()._silhouette).toBeDefined();
			await settle();
			for (let i = 0; i < 3; i++) {
				expect(isIris(change()), `change ${i + 2}`).toBe(true);
				await settle();
			}
			expectLetGoWarning();
		});

		it("a mask transition given no shape says so once, and switches directly", async () => {
			state.transition("mask", "#000", DURATION);
			for (let i = 0; i < 3; i++) {
				expect(change(), `change ${i + 1}`).toBeUndefined();
				await settle();
			}
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toMatch(/requires a shape/);
		});

		it("setting another transition forgets a kept sprite", async () => {
			const sprite = atlasSprite();
			state.transition("mask", "#000", DURATION, sprite);
			expect(change()._silhouette).toBeDefined();
			await settle();

			state.transition("fade", "#000", DURATION);
			state.change((current = current === here ? there : here));
			expect(app.viewport.getCameraEffect(MaskEffect)).toBeUndefined();
			expect(app.viewport.getCameraEffect(FadeEffect)).toBeDefined();
		});
	});
});
