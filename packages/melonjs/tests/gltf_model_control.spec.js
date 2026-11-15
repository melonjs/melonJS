import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	GLTFModel,
	Matrix3d,
	Mesh,
	Renderable,
	Sprite3d,
	Vector3d,
	video,
} from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import { gltfList } from "../src/loader/cache.js";
import { parseGLTF } from "../src/loader/parsers/gltf.js";
import { buildBarGLB } from "./helpers/skinned-bar.js";

/**
 * Driving a GLTFModel from game code: a default crossfade, moving a clip to a
 * time, playing it backwards (and at a negative speed), and reaching its
 * nodes — where one is, and keeping something on it.
 *
 * The bar (see helpers/skinned-bar.js): "hip" at the origin carries "knee" at
 * (0, 1, 0); "bend" turns the knee 90° about Z over one second, "lift" holds
 * the hip at y = 10, "rest" at y = 0. v2, at (0, 2, 0), is bound to the knee.
 */

const R45 = Math.SQRT1_2;
const Y_AXIS = new Vector3d(0, 1, 0);
const X_AXIS = new Vector3d(1, 0, 0);

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

const makeModel = (options = {}) => {
	return new GLTFModel(BAR, { scale: 1, rightHanded: false, ...options });
};
// the hip's height, which "lift" drives and "rest" holds at 0
const hipY = (model) => {
	return model._world[1][13];
};
// the knee's turn about Z, in degrees, read off its world matrix
const kneeAngle = (model) => {
	const w = model._world[2];
	return (Math.atan2(w[1], w[0]) * 180) / Math.PI;
};
const apply = (m, x, y, z) => {
	const v = m.val ?? m;
	return [
		v[0] * x + v[4] * y + v[8] * z + v[12],
		v[1] * x + v[5] * y + v[9] * z + v[13],
		v[2] * x + v[6] * y + v[10] * z + v[14],
	];
};
const expectClose = (actual, expected, digits = 4) => {
	expect(actual.length).toBe(expected.length);
	for (let i = 0; i < expected.length; i++) {
		expect(actual[i]).toBeCloseTo(expected[i], digits);
	}
};
const finite = (m) => {
	return Array.from(m.val ?? m).every(Number.isFinite);
};

