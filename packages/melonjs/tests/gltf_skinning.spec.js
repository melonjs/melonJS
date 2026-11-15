import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, GLTFModel, video } from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import {
	computeJointMatrices,
	invertMatrixInto,
	normalizeSkinWeights,
	skinVertices,
} from "../src/level/gltf/gltf_skin.js";
import { gltfList } from "../src/loader/cache.js";
import { composeTRS, parseGLTF } from "../src/loader/parsers/gltf.js";
import {
	buildBarGLB,
	IDENTITY,
	QZ90,
	translation,
} from "./helpers/skinned-bar.js";

/**
 * glTF skinning: JOINTS_0 / WEIGHTS_0 with inverse bind matrices, deformed on
 * the CPU by GLTFModel, and the crossfade between clips that a skinned
 * character needs as soon as it has more than one.
 *
 * The test asset is a two-bone "bar", built in memory:
 *
 *   node 0 "bar"   — the skinned mesh. Deliberately translated to x = 100:
 *                    the spec says a skinned mesh's own node transform is
 *                    IGNORED, so nothing may end up near x = 100.
 *   node 1 "hip"   — joint 0, at the origin
 *   └─ node 2 "knee" — joint 1, at (0, 1, 0)
 *
 *   v0 (0,0,0)  v1 (1,0,0)  → bound fully to the hip
 *   v2 (0,2,0)  v3 (1,2,0)  → bound fully to the knee
 *
 * "bend" turns the knee 90° about Z, which swings v2 to (-1, 1, 0) and v3 to
 * (-1, 2, 0). "lift" raises the hip to y = 10, carrying everything.
 */

// ── reference math, independent of the code under test ─────────────────────

function applyMat(m, v) {
	return [
		m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
		m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
		m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
	];
}

function mul(a, b) {
	const out = new Array(16).fill(0);
	for (let c = 0; c < 4; c++) {
		for (let r = 0; r < 4; r++) {
			for (let k = 0; k < 4; k++) {
				out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
			}
		}
	}
	return out;
}

const R45 = Math.SQRT1_2;

const expectClose = (actual, expected, digits = 4) => {
	expect(actual.length).toBe(expected.length);
	for (let i = 0; i < expected.length; i++) {
		expect(actual[i]).toBeCloseTo(expected[i], digits);
	}
};

// ── pure math ────────────────────────────────────────────────────────────────

