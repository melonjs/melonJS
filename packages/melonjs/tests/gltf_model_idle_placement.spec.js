import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	GLTFModel,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * A `GLTFModel` did not move, turn or grow unless an animation was playing.
 *
 * The model's placement (`pos`, `depth`, `currentTransform`) reaches its part
 * meshes only through `_rootMatrix()`, inside `_pose()`, and `update()` only
 * called `_pose()` while a clip was current, unpaused, unfinished and of
 * non-zero length. So a model that was never played, whose clip was paused,
 * or whose play-once clip had finished, stayed drawn where it last posed: a
 * knockback, a teleport or a turn changed `model.pos` (which reported the new
 * place perfectly) while every part kept drawing at the old one.
 *
 * The existing placement tests called `model._pose()` by hand after
 * `pos.set`, which hid it. These go through `update()`, the way the world
 * drives a model every frame.
 *
 * Fixed by re-posing in `update()` when the placement differs from the one
 * the rig was last posed with — without touching the animation time, so a
 * paused or finished clip stays exactly where it was.
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

// root node 0 (animated by "move": translation x 0 → 5 over 1 s) with a mesh
// child at local (1, 0, 0)
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
			{
				// a clip of zero length: one keyframe, nothing to advance
				name: "still",
				duration: 0,
				channels: [
					{
						node: 0,
						path: "translation",
						times: [0],
						values: [2, 0, 0],
						stride: 3,
						interpolation: "LINEAR",
					},
				],
			},
		],
	};
};

const makeModel = () => {
	return new GLTFModel(makeData(), { scale: 1, rightHanded: false });
};

const childOf = (model) => {
	return model.getChildByName("child")[0];
};

const AXIS_Z = new Vector3d(0, 0, 1);

