import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	CanvasRenderer,
	Color,
	Matrix3d,
	Rect,
	Renderable,
	Sprite,
	Stage,
	state,
	video,
} from "../src/index.js";
import { pixelSnap } from "../src/video/utils/pixel_snap.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";

/**
 * `subPixel: false`, the default, snaps what is drawn to whole pixels: once,
 * where it lands, the same way on every backend (#1765).
 *
 * It used to truncate (`|0`) after every `translate` and `transform` on the
 * GPU backends, and every `translate` argument on Canvas, and to leave shapes
 * alone. That moved a flipped sprite by a pixel, put nested translations a
 * pixel apart on Canvas and WebGL, drew a sprite and a `fillRect` at the same
 * position a pixel apart with half-grey edges on Canvas, and drew a body
 * resting on the floor (y = 224, then 223.99999999999997 after a collision
 * push-out) a pixel apart every other frame.
 *
 * Canvas and WebGL are read back in pixels. There is no WebGPU device in the
 * test browser, so WebGPU runs its real transform, `drawImage` and `fillRect`
 * on a stand-in that records the quads and triangles they emit, and the
 * pixels those cover are worked out with the GPU's rule: a pixel is covered
 * when its centre is inside.
 */

// one row of pixels, read across the middle of a short canvas
const W = 256;
const H = 8;
const ROW = 4;

// a float error short of 224, as the built-in solver leaves a resting body
const NEAR_224 = 223.99999999999997;

/**
 * a solid image
 * @param {number} w - width
 * @param {number} h - height
 * @param {string} color - fill
 * @returns {HTMLCanvasElement} the image
 */
const solid = (w, h, color) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const context = canvas.getContext("2d");
	context.fillStyle = color;
	context.fillRect(0, 0, w, h);
	return canvas;
};

/**
 * Columns of a row of RGBA bytes: full red, and partly red (an anti-aliased
 * edge). Green is read the same way when `channel` is 1.
 * @param {Uint8Array|Uint8ClampedArray} data - one row
 * @param {number} [channel=0] - 0 red, 1 green
 * @returns {{full: number[], partial: number[]}} the columns
 */
const columnsOf = (data, channel = 0) => {
	const full = [];
	const partial = [];
	for (let x = 0; x < data.length / 4; x++) {
		const v = data[x * 4 + channel];
		if (v > 200) {
			full.push(x);
		} else if (v > 20) {
			partial.push(x);
		}
	}
	return { full, partial };
};

/**
 * Read back a row (or a column, with `column`) of a real renderer.
 * @param {object} renderer - a Canvas or WebGL renderer
 * @param {object} [options] - what to read
 * @param {number} [options.channel=0] - 0 red, 1 green
 * @param {number} [options.column] - read this column, top to bottom
 * @returns {{full: number[], partial: number[]}} the pixels
 */
const readBack = (renderer, { channel = 0, column } = {}) => {
	const canvas = renderer.getCanvas();
	const across = column === undefined;
	const n = across ? canvas.width : canvas.height;
	let data;
	if (renderer.gl) {
		renderer.flush();
		const gl = renderer.gl;
		data = new Uint8Array(n * 4);
		if (across) {
			gl.readPixels(
				0,
				canvas.height - 1 - ROW,
				n,
				1,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				data,
			);
		} else {
			// bottom-up rows: read them, then put them top-down
			const raw = new Uint8Array(n * 4);
			gl.readPixels(column, 0, 1, n, gl.RGBA, gl.UNSIGNED_BYTE, raw);
			for (let i = 0; i < n; i++) {
				data.set(raw.subarray((n - 1 - i) * 4, (n - i) * 4), i * 4);
			}
		}
	} else {
		const context = renderer.getContext();
		data = across
			? context.getImageData(0, ROW, n, 1).data
			: context.getImageData(column, 0, 1, n).data;
	}
	return columnsOf(data, channel);
};

/**
 * WebGPU's real transform, `drawImage` and `fillRect` on a stand-in for its
 * device: every quad and triangle list it emits is recorded, transformed as
 * the batcher would, by the current transform at the time.
 * @returns {object} the stand-in renderer
 */