describe("GLTFModel#crossfade, the default blend", () => {
	it("is 0 (snap) unless set, as before", () => {
		const model = makeModel();
		expect(model.crossfade).toBe(0);
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift");
		expect(hipY(model)).toBeCloseTo(10);
		expect(model._fade).toBeNull();
	});

	it("blends every change that does not give its own", () => {
		const model = makeModel();
		model.crossfade = 1000;
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift");
		model.update(500);
		expect(hipY(model)).toBeCloseTo(5);
	});

	it("is a constructor option", () => {
		const model = makeModel({ crossfade: 1000 });
		expect(model.crossfade).toBe(1000);
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift");
		model.update(250);
		expect(hipY(model)).toBeCloseTo(2.5);
	});

	it("gives way to a call's own crossfade, 0 included", () => {
		const model = makeModel({ crossfade: 1000 });
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: 0 });
		expect(hipY(model)).toBeCloseTo(10);
		model.setCurrentAnimation("rest", { crossfade: 200 });
		model.update(100);
		expect(hipY(model)).toBeCloseTo(5);
	});

	it("applies to play(), and to the string and function forms", () => {
		const model = makeModel({ crossfade: 1000 });
		model.play("rest");
		model.play("lift");
		model.update(500);
		expect(hipY(model)).toBeCloseTo(5);
		const b = makeModel({ crossfade: 1000 });
		b.setCurrentAnimation("rest");
		b.setCurrentAnimation("lift", "rest");
		b.update(500);
		expect(hipY(b)).toBeCloseTo(5);
		const c = makeModel({ crossfade: 1000 });
		c.setCurrentAnimation("rest");
		c.setCurrentAnimation("lift", () => {});
		c.update(500);
		expect(hipY(c)).toBeCloseTo(5);
	});

	it("chains into `next` with the crossfade the call gave, even 0 over a default", () => {
		const model = makeModel({ crossfade: 1000 });
		model.setCurrentAnimation("lift", { crossfade: 0, next: "rest" });
		model.update(1000); // lift ends → rest, snapped
		expect(model.isCurrentAnimation("rest")).toBe(true);
		expect(model._fade).toBeNull();
		expect(hipY(model)).toBeCloseTo(0);
		// and with the default when the call gave none
		const b = makeModel({ crossfade: 1000 });
		b.setCurrentAnimation("lift", { next: "rest" });
		b.update(1000); // the fade into lift is done; lift ends → rest, blended
		b.update(500);
		expect(b.isCurrentAnimation("rest")).toBe(true);
		expect(hipY(b)).toBeCloseTo(5);
	});

	it("switches at once for a default that is not a usable length", () => {
		for (const bad of [
			Number.NaN,
			-500,
			Number.POSITIVE_INFINITY,
			"300",
			null,
		]) {
			const model = makeModel();
			model.crossfade = bad;
			model.setCurrentAnimation("rest");
			model.setCurrentAnimation("lift");
			expect(model._fade).toBeNull();
			expect(hipY(model)).toBeCloseTo(10);
			model.update(16);
			expect(finite(model._world[1])).toBe(true);
		}
	});

	it("an endless crossfade given to one call switches at once rather than never", () => {
		const model = makeModel();
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("lift", { crossfade: Number.POSITIVE_INFINITY });
		expect(hipY(model)).toBeCloseTo(10);
	});

	it("reaches a model built by GLTFScene, and level.load knows the option", () => {
		const NAME = "__bar_crossfade__";
		gltfList[NAME] = BAR;
		try {
			const container = new Container(0, 0, 100, 100);
			new GLTFScene(NAME).addTo(container, {
				scale: 1,
				rightHanded: false,
				crossfade: 300,
			});
			const model = container.getChildren()[0];
			expect(model).toBeInstanceOf(GLTFModel);
			expect(model.crossfade).toBe(300);
			expect(GLTFScene.loadOptions).toContain("crossfade");
		} finally {
			delete gltfList[NAME];
		}
	});
});

describe("GLTFModel#setAnimationTime / getCurrentAnimationTime", () => {
	it("do nothing, and read 0, with no clip playing", () => {
		const model = makeModel();
		expect(model.setAnimationTime(500)).toBe(model);
		expect(model.getCurrentAnimationTime()).toBe(0);
	});

	it("move the clip there and pose it at once, without an update", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend");
		model.setAnimationTime(500);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(500);
		expect(kneeAngle(model)).toBeCloseTo(45);
		// and the default goes back to the start
		model.setAnimationTime();
		expect(kneeAngle(model)).toBeCloseTo(0);
	});

	it("wrap the time into a looping clip, either side", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend");
		model.setAnimationTime(1500);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(500);
		model.setAnimationTime(-250);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(750);
		model.setAnimationTime(3000);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(0);
	});

	it("hold a play-once clip between its start and its end", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.setAnimationTime(1500);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(1000);
		expect(kneeAngle(model)).toBeCloseTo(90);
		model.setAnimationTime(-100);
		expect(model.getCurrentAnimationTime()).toBe(0);
	});

	it("play a finished play-once clip again from where it is moved to", () => {
		const model = makeModel();
		let done = 0;
		model.setCurrentAnimation("bend", {
			loop: false,
			onComplete: () => {
				done++;
			},
		});
		model.update(1200);
		expect(done).toBe(1);
		model.update(500);
		expect(done).toBe(1);
		model.setAnimationTime(500);
		model.update(250);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(750);
		model.update(500);
		expect(done).toBe(2);
		expect(kneeAngle(model)).toBeCloseTo(90);
	});

	it("follow the clip as it plays", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend");
		model.update(250);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(250);
		model.update(1000);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(250);
	});

	it("refuse a time that is not a finite number, and change nothing", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend");
		model.setAnimationTime(400);
		for (const bad of [
			Number.NaN,
			Number.POSITIVE_INFINITY,
			-Infinity,
			"500",
			null,
		]) {
			expect(() => {
				model.setAnimationTime(bad);
			}).toThrow(/finite/);
		}
		expect(model.getCurrentAnimationTime()).toBeCloseTo(400);
	});

	it("chain with the rest of the animation API", () => {
		const model = makeModel();
		expect(model.setCurrentAnimation("bend").setAnimationTime(250)).toBe(model);
	});
});