describe("glTF skinning math", () => {
	it("invertMatrixInto inverts a TRS matrix", () => {
		const m = composeTRS([3, -2, 5], [0, 0, R45, R45], [2, 2, 2]);
		const inv = new Array(16);
		expect(invertMatrixInto(inv, m)).toBe(true);
		expectClose(mul(m, inv), IDENTITY, 6);
	});

	it("invertMatrixInto reports a singular matrix and leaves out alone", () => {
		const out = new Array(16).fill(7);
		const zeroScale = composeTRS([1, 2, 3], [0, 0, 0, 1], [0, 1, 1]);
		expect(invertMatrixInto(out, zeroScale)).toBe(false);
		expect(
			out.every((v) => {
				return v === 7;
			}),
		).toBe(true);
	});

	it("normalizeSkinWeights scales normalized bytes back to 0..1", () => {
		const out = normalizeSkinWeights(
			new Uint8Array([255, 0, 0, 0, 128, 127, 0, 0]),
			5121,
		);
		expectClose(Array.from(out), [1, 0, 0, 0, 128 / 255, 127 / 255, 0, 0]);
	});

	it("normalizeSkinWeights makes weights that do not sum to 1 sum to 1", () => {
		const out = normalizeSkinWeights(
			new Float32Array([0.5, 0.25, 0, 0, 2, 2, 0, 0]),
			5126,
		);
		expectClose(Array.from(out), [2 / 3, 1 / 3, 0, 0, 0.5, 0.5, 0, 0]);
	});

	it("normalizeSkinWeights binds an all-zero vertex to its first joint", () => {
		const out = normalizeSkinWeights(new Float32Array([0, 0, 0, 0]), 5126);
		expect(Array.from(out)).toEqual([1, 0, 0, 0]);
	});

	it("skinVertices with identity joints leaves the bind pose as it is", () => {
		const pos = new Float32Array([1, 2, 3, -4, 5, 6]);
		const out = new Float32Array(6);
		skinVertices(
			pos,
			undefined,
			new Uint16Array([0, 1, 0, 0, 1, 0, 0, 0]),
			new Float32Array([0.5, 0.5, 0, 0, 1, 0, 0, 0]),
			new Float32Array([...IDENTITY, ...IDENTITY]),
			2,
			out,
		);
		expectClose(Array.from(out), Array.from(pos));
	});

	it("skinVertices blends two joints by weight", () => {
		const out = new Float32Array(3);
		skinVertices(
			new Float32Array([0, 0, 0]),
			undefined,
			new Uint16Array([0, 1, 0, 0]),
			new Float32Array([0.25, 0.75, 0, 0]),
			new Float32Array([...translation(4, 0, 0), ...translation(0, 8, 0)]),
			1,
			out,
		);
		expectClose(Array.from(out), [1, 6, 0]);
	});

	it("skinVertices turns normals with their joints and renormalizes them", () => {
		const rotZ = composeTRS([9, 9, 9], QZ90, [3, 3, 3]);
		const pos = new Float32Array(3);
		const nrm = new Float32Array(3);
		skinVertices(
			new Float32Array([0, 0, 0]),
			new Float32Array([1, 0, 0]),
			new Uint16Array([0, 0, 0, 0]),
			new Float32Array([1, 0, 0, 0]),
			new Float32Array(rotZ),
			1,
			pos,
			nrm,
		);
		// the joint's translation never reaches a normal, and its scale is
		// normalized away
		expectClose(Array.from(nrm), [0, 1, 0]);
	});

	it("computeJointMatrices is jointWorld · inverseBind, in the mesh node's space", () => {
		const skin = {
			joints: [5],
			inverseBindMatrices: new Float32Array(translation(0, -1, 0)),
		};
		const jointWorld = translation(0, 3, 0);
		const meshWorld = translation(100, 0, 0);
		const meshInv = new Array(16);
		invertMatrixInto(meshInv, meshWorld);
		const out = new Float32Array(16);
		computeJointMatrices(
			out,
			skin,
			() => {
				return jointWorld;
			},
			meshInv,
		);
		// placed back by the mesh node, a vertex at the bind origin of the
		// joint lands where the joint went: meshWorld · jointMatrix · (0,1,0)
		const placed = applyMat(meshWorld, applyMat(Array.from(out), [0, 1, 0]));
		expectClose(placed, [0, 3, 0]);
	});

	it("computeJointMatrices keeps a joint outside the node tree at its bind pose", () => {
		const skin = {
			joints: [42],
			inverseBindMatrices: new Float32Array(translation(0, -1, 0)),
		};
		const meshInv = new Array(16);
		invertMatrixInto(meshInv, translation(100, 0, 0));
		const out = new Float32Array(16);
		computeJointMatrices(
			out,
			skin,
			() => {
				return undefined;
			},
			meshInv,
		);
		expectClose(Array.from(out), meshInv);
	});
});

// ── parser ───────────────────────────────────────────────────────────────────