const webgpuStandIn = () => {
	const r = Object.create(WebGPURenderer.prototype);
	const shapes = [];
	const stack = [];
	const record = (points) => {
		const v = r.currentTransform.val;
		shapes.push(
			points.map(([x, y]) => {
				return [v[0] * x + v[4] * y + v[12], v[1] * x + v[5] * y + v[13]];
			}),
		);
	};
	const recorder = {
		addQuad(texture, x, y, w, h) {
			record([
				[x, y],
				[x + w, y],
				[x, y + h],
				[x + w, y + h],
			]);
		},
		drawVertices(mode, verts, count = verts.length) {
			record(
				verts.slice(0, count).map((p) => {
					return [p.x, p.y];
				}),
			);
		},
	};
	const own = {
		shapes,
		settings: { subPixel: false },
		currentTransform: new Matrix3d(),
		projectionMatrix: new Matrix3d(),
		_pixelSnapStack: [],
		_pixelSnapDepth: 0,
		rectTriangles: Array.from({ length: 6 }, () => {
			return { x: 0, y: 0 };
		}),
		currentGradient: null,
		currentTint: new Color(255, 255, 255, 1),
		currentNormalMap: null,
		customShader: undefined,
		activeLightCount: 0,
		frameId: 1,
		batchers: new Map(),
		cache: {
			get() {
				return {
					_quadUVs() {
						return [0, 0, 1, 1];
					},
				};
			},
		},
		setBatcher() {
			this.currentBatcher = recorder;
			return recorder;
		},
		setProjection(m) {
			this.projectionMatrix.copy(m);
			this.currentTransform.identity();
		},
		clearColor() {
			shapes.length = 0;
		},
		save() {
			stack.push(this.currentTransform.clone());
		},
		restore() {
			this.currentTransform.copy(stack.pop());
		},
		getGlobalAlpha() {
			return 1;
		},
		globalAlpha() {
			return 1;
		},
		getBlendMode() {
			return "normal";
		},
		beginPostEffect() {
			return false;
		},
	};
	for (const name of [
		"setGlobalAlpha",
		"setTint",
		"clearTint",
		"endPostEffect",
		"setDepth",
		"setBlendMode",
		"setColor",
		"flush",
	]) {
		own[name] = () => {};
	}
	for (const [key, value] of Object.entries(own)) {
		Object.defineProperty(r, key, {
			value,
			writable: true,
			configurable: true,
		});
	}
	return r;
};

/**
 * The pixels the stand-in's recorded draws cover on the row read (or down a
 * column, with `column`): those whose centre is inside a draw's box. A GPU
 * does not anti-alias, so nothing is partly covered.
 * @param {object} r - the stand-in
 * @param {object} [options] - what to read
 * @param {number} [options.column] - read this column, top to bottom
 * @returns {{full: number[], partial: number[]}} the pixels
 */
const coveredBy = (r, { column } = {}) => {
	const cols = new Set();
	const along = column === undefined ? 0 : 1;
	const at = (column === undefined ? ROW : column) + 0.5;
	for (const shape of r.shapes) {
		const a = shape.map((p) => {
			return p[along];
		});
		const b = shape.map((p) => {
			return p[1 - along];
		});
		if (Math.min(...b) > at || Math.max(...b) <= at) {
			continue;
		}
		const a0 = Math.min(...a);
		const a1 = Math.max(...a);
		for (let i = Math.ceil(a0 - 0.5); i < Math.ceil(a1 - 0.5); i++) {
			cols.add(i);
		}
	}
	return {
		full: [...cols].sort((a, b) => {
			return a - b;
		}),
		partial: [],
	};
};

/** the columns from `a` to `b`, both included */
const span = (a, b) => {
	return Array.from({ length: b - a + 1 }, (_, i) => {
		return a + i;
	});
};