describe("GLTFModel placement without a playing clip", () => {
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

	describe("the bug: placement changes reach the parts", () => {
		it("a model never played moves with pos", () => {
			const model = makeModel();
			model.pos.set(100, 40);
			model.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(101, 4);
			expect(childOf(model).pos.y).toBeCloseTo(40, 4);
		});

		it("a model never played moves with depth", () => {
			const model = makeModel();
			model.depth = 250;
			model.update(16);
			expect(childOf(model).depth).toBeCloseTo(250, 4);
		});

		it("a model never played turns with rotate()", () => {
			const model = makeModel();
			model.rotate(Math.PI, AXIS_Z);
			model.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(-1, 4);
		});

		it("a model never played grows with scale()", () => {
			const model = makeModel();
			model.scale(2);
			model.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(2, 4);
		});

		it("a PAUSED clip still follows a knockback", () => {
			const model = makeModel();
			model.setCurrentAnimation("move");
			model.update(500); // child at 1 + 2.5
			model.pause();
			model.pos.set(-60, 0);
			model.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(-60 + 3.5, 4);
		});

		it("a FINISHED play-once clip still follows a teleport", () => {
			const model = makeModel();
			model.setCurrentAnimation("move", { loop: false });
			model.update(1500); // held on the last frame: child at 1 + 5
			model.pos.set(300, 0);
			model.depth = 20;
			model.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(306, 4);
			expect(childOf(model).depth).toBeCloseTo(20, 4);
		});

		it("a paused clip keeps its frozen pose while the model moves", () => {
			const model = makeModel();
			model.setCurrentAnimation("move");
			model.update(250);
			model.pause();
			for (let i = 0; i < 5; i++) {
				model.pos.x += 10;
				model.update(100);
			}
			// pose = clip at 0.25 (child at 2.25) + the model's own 50
			expect(childOf(model).pos.x).toBeCloseTo(52.25, 4);
		});

		it("a finished clip holds its last frame while the model moves", () => {
			const model = makeModel();
			model.setCurrentAnimation("move", { loop: false });
			model.update(1500);
			for (let i = 0; i < 4; i++) {
				model.pos.x += 10;
				model.update(500);
			}
			expect(childOf(model).pos.x).toBeCloseTo(46, 4);
		});

		it("a zero-length clip still follows the model", () => {
			const model = makeModel();
			model.setCurrentAnimation("still");
			model.pos.set(10, 0);
			model.update(16);
			// root held at its keyframe x = 2, child 1 further, model 10
			expect(childOf(model).pos.x).toBeCloseTo(13, 4);
		});

		it("a stopped model follows the model", () => {
			const model = makeModel();
			model.setCurrentAnimation("move");
			model.update(500);
			model.stop();
			model.pos.set(7, 0);
			model.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(8, 4);
		});

		it("a direct write to currentTransform is seen too", () => {
			const model = makeModel();
			model.currentTransform.rotate(Math.PI, AXIS_Z);
			model.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(-1, 4);
		});

		it("through the scene graph: a world update carries the move", () => {
			const parent = new Container(0, 0, 800, 600);
			const model = makeModel();
			parent.addChild(model, 0);
			model.pause();
			model.pos.set(50, 60);
			parent.update(16);
			expect(childOf(model).pos.x).toBeCloseTo(51, 4);
			expect(childOf(model).pos.y).toBeCloseTo(60, 4);
		});
	});

	describe("normal behaviour the fix must keep", () => {
		it("a paused clip does not advance when the model moves", () => {
			const model = makeModel();
			model.setCurrentAnimation("move");
			model.update(250);
			model.pause();
			const t = model.current.time;
			for (let i = 0; i < 5; i++) {
				model.pos.x += 10;
				model.update(100);
			}
			expect(model.current.time).toBe(t);
			expect(model.animationpause).toBe(true);
		});

		it("a finished clip is not restarted and does not fire again", () => {
			const model = makeModel();
			let completed = 0;
			model.setCurrentAnimation("move", {
				loop: false,
				onComplete: () => {
					completed++;
				},
			});
			model.update(1500);
			expect(completed).toBe(1);
			for (let i = 0; i < 4; i++) {
				model.pos.x += 10;
				model.update(500);
			}
			expect(completed).toBe(1);
			expect(model.current.time).toBe(1);
			expect(model.isCurrentAnimation("move")).toBe(true);
		});

		it("a never-played model gains no animation", () => {
			const model = makeModel();
			model.pos.x = 30;
			model.update(16);
			expect(model.current.name).toBeUndefined();
			expect(model.current.time).toBe(0);
		});

		it("a playing clip still advances and composes with the placement", () => {
			const model = makeModel();
			model.setCurrentAnimation("move");
			model.pos.x = 100;
			model.update(500);
			expect(childOf(model).pos.x).toBeCloseTo(103.5, 4);
			model.update(250);
			expect(childOf(model).pos.x).toBeCloseTo(104.75, 4);
		});

		it("pause() then play() resumes from the frozen time", () => {
			const model = makeModel();
			model.setCurrentAnimation("move");
			model.update(250);
			model.pause();
			model.pos.x = 10;
			model.update(400);
			model.play();
			model.update(250);
			// 0.25 + 0.25 = 0.5 → child 3.5, plus 10
			expect(childOf(model).pos.x).toBeCloseTo(13.5, 4);
		});

		it("a still, idle model is not re-posed every frame", () => {
			const model = makeModel();
			model.pos.set(20, 0);
			model.update(16);
			let posed = 0;
			const pose = model._pose.bind(model);
			model._pose = () => {
				posed++;
				pose();
			};
			for (let i = 0; i < 10; i++) {
				model.update(16);
			}
			expect(posed).toBe(0);
		});

		it("a part moved by hand is left alone while the model stays put", () => {
			// re-posing is driven by the MODEL's placement only; a still model
			// does not keep overwriting its parts
			const model = makeModel();
			model.update(16);
			childOf(model).pos.x = 999;
			model.update(16);
			expect(childOf(model).pos.x).toBe(999);
		});

		it("updating a destroyed model is still a no-op", () => {
			const parent = new Container(0, 0, 400, 300);
			const model = makeModel();
			parent.addChild(model);
			model.pause();
			parent.removeChildNow(model);
			expect(() => {
				model.update(16);
			}).not.toThrow();
		});
	});
});
