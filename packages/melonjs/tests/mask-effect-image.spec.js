/**
 * `MaskEffect` with an image, a sprite or a preloaded image's name as its
 * shape, a `center` to close on, and `invert` (#1399).
 *
 * The image used throughout is a disc with a hole in its middle, in a 32 px
 * square: the hole is enclosed, so the silhouette fills it, and the disc's
 * own radius is the circle that has to reach the screen's corners for a
 * reveal to end with the scene fully uncovered.
 *
 * The pixel checks draw the effect over white, so a covered pixel reads
 * black and a visible one white, on Canvas and on WebGL (WebGPU, where the
 * browser has it).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Ellipse,
	loader,
	MaskEffect,
	Polygon,
	Renderable,
	Sprite,
	Trigger,
	video,
} from "../src/index.js";
import { readPixel } from "./helpers/pixels.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 64;

/** a 32 px disc, radius 14, with a hole of radius 4 at its centre */
const discWithHole = () => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 32;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#3a7";
	ctx.beginPath();
	ctx.arc(16, 16, 14, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalCompositeOperation = "destination-out";
	ctx.beginPath();
	ctx.arc(16, 16, 4, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
};

/** an image whose left half only is opaque */
const leftHalf = (w = 20, h = 30) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#f00";
	ctx.fillRect(0, 0, w / 2, h);
	return canvas;
};

/** an effect at a given progress (1 = all visible, 0 = all covered) */
const at = (camera, progress, options) => {
	const effect = new MaskEffect(camera, {
		color: "#000",
		duration: 1000,
		direction: "hide",
		...options,
	});
	effect.tween.stop();
	effect.progress.value = progress;
	return effect;
};

/** draw an effect over a white screen */
const drawOverWhite = (renderer, effect) => {
	renderer.save();
	renderer.resetTransform();
	renderer.setColor("#ffffff");
	renderer.fillRect(0, 0, SIZE, SIZE);
	renderer.restore();
	effect.draw(renderer, SIZE, SIZE);
	renderer.flush();
};

/** 1 where a pixel is covered (dark), 0 where it is visible (light) */
const covered = async (renderer, x, y) => {
	return (await readPixel(renderer, x, y))[0] < 128 ? 1 : 0;
};

const CORNERS = [
	[1, 1],
	[SIZE - 2, 1],
	[1, SIZE - 2],
	[SIZE - 2, SIZE - 2],
];