describe("pixelSnap, the rule every backend follows", () => {
	/** where `x` lands after the x correction */
	const mapX = (k, x) => {
		return k === null ? x : k[0] * x + k[1];
	};
	const mapY = (k, y) => {
		return k === null ? y : k[2] * y + k[3];
	};

	it("rounds each edge of the box to the nearest pixel", () => {
		const k = pixelSnap(1, 0, 0, 1, 0, 0, 10.25, 0, 5.5, 8);
		expect(mapX(k, 10.25)).toBeCloseTo(10, 10);
		expect(mapX(k, 15.75)).toBeCloseTo(16, 10);
	});

	it("lands a float error short of a pixel on it", () => {
		const k = pixelSnap(1, 0, 0, 1, 0, 0, 0, NEAR_224, 16, 32);
		expect(mapY(k, NEAR_224)).toBe(224);
		expect(mapY(k, NEAR_224 + 32)).toBe(256);
	});

	it("gives a flipped draw the edges of the unflipped one", () => {
		// a 13 px box at 20.5, and the same box mirrored about its centre (27):
		// x lands on 54 - x
		const plain = pixelSnap(1, 0, 0, 1, 0, 0, 20.5, 0, 13, 8);
		const flipped = pixelSnap(-1, 0, 0, 1, 54, 0, 20.5, 0, 13, 8);
		const left = mapX(plain, 20.5);
		// mirrored, the local left edge lands on the right one
		expect(mapX(flipped, 54 - 20.5)).toBeCloseTo(left + 13, 10);
		expect(mapX(flipped, 54 - 33.5)).toBeCloseTo(left, 10);
	});

	it("moves a stroke so its line covers whole pixels", () => {
		// a 1 px line along y = 10 reaches from 9.5 to 10.5
		const k = pixelSnap(1, 0, 0, 1, 0, 0, 0, 10, 20, 0, 0.5);
		expect(mapY(k, 10)).toBeCloseTo(10.5, 10);
	});

	it("keeps a draw thinner than a pixel one pixel wide", () => {
		const k = pixelSnap(1, 0, 0, 1, 0, 0, 10.2, 0, 0.2, 8);
		expect(mapX(k, 10.2)).toBeCloseTo(10, 10);
		expect(mapX(k, 10.4)).toBeCloseTo(11, 10);
	});

	it("snaps in the units it is given: a zoom of 2 moves in 2 px steps", () => {
		// a renderer-space box at 10.4 (a world drawn zoomed lands at 20.8)
		const k = pixelSnap(1, 0, 0, 1, 0, 0, 10.4, 0, 4, 4);
		expect(mapX(k, 10.4)).toBeCloseTo(10, 10);
	});

	it("leaves a draw already on whole pixels, a rotated one and an endless one alone", () => {
		expect(pixelSnap(1, 0, 0, 1, 3, 4, 10, 0, 5, 8)).toBe(null);
		expect(pixelSnap(0.8, 0.6, -0.6, 0.8, 0, 0, 10.5, 0, 5, 8)).toBe(null);
		expect(pixelSnap(1, 0, 0, 1, 0, 0, -Infinity, 0, Infinity, 8)).toBe(null);
	});

	it("is done once: a snapped draw snaps to itself", () => {
		const k = pixelSnap(2, 0, 0, -1, 7.3, 50.6, 10.25, 3.5, 5.5, 8.25);
		const a = k[0] * 2;
		const e = k[0] * 7.3 + k[1];
		const d = k[2] * -1;
		const f = k[2] * 50.6 + k[3];
		const again = pixelSnap(a, 0, 0, d, e, f, 10.25, 3.5, 5.5, 8.25);
		if (again !== null) {
			expect(again[0]).toBeCloseTo(1, 10);
			expect(again[1]).toBeCloseTo(0, 10);
			expect(again[2]).toBeCloseTo(1, 10);
			expect(again[3]).toBeCloseTo(0, 10);
		}
	});
});