describe("GLTFModel#reverseAnimation, and a negative speed", () => {
	it("refuses an unknown clip, and does nothing with no clip at all", () => {
		const model = makeModel();
		expect(model.reverseAnimation()).toBe(model);
		expect(() => {
			model.reverseAnimation("nope");
		}).toThrow(/not defined/);
	});

	it("plays a looping clip from its end back to its start, and round again", () => {
		const model = makeModel();
		let cycles = 0;
		model.onended = () => {
			cycles++;
		};
		model.reverseAnimation("bend").setCurrentAnimation("bend");
		// it starts at its end
		expect(model.getCurrentAnimationTime()).toBeCloseTo(1000);
		expect(kneeAngle(model)).toBeCloseTo(90);
		model.update(250);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(750);
		expect(kneeAngle(model)).toBeCloseTo(67.5);
		model.update(1000); // past the start: wraps to the end once
		expect(cycles).toBe(1);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(750);
		// a cycle that lands exactly on the start does not end twice
		model.update(750);
		expect(cycles).toBe(2);
		model.update(16);
		expect(cycles).toBe(2);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(1000 - 16);
	});

	it("ends a play-once clip on its first frame, once", () => {
		const model = makeModel();
		let done = 0;
		model.reverseAnimation("bend");
		model.setCurrentAnimation("bend", {
			loop: false,
			onComplete: () => {
				done++;
			},
		});
		model.update(1200);
		expect(done).toBe(1);
		expect(model.getCurrentAnimationTime()).toBe(0);
		expect(kneeAngle(model)).toBeCloseTo(0);
		model.update(500);
		expect(done).toBe(1);
	});

	it("turns the current clip around where it is, and back", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend");
		model.update(400);
		model.reverseAnimation();
		model.update(100);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(300);
		model.reverseAnimation();
		model.update(100);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(400);
	});

	it("runs a finished play-once clip back the other way", () => {
		const model = makeModel();
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1500);
		expect(kneeAngle(model)).toBeCloseTo(90);
		model.reverseAnimation();
		model.update(500);
		expect(kneeAngle(model)).toBeCloseTo(45);
	});

	it("stays reversed the next time the clip is played, as a Sprite's does", () => {
		const model = makeModel();
		model.reverseAnimation("bend");
		model.setCurrentAnimation("rest");
		model.setCurrentAnimation("bend");
		expect(model.getCurrentAnimationTime()).toBeCloseTo(1000);
	});

	it("a negative speed plays the clip backwards too, instead of freezing it", () => {
		const model = makeModel();
		let cycles = 0;
		model.onended = () => {
			cycles++;
		};
		model.setCurrentAnimation("bend", { speed: -1 });
		expect(model.getCurrentAnimationTime()).toBeCloseTo(1000);
		model.update(250);
		expect(kneeAngle(model)).toBeCloseTo(67.5);
		model.update(1000);
		expect(cycles).toBe(1);
		// and a play-once clip at a negative speed ends on its first frame
		const once = makeModel();
		let done = 0;
		once.setCurrentAnimation("bend", {
			loop: false,
			speed: -2,
			onComplete: () => {
				done++;
			},
		});
		once.update(600);
		expect(done).toBe(1);
		expect(kneeAngle(once)).toBeCloseTo(0);
	});

	it("reversed and at a negative speed, a clip plays forwards", () => {
		const model = makeModel();
		model.reverseAnimation("bend");
		model.setCurrentAnimation("bend", { speed: -1 });
		expect(model.getCurrentAnimationTime()).toBe(0);
		model.update(250);
		expect(model.getCurrentAnimationTime()).toBeCloseTo(250);
	});

	it("a reversed clip chained with `next` hands over to a forward clip at its start", () => {
		const model = makeModel();
		model.reverseAnimation("bend");
		model.setCurrentAnimation("bend", { next: "lift" });
		model.update(1100);
		expect(model.isCurrentAnimation("lift")).toBe(true);
		// not wrapped to lift's end by the reversed clip's bookkeeping
		expect(model.getCurrentAnimationTime()).toBe(0);
	});

	it("a crossfade out of a reversed play-once clip holds its first frame", () => {
		const model = makeModel();
		model.reverseAnimation("bend");
		model.setCurrentAnimation("bend", { loop: false });
		model.update(900); // 100 ms from its start
		model.setCurrentAnimation("lift", { crossfade: 10000 });
		model.update(500);
		// it ran on to its start and stopped there, not round to its end
		expect(model._fade.time).toBe(0);
		expect(model._fade.done).toBe(true);
	});

	it("a crossfade out of a reversed looping clip keeps going backwards", () => {
		const model = makeModel();
		model.reverseAnimation("bend");
		model.setCurrentAnimation("bend");
		model.update(800); // at 0.2 s
		model.setCurrentAnimation("lift", { crossfade: 10000 });
		model.update(300);
		expect(model._fade.time).toBeCloseTo(0.9);
	});
});