describe("glTF skin parsing", () => {
	it("reads the skin's joints and inverse bind matrices", async () => {
		const data = await parseGLTF(buildBarGLB());
		expect(data.skins).toHaveLength(1);
		expect(data.skins[0].name).toBe("rig");
		expect(data.skins[0].joints).toEqual([1, 2]);
		expectClose(Array.from(data.skins[0].inverseBindMatrices), [
			...IDENTITY,
			...translation(0, -1, 0),
		]);
	});

	it("gives the skinned primitive its joints, weights and skin", async () => {
		const data = await parseGLTF(buildBarGLB());
		const prim = data.graph.nodes[0].primitives[0];
		expect(data.graph.nodes[0].skin).toBe(0);
		expect(data.graph.nodes[1].skin).toBeNull();
		expect(prim.skin).toBe(0);
		expect(prim.joints).toBeInstanceOf(Uint16Array);
		expect(Array.from(prim.joints)).toEqual([
			0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
		]);
		expect(prim.weights).toBeInstanceOf(Float32Array);
		expect(data.nodes[0].skin).toBe(0);
	});

	it("reads normalized-byte weights as 0..1", async () => {
		const data = await parseGLTF(buildBarGLB({ weights: "ubyte" }));
		const w = data.graph.nodes[0].primitives[0].weights;
		expect(Array.from(w)).toEqual([
			1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
		]);
	});

	it("uses identity inverse bind matrices when the skin has none", async () => {
		const data = await parseGLTF(buildBarGLB({ ibm: false }));
		expect(Array.from(data.skins[0].inverseBindMatrices)).toEqual([
			...IDENTITY,
			...IDENTITY,
		]);
	});

	it("bounds the skinned mesh where its joints put it, not where its node is", async () => {
		const data = await parseGLTF(buildBarGLB());
		// the node sits at x = 100, which the spec says to ignore
		expectClose(data.bounds.min, [0, 0, 0]);
		expectClose(data.bounds.max, [1, 2, 0]);
	});

	it("drops the weight of a joint the skin does not have, with a warning", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			// v2 names joint 9 alongside joint 1, half and half
			const data = await parseGLTF(
				buildBarGLB({
					joints: [0, 0, 0, 0, 0, 0, 0, 0, 1, 9, 0, 0, 1, 0, 0, 0],
				}),
			);
			const prim = data.graph.nodes[0].primitives[0];
			expect(prim.joints[9]).toBe(0);
			expect(prim.weights[9]).toBe(0);
			expect(prim.weights[8]).toBe(1);
			expect(warn).toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});
});

// ── GLTFModel ────────────────────────────────────────────────────────────────

