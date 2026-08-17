import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, GLTFModel, video } from "../src/index.js";
import Renderer from "../src/video/renderer.js";

// a small real texture so part meshes resolve a non-white-pixel atlas (lets us
// assert the glTF wrap mode is forwarded onto the mesh texture)
let TEX;

/**
 * Unit tests for GLTFModel — the rig that drives node-TRS animation over a
 * glTF node hierarchy and exposes the Sprite-aligned animation API.
 *
 * A synthetic two-node descriptor is used (no GLB decode needed):
 *   node 0 "parent"  — animated (translation / rotation), child of nothing
 *   └─ node 1 "child" — a 1-triangle mesh at local translation (1, 0, 0)
 * so we can assert hierarchy propagation by reading the child mesh's `pos`.
 */

// minimal drawable primitive (one triangle) for the child node
const PRIM = () => {
	return {
		vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
		uvs: new Float32Array([0, 0, 0, 0, 0, 0]),
		indices: new Uint16Array([0, 1, 2]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
		vertexCount: 3,
		// a real texture + glTF-default repeat wrap, so the wrap mode forwarding
		// onto the part mesh can be asserted
		image: TEX,
		textureRepeat: "repeat",
		baseColorFactor: [1, 1, 1, 1],
		colors: undefined,
		doubleSided: false,
	};
};

// build a fresh descriptor each time (GLTFModel keeps mutable rest TRS refs)
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
				name: "spin",
				duration: 1,
				channels: [
					{
						node: 0,
						path: "rotation",
						// identity → 180° about Z ([0,0,1,0])
						times: [0, 1],
						values: [0, 0, 0, 1, 0, 0, 1, 0],
						stride: 4,
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
// the single child mesh (node 1's one primitive)
const childOf = (model) => {
	return model.getChildByName("child")[0];
};

describe("GLTFModel", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		TEX = Renderer.createCanvas(8, 8);
	});

	afterAll(() => {
		// release the WebGL context this describe owns — browsers cap
		// live contexts, and a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	afterAll(async () => {
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			// Canvas: this app exists only to reset global state for later
			// spec files. Under AUTO it took a WebGL context and was never
			// destroyed — see webgl_vao_teardown.spec.js.
			renderer: video.CANVAS,
		});
		await app.init();
	});

	it("instantiates one Mesh per mesh-node primitive, named after the node", () => {
		const model = makeModel();
		expect(model.getChildByName("child").length).toBe(1);
		// the empty parent node contributes no mesh
		expect(model.getChildByName("parent").length).toBe(0);
	});

	it("getAnimationNames lists every clip", () => {
		expect(makeModel().getAnimationNames().sort()).toEqual(["move", "spin"]);
	});

	it("opts out of the anchor offset (sizeless container would NaN-poison the transform)", () => {
		// the container's width/height are Infinity, so the base preDraw anchor
		// offset `width * anchorPoint` is `Infinity * 0 = NaN`; opting out is
		// what keeps the nested part meshes rendering (see Camera3d.isVisible fix)
		expect(makeModel().applyAnchorTransform).toBe(false);
	});

	it("forwards the glTF texture wrap mode onto each part mesh", () => {
		const mesh = childOf(makeModel());
		// PRIM() carries textureRepeat:"repeat" + a real texture → the part
		// mesh must sample REPEAT-wrapped (tiling UVs vs clamping). The wrap
		// is per-mesh (threaded to the batcher at draw time) — the shared
		// per-image atlas stays untouched (#1503).
		expect(mesh.textureRepeat).toBe("repeat");
		expect(mesh.texture.repeat).toBe("no-repeat");
	});

	it("poses to the bind/rest pose on construction (parent at origin → child at its local x)", () => {
		const model = makeModel();
		// rest: parent translation 0, child local (1,0,0) → child world.x = 1
		expect(childOf(model).pos.x).toBeCloseTo(1, 5);
	});

	it("HIERARCHY: animating the parent's translation carries the child", () => {
		const model = makeModel();
		// loop:false so the endpoint pose is held (a looping clip wraps exactly
		// at t == duration, by design)
		model.setCurrentAnimation("move", { loop: false });
		model.update(500); // t = 0.5 → parent tx = 2.5 → child world.x = 2.5 + 1
		expect(childOf(model).pos.x).toBeCloseTo(3.5, 4);
		model.update(500); // t = 1.0 → clamp+hold → parent tx = 5 → child world.x = 6
		expect(childOf(model).pos.x).toBeCloseTo(6, 4);
	});

	it("HIERARCHY: rotating the parent rotates the child's position about it", () => {
		const model = makeModel();
		model.setCurrentAnimation("spin", { loop: false });
		model.update(1000); // t = 1 (held) → parent rotated 180° about Z
		// child local (1,0,0) rotated 180°Z → (-1,0,0)
		expect(childOf(model).pos.x).toBeCloseTo(-1, 4);
		expect(childOf(model).pos.y).toBeCloseTo(0, 4);
	});

	it("loops by default (wraps past duration)", () => {
		const model = makeModel();
		model.setCurrentAnimation("move");
		model.update(1500); // 1.5 → wraps to 0.5 → child.x = 3.5
		expect(childOf(model).pos.x).toBeCloseTo(3.5, 4);
		expect(model.isCurrentAnimation("move")).toBe(true);
	});

	it("animationspeed multiplies playback rate", () => {
		const model = makeModel();
		model.setCurrentAnimation("move", { speed: 2 });
		model.update(250); // 0.25s × 2 = t 0.5 → child.x = 3.5
		expect(childOf(model).pos.x).toBeCloseTo(3.5, 4);
	});

	it("options loop:false plays once, holds the final pose, fires onComplete once", () => {
		const model = makeModel();
		let done = 0;
		model.setCurrentAnimation("move", {
			loop: false,
			onComplete: () => {
				return done++;
			},
		});
		model.update(2000); // overshoot → clamps at t=1 → child.x = 6
		expect(childOf(model).pos.x).toBeCloseTo(6, 4);
		expect(done).toBe(1);
		model.update(2000); // frozen (_animDone) → still 6, no more callbacks
		expect(childOf(model).pos.x).toBeCloseTo(6, 4);
		expect(done).toBe(1);
	});

	it("options next chains to another clip, firing onComplete first", () => {
		const model = makeModel();
		let fired = 0;
		model.setCurrentAnimation("move", {
			next: "spin",
			onComplete: () => {
				return fired++;
			},
		});
		model.update(1000); // move completes → onComplete + switch to spin
		expect(fired).toBe(1);
		expect(model.isCurrentAnimation("spin")).toBe(true);
	});

	// ── play / pause / stop ────────────────────────────────────────────────

	it("play(name) switches and starts a clip", () => {
		const model = makeModel();
		model.play("spin");
		expect(model.isCurrentAnimation("spin")).toBe(true);
		expect(model.animationpause).toBe(false);
	});

	it("pause() freezes the pose, play() resumes", () => {
		const model = makeModel();
		model.setCurrentAnimation("move");
		model.update(250); // t 0.25 → child.x = 1 + 1.25 = 2.25
		model.pause();
		const frozen = childOf(model).pos.x;
		model.update(1000); // paused → no change
		expect(childOf(model).pos.x).toBeCloseTo(frozen, 6);
		model.play();
		model.update(250); // resumes advancing
		expect(childOf(model).pos.x).toBeGreaterThan(frozen);
	});

	it("stop() resets to the bind pose and clears the current animation", () => {
		const model = makeModel();
		model.setCurrentAnimation("move");
		model.update(800); // moved away from rest
		expect(childOf(model).pos.x).not.toBeCloseTo(1, 2);
		model.stop();
		expect(model.isCurrentAnimation("move")).toBe(false);
		expect(model.current.name).toBeUndefined();
		// back to the rest pose: child at its local x = 1
		expect(childOf(model).pos.x).toBeCloseTo(1, 5);
	});

	// ── adversarial ─────────────────────────────────────────────────────────

	it("ADVERSARIAL: re-selecting the same clip is a no-op (does not reset time)", () => {
		const model = makeModel();
		model.setCurrentAnimation("move");
		model.update(400); // t 0.4
		model.setCurrentAnimation("move"); // same → must NOT restart
		const x = childOf(model).pos.x;
		// child.x at t0.4 = 1 + (0.4*5) = 3.0 ; a reset would put it at 1.0
		expect(x).toBeCloseTo(3.0, 4);
	});

	it("ADVERSARIAL: animationpause halts advancement entirely", () => {
		const model = makeModel();
		model.setCurrentAnimation("move");
		model.animationpause = true;
		model.update(1000);
		expect(childOf(model).pos.x).toBeCloseTo(1, 5); // never left rest
	});

	it("ADVERSARIAL: speed 0 freezes the animation", () => {
		const model = makeModel();
		model.setCurrentAnimation("move", { speed: 0 });
		model.update(1000);
		expect(childOf(model).pos.x).toBeCloseTo(1, 5);
	});

	it("ADVERSARIAL: stop() after a play-once unfreezes so a later clip animates", () => {
		const model = makeModel();
		model.setCurrentAnimation("move", { loop: false });
		model.update(2000); // held + _animDone
		model.stop(); // clears _animDone + clip
		model.play("move"); // loop again
		model.update(500);
		expect(childOf(model).pos.x).toBeCloseTo(3.5, 4); // advancing again
	});

	it("ADVERSARIAL: unknown clip name throws", () => {
		expect(() => {
			return makeModel().setCurrentAnimation("nope");
		}).toThrow();
	});

	it("ADVERSARIAL: a non-animated node keeps its rest transform while a sibling animates", () => {
		// child node is never targeted by any clip → its LOCAL transform stays
		// at rest; only the inherited parent motion moves it. Verify the child's
		// own rotation/scale columns stay identity after the parent spins.
		const model = makeModel();
		model.setCurrentAnimation("spin", { loop: false });
		model.update(1000);
		const v = childOf(model).currentTransform.val;
		// world rotation is the PARENT's 180°Z (m00 = m11 = -1), proving the
		// child inherited it rather than carrying its own (which is identity)
		expect(v[0]).toBeCloseTo(-1, 4);
		expect(v[5]).toBeCloseTo(-1, 4);
	});
});