describe("GLTFModel nodes: getNodeNames, getNodeTransform", () => {
	it("lists every named node once", () => {
		const model = makeModel();
		expect(model.getNodeNames().sort()).toEqual(["bar", "hip", "knee"]);
	});

	it("refuses a name no node has", () => {
		const model = makeModel();
		for (const bad of ["nope", "", undefined, null, 2]) {
			expect(() => {
				model.getNodeTransform(bad);
			}).toThrow(/not defined/);
		}
	});

	it("gives the node's origin in render space, scaled like the parts", () => {
		const model = makeModel({ scale: 10 });
		const m = model.getNodeTransform("knee");
		expect(m).toBeInstanceOf(Matrix3d);
		// glTF (0, 1, 0), Y-up, is 10 pixels UP: y = -10 in Y-down render space
		expectClose([m.val[12], m.val[13], m.val[14]], [0, -10, 0]);
	});

	it("turns with the clip: the knee's up follows the bend", () => {
		const model = makeModel({ scale: 10 });
		model.setCurrentAnimation("bend");
		model.setAnimationTime(500);
		const m = model.getNodeTransform("knee");
		// glTF up turned 45° about Z is up-left; in render space y points down
		const up = apply(m, 0, -1, 0);
		expectClose(
			[up[0] - m.val[12], up[1] - m.val[13], up[2] - m.val[14]],
			[-R45, -R45, 0],
		);
	});

	it("maps the knee's frame onto where the skin really draws, however the model is placed", () => {
		for (const rightHanded of [false, true]) {
			const s = 7;
			const model = new GLTFModel(BAR, { scale: s, rightHanded });
			model.pos.set(40, -25, 300);
			model.currentTransform.rotate(0.6, Y_AXIS);
			model.currentTransform.rotate(-0.3, X_AXIS);
			model.setCurrentAnimation("bend");
			model.setAnimationTime(330);
			const knee = model.getNodeTransform("knee");
			// v2 sits one glTF unit up the knee: in render units that is
			// `s` along the knee's own (Y-down) up
			const viaNode = apply(knee, 0, -s, 0);
			const bar = model.getChildByName("bar")[0];
			const drawn = apply(
				bar._composeModelMatrix(),
				bar.originalVertices[6],
				bar.originalVertices[7],
				bar.originalVertices[8],
			);
			expectClose(viaNode, drawn, 3);
		}
	});

	it("is a pure rotation: the node's scale and the model's are left out", () => {
		const model = makeModel({ scale: 25 });
		model.currentTransform.scale(3, 0.5, 2);
		model.setCurrentAnimation("bend");
		model.setAnimationTime(700);
		const v = model.getNodeTransform("knee").val;
		for (let c = 0; c < 3; c++) {
			expect(Math.hypot(v[c * 4], v[c * 4 + 1], v[c * 4 + 2])).toBeCloseTo(1);
		}
		// columns at right angles
		expect(v[0] * v[4] + v[1] * v[5] + v[2] * v[6]).toBeCloseTo(0);
	});

	it("writes into the matrix it is given", () => {
		const model = makeModel();
		const out = new Matrix3d();
		expect(model.getNodeTransform("hip", out)).toBe(out);
	});

	it("follows a model moved since its last pose, without an update", () => {
		const model = makeModel({ scale: 10 });
		model.getNodeTransform("knee");
		model.pos.set(100, 50, 20);
		const m = model.getNodeTransform("knee");
		expectClose([m.val[12], m.val[13], m.val[14]], [100, 40, 20]);
	});

	it("stays finite for a model scaled to nothing", () => {
		const model = makeModel({ scale: 10 });
		model.currentTransform.scale(0, 0, 0);
		model.setCurrentAnimation("bend");
		model.update(100);
		expect(finite(model.getNodeTransform("knee"))).toBe(true);
	});
});

