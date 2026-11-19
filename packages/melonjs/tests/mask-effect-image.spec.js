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
	Camera3d,
	Container,
	Ellipse,
	level,
	loader,
	MaskEffect,
	NineSliceSprite,
	Polygon,
	Renderable,
	Sprite,
	TextureAtlas,
	Trigger,
	Vector3d,
	video,
} from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import {
	at,
	discWithHole,
	drawingChecks,
	drawOverWhite,
	leftHalf,
	offOrigin,
	SIZE,
	topLeftQuarter,
} from "./helpers/mask-effect-checks.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

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

		it("destroy frees the copy of the image uploaded to the GPU", async (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
				return;
			}
			const effect = at(new Camera2d(0, 0, SIZE, SIZE), 0.5, {
				shape: discWithHole(),
			});
			await drawOverWhite(renderer, effect);
			const canvas = effect._cover.canvas;
			expect(renderer.cache.has(canvas)).toBe(true);
			effect.destroy();
			expect(renderer.cache.has(canvas)).toBe(false);
		});
	});
});

describe("MaskEffect: what a shape and a center resolve to", () => {
	/** the alpha of a silhouette pixel, in the silhouette's own pixels */
	const alpha = (effect, x, y) => {
		const canvas = effect._silhouette.target.canvas;
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
		expect(effect._silhouette.target.canvas.width).toBe(36);
		// grown about its middle, by the disc's radius (less its soft edge)
		expect(effect._anchor.x).toBe(18.5);
		expect(effect._anchor.y).toBe(18.5);
		expect(effect._anchor.inner).toBeGreaterThan(12.5);
		expect(effect._anchor.inner).toBeLessThan(14.5);
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
		expect(full._silhouette.target.canvas.width).toBe(24);
		expect(alpha(full, 12, 15)).toBe(255);
		full.destroy();
		// the clear frame has no silhouette at all: warned, and an iris
		sprite.setCurrentAnimation("empty");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const empty = new MaskEffect(app.viewport, {
			shape: sprite,
			color: "#000",
		});
		expect(empty._silhouette).toBeUndefined();
		expect(empty._maskShape).toBeInstanceOf(Ellipse);
		expect(warn.mock.calls.flat().join(" ")).toMatch(/fully transparent/);
		warn.mockRestore();
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

	it("reverseOptions: the effect played back, with the shape after its sprite is gone", () => {
		const sprite = new Sprite(0, 0, { image: leftHalf() });
		const hide = new MaskEffect(app.viewport, {
			shape: sprite,
			color: "#336699",
			duration: 321,
			center: { x: 30, y: 40 },
			invert: true,
		});
		sprite.destroy();
		const options = hide.reverseOptions();
		const anchor = { ...hide._anchor };
		const reveal = new MaskEffect(app.viewport, options);
		hide.destroy();
		expect(options.direction).toBe("reveal");
		expect(reveal.duration).toBe(321);
		expect(reveal.invert).toBe(true);
		expect(reveal.color.toHex()).toBe("#336699");
		// the same silhouette, not one made again from it
		expect(reveal._silhouette.target.canvas).toBe(options.shape);
		expect(reveal._anchor).toEqual(anchor);
		expect(reveal.center).toEqual({ x: 30, y: 40 });
		// and back again
		expect(reveal.reverseOptions().direction).toBe("hide");
		reveal.destroy();
	});

	it("reverseOptions of a polygon or the default iris give the same shape", () => {
		const poly = offOrigin();
		const a = new MaskEffect(app.viewport, { shape: poly, color: "#000" });
		const b = new MaskEffect(app.viewport, a.reverseOptions());
		expect(b._template).toBe(poly);
		expect(b._anchor).toEqual(a._anchor);
		a.destroy();
		b.destroy();
		const iris = new MaskEffect(app.viewport, { color: "#000" });
		expect(iris.reverseOptions().shape).toBeUndefined();
		iris.destroy();
	});

	it("no shape is the default iris, without a warning", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new MaskEffect(app.viewport, { color: "#000" });
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
		effect.destroy();
	});

	it("a shape of the wrong kind warns that it is not supported, and is an iris", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		for (const shape of [{}, 42]) {
			const effect = new MaskEffect(app.viewport, { shape, color: "#000" });
			expect(effect._maskShape).toBeInstanceOf(Ellipse);
			effect.destroy();
		}
		expect(warn.mock.calls.flat().join(" ")).toMatch(/not an Ellipse/);
		warn.mockRestore();
	});

	it("a fully transparent image is an iris (the warning is shown once, above)", () => {
		const blank = document.createElement("canvas");
		blank.width = blank.height = 16;
		const effect = new MaskEffect(app.viewport, {
			shape: blank,
			color: "#000",
		});
		expect(effect._silhouette).toBeUndefined();
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		effect.destroy();
	});

	it("an image that cannot be read back warns, and is an iris", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const read = vi
			.spyOn(CanvasRenderingContext2D.prototype, "getImageData")
			.mockImplementation(() => {
				throw new DOMException("tainted", "SecurityError");
			});
		try {
			const effect = new MaskEffect(app.viewport, {
				shape: discWithHole(),
				color: "#000",
			});
			expect(effect._maskShape).toBeInstanceOf(Ellipse);
			effect.destroy();
		} finally {
			read.mockRestore();
		}
		expect(warn.mock.calls.flat().join(" ")).toMatch(/could not be read/);
		warn.mockRestore();
	});

	it("a polygon with no inside warns, and is an iris", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const flat = new Polygon(0, 0, [
			{ x: -1, y: 0 },
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
		]);
		const effect = new MaskEffect(app.viewport, { shape: flat, color: "#000" });
		expect(effect._template).toBeUndefined();
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		warn.mockRestore();
		effect.destroy();
	});

	it("a sprite flipped on either axis", () => {
		const sprite = new Sprite(0, 0, { image: topLeftQuarter() });
		const flips = [
			[false, false, [5, 5]],
			[true, false, [15, 5]],
			[false, true, [5, 22]],
			[true, true, [15, 22]],
		];
		for (const [fx, fy, [x, y]] of flips) {
			sprite.flipX(fx);
			sprite.flipY(fy);
			const effect = new MaskEffect(app.viewport, {
				shape: sprite,
				color: "#000",
			});
			// the opaque quarter is where the flips put it (2 px margin)
			expect(alpha(effect, 2 + x, 2 + y)).toBe(255);
			const others = [
				[5, 5],
				[15, 5],
				[5, 22],
				[15, 22],
			].filter(([ox, oy]) => {
				return ox !== x || oy !== y;
			});
			for (const [ox, oy] of others) {
				expect(alpha(effect, 2 + ox, 2 + oy)).toBe(0);
			}
			effect.destroy();
		}
		sprite.destroy();
	});

	it("an atlas frame stored turned, or trimmed, gives the same silhouette as a plain one", () => {
		// the art: a 12 × 20 Γ
		const art = document.createElement("canvas");
		art.width = 12;
		art.height = 20;
		const a = art.getContext("2d");
		a.fillStyle = "#c00";
		a.fillRect(0, 0, 12, 6);
		a.fillRect(0, 0, 4, 20);
		// one sheet: plain at (0, 0), turned a quarter clockwise at (20, 0)
		// (20 wide, 12 tall), and trimmed out of a 16 × 24 frame at (0, 30)
		const sheet = document.createElement("canvas");
		sheet.width = sheet.height = 64;
		const s = sheet.getContext("2d");
		s.drawImage(art, 0, 0);
		s.save();
		s.translate(40, 0);
		s.rotate(Math.PI / 2);
		s.drawImage(art, 0, 0);
		s.restore();
		s.drawImage(art, 0, 30);
		const frame = (filename, x, y, extra = {}) => {
			return {
				filename,
				frame: { x, y, w: 12, h: 20 },
				rotated: false,
				trimmed: false,
				spriteSourceSize: { x: 0, y: 0, w: 12, h: 20 },
				sourceSize: { w: 12, h: 20 },
				...extra,
			};
		};
		const atlas = new TextureAtlas(
			{
				frames: [
					frame("plain", 0, 0),
					frame("turned", 20, 0, { rotated: true }),
					frame("trimmed", 0, 30, {
						trimmed: true,
						spriteSourceSize: { x: 2, y: 3, w: 12, h: 20 },
						sourceSize: { w: 16, h: 24 },
					}),
				],
				meta: {
					app: "texturepacker",
					image: "mask-sheet.png",
					size: { w: 64, h: 64 },
					scale: "1",
				},
			},
			sheet,
		);
		const silhouetteOf = (name) => {
			const sprite = atlas.createSpriteFromName(name);
			const effect = new MaskEffect(app.viewport, {
				shape: sprite,
				color: "#000",
			});
			const canvas = effect._silhouette.target.canvas;
			const data = canvas
				.getContext("2d")
				.getImageData(0, 0, canvas.width, canvas.height);
			effect.destroy();
			sprite.destroy();
			return data;
		};
		const plain = silhouetteOf("plain");
		const turned = silhouetteOf("turned");
		expect([turned.width, turned.height]).toEqual([plain.width, plain.height]);
		expect(Array.from(turned.data)).toEqual(Array.from(plain.data));
		// trimmed: the same, 2 across and 3 down in its larger frame
		const trimmed = silhouetteOf("trimmed");
		const at = (img, x, y) => {
			return img.data[(y * img.width + x) * 4 + 3];
		};
		let same = 0;
		for (let y = 0; y < plain.height; y++) {
			for (let x = 0; x < plain.width; x++) {
				if (at(plain, x, y) === at(trimmed, x + 2, y + 3)) {
					same++;
				}
			}
		}
		expect(same).toBe(plain.width * plain.height);
	});

	it("a NineSliceSprite: its whole stretched size, not its source frame", () => {
		const source = document.createElement("canvas");
		source.width = source.height = 30;
		const s = source.getContext("2d");
		s.fillStyle = "#08f";
		s.fillRect(0, 0, 30, 30);
		const panel = new NineSliceSprite(0, 0, {
			image: source,
			width: 90,
			height: 60,
		});
		const effect = new MaskEffect(app.viewport, {
			shape: panel,
			color: "#000",
		});
		const canvas = effect._silhouette.target.canvas;
		expect([canvas.width, canvas.height]).toEqual([94, 64]);
		expect(alpha(effect, 85, 55)).toBe(255);
		effect.destroy();
		panel.destroy();
	});

	it("a center in a floating container is where it is on the screen", () => {
		const hud = new Container(0, 0, SIZE, SIZE);
		hud.floating = true;
		app.world.addChild(hud);
		const item = new Renderable(10, 10, 4, 4);
		item.anchorPoint.set(0, 0);
		hud.addChild(item);
		// a child of a floating container is not floating itself
		expect(item.floating).toBe(false);
		app.viewport.pos.set(40, 10);
		const effect = new MaskEffect(app.viewport, {
			color: "#000",
			center: item,
		});
		expect(effect.center.x).toBeCloseTo(12, 5);
		expect(effect.center.y).toBeCloseTo(12, 5);
		effect.destroy();
		app.viewport.pos.set(0, 0);
		app.world.removeChildNow(hud);
	});

	it("under a Camera3d, a center inside a container at a depth is projected at its full depth", () => {
		const camera = new Camera3d(0, 0, SIZE, SIZE);
		camera.setClipPlanes(1, 100000);
		camera.orbit({ x: 0, y: 0, z: 0 }, 0, 0, 500);
		const box = new Container(0, 0, 100, 100);
		app.world.addChild(box);
		// after addChild, which gives it a depth of its own
		box.depth = 200;
		const item = new Renderable(40, 0, 4, 4);
		item.anchorPoint.set(0, 0);
		box.addChild(item);
		const effect = new MaskEffect(camera, { color: "#000", center: item });
		const b = item.getBounds();
		// the container's depth and the child's own (its place in the container)
		const depth = item.getAbsolutePosition().z;
		expect(depth).toBeGreaterThanOrEqual(200);
		const atDepth = camera.worldToScreen(
			new Vector3d(b.centerX, b.centerY, depth),
		);
		const atZero = camera.worldToScreen(
			new Vector3d(b.centerX, b.centerY, item.depth),
		);
		expect(effect.center.x).toBeCloseTo(atDepth.x, 4);
		expect(effect.center.y).toBeCloseTo(atDepth.y, 4);
		// and that is not where its own (local) depth would put it
		expect(Math.abs(atDepth.x - atZero.x)).toBeGreaterThan(1);
		effect.destroy();
		app.world.removeChildNow(box);
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
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		trigger.onCollisionStart({});

		const effect = app.viewport.getCameraEffect(MaskEffect);
		expect(effect._maskShape).toBeInstanceOf(Ellipse);
		expect(effect.center).toBeUndefined();
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();

		clearEffects();
		app.world.removeChildNow(trigger);
	});
});

