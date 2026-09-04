import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Matrix3d, Mesh, TextureAtlas, Vector3d } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * `uEyePosition` under a scaled ancestor (#1636).
 *
 * The lit shaders need the camera's position to build the Blinn-Phong half
 * vector. `vWorldPos` is PRE-view (`uModelMatrix * position`), so the eye they
 * want is by definition the point the view maps to the view-space origin — the
 * translation column of the view's inverse.
 *
 * It used to be extracted as `-Rᵀ·t`, which is that column only when the upper
 * 3×3 is orthonormal. The matrix in play is not the camera's view alone:
 * `Container.draw` folds every ancestor into it, so one scaled container put
 * the eye somewhere else and took the highlight with it.
 */
/** where the view maps to the view-space origin — the definition of the eye */
const trueEye = (view) => {
	const inv = new Matrix3d().copy(view).invert().val;
	return [inv[12], inv[13], inv[14]];
};

describe("the eye position derived from the view", () => {
	/** the pre-fix formula, kept here so the regression stays visible */
	const legacyEye = (view) => {
		const v = view.val;
		return [
			-(v[0] * v[12] + v[1] * v[13] + v[2] * v[14]),
			-(v[4] * v[12] + v[5] * v[13] + v[6] * v[14]),
			-(v[8] * v[12] + v[9] * v[13] + v[10] * v[14]),
		];
	};

	/** push a point through the view; the true eye must land on the origin */
	const throughView = (view, [x, y, z]) => {
		const v = view.val;
		return [
			v[0] * x + v[4] * y + v[8] * z + v[12],
			v[1] * x + v[5] * y + v[9] * z + v[13],
			v[2] * x + v[6] * y + v[10] * z + v[14],
		];
	};

	const rigid = () => {
		return new Matrix3d().identity().translate(0, -300, -600);
	};

	it("agrees with the old formula whenever the view is rigid", () => {
		// the fix must be invisible for every scene that was already correct
		for (const build of [
			() => {
				return new Matrix3d().identity().translate(10, 20, 30);
			},
			() => {
				return new Matrix3d().identity().rotate(0.7, new Vector3d(0, 1, 0));
			},
			() => {
				return new Matrix3d()
					.identity()
					.rotate(0.4, new Vector3d(1, 0, 0))
					.translate(120, -40, -800);
			},
			rigid,
		]) {
			const view = build();
			const [ax, ay, az] = trueEye(view);
			const [bx, by, bz] = legacyEye(view);
			expect(ax).toBeCloseTo(bx, 4);
			expect(ay).toBeCloseTo(by, 4);
			expect(az).toBeCloseTo(bz, 4);
		}
	});

	it("is the point the view sends to the view-space origin, scaled or not", () => {
		// the property that actually defines it — holds for ANY invertible view
		const views = [
			rigid(),
			new Matrix3d().identity().translate(0, -300, -600).scale(0.5, 0.5, 0.5),
			new Matrix3d().identity().translate(0, -300, -600).scale(3, 1, 1),
			new Matrix3d()
				.identity()
				.rotate(0.6, new Vector3d(0, 1, 0))
				.translate(50, -20, -400)
				.scale(2, 0.5, 1.5),
		];
		for (const view of views) {
			const [x, y, z] = throughView(view, trueEye(view));
			expect(x).toBeCloseTo(0, 3);
			expect(y).toBeCloseTo(0, 3);
			expect(z).toBeCloseTo(0, 3);
		}
	});

	it("diverges from the old formula by s² under a uniform scale", () => {
		// the reported case, and counter-intuitively the WORST one: the old
		// extraction yields s·e where the truth is e/s
		const view = new Matrix3d().identity();
		view.val[0] = view.val[5] = view.val[10] = 0.5;
		view.val[13] = -300;
		view.val[14] = -600;
		const t = trueEye(view);
		const l = legacyEye(view);
		expect(t[1]).toBeCloseTo(600, 3);
		expect(t[2]).toBeCloseTo(1200, 3);
		expect(l[1]).toBeCloseTo(150, 3); // 0.5 * 300
		expect(l[2]).toBeCloseTo(300, 3);
		// s = 0.5 -> the ratio is 1/s² = 4
		expect(t[1] / l[1]).toBeCloseTo(4, 3);
	});

	it("stays finite for a degenerate (zero-scale) view", () => {
		// a collapsed container renders nothing anyway; what matters is that
		// the uniform never carries NaN into the shader
		const view = new Matrix3d().identity();
		view.val[0] = 0; // singular
		const eye = trueEye(view);
		for (const c of eye) {
			expect(Number.isFinite(c)).toBe(true);
		}
	});
});

describe("the eye position the batcher actually uploads", () => {
	const SIZE = 64;
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// unavailable — the tests below skip
		}
	});
	afterAll(() => {
		try {
			releaseWebGLRenderer();
		} catch {
			/* ignore */
		}
	});
	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available");
		}
	};

	let _atlas = null;
	const whiteAtlas = () => {
		if (_atlas === null) {
			const c = document.createElement("canvas");
			c.width = 1;
			c.height = 1;
			const g = c.getContext("2d");
			g.fillStyle = "#ffffff";
			g.fillRect(0, 0, 1, 1);
			_atlas = new TextureAtlas({ framewidth: 1, frameheight: 1, image: c }, c);
		}
		return _atlas;
	};

	const litQuad = () => {
		const h = 16;
		const mesh = new Mesh(0, 0, {
			vertices: [-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0],
			uvs: [0, 0, 1, 0, 1, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
			texture: whiteAtlas(),
			width: h * 2,
			height: h * 2,
			cullBackFaces: false,
			lit: true,
			shininess: 64,
		});
		mesh._useWorldSpace = true;
		return mesh;
	};

	/** draw one lit mesh under `view` and report what the batcher computed */
	const eyeAfterDraw = (view) => {
		const proj = new Matrix3d();
		proj.ortho(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, -1000, 1000);
		renderer.setProjection(proj);
		renderer.currentTransform.copy(view);
		const mesh = litQuad();
		mesh.preDraw(renderer);
		mesh.draw(renderer);
		mesh.postDraw(renderer);
		renderer.flush();
		const b = renderer.currentBatcher;
		return [b.currentEyeX, b.currentEyeY, b.currentEyeZ];
	};

	it("matches the view's inverse for a rigid view", (ctx) => {
		requireWebGL(ctx);
		const view = new Matrix3d().identity().translate(0, -300, -600);
		const [x, y, z] = eyeAfterDraw(view);
		const [tx, ty, tz] = trueEye(view);
		expect(x).toBeCloseTo(tx, 3);
		expect(y).toBeCloseTo(ty, 3);
		expect(z).toBeCloseTo(tz, 3);
	});

	it("matches it under a scaled ancestor too — the bug", (ctx) => {
		requireWebGL(ctx);
		// the old extraction gave 0.5*300 = 150 here, where the truth is 600
		const view = new Matrix3d().identity();
		view.val[0] = 0.5;
		view.val[5] = 0.5;
		view.val[10] = 0.5;
		view.val[13] = -300;
		view.val[14] = -600;
		const [x, y, z] = eyeAfterDraw(view);
		const [tx, ty, tz] = trueEye(view);
		expect(y).toBeCloseTo(600, 2);
		expect(x).toBeCloseTo(tx, 2);
		expect(y).toBeCloseTo(ty, 2);
		expect(z).toBeCloseTo(tz, 2);
	});

	it("matches it under a non-uniform scale with rotation", (ctx) => {
		requireWebGL(ctx);
		const view = new Matrix3d()
			.identity()
			.rotate(0.6, new Vector3d(0, 1, 0))
			.translate(50, -20, -400);
		view.val[0] *= 2;
		view.val[5] *= 0.5;
		const [x, y, z] = eyeAfterDraw(view);
		const [tx, ty, tz] = trueEye(view);
		expect(x).toBeCloseTo(tx, 2);
		expect(y).toBeCloseTo(ty, 2);
		expect(z).toBeCloseTo(tz, 2);
	});

	it("does not mutate the renderer's live view matrix", (ctx) => {
		requireWebGL(ctx);
		// `viewMatrix` IS `renderer.currentTransform` — the batcher binds the
		// reference — and `Matrix3d.invert()` mutates its receiver. Inverting
		// in place therefore leaves the frame's transform inverted.
		//
		// Checked between `draw` and `postDraw`: `postDraw` restores the
		// transform from the stack, so the damage is invisible once the
		// bracket closes. That restore is the only reason nothing else in the
		// suite notices, which is exactly why this is worth pinning.
		const view = new Matrix3d().identity().translate(0, -300, -600);
		view.val[0] = 0.5;
		view.val[5] = 0.5;
		view.val[10] = 0.5;
		const proj = new Matrix3d();
		proj.ortho(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, -1000, 1000);
		renderer.setProjection(proj);
		renderer.currentTransform.copy(view);
		const expected = Array.from(renderer.currentTransform.val);

		const mesh = litQuad();
		mesh.preDraw(renderer);
		mesh.draw(renderer);
		const during = Array.from(renderer.currentTransform.val);
		mesh.postDraw(renderer);
		renderer.flush();

		expect(during).toEqual(expected);
	});

	it("leaves the caller's matrix object unmodified", (ctx) => {
		requireWebGL(ctx);
		const view = new Matrix3d().identity().translate(0, -30, -600);
		view.val[0] = 0.5;
		const before = Array.from(view.val);
		eyeAfterDraw(view);
		expect(Array.from(view.val)).toEqual(before);
	});

	it("never uploads a NaN, even for a degenerate view", (ctx) => {
		requireWebGL(ctx);
		const view = new Matrix3d().identity().translate(0, -30, -600);
		view.val[0] = 0; // singular
		const eye = eyeAfterDraw(view);
		for (const c of eye) {
			expect(Number.isFinite(c)).toBe(true);
		}
	});
});