describe("GLTFModel#addChildToNode", () => {
	const marker = (x = 0, y = 0, z = 0) => {
		const r = new Renderable(0, 0, 4, 4);
		r.pos.set(x, y, z);
		r.name = "marker";
		return r;
	};
	const tri = (rightHanded) => {
		return new Mesh(0, 0, {
			vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
			uvs: new Float32Array(6),
			indices: new Uint16Array([0, 1, 2]),
			width: 1,
			height: 1,
			scale: 1,
			normalize: false,
			rightHanded,
		});
	};

	it("keeps a renderable on the node as the clip plays", () => {
		const model = makeModel({ scale: 10 });
		const m = marker();
		expect(model.addChildToNode(m, "knee")).toBe(m);
		expect(m.ancestor).toBe(model);
		expectClose([m.pos.x, m.pos.y, m.pos.z], [0, -10, 0]);
		model.setCurrentAnimation("lift");
		model.update(16);
		// lifted 10 glTF units: 100 pixels up
		expectClose([m.pos.x, m.pos.y, m.pos.z], [0, -110, 0]);
	});

	it("holds its offset along the node's own axes", () => {
		const model = makeModel({ scale: 10 });
		const m = marker(0, -20, 0); // 20 pixels up the knee
		model.addChildToNode(m, "knee");
		expectClose([m.pos.x, m.pos.y, m.pos.z], [0, -30, 0]);
		model.setCurrentAnimation("bend", { loop: false });
		model.setAnimationTime(1000); // the knee turned 90°: its up is now -x
		expectClose([m.pos.x, m.pos.y, m.pos.z], [-20, -10, 0]);
		const t = model.getNodeTransform("knee");
		expectClose([m.pos.x, m.pos.y, m.pos.z], apply(t, 0, -20, 0));
	});

	it("follows the model itself: moved, turned, and only when posed", () => {
		const model = makeModel({ scale: 10 });
		const m = marker();
		model.addChildToNode(m, "knee");
		model.pos.set(50, 0, 0);
		model.update(16);
		expectClose([m.pos.x, m.pos.y, m.pos.z], [50, -10, 0]);
	});

	it("turns a mesh with the node, whichever way the mesh is handed", () => {
		for (const modelHanded of [false, true]) {
			for (const meshHanded of [false, true]) {
				const model = new GLTFModel(BAR, {
					scale: 10,
					rightHanded: modelHanded,
				});
				const mesh = tri(meshHanded);
				model.addChildToNode(mesh, "knee");
				model.setCurrentAnimation("bend");
				model.setAnimationTime(500);
				const knee = model.getNodeTransform("knee");
				// the mesh's source "up" (0, 1, 0) points where the knee's does
				const mm = mesh._composeModelMatrix().val;
				const up = [mm[4], mm[5], mm[6]];
				const len = Math.hypot(...up);
				expectClose(
					up.map((c) => {
						return c / len;
					}),
					[-knee.val[4], -knee.val[5], -knee.val[6]],
				);
			}
		}
	});

	it("keeps the turn a mesh was added with, on top of the node's", () => {
		const model = makeModel({ scale: 10 });
		const mesh = tri(false);
		mesh.currentTransform.rotate(Math.PI / 2, new Vector3d(0, 0, 1));
		const before = Array.from(mesh.currentTransform.val);
		model.addChildToNode(mesh, "knee");
		// at rest the knee is not turned: the mesh is as it was
		expectClose(Array.from(mesh.currentTransform.val), before);
		model.setCurrentAnimation("bend", { loop: false });
		model.setAnimationTime(1000);
		// and the node's quarter turn is added to the mesh's own
		const angle = Math.atan2(
			mesh.currentTransform.val[1],
			mesh.currentTransform.val[0],
		);
		expect(Math.abs(angle)).toBeCloseTo(Math.PI, 4);
	});

	it("turns a nested model with the node", () => {
		const model = makeModel({ scale: 10 });
		const hat = makeModel({ scale: 2 });
		model.addChildToNode(hat, "knee");
		model.setCurrentAnimation("bend");
		model.setAnimationTime(500);
		const knee = model.getNodeTransform("knee").val;
		for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
			expect(hat.currentTransform.val[i]).toBeCloseTo(knee[i]);
		}
		expectClose(
			[hat.pos.x, hat.pos.y, hat.pos.z],
			[knee[12], knee[13], knee[14]],
		);
	});

	it("moves a billboard Sprite3d but leaves it facing the camera", () => {
		const img = document.createElement("canvas");
		img.width = 4;
		img.height = 4;
		const flame = new Sprite3d(0, 0, {
			image: img,
			width: 8,
			height: 8,
			billboard: true,
		});
		const model = makeModel({ scale: 10 });
		model.addChildToNode(flame, "knee");
		model.setCurrentAnimation("bend", { loop: false });
		model.setAnimationTime(1000);
		expect(flame.currentTransform.isIdentity()).toBe(true);
		expectClose([flame.pos.x, flame.pos.y, flame.pos.z], [0, -10, 0]);
	});

	it("moves to another node keeping its offset, not its last world position", () => {
		const model = makeModel({ scale: 10 });
		const m = marker(5, 0, 0);
		model.addChildToNode(m, "knee");
		model.setCurrentAnimation("lift");
		model.update(16);
		model.addChildToNode(m, "hip");
		expectClose([m.pos.x, m.pos.y, m.pos.z], [5, -100, 0]);
		expect(
			model.getChildren().filter((c) => {
				return c === m;
			}).length,
		).toBe(1);
	});

	it("stops following once removed, moved to another container or destroyed", () => {
		const model = makeModel({ scale: 10 });
		const removed = marker();
		const moved = marker();
		const killed = marker();
		model.addChildToNode(removed, "knee");
		model.addChildToNode(moved, "knee");
		model.addChildToNode(killed, "knee");
		model.removeChildNow(removed, true);
		new Container(0, 0, 10, 10).addChild(moved);
		model.removeChildNow(killed);
		model.setCurrentAnimation("lift");
		expect(() => {
			model.update(16);
		}).not.toThrow();
		expect(removed.pos.y).toBeCloseTo(-10);
		expect(moved.pos.y).toBeCloseTo(-10);
		expect(model._attached.size).toBe(0);
		// re-added as a plain child, it no longer follows the knee
		model.addChild(removed);
		model.update(16);
		expect(removed.pos.y).toBeCloseTo(-10);
	});

	it("is an ordinary child otherwise", () => {
		const model = makeModel();
		const m = marker();
		model.addChildToNode(m, "knee");
		expect(model.getChildByName("marker")[0]).toBe(m);
	});

	it("refuses what it cannot attach, and attaches nothing", () => {
		const model = makeModel();
		const count = model.getChildren().length;
		expect(() => {
			model.addChildToNode(marker(), "nope");
		}).toThrow(/not defined/);
		for (const bad of [null, undefined, {}, 3]) {
			expect(() => {
				model.addChildToNode(bad, "knee");
			}).toThrow(/Renderable/);
		}
		expect(() => {
			model.addChildToNode(model, "knee");
		}).toThrow(/itself/);
		const group = new Container(0, 0, 10, 10);
		group.addChild(model);
		expect(() => {
			model.addChildToNode(group, "knee");
		}).toThrow(/itself/);
		expect(model.getChildren().length).toBe(count);
		expect(model._attached.size).toBe(0);
	});
});