/** the same drawing checks, on one renderer */
const drawingChecks = (getRenderer) => {
	const camera = new Camera2d(0, 0, SIZE, SIZE);

	it("an image: the scene shows through its silhouette, hole filled in", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = at(camera, 0.3, { shape: discWithHole() });
		drawOverWhite(renderer, effect);
		// the centre is the image's hole: part of the silhouette, so visible
		expect(await covered(renderer, 32, 32)).toBe(0);
		expect(await covered(renderer, 32, 26)).toBe(0);
		for (const [x, y] of CORNERS) {
			expect(await covered(renderer, x, y)).toBe(1);
		}
		effect.destroy();
	});

	it("an image: covers everything once closed", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = at(camera, 0, { shape: discWithHole() });
		drawOverWhite(renderer, effect);
		expect(await covered(renderer, 32, 32)).toBe(1);
		expect(await covered(renderer, 1, 1)).toBe(1);
		effect.destroy();
	});

	it("an image: just before the end, the whole screen is already uncovered", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = at(camera, 0.995, { shape: discWithHole() });
		drawOverWhite(renderer, effect);
		for (const [x, y] of CORNERS) {
			expect(await covered(renderer, x, y)).toBe(0);
		}
		effect.destroy();
	});

	it("a polygon: just before the end, the whole screen is already uncovered", async (ctx) => {
		const renderer = getRenderer(ctx);
		const diamond = new Polygon(0, 0, [
			{ x: 0, y: -1 },
			{ x: 1, y: 0 },
			{ x: 0, y: 1 },
			{ x: -1, y: 0 },
		]);
		const effect = at(camera, 0.995, { shape: diamond });
		drawOverWhite(renderer, effect);
		for (const [x, y] of CORNERS) {
			expect(await covered(renderer, x, y)).toBe(0);
		}
		effect.destroy();
	});

	it("inverted: the silhouette is the cover, the scene shows round it", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = at(camera, 0.7, { shape: discWithHole(), invert: true });
		drawOverWhite(renderer, effect);
		expect(await covered(renderer, 32, 32)).toBe(1);
		for (const [x, y] of CORNERS) {
			expect(await covered(renderer, x, y)).toBe(0);
		}
		effect.destroy();
	});

	it("inverted: covers everything once closed, nothing at the start", async (ctx) => {
		const renderer = getRenderer(ctx);
		const closed = at(camera, 0, { shape: discWithHole(), invert: true });
		drawOverWhite(renderer, closed);
		expect(await covered(renderer, 1, 1)).toBe(1);
		expect(await covered(renderer, 32, 32)).toBe(1);
		closed.destroy();
		const open = at(camera, 1, { shape: discWithHole(), invert: true });
		drawOverWhite(renderer, open);
		expect(await covered(renderer, 32, 32)).toBe(0);
		open.destroy();
	});

	it("inverted geometry: an iris filled, growing out of the centre", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = at(camera, 0.7, {
			shape: new Ellipse(0, 0, 1, 1),
			invert: true,
		});
		drawOverWhite(renderer, effect);
		expect(await covered(renderer, 32, 32)).toBe(1);
		expect(await covered(renderer, 1, 1)).toBe(0);
		effect.destroy();
	});

	it("center: closes on that point, not on the centre of the screen", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = at(camera, 0.2, {
			shape: discWithHole(),
			center: { x: 12, y: 12 },
		});
		drawOverWhite(renderer, effect);
		expect(await covered(renderer, 12, 12)).toBe(0);
		expect(await covered(renderer, 52, 52)).toBe(1);
		effect.destroy();
	});
};

// One Canvas application for the whole file, made first: the engine gives a
// viewport only to the application live at the first `init()`
let app;
beforeAll(async () => {
	boot();
	app = new Application(SIZE, SIZE, {
		parent: "screen",
		renderer: video.CANVAS,
		consoleHeader: false,
	});
	await app.init();
	const png = discWithHole().toDataURL("image/png");
	await loader.preload(
		[{ name: "mask-disc", type: "image", src: png }],
		undefined,
		false,
	);
});
afterAll(() => {
	app?.destroy();
});

describe("MaskEffect: image and sprite shapes", () => {
	describe("Canvas", () => {
		drawingChecks(() => {
			return app.renderer;
		});
	});

	describe("WebGL", () => {
		let renderer;
		beforeAll(async () => {
			boot();
			renderer = await getWebGLRenderer(SIZE, SIZE);
			if (renderer !== undefined) {
				renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
				renderer.currentBatcher.setProjection(renderer.projectionMatrix);
			}
		});
		afterAll(() => {
			releaseWebGLRenderer();
		});
		drawingChecks((ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
			}
			return renderer;
		});

		it("destroy frees the copy of the image uploaded to the GPU", (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
				return;
			}
			const effect = at(new Camera2d(0, 0, SIZE, SIZE), 0.5, {
				shape: discWithHole(),
			});
			drawOverWhite(renderer, effect);
			const canvas = effect._cover.canvas;
			expect(renderer.cache.has(canvas)).toBe(true);
			effect.destroy();
			expect(renderer.cache.has(canvas)).toBe(false);
		});
	});

	describe("WebGPU", () => {
		let gpuApp;
		let available = false;
		beforeAll(async () => {
			try {
				gpuApp = new Application(SIZE, SIZE, {
					parent: "screen",
					renderer: video.WEBGPU,
					consoleHeader: false,
				});
				await gpuApp.init();
				available = gpuApp.renderer.type === "WebGPU";
			} catch {
				available = false;
			}
		});
		afterAll(() => {
			gpuApp?.destroy();
		});
		drawingChecks((ctx) => {
			if (!available) {
				ctx.skip("WebGPU not available in this environment");
			}
			return gpuApp.renderer;
		});
	});
});