describe("the WebGPU backend derives the same eye (mock device)", () => {
	// WebGPU has no adapter here, so this asserts the value the batcher writes
	// into its uniform block rather than a pixel. Floats 48..50 of the mesh
	// block are the eye — see `setPlacementUniforms`.
	const eyeFromWrite = (renderer) => {
		const w = renderer.calls.writes
			.filter((x) => {
				return x.floats.length >= 51;
			})
			.at(-1);
		return [w.floats[48], w.floats[49], w.floats[50]];
	};

	const drawWith = async (view) => {
		const { createMockWebGPURenderer } = await import(
			"./helpers/webgpu-mock-renderer.js"
		);
		const { default: WebGPUMeshBatcher } = await import(
			"../src/video/webgpu/batchers/mesh_batcher.js"
		);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		renderer.currentTransform.copy(view);
		batcher.setPlacementUniforms(new Matrix3d(), 0xffffffff, {
			alphaCutoff: 0,
		});
		return { renderer, view };
	};

	it("matches the view's inverse for a rigid view", async () => {
		const view = new Matrix3d().identity().translate(0, -300, -600);
		const { renderer } = await drawWith(view);
		const [tx, ty, tz] = trueEye(view);
		const [x, y, z] = eyeFromWrite(renderer);
		expect(x).toBeCloseTo(tx, 2);
		expect(y).toBeCloseTo(ty, 2);
		expect(z).toBeCloseTo(tz, 2);
	});

	it("matches it under a scaled ancestor — the bug, on this backend too", async () => {
		const view = new Matrix3d().identity();
		view.val[0] = 0.5;
		view.val[5] = 0.5;
		view.val[10] = 0.5;
		view.val[13] = -300;
		view.val[14] = -600;
		const { renderer } = await drawWith(view);
		const [x, y, z] = eyeFromWrite(renderer);
		const [tx, ty, tz] = trueEye(view);
		expect(y).toBeCloseTo(600, 1); // the old extraction gave 150
		expect(x).toBeCloseTo(tx, 1);
		expect(y).toBeCloseTo(ty, 1);
		expect(z).toBeCloseTo(tz, 1);
	});

	it("does not mutate the renderer's live view matrix", async () => {
		const view = new Matrix3d().identity().translate(0, -300, -600);
		view.val[0] = 0.5;
		const { renderer } = await drawWith(view);
		expect(Array.from(renderer.currentTransform.val)).toEqual(
			Array.from(view.val),
		);
	});
});