/**
 * Ground shadows through the animated glTF path (#1515).
 *
 * The opt-in is TRI-STATE — `undefined` means "follow the application
 * setting" — so what the loader must NOT do is flatten it. Forwarding an
 * omitted option as an explicit `false` would silently opt every animated
 * glTF scene out of an application-wide default, and nothing about that is
 * visible from a draw count or a screenshot.
 */
describe("GLTFModel ground shadows (#1515)", () => {
	const partsOf = (options) => {
		const model = new GLTFModel(makeData(), {
			scale: 1,
			rightHanded: false,
			...options,
		});
		return model.children;
	};

	// a prim lying flat in the ground plane — every y identical
	const FLAT = () => {
		return {
			...PRIM(),
			vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
		};
	};

	it("leaves the flag UNSET when the caller says nothing", () => {
		// the application setting must still be able to reach these meshes
		for (const part of partsOf({})) {
			expect(part.castGroundShadow).toBeUndefined();
		}
	});

	it("opts the scene in, and forwards the ground height", () => {
		const parts = partsOf({ castGroundShadow: true, shadowGroundY: 7 });
		expect(parts.length).toBeGreaterThan(0);
		for (const part of parts) {
			// PRIM() spans y 0..1, so it has height to cast from
			expect(part.castGroundShadow).toBe(true);
			expect(part.shadowGroundY).toBe(7);
		}
	});

	it("opts the scene OUT explicitly, overriding an application default", () => {
		for (const part of partsOf({ castGroundShadow: false })) {
			expect(part.castGroundShadow).toBe(false);
		}
	});

	it("a scene-wide opt-in SKIPS a part with no vertical extent", () => {
		// a flat plane lying in the floor IS the floor; shadowing it with
		// itself smears a blob across the whole ground
		const data = makeData();
		data.graph.nodes[1].primitives = [FLAT()];
		const model = new GLTFModel(data, {
			scale: 1,
			rightHanded: false,
			castGroundShadow: true,
		});
		expect(model.children.length).toBeGreaterThan(0);
		for (const part of model.children) {
			expect(part.castGroundShadow).toBe(false);
		}
	});
});