describe("MaskEffect: what a shape and a center resolve to", () => {
	/** the alpha of a silhouette pixel, in the silhouette's own pixels */
	const alpha = (effect, x, y) => {
		const canvas = effect._silhouette.canvas;
		return canvas.getContext("2d").getImageData(x, y, 1, 1).data[3];
	};

	it("a preloaded image's name is that image", () => {
		const effect = new MaskEffect(app.viewport, {
			shape: "mask-disc",
			color: "#000",
		});
		expect(effect._silhouette).toBeDefined();
		expect(effect._maskShape).toBeUndefined();
		// 32 px plus the clear margin on each side
		expect(effect._silhouette.canvas.width).toBe(36);
		// the disc's radius, give or take its anti-aliased edge
		expect(effect._inner).toBeGreaterThan(13);
		expect(effect._inner).toBeLessThan(15.5);
		effect.destroy();
	});

	it("an unknown name warns, and an iris is used instead", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new MaskEffect(app.viewport, {
			shape: "no-such-mask-image",
			color: "#000",
		});
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
		effect.destroy();
	});

	it("a sprite: the frame it shows, facing the way it faces", () => {
		const sprite = new Sprite(0, 0, { image: leftHalf() });
		const facing = new MaskEffect(app.viewport, {
			shape: sprite,
			color: "#000",
		});
		// opaque on the left, clear on the right (2 px margin)
		expect(alpha(facing, 2 + 3, 15)).toBe(255);
		expect(alpha(facing, 2 + 16, 15)).toBe(0);
		facing.destroy();

		sprite.flipX(true);
		const flipped = new MaskEffect(app.viewport, {
			shape: sprite,
			color: "#000",
		});
		expect(alpha(flipped, 2 + 3, 15)).toBe(0);
		expect(alpha(flipped, 2 + 16, 15)).toBe(255);
		flipped.destroy();
		sprite.destroy();
	});

	it("a sprite's atlas frame: only that region of its image", () => {
		// a 40 × 30 sheet of two 20 × 30 frames: opaque left half, then clear
		const sheet = document.createElement("canvas");
		sheet.width = 40;
		sheet.height = 30;
		const ctx = sheet.getContext("2d");
		ctx.fillStyle = "#00f";
		ctx.fillRect(0, 0, 20, 30);
		const sprite = new Sprite(0, 0, {
			image: sheet,
			framewidth: 20,
			frameheight: 30,
		});
		sprite.addAnimation("full", [0]);
		sprite.addAnimation("empty", [1]);
		sprite.setCurrentAnimation("full");
		const full = new MaskEffect(app.viewport, { shape: sprite, color: "#000" });
		expect(full._silhouette.canvas.width).toBe(24);
		expect(alpha(full, 12, 15)).toBe(255);
		full.destroy();
		sprite.setCurrentAnimation("empty");
		const empty = new MaskEffect(app.viewport, {
			shape: sprite,
			color: "#000",
		});
		expect(alpha(empty, 12, 15)).toBe(0);
		empty.destroy();
		sprite.destroy();
	});

	it("a destroyed sprite warns, and an iris is used instead", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const sprite = new Sprite(0, 0, { image: leftHalf() });
		sprite.destroy();
		const effect = new MaskEffect(app.viewport, {
			shape: sprite,
			color: "#000",
		});
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
		effect.destroy();
	});

	it("a renderable that is not a sprite warns, and an iris is used instead", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new MaskEffect(app.viewport, {
			shape: new Renderable(0, 0, 10, 10),
			color: "#000",
		});
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
		effect.destroy();
	});

	it("an object holding a sprite (an Entity) is shaped by that sprite", () => {
		const holder = new Renderable(0, 0, 20, 30);
		holder.renderable = new Sprite(0, 0, { image: leftHalf() });
		const effect = new MaskEffect(app.viewport, {
			shape: holder,
			color: "#000",
		});
		expect(effect._silhouette).toBeDefined();
		expect(alpha(effect, 5, 15)).toBe(255);
		effect.destroy();
		holder.renderable.destroy();
	});

	it("a renderable center is where it is drawn on screen, read once", () => {
		const target = new Renderable(50, 30, 20, 20);
		target.anchorPoint.set(0, 0);
		app.world.addChild(target);
		app.viewport.pos.set(40, 10);
		const effect = new MaskEffect(app.viewport, {
			shape: new Ellipse(0, 0, 1, 1),
			color: "#000",
			center: target,
		});
		// its middle (60, 40), less the camera's position
		expect(effect.center.x).toBeCloseTo(20, 5);
		expect(effect.center.y).toBeCloseTo(30, 5);
		// moving it afterwards changes nothing
		target.pos.set(0, 0);
		expect(effect.center.x).toBeCloseTo(20, 5);
		effect.destroy();
		app.viewport.pos.set(0, 0);
		app.world.removeChildNow(target);
	});

	it("a center not in the world warns, and the centre of the screen is used", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new MaskEffect(app.viewport, {
			shape: new Ellipse(0, 0, 1, 1),
			color: "#000",
			center: new Renderable(10, 10, 5, 5),
		});
		expect(effect.center).toBeUndefined();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
		effect.destroy();
	});

	it("the reverse effect keeps the shape after its sprite is gone", () => {
		const sprite = new Sprite(0, 0, { image: leftHalf() });
		const hide = new MaskEffect(app.viewport, {
			shape: sprite,
			color: "#000",
			center: { x: 30, y: 40 },
		});
		sprite.destroy();
		const shape = hide.resolvedShape;
		const inner = hide._inner;
		const reveal = new MaskEffect(app.viewport, {
			shape,
			color: "#000",
			direction: "reveal",
			center: hide.center,
		});
		hide.destroy();
		expect(reveal._silhouette).toBeDefined();
		// the same silhouette, not one made again from it
		expect(reveal._silhouette.canvas).toBe(shape);
		expect(reveal._inner).toBe(inner);
		expect(reveal.center).toEqual({ x: 30, y: 40 });
		reveal.destroy();
	});
});