describe("Trigger: the reveal opens where the hide closed", () => {
	let originalAddTo;
	beforeAll(() => {
		// a level that loads without assets
		originalAddTo = GLTFScene.prototype.addTo;
		GLTFScene.prototype.addTo = () => {};
		level.add("gltf", "mask-trigger-target");
	});
	afterAll(() => {
		GLTFScene.prototype.addTo = originalAddTo;
	});

	it("with the player's silhouette and place, though the level change destroyed the player", async () => {
		const player = new Sprite(30, 20, { image: leftHalf() });
		player.anchorPoint.set(0, 0);
		app.world.addChild(player);
		const trigger = new Trigger(0, 0, {
			width: 8,
			height: 8,
			transition: "mask",
			shape: "touching",
			center: "touching",
			invert: true,
			color: "#000",
			duration: 300,
			to: "mask-trigger-target",
		});
		app.world.addChild(trigger);
		trigger.onCollisionStart({}, player);
		const hide = app.viewport.getCameraEffect(MaskEffect);
		const silhouette = hide._silhouette.target.canvas;
		const center = { ...hide.center };

		// the hide ends: the level loads, then the reveal starts
		hide.tween.stop();
		hide.progress.value = 0;
		hide.update();
		let reveal;
		for (let i = 0; i < 50 && reveal === undefined; i++) {
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			reveal = app.viewport.cameraEffects.find((fx) => {
				return fx instanceof MaskEffect && fx.direction === "reveal";
			});
		}
		expect(reveal).toBeDefined();
		expect(player.offset).toBeUndefined();
		expect(reveal._silhouette.target.canvas).toBe(silhouette);
		expect(reveal.center).toEqual(center);
		expect(reveal.invert).toBe(true);
		expect(reveal.duration).toBe(300);
		while (app.viewport.cameraEffects.length > 0) {
			app.viewport.removeCameraEffect(app.viewport.cameraEffects[0]);
		}
	});
});