describe("subPixel: false on Canvas, WebGL and WebGPU", () => {
	const apps = {};
	const backends = {};
	let red13;
	let projection;
	// where the body comes to rest, step after step (see below)
	let positions;

	beforeAll(async () => {
		boot();
		// the alex4 player: a 192x96 sprite with its body low in the
		// frame, on a floor whose top edge is at 320, so it rests at
		// y = 224. The built-in solver leaves it at 224 one step and
		// 223.99999999999997 the next. Its own world, big enough to hold it
		const physics = new Application(400, 400, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await physics.init();
		const world = physics.world;
		const floor = new Renderable(0, 320, 400, 32);
		floor.anchorPoint.set(0, 0);
		floor.isKinematic = false;
		floor.bodyDef = { type: "static", shapes: [new Rect(0, 0, 400, 32)] };
		world.addChild(floor);
		const alex = new Renderable(100, 0, 192, 96);
		alex.anchorPoint.set(0, 0);
		alex.isKinematic = false;
		alex.bodyDef = { type: "dynamic", shapes: [new Rect(76, 36, 40, 60)] };
		world.addChild(alex);
		positions = [];
		for (let i = 0; i < 300; i++) {
			world.update(16);
			if (i >= 200) {
				positions.push(alex.pos.y);
			}
		}
		physics.destroy();

		for (const [name, type] of [
			["Canvas", video.CANVAS],
			["WebGL", video.WEBGL],
		]) {
			const app = new Application(W, H, {
				parent: "screen",
				renderer: type,
				failIfMajorPerformanceCaveat: false,
				subPixel: false,
			});
			await app.init();
			apps[name] = app;
		}
		expect(apps.Canvas.renderer).toBeInstanceOf(CanvasRenderer);
		red13 = solid(13, H, "#ff0000");
		projection = new Matrix3d().ortho(0, W, H, 0, -1000, 1000);
	});

	afterAll(() => {
		for (const app of Object.values(apps)) {
			app.destroy();
		}
	});

	/**
	 * Draw a scene on one backend from a clear frame and an identity
	 * transform, and return the pixels it covers on the row read.
	 * @param {string} name - "Canvas", "WebGL" or "WebGPU"
	 * @param {Function} scene - (renderer) => void
	 * @param {object} [read] - what to read back (see readBack)
	 * @returns {{full: number[], partial: number[]}} the pixels
	 */
	const draw = (name, scene, read) => {
		const r =
			name === "WebGPU"
				? (backends.WebGPU ??= webgpuStandIn())
				: apps[name].renderer;
		if (name === "WebGL" && !(r instanceof WebGLRenderer)) {
			return null;
		}
		r.clearColor("#000000ff");
		r.save();
		r.setProjection(projection);
		r.resetTransform?.();
		try {
			scene(r);
		} finally {
			r.restore();
		}
		return name === "WebGPU" ? coveredBy(r, read) : readBack(r, read);
	};

	/** a 13 px sprite anchored at its centre, as most sprites are */
	const sprite = (r, x, flipped) => {
		const s = new Sprite(x, ROW, { image: red13 });
		s.flipX(flipped);
		s.preDraw(r);
		s.draw(r);
		s.postDraw(r);
	};

	describe.for(["Canvas", "WebGL", "WebGPU"])("%s", (name) => {
		it("draws a sprite where the rule puts it: its left edge rounded", (ctx) => {
			// a 13 px sprite anchored at its centre starts at x - 6.5, so at a
			// whole x its edges sit on half pixels, where the canvas's own
			// rasterization and the rule part ways
			for (const x of [20, 20.25, 20.5, 20.75, 21.4, 21.6, 22]) {
				const at = draw(name, (r) => {
					sprite(r, x, false);
				});
				if (at === null) {
					ctx.skip("no WebGL");
				}
				const left = Math.round(x - 6.5);
				expect(at.full, `x ${x}`).toEqual(span(left, left + 12));
				expect(at.partial, `x ${x}`).toEqual([]);
			}
		});

		it("draws a flipped sprite on the pixels it covers unflipped", (ctx) => {
			for (const x of [20, 20.25, 20.5, 20.75]) {
				const plain = draw(name, (r) => {
					sprite(r, x, false);
				});
				if (plain === null) {
					ctx.skip("no WebGL");
				}
				const flipped = draw(name, (r) => {
					sprite(r, x, true);
				});
				expect(plain.full.length, `x ${x}`).toBe(13);
				expect(flipped.full, `x ${x}`).toEqual(plain.full);
			}
		});

		it("lands nested translations where their sum does", (ctx) => {
			// 10.6 then -6.5 is 4.1: the image starts on pixel 4. Snapping each
			// translate landed it on 3 (WebGL) or 5 (rounding each one)
			const at = draw(name, (r) => {
				r.translate(10.6, 0);
				r.translate(-6.5, 0);
				r.drawImage(red13, 0, 0);
			});
			if (at === null) {
				ctx.skip("no WebGL");
			}
			expect(at.full).toEqual(span(4, 16));
		});

		it("draws a sprite and a fillRect at the same position on the same pixels", (ctx) => {
			for (const x of [10.25, 10.5, 10.75, -0.5]) {
				const image = draw(name, (r) => {
					r.drawImage(red13, x, 0, 6, H);
				});
				if (image === null) {
					ctx.skip("no WebGL");
				}
				const rect = draw(name, (r) => {
					r.setColor("#ff0000");
					r.fillRect(x, 0, 6, H);
				});
				expect(rect.full, `x ${x}`).toEqual(image.full);
				expect(rect.full.length, `x ${x}`).toBe(6);
			}
		});

		it("rounds a fractional size the same way: each edge to its nearest pixel", (ctx) => {
			const at = draw(name, (r) => {
				r.setColor("#ff0000");
				r.fillRect(10, 0, 5.5, H);
			});
			if (at === null) {
				ctx.skip("no WebGL");
			}
			expect(at.full).toEqual(span(10, 15));
			expect(at.partial).toEqual([]);
		});

		it("lands a float error short of a pixel on it", (ctx) => {
			const at = draw(name, (r) => {
				r.drawImage(red13, NEAR_224, 0, 13, H);
			});
			if (at === null) {
				ctx.skip("no WebGL");
			}
			expect(at.full[0]).toBe(224);
		});
	});

	describe.for(["Canvas", "WebGL"])("%s shapes", (name) => {
		it("draws shape edges on whole pixels, with no half-grey column", (ctx) => {
			const fill = draw(name, (r) => {
				r.setColor("#ff0000");
				r.fillRect(10.25, 0, 5.5, H);
				r.fillRoundRect(40.5, 0, 12, H, 2);
			});
			if (fill === null) {
				ctx.skip("no WebGL");
			}
			expect(fill.full).toEqual([...span(10, 15), ...span(41, 52)]);
			expect(fill.partial).toEqual([]);
			// a 1 px stroke on a whole-pixel path covers half of two pixels
			// unless it is moved to their middle
			const stroke = draw(name, (r) => {
				r.setColor("#ff0000");
				r.lineWidth = 1;
				r.strokeRect(10, 1, 20, H - 2);
				r.strokeLine(60, 0, 60, H);
			});
			expect(stroke.full).toEqual([10, 30, 60]);
			expect(stroke.partial).toEqual([]);
		});

		it("masks on whole pixels", (ctx) => {
			const at = draw(name, (r) => {
				r.setMask(new Rect(10.6, 0, 19.8, H));
				r.setColor("#ff0000");
				r.fillRect(0, 0, W, H);
				r.clearMask();
			});
			if (at === null) {
				ctx.skip("no WebGL");
			}
			// 10.6 to 30.4: pixels 11 to 29, as a fill of the same shape is
			expect(at.full).toEqual(span(11, 29));
			expect(at.partial).toEqual([]);
		});

		it("clips on whole pixels", (ctx) => {
			const at = draw(name, (r) => {
				r.clipRect(10.6, 0, 19.8, H);
				r.setColor("#ff0000");
				r.fillRect(0, 0, W, H);
			});
			if (at === null) {
				ctx.skip("no WebGL");
			}
			// 10.6 to 30.4: pixels 11 to 29, each edge to its nearest (the GPU
			// scissor used to widen it to 10 to 30, and Canvas to grey them)
			expect(at.full).toEqual(span(11, 29));
			expect(at.partial).toEqual([]);
		});
	});

	it("draws the same pixels on every backend", (ctx) => {
		if (!(apps.WebGL.renderer instanceof WebGLRenderer)) {
			ctx.skip("no WebGL");
		}
		const scenes = [
			(r) => {
				r.translate(3.3, 0);
				r.scale(2, 1);
				r.drawImage(red13, 4.4, 0, 6, H);
			},
			(r) => {
				r.translate(30.7, 0);
				r.scale(-1, 1);
				r.translate(-6.25, 0);
				r.setColor("#ff0000");
				r.fillRect(0, 0, 12.5, H);
			},
			(r) => {
				r.translate(-0.4, 0);
				r.translate(10.45, 0);
				r.drawImage(red13, 0.5, 0);
			},
		];
		for (const [i, scene] of scenes.entries()) {
			const canvas = draw("Canvas", scene).full;
			expect(draw("WebGL", scene).full, `scene ${i}`).toEqual(canvas);
			expect(draw("WebGPU", scene).full, `scene ${i}`).toEqual(canvas);
		}
	});

	it("leaves what a perspective view (a Camera3d) draws where it is", () => {
		// 10.5 to 16.5 unsnapped covers pixels 10 to 15; snapped, 11 to 16
		const at = draw("WebGPU", (r) => {
			r.projectionMatrix.perspective(Math.PI / 3, W / H, 1, 1000);
			r.setColor("#ff0000");
			r.fillRect(10.5, 0, 6, H);
		});
		expect(at.full).toEqual(span(10, 15));
	});

	it("keeps the fraction when subPixel is true", () => {
		const r = apps.Canvas.renderer;
		r.settings.subPixel = true;
		try {
			const at = draw("Canvas", (renderer) => {
				renderer.setColor("#ff0000");
				renderer.fillRect(10.5, 0, 6, H);
			});
			// half a pixel on each side
			expect(at.partial).toEqual([10, 16]);
		} finally {
			r.settings.subPixel = false;
		}
	});

	describe("a body resting on the floor", () => {
		it("still alternates in the physics", () => {
			// what the snap absorbs: if the solver comes to rest exactly one
			// day, this needs another source of float error to mean anything
			expect([...new Set(positions)].sort()).toEqual([NEAR_224, 224]);
		});

		it.for(["Canvas", "WebGL", "WebGPU"])(
			"is drawn on one pixel row by %s",
			(name, ctx) => {
				const rows = new Set();
				const tall = solid(13, 96, "#ff0000");
				for (const y of positions) {
					// the sprite's top edge, brought into the short canvas
					const at = draw(
						name,
						(r) => {
							r.translate(0, -220);
							const s = new Sprite(100, y, { image: tall });
							s.anchorPoint.set(0, 0);
							s.preDraw(r);
							s.draw(r);
							s.postDraw(r);
						},
						{ column: 105 },
					);
					if (at === null) {
						ctx.skip("no WebGL");
					}
					rows.add(at.full[0]);
				}
				expect([...rows]).toEqual([4]);
			},
		);
	});
});

describe("the camera draws, culls and reads the pointer from one whole pixel", () => {
	let app;
	let camera;

	beforeAll(async () => {
		boot();
		app = new Application(64, H, {
			parent: "screen",
			renderer: video.CANVAS,
			subPixel: false,
		});
		await app.init();
		// the stage's own camera: `app.viewport` is only set by a reset. The
		// stage outlives the applications made before this one, so the camera
		// is sized to this one
		camera = state.current().cameras.get("default");
		camera.resize(64, H);
		camera.setBounds(-1000, -1000, 4000, 4000);
	});

	afterAll(() => {
		app?.destroy();
	});

	/**
	 * draw the world with the camera at `x`
	 * @returns {{red: number[], green: number[]}} the columns drawn
	 */
	const frame = (x) => {
		camera.moveTo(x, 0);
		app.world.update(0);
		app.repaint();
		app.draw();
		const r = app.renderer;
		return {
			red: readBack(r).full,
			green: readBack(r, { channel: 1 }).full,
		};
	};

	it("draws where worldToLocal says, and localToWorld reads it back", () => {
		const hero = new Sprite(20, 0, { image: solid(13, H, "#ff0000") });
		hero.anchorPoint.set(0, 0);
		app.world.addChild(hero);
		try {
			for (const x of [0.2, 0.4, 0.5, 0.6, 0.8, 1.4, -0.6]) {
				const drawn = frame(x).red[0];
				expect(drawn, `camera at ${x}`).toBe(20 - Math.round(x));
				const v = camera;
				expect(v.worldToLocal(20, 0).x, `camera at ${x}`).toBe(drawn);
				expect(v.localToWorld(drawn, 0).x, `camera at ${x}`).toBe(20);
				expect(v.worldView.left, `camera at ${x}`).toBe(Math.round(x));
				// the position keeps its fraction: a damped follow converges
				expect(v.pos.x).toBe(x);
			}
		} finally {
			app.world.removeChildNow(hero);
		}
	});

	it("keeps things still against each other while the view scrolls", () => {
		// a hero standing at 30.5, next to a tile at 10
		const hero = new Sprite(30.5, 0, { image: solid(6, H, "#ff0000") });
		const tile = new Sprite(10, 0, { image: solid(6, H, "#00ff00") });
		hero.anchorPoint.set(0, 0);
		tile.anchorPoint.set(0, 0);
		app.world.addChild(hero);
		app.world.addChild(tile);
		try {
			const gaps = new Set();
			for (const x of [0, 0.2, 0.4, 0.6, 0.8, 1, 1.3]) {
				const { red, green } = frame(x);
				gaps.add(red[0] - green[0]);
			}
			expect([...gaps]).toEqual([21]);
		} finally {
			app.world.removeChildNow(hero);
			app.world.removeChildNow(tile);
		}
	});

	it("follows its application from the stage's reset, before any frame is drawn", async () => {
		// The camera was last drawn by an application with subPixel off. One
		// with it on switches to a stage, whose onResetEvent reads the view
		// before anything has drawn: it is not rounded.
		const other = new Application(32, 32, {
			parent: "screen",
			renderer: video.CANVAS,
			subPixel: true,
		});
		await other.init();
		let seen;
		class Probe extends Stage {
			onResetEvent() {
				const cam = this.cameras.get("default");
				cam.setBounds(-1000, -1000, 4000, 4000);
				cam.moveTo(0.4, 0);
				seen = cam.worldView.left;
			}
		}
		const PROBE = state.USER + 17;
		state.set(PROBE, new Probe());
		try {
			state.change(PROBE, true);
			expect(seen).toBe(0.4);
		} finally {
			other.destroy();
		}
	});

	it("follows the renderer that draws it, not the last application made", async () => {
		// `game` is the last application to init(): one with subPixel on,
		// made after this one. The camera still snaps when this application
		// draws it, and stops when the other one does.
		const other = new Application(32, 32, {
			parent: "screen",
			renderer: video.CANVAS,
			subPixel: true,
		});
		await other.init();
		try {
			const cam = state.current().cameras.get("default");
			cam.setBounds(-1000, -1000, 4000, 4000);
			cam.moveTo(0.4, 0);
			app.world.update(0);
			app.repaint();
			app.draw();
			expect(cam.worldView.left).toBe(0);

			other.repaint();
			other.draw();
			expect(cam.worldView.left).toBe(0.4);
		} finally {
			other.destroy();
		}
	});
});

describe("Canvas with smoothing on", () => {
	// With smoothing off the canvas already draws image edges whole, so it is
	// with smoothing on that a draw left between pixels shows: blended edges
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(W, H, {
			parent: "screen",
			renderer: video.CANVAS,
			antiAlias: true,
			subPixel: false,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	it("draws a sprite at a fractional position on whole pixels, unblended", () => {
		// red and black stripes, a pixel wide: a draw left between pixels
		// blends neighbouring stripes into in-between reds, which a solid
		// image would hide
		const image = document.createElement("canvas");
		image.width = 13;
		image.height = H;
		const c = image.getContext("2d");
		for (let i = 0; i < 13; i += 2) {
			c.fillStyle = "#ff0000";
			c.fillRect(i, 0, 1, H);
		}
		const r = app.renderer;
		for (const x of [20.25, 20.5, 20.75]) {
			r.clearColor("#000000ff");
			r.save();
			r.setProjection(new Matrix3d().ortho(0, W, H, 0, -1000, 1000));
			r.resetTransform();
			const s = new Sprite(x, ROW, { image });
			s.preDraw(r);
			s.draw(r);
			s.postDraw(r);
			r.restore();
			const at = readBack(r);
			const left = Math.round(x - 6.5);
			expect(at.full, `x ${x}`).toEqual(
				span(0, 6).map((i) => {
					return left + i * 2;
				}),
			);
			expect(at.partial, `x ${x}`).toEqual([]);
		}
	});

	it("draws a pattern at a fractional position from a whole pixel, unblended", () => {
		// a red pixel then a black one, repeated: the pattern starts where
		// the fill does, so a fill left between pixels blends the stripes
		const tile = document.createElement("canvas");
		tile.width = 2;
		tile.height = H;
		const c = tile.getContext("2d");
		c.fillStyle = "#ff0000";
		c.fillRect(0, 0, 1, H);
		const r = app.renderer;
		const pattern = r.createPattern(tile, "repeat");
		for (const x of [20.25, 20.5, 20.75]) {
			r.clearColor("#000000ff");
			r.save();
			r.setProjection(new Matrix3d().ortho(0, W, H, 0, -1000, 1000));
			r.resetTransform();
			r.drawPattern(pattern, x, 0, 14, H);
			r.restore();
			const at = readBack(r);
			const left = Math.round(x);
			expect(at.full, `x ${x}`).toEqual(
				span(0, 6).map((i) => {
					return left + i * 2;
				}),
			);
			expect(at.partial, `x ${x}`).toEqual([]);
		}
	});
});
