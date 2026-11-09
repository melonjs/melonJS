import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	GLTFModel,
	Renderable,
	Vector2d,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * `GLTFModel#scale()` threw "this.scale is not a function".
 *
 * The constructor stored the scene's pixels-per-glTF-unit as `this.scale`, a
 * NUMBER, which shadowed the inherited `Renderable#scale(x, y, z)` method on
 * every instance. The documentation (and the 3D skills) say a model is placed
 * like any other renderable, with `pos`, `depth`, `rotate` and `scale` moving
 * the whole rig, but the one helper that resizes it could not even be called:
 *
 *     model.scale(2);   // TypeError: model.scale is not a function
 *
 * The number is internal (`@ignore` / `@internal`, stripped from the
 * published declarations) and is kept under its own name; `scale()` writes
 * the model's `currentTransform` like it does for any renderable, which the
 * rig's root matrix already folds into every part, and the reported bounds
 * grow with it.
 *
 * A synthetic descriptor (no GLB decode): an empty root node with a child
 * mesh node at local translation (1, 0, 0), so the child part's `pos` reads
 * where the rig put it.
 */

const PRIM = () => {
	return {
		vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
		uvs: new Float32Array([0, 0, 0, 0, 0, 0]),
		indices: new Uint16Array([0, 1, 2]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
		vertexCount: 3,
		baseColorFactor: [1, 1, 1, 1],
		colors: undefined,
		doubleSided: false,
	};
};

const makeData = () => {
	return {
		bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
		graph: {
			roots: [0],
			nodes: {
				0: {
					index: 0,
					name: "parent",
					translation: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1, 1, 1],
					matrix: null,
					children: [1],
					primitives: [],
				},
				1: {
					index: 1,
					name: "child",
					translation: [1, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1, 1, 1],
					matrix: null,
					children: [],
					primitives: [PRIM()],
				},
			},
		},
		animations: [
			{
				name: "move",
				duration: 1,
				channels: [
					{
						node: 0,
						path: "translation",
						times: [0, 1],
						values: [0, 0, 0, 5, 0, 0],
						stride: 3,
						interpolation: "LINEAR",
					},
				],
			},
		],
	};
};

const makeModel = (options = {}) => {
	return new GLTFModel(makeData(), {
		scale: 1,
		rightHanded: false,
		...options,
	});
};

const childOf = (model) => {
	return model.getChildByName("child")[0];
};

describe("GLTFModel#scale()", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	it("is the inherited Renderable#scale method, not a number", () => {
		const model = makeModel({ scale: 40 });
		expect(typeof model.scale).toBe("function");
		expect(model.scale).toBe(Renderable.prototype.scale);
	});

	it("can be called, and chains", () => {
		const model = makeModel();
		let result;
		expect(() => {
			result = model.scale(2);
		}).not.toThrow();
		expect(result).toBe(model);
	});

	it("grows the whole rig about the model's origin", () => {
		const model = makeModel();
		model.scale(2);
		model._pose();
		// the child sits 1 unit out at rest: twice the size puts it 2 out
		expect(childOf(model).pos.x).toBeCloseTo(2, 5);
		expect(childOf(model).pos.y).toBeCloseTo(0, 5);
	});

	it("grows each part's own geometry too", () => {
		const model = makeModel();
		model.scale(3);
		model._pose();
		const v = childOf(model).currentTransform.val;
		expect(v[0]).toBeCloseTo(3, 5);
		expect(v[5]).toBeCloseTo(3, 5);
	});

	it("multiplies the configured scene scale rather than replacing it", () => {
		// options.scale is pixels per glTF unit; scale() is the renderable's
		// own size on top of it
		const model = makeModel({ scale: 4 });
		model.scale(2);
		model._pose();
		expect(childOf(model).pos.x).toBeCloseTo(8, 4);
	});

	it("honours a non-uniform scale(x, y, z)", () => {
		const data = makeData();
		data.graph.nodes[1].translation = [1, 1, 1];
		const model = new GLTFModel(data, { scale: 1, rightHanded: false });
		model.scale(2, 3, 4);
		model._pose();
		const child = childOf(model);
		// glTF is Y-up, render space Y-down: local +1 in y is render -1
		expect(child.pos.x).toBeCloseTo(2, 5);
		expect(child.pos.y).toBeCloseTo(-3, 5);
		expect(child.depth).toBeCloseTo(4, 5);
	});

	it("scaleV() works too", () => {
		const model = makeModel();
		model.scaleV(new Vector2d(2, 2));
		model._pose();
		expect(childOf(model).pos.x).toBeCloseTo(2, 5);
	});

	it("composes with pos: the rig grows about where it stands", () => {
		const model = makeModel();
		model.pos.set(100, 50);
		model.scale(2);
		model._pose();
		expect(childOf(model).pos.x).toBeCloseTo(102, 4);
		expect(childOf(model).pos.y).toBeCloseTo(50, 4);
	});

	it("composes with a playing clip", () => {
		const model = makeModel();
		model.scale(2);
		model.setCurrentAnimation("move", { loop: false });
		model.update(500); // root tx 2.5, child at 3.5 local → 7 at twice the size
		expect(childOf(model).pos.x).toBeCloseTo(7, 4);
	});

	it("grows the reported bounds with the model", () => {
		const model = makeModel();
		const before = model.updateBounds(true);
		const w = before.width;
		const h = before.height;
		model.scale(2);
		const after = model.getBounds();
		expect(after.width).toBeCloseTo(w * 2, 5);
		expect(after.height).toBeCloseTo(h * 2, 5);
	});

	describe("normal behaviour the fix must keep", () => {
		it("options.scale still sets the scene size", () => {
			const model = makeModel({ scale: 4 });
			expect(childOf(model).pos.x).toBeCloseTo(4, 5);
			// the part is sized by the scene scale, not by currentTransform
			expect(childOf(model).currentTransform.val[0]).toBeCloseTo(1, 5);
			expect(model.currentTransform.isIdentity()).toBe(true);
		});

		it("options.scale defaults to 1", () => {
			const model = new GLTFModel(makeData(), { rightHanded: false });
			expect(childOf(model).pos.x).toBeCloseTo(1, 5);
		});

		it("an unscaled model's bounds are exactly what they were", () => {
			// bounds AABB [-1, 1]³: radius = √12 / 2 · scale, centred on 0
			const model = makeModel({ scale: 10 });
			const b = model.updateBounds(true);
			const e = (Math.sqrt(12) / 2) * 10;
			expect(b.left).toBeCloseTo(-e, 6);
			expect(b.right).toBeCloseTo(e, 6);
			expect(b.top).toBeCloseTo(-e, 6);
			expect(b.bottom).toBeCloseTo(e, 6);
		});

		it("a turned model's bounds do not change size", () => {
			const model = makeModel({ scale: 10 });
			const w = model.updateBounds(true).width;
			model.rotate(Math.PI / 3, new Vector3d(0, 1, 0));
			expect(model.getBounds().width).toBeCloseTo(w, 6);
		});

		it("rotate() still turns the rig", () => {
			const model = makeModel();
			model.rotate(Math.PI, new Vector3d(0, 0, 1));
			model._pose();
			expect(childOf(model).pos.x).toBeCloseTo(-1, 4);
		});
	});
});