describe("GLTFModel skinning", () => {
	let app;
	let BAR;
	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		BAR = await parseGLTF(buildBarGLB());
	});
	afterAll(() => {
		app?.destroy();
	});

	const makeModel = (data = BAR) => {
		return new GLTFModel(data, { scale: 1, rightHanded: false });
	};
	const partOf = (model) => {
		return model.getChildByName("bar")[0];
	};
	// every vertex of the skinned part in glTF world space: the model's
	// placement, which the part is drawn with, applied to its deformed vertices
	const worldVertices = (model) => {
		const mesh = partOf(model);
		const world = model._rootMatrix();
		const out = [];
		for (let i = 0; i < mesh.vertexCount; i++) {
			out.push(
				applyMat(world, [
					mesh.originalVertices[i * 3],
					mesh.originalVertices[i * 3 + 1],
					mesh.originalVertices[i * 3 + 2],
				]),
			);
		}
		return out;
	};
	const expectVertex = (model, index, expected) => {
		expectClose(worldVertices(model)[index], expected);
	};

	it("builds the skinned part in the rest pose, ignoring its node's own transform", () => {
		const model = makeModel();
		expectVertex(model, 0, [0, 0, 0]);
		expectVertex(model, 1, [1, 0, 0]);
		expectVertex(model, 2, [0, 2, 0]);
		expectVertex(model, 3, [1, 2, 0]);
	});

	it("places the skinned part at the model's origin, so it culls where it is drawn", () => {
		const model = makeModel();
		const mesh = partOf(model);
		// not at its node's x = 100, which is nowhere near the geometry
		expect(mesh.pos.x).toBeCloseTo(0);
		// and its cull sphere reaches the rig's farthest corner, (1, 2, 0)
		const radius = Math.hypot(mesh.width, mesh.height) / 2;
		expect(radius).toBeGreaterThanOrEqual(Math.hypot(1, 2));
	});

	it("follows a moved model with the deformation it already had", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		model.pos.set(30, -40, 0);
		model.update(16);
		// glTF space is Y-up: the model's render-space y of -40 is +40 here
		expectVertex(model, 2, [29, 41, 0]);
	});

	it("bends the vertices bound to a turning joint", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		// the hip's vertices stay, the knee's swing 90° about it
		expectVertex(model, 0, [0, 0, 0]);
		expectVertex(model, 1, [1, 0, 0]);
		expectVertex(model, 2, [-1, 1, 0]);
		expectVertex(model, 3, [-1, 2, 0]);
	});

	it("turns the normals with their joints", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		const n = partOf(model).originalNormals;
		// hip-bound normals untouched, knee-bound ones turned 90° about Z
		expectClose(Array.from(n.subarray(0, 3)), [1, 0, 0]);
		expectClose(Array.from(n.subarray(6, 9)), [0, 1, 0]);
	});

	it("carries the whole skin with a moving root joint", () => {
		const model = makeModel();
		model.setCurrentAnimation("lift", { loop: false });
		model.update(1000);
		expectVertex(model, 0, [0, 10, 0]);
		expectVertex(model, 3, [1, 12, 0]);
	});

	it("tells the renderer the geometry moved on every pose that deforms it", () => {
		const model = makeModel();
		const mesh = partOf(model);
		const before = mesh._geometryVersion;
		model.setCurrentAnimation("bend");
		model.update(100);
		expect(mesh._geometryVersion).toBeGreaterThan(before);
	});

	it("does not re-skin when the model only moves", () => {
		const model = makeModel();
		const mesh = partOf(model);
		const before = mesh._geometryVersion;
		model.pos.set(50, 20, 0);
		model.update(16);
		expect(mesh._geometryVersion).toBe(before);
		// ...and the part is carried by the placement: at the model's origin,
		// not at its node's x = 100
		expect(mesh.pos.x).toBeCloseTo(50);
		expect(mesh.pos.y).toBeCloseTo(20);
	});

	it("leaves the parsed descriptor's bind pose untouched", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		const prim = BAR.graph.nodes[0].primitives[0];
		expect(Array.from(prim.vertices)).toEqual([
			0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 2, 0,
		]);
		expect(partOf(model).originalVertices).not.toBe(prim.vertices);
	});

	it("poses two models built from one descriptor independently", () => {
		const a = makeModel();
		const b = makeModel();
		a.setCurrentAnimation("bend", { loop: false });
		a.update(1000);
		expectVertex(a, 2, [-1, 1, 0]);
		expectVertex(b, 2, [0, 2, 0]);
	});

	it("stop() returns the skin to the rest pose", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		model.stop();
		expectVertex(model, 2, [0, 2, 0]);
	});

	it("GLTFScene builds a skinned asset with no clips as a GLTFModel", async () => {
		const NAME = "__gltf_skin_static";
		gltfList[NAME] = await parseGLTF(buildBarGLB({ animations: false }));
		try {
			const container = {
				autoDepth: true,
				kids: [],
				addChild(c) {
					this.kids.push(c);
				},
			};
			new GLTFScene(NAME).addTo(container, { scale: 1, rightHanded: false });
			const model = container.kids.find((k) => {
				return k instanceof GLTFModel;
			});
			expect(model).toBeDefined();
			expectVertex(model, 3, [1, 2, 0]);
		} finally {
			delete gltfList[NAME];
		}
	});
});

// ── crossfade ────────────────────────────────────────────────────────────────