describe("Trigger: a mask that is whoever walked in", () => {
	const clearEffects = () => {
		while (app.viewport.cameraEffects.length > 0) {
			app.viewport.removeCameraEffect(app.viewport.cameraEffects[0]);
		}
	};

	it('"touching" is the sprite that set the trigger off, and where it is', () => {
		const player = new Sprite(30, 20, { image: leftHalf() });
		player.anchorPoint.set(0, 0);
		app.world.addChild(player);
		const trigger = new Trigger(0, 0, {
			width: 50,
			height: 50,
			transition: "mask",
			shape: "touching",
			center: "touching",
			invert: true,
			color: "#000",
			duration: 300,
			to: "map2",
		});
		app.world.addChild(trigger);
		trigger.onCollisionStart({}, player);

		const effect = app.viewport.getCameraEffect(MaskEffect);
		expect(effect).toBeDefined();
		expect(effect._silhouette).toBeDefined();
		expect(effect.invert).toBe(true);
		// the middle of the player's 20 × 30 frame
		expect(effect.center.x).toBeCloseTo(40, 5);
		expect(effect.center.y).toBeCloseTo(35, 5);

		clearEffects();
		app.world.removeChildNow(trigger);
		app.world.removeChildNow(player);
	});

	it('"touching" with nothing that touched it: an iris on the centre', () => {
		const trigger = new Trigger(0, 0, {
			width: 50,
			height: 50,
			transition: "mask",
			shape: "touching",
			center: "touching",
			color: "#000",
			duration: 300,
			to: "map2",
		});
		app.world.addChild(trigger);
		trigger.triggerEvent();

		const effect = app.viewport.getCameraEffect(MaskEffect);
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		expect(effect.center).toBeUndefined();

		clearEffects();
		app.world.removeChildNow(trigger);
	});
});
