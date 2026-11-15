import { afterAll, beforeAll, describe, expect, it } from "vitest";
import foxUrl from "../../examples/public/assets/skinnedCharacter/fox.glb?url";
import { boot, Camera3d, Container, GLTFModel, Mesh } from "../src/index.js";
import { parseGLTF } from "../src/loader/parsers/gltf.js";
import { buildBarGLB } from "./helpers/skinned-bar.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Skinning through a real renderer, and on a real asset.
 *
 * The unit specs prove the deformed vertices are right. What they cannot
 * prove is that the GPU ever sees them: on the retained `Camera3d` path the
 * geometry lives in a GPU buffer, uploaded once and refreshed only when the
 * mesh's geometry version moves. A skinned part that deformed its arrays but
 * not its version would draw its bind pose forever, and every unit test would
 * still pass. So the bar is drawn, bent, and drawn again, and the pixels must
 * move.
 */
describe("skinned meshes on WebGL", () => {
	const SIZE = 128;
	let renderer;
	let cam;
	let bar;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// genuinely unavailable — every test below skips
		}
		cam = new Camera3d(0, 0, SIZE, SIZE);
		cam.setPosition(0, 0, 0);
		cam.update(0);
		bar = await parseGLTF(buildBarGLB());
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// draw `root` and count the lit pixels in the top-left and top-right
	// quadrants of the view
	const quadrants = (root) => {
		const markInView = (c) => {
			for (const child of c.getChildren()) {
				child.inViewport = true;
				if (child instanceof Mesh) {
					child._useWorldSpace = true;
				}
				if (child instanceof Container) {
					markInView(child);
				}
			}
		};
		markInView(root);
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();
		cam.draw(renderer, root);
		renderer.flush();
		const gl = renderer.gl;
		gl.finish();
		const px = new Uint8Array(SIZE * SIZE * 4);
		gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
		let left = 0;
		let right = 0;
		// readPixels rows are bottom-up: the top half is rows SIZE/2..SIZE
		for (let y = SIZE / 2; y < SIZE; y++) {
			for (let x = 0; x < SIZE; x++) {
				if (px[(y * SIZE + x) * 4] > 64) {
					if (x < SIZE / 2) {
						left++;
					} else {
						right++;
					}
				}
			}
		}
		return { left, right };
	};

	const makeScene = () => {
		const root = new Container(0, 0, Infinity, Infinity);
		root.autoDepth = false;
		root.root = true;
		const model = new GLTFModel(bar, { scale: 20, rightHanded: false });
		const part = model.getChildByName("bar")[0];
		part.cullBackFaces = false;
		part.castGroundShadow = false;
		// the bar stands on the view's centre, reaching up and to the right
		// (`addChild`'s z is what sets the depth)
		root.addChild(model, 100);
		// the first update poses the rig at the depth it was just given
		model.update(0);
		return { root, model };
	};

	it("draws the rest pose up and to the right of its root", (ctx) => {
		requireWebGL(ctx);
		const { root } = makeScene();
		const { left, right } = quadrants(root);
		expect(right).toBeGreaterThan(20);
		expect(left).toBe(0);
	});

	it("draws the bent pose: the upper half swings over to the left", (ctx) => {
		requireWebGL(ctx);
		const { root, model } = makeScene();
		// first frame uploads the bind pose to the GPU...
		const before = quadrants(root);
		expect(before.left).toBe(0);
		// ...then the knee turns 90° and the GPU copy has to follow
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		const after = quadrants(root);
		expect(after.left).toBeGreaterThan(20);
	});
});

/**
 * The example's character. Its contract: a skinned mesh with three clips that
 * drive the same joints, which is what the crossfade in the example shows.
 */
describe("fox.glb (the skinnedCharacter example)", () => {
	let data;
	beforeAll(async () => {
		await boot();
		const response = await fetch(foxUrl);
		expect(response.ok, "fox.glb should be reachable").toBe(true);
		data = await parseGLTF(await response.arrayBuffer());
	});

	it("carries one skin with its joints and three clips", () => {
		expect(data.skins).toHaveLength(1);
		expect(data.skins[0].joints.length).toBe(24);
		expect(
			data.animations.map((a) => {
				return a.name;
			}),
		).toEqual(["Survey", "Walk", "Run"]);
	});

	it("binds every vertex with weights that sum to 1", () => {
		const prim = Object.values(data.graph.nodes).find((n) => {
			return n.primitives.length > 0;
		}).primitives[0];
		expect(prim.skin).toBe(0);
		for (let v = 0; v < prim.vertexCount; v++) {
			const w = prim.weights;
			const sum = w[v * 4] + w[v * 4 + 1] + w[v * 4 + 2] + w[v * 4 + 3];
			expect(Math.abs(sum - 1)).toBeLessThan(1e-5);
		}
	});

	it("has finite bounds, measured on the skinned rest pose", () => {
		for (const v of [...data.bounds.min, ...data.bounds.max]) {
			expect(Number.isFinite(v)).toBe(true);
		}
		// a fox is taller than it is nothing, and longer than it is tall
		const h = data.bounds.max[1] - data.bounds.min[1];
		const l = data.bounds.max[2] - data.bounds.min[2];
		expect(h).toBeGreaterThan(0);
		expect(l).toBeGreaterThan(h);
	});

	it("deforms as it walks, and every vertex stays finite", () => {
		const model = new GLTFModel(data, { scale: 1 });
		const mesh = model.getChildren().find((c) => {
			return c instanceof Mesh;
		});
		const rest = mesh.originalVertices.slice();
		model.setCurrentAnimation("Walk");
		model.update(300);
		let moved = 0;
		for (let i = 0; i < rest.length; i++) {
			expect(Number.isFinite(mesh.originalVertices[i])).toBe(true);
			if (Math.abs(mesh.originalVertices[i] - rest[i]) > 0.01) {
				moved++;
			}
		}
		expect(moved).toBeGreaterThan(rest.length / 4);
	});
});