describe("GLTFModel crossfade", () => {
	let app;
	let BAR;
	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		BAR = await parseGLTF(buildBarGLB());
	});
	afterAll(() => {
		app?.destroy();
	});

	const makeModel = () => {
		return new GLTFModel(BAR, { scale: 1, rightHanded: false });
	};
	// the hip's world height, which "lift" drives and "rest" holds at 0
	const hipY = (model) => {
		return model._world[1][13];
	};
	// the knee-bound vertex v2, in glTF world space
	const v2 = (model) => {
		const mesh = model.getChildByName("bar")[0];
		return applyMat(model._rootMatrix(), [
			mesh.originalVertices[6],
			mesh.originalVertices[7],
			mesh.originalVertices[8],
		]);
	};

	it("without a crossfade, switching clips snaps", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift");
		expect(hipY(model)).toBeCloseTo(10);
	});

	it("blends from the previous clip by elapsed time", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: 1000 });
		// the switch itself shows the previous clip
		expect(hipY(model)).toBeCloseTo(0);
		model.update(250);
		expect(hipY(model)).toBeCloseTo(2.5);
		model.update(250);
		expect(hipY(model)).toBeCloseTo(5);
		model.update(600);
		expect(hipY(model)).toBeCloseTo(10);
		expect(model._fade).toBeNull();
	});

	it("slerps rotations, so a half-blended 90° bend is a 45° bend", () => {
		const model = makeModel();
		// fade from the rest pose into a play-once bend that reaches its end
		// (90°) halfway through the fade, and holds it there
		model.setCurrentAnimation("bend", { loop: false, crossfade: 2000 });
		model.update(1000);
		// clip at its end (90°), weight 0.5 → 45° about the knee at (0, 1, 0)
		expectClose(v2(model), [-R45, 1 + R45, 0]);
	});

	it("fades in from the rest pose when nothing was playing", () => {
		const model = makeModel();
		model.setCurrentAnimation("lift", { crossfade: 400 });
		model.update(100);
		expect(hipY(model)).toBeCloseTo(2.5);
	});

	it("an interrupted crossfade starts from the pose on screen, without a pop", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: 1000 });
		model.update(500);
		expect(hipY(model)).toBeCloseTo(5);
		model.setCurrentAnimation("rest", { crossfade: 1000 });
		model.update(0);
		expect(hipY(model)).toBeCloseTo(5);
		model.update(500);
		expect(hipY(model)).toBeCloseTo(2.5);
	});

	it("pause() freezes a crossfade where it is", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: 1000 });
		model.update(500);
		model.pause();
		model.update(500);
		expect(hipY(model)).toBeCloseTo(5);
		model.play();
		model.update(250);
		expect(hipY(model)).toBeCloseTo(7.5);
	});

	it("stop() cancels a crossfade", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: 1000 });
		model.update(500);
		model.stop();
		expect(model._fade).toBeNull();
		expect(hipY(model)).toBeCloseTo(0);
	});

	it("a clip chained with next is entered with the same crossfade", () => {
		const model = makeModel();
		model.setCurrentAnimation("lift", { crossfade: 1, next: "rest" });
		model.update(10); // fade done; lift plays
		model.update(1000); // lift ends → rest, faded in over 1 ms
		expect(model.isCurrentAnimation("rest")).toBe(true);
		expect(model._fade).not.toBeNull();
	});

	it("a chained clip fades out from its last frame, not from its start", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { next: "rest", crossfade: 100 });
		model.update(200); // fade in done; bend at 0.2 s
		model.update(800); // bend ends (90°) → rest, faded in over 100 ms
		expect(model.isCurrentAnimation("rest")).toBe(true);
		expect(model._fade.time).toBeCloseTo(1);
		model.update(50);
		// the outgoing bend holds 90° (not 4.5° from starting over), weight 0.5
		expect(model._fade.time).toBeCloseTo(1);
		expectClose(v2(model), [-R45, 1 + R45, 0]);
	});

	it("a play-once clip faded out near its end runs on to its last frame and holds it", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.update(900);
		model.setCurrentAnimation("rest", { crossfade: 1000 });
		model.update(500);
		// 0.9 s + 0.5 s would wrap to 0.4 s on a loop; a play-once clip stops at 1 s
		expect(model._fade.time).toBeCloseTo(1);
		expectClose(v2(model), [-R45, 1 + R45, 0]);
	});

	it("a looping clip faded out carries on round its loop", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend");
		model.update(900);
		model.setCurrentAnimation("rest", { crossfade: 1000 });
		model.update(300);
		expect(model._fade.time).toBeCloseTo(0.2);
	});

	it("the clip being faded out keeps playing underneath", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend");
		model.update(500); // bend halfway, 45°
		model.setCurrentAnimation("rest", { crossfade: 10000 });
		const fromTime = model._fade.time;
		model.update(250);
		expect(model._fade.time).toBeCloseTo(fromTime + 0.25);
	});

	it("a crossfade on a rigid (unskinned) rig blends the node TRS too", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: 100 });
		model.update(50);
		// the knee is a child of the hip, so it rides at the blended height
		expect(model._world[2][13]).toBeCloseTo(6);
	});

	it("a zero or negative crossfade switches at once", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: 0 });
		expect(hipY(model)).toBeCloseTo(10);
		model.setCurrentAnimation("rest", { crossfade: -5 });
		expect(hipY(model)).toBeCloseTo(0);
	});
});
