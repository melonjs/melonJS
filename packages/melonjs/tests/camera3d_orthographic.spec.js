import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	Container,
	Frustum,
	Mesh,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * `Camera3d` with `projection: "orthographic"`: the same 3D world, depth,
 * culling and picking, without foreshortening — the isometric / top-down /
 * diorama look. Perspective stays the default, untouched.
 *
 * Render space is Y-down and an unturned camera looks down +Z.
 */

const W = 200;
const H = 100;

let app;
beforeAll(async () => {
	await boot();
	app = new Application(W, H, {
		parent: "screen",
		scale: "auto",
		renderer: video.WEBGL,
		cameraClass: Camera3d,
	});
	await app.init();
});
afterAll(() => {
	app?.destroy();
});

const ortho = (opts = {}) => {
	const cam = new Camera3d(0, 0, W, H, {
		projection: "orthographic",
		near: 1,
		far: 5000,
		...opts,
	});
	cam.setPosition(0, 0, 0);
	cam.update(0);
	return cam;
};

/** a flat W×H quad facing the camera, centred on its origin */
const quad = (half, x, y, z) => {
	const h = half;
	const mesh = new Mesh(x, y, {
		vertices: new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0]),
		uvs: new Float32Array(8),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		width: h * 2,
		height: h * 2,
		scale: 1,
		normalize: false,
		cullBackFaces: false,
		castGroundShadow: false,
	});
	mesh.depth = z;
	return mesh;
};

describe("Frustum orthographic projection", () => {
	it("defaults to perspective, as before", () => {
		const f = new Frustum();
		expect(f.projection).toBe("perspective");
		expect(f.projectionMatrix.val[11]).not.toBe(0);
	});

	it("maps the view box to clip space, whatever the depth", () => {
		const f = new Frustum({
			projection: "orthographic",
			orthoHeight: 100,
			aspect: 2,
			near: 1,
			far: 101,
		});
		// no perspective term: w stays 1
		expect(Math.abs(f.projectionMatrix.val[11])).toBe(0);
		expect(f.projectionMatrix.val[15]).toBe(1);
		for (const z of [1, 50, 101]) {
			// half-width is 100 (height 100 × aspect 2): x = 100 is the right edge
			const right = f.projectionMatrix.apply(new Vector3d(100, 0, z));
			expect(right.x).toBeCloseTo(1);
			// Y-down: +50 is the BOTTOM edge, NDC -1
			const bottom = f.projectionMatrix.apply(new Vector3d(0, 50, z));
			expect(bottom.y).toBeCloseTo(-1);
		}
		// +Z forward: near → -1, far → +1
		expect(f.projectionMatrix.apply(new Vector3d(0, 0, 1)).z).toBeCloseTo(-1);
		expect(f.projectionMatrix.apply(new Vector3d(0, 0, 101)).z).toBeCloseTo(1);
	});
});

describe("Camera3d projection", () => {
	it("is perspective unless asked otherwise", () => {
		const cam = new Camera3d(0, 0, W, H);
		expect(cam.projection).toBe("perspective");
		expect(cam.projectionMatrix.val[11]).not.toBe(0);
	});

	it("takes projection and orthoHeight as options, orthoHeight defaulting to its height", () => {
		const cam = ortho();
		expect(cam.projection).toBe("orthographic");
		expect(cam.orthoHeight).toBe(H);
		expect(Math.abs(cam.projectionMatrix.val[11])).toBe(0);
		expect(ortho({ orthoHeight: 640 }).orthoHeight).toBe(640);
	});

	it("switches projection at run time, and back", () => {
		const cam = new Camera3d(0, 0, W, H);
		const perspective = Array.from(cam.projectionMatrix.val);
		cam.projection = "orthographic";
		expect(Math.abs(cam.projectionMatrix.val[11])).toBe(0);
		cam.projection = "perspective";
		expect(Array.from(cam.projectionMatrix.val)).toEqual(perspective);
	});

	it("rejects an unknown projection and a bad orthoHeight", () => {
		const cam = ortho();
		expect(() => {
			cam.projection = "isometric";
		}).toThrow();
		for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => {
				cam.orthoHeight = bad;
			}).toThrow();
		}
		expect(cam.orthoHeight).toBe(H);
	});

	it("keeps orthoHeight across a resize, and follows the new aspect", () => {
		const cam = ortho({ orthoHeight: 300 });
		cam.resize(400, 100);
		expect(cam.orthoHeight).toBe(300);
		expect(cam.aspect).toBeCloseTo(4);
		// half-width 600 now: x = 600 is the right edge
		const p = cam.worldToScreen(new Vector3d(600, 0, 100));
		expect(p.x).toBeCloseTo(400, 1);
	});
});

describe("orthographic screen ↔ world", () => {
	it("worldToScreen: no foreshortening — depth does not move a point", () => {
		const cam = ortho();
		const near = cam.worldToScreen(new Vector3d(50, -25, 10));
		const far = cam.worldToScreen(new Vector3d(50, -25, 3000));
		expect(far.x).toBeCloseTo(near.x, 3);
		expect(far.y).toBeCloseTo(near.y, 3);
		// one world unit per pixel by default, Y-down
		expect(near.x).toBeCloseTo(W / 2 + 50, 2);
		expect(near.y).toBeCloseTo(H / 2 - 25, 2);
	});

	it("worldToScreen returns null behind the camera", () => {
		const cam = ortho();
		expect(cam.worldToScreen(new Vector3d(0, 0, -50))).toBeNull();
	});

	it("screenToRay: parallel rays from the camera's plane", () => {
		const cam = ortho();
		cam.setPosition(10, -20, -300);
		cam.lookAt(10, -20, 0);
		cam.update(0);
		const a = cam.screenToRay(20, 30);
		const b = cam.screenToRay(170, 80);
		// parallel, along the camera's forward
		const fwd = cam.getForward(new Vector3d());
		for (const r of [a, b]) {
			expect(r.direction.x).toBeCloseTo(fwd.x, 4);
			expect(r.direction.y).toBeCloseTo(fwd.y, 4);
			expect(r.direction.z).toBeCloseTo(fwd.z, 4);
			// starting on the camera's plane: no distance along forward
			const along =
				(r.origin.x - cam.pos.x) * fwd.x +
				(r.origin.y - cam.pos.y) * fwd.y +
				(r.origin.z - cam.depth) * fwd.z;
			expect(along).toBeCloseTo(0, 2);
		}
		// but from different places
		expect(Math.abs(a.origin.x - b.origin.x)).toBeGreaterThan(100);
	});

	it("screenToRay is the inverse of worldToScreen, however the camera is turned", () => {
		const cam = ortho({ orthoHeight: 800 });
		cam.setPosition(-900, -700, -900);
		cam.lookAt(0, 0, 0);
		cam.update(0);
		for (const [x, y] of [
			[5, 5],
			[W / 2, H / 2],
			[190, 20],
			[40, 90],
		]) {
			const ray = cam.screenToRay(x, y);
			const back = cam.worldToScreen(ray.at(1200));
			expect(back.x).toBeCloseTo(x, 1);
			expect(back.y).toBeCloseTo(y, 1);
		}
	});

	it("screenToWorld finds the floor under an isometric view", () => {
		const cam = ortho({ orthoHeight: 800 });
		cam.setPosition(-900, -700, -900);
		cam.lookAt(0, 0, 0);
		cam.update(0);
		const p = cam.screenToWorld(W / 2, H / 2, 0);
		expect(p.x).toBeCloseTo(0, 0);
		expect(p.y).toBeCloseTo(0, 4);
		expect(p.z).toBeCloseTo(0, 0);
	});

	it("pick finds the nearest mesh along the parallel ray", () => {
		const cam = ortho();
		const world = new Container(0, 0, Infinity, Infinity);
		world.autoDepth = false;
		// off to the side, where a perspective ray from the centre would not
		// reach, but an orthographic one straight down +Z does
		const near = quad(10, 60, 0, 400);
		const far = quad(10, 60, 0, 900);
		world.addChild(far, 900);
		world.addChild(near, 400);
		const hit = cam.pick(W / 2 + 60, H / 2, world);
		expect(hit.renderable).toBe(near);
		expect(hit.distance).toBeCloseTo(400, 1);
	});
});

describe("orthographic culling", () => {
	it("keeps what is in the box at any depth, drops what is beside it", () => {
		const cam = ortho();
		const deep = quad(10, 80, 0, 4000);
		deep.updateBounds();
		// at this depth a 60° perspective would see ±2300 across; the ortho
		// box is ±100 wide however deep, and the quad is inside it
		expect(cam.isVisible(deep)).toBe(true);
		const beside = quad(10, 300, 0, 4000);
		beside.updateBounds();
		expect(cam.isVisible(beside)).toBe(false);
	});

	it("re-culls as soon as the projection changes, without an update", () => {
		const cam = ortho();
		const beside = quad(10, 300, 0, 4000);
		beside.updateBounds();
		expect(cam.isVisible(beside)).toBe(false);
		cam.projection = "perspective";
		expect(cam.isVisible(beside)).toBe(true);
		cam.projection = "orthographic";
		cam.orthoHeight = 1000;
		expect(cam.isVisible(beside)).toBe(true);
	});
});

describe("drawing through an orthographic Camera3d", () => {
	it("a container still moves its children by its depth, except on screen-space draws", () => {
		const c = new Container(0, 0, 10, 10);
		c.pos.z = 250;
		const renderer = {
			projectionMatrix: ortho().projectionMatrix,
			_orthographic3d: true,
		};
		expect(c._drawDepth(renderer)).toBe(250);
		renderer._screenSpaceDepth = 1;
		expect(c._drawDepth(renderer)).toBe(0);
		// a 2D camera's ortho is not a 3D world
		expect(c._drawDepth({ projectionMatrix: renderer.projectionMatrix })).toBe(
			0,
		);
	});

	it("a Camera2d never claims to be an orthographic 3D view", () => {
		expect(new Camera2d(0, 0, W, H)._isOrthographic3d()).toBe(false);
		expect(new Camera3d(0, 0, W, H)._isOrthographic3d()).toBe(false);
		expect(ortho()._isOrthographic3d()).toBe(true);
	});

	it("two equal quads at different depths draw the same size", () => {
		const renderer = app.renderer;
		const cam = ortho();
		// width in lit pixels of the row through the view's centre
		const widthAt = (z) => {
			const world = new Container(0, 0, Infinity, Infinity);
			world.autoDepth = false;
			world.root = true;
			const q = quad(20, 0, 0, z);
			q.inViewport = true;
			q._useWorldSpace = true;
			world.addChild(q, z);
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			cam.draw(renderer, world);
			renderer.flush();
			const gl = renderer.gl;
			gl.finish();
			const row = new Uint8Array(W * 4);
			gl.readPixels(0, H / 2, W, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
			let lit = 0;
			for (let x = 0; x < W; x++) {
				if (row[x * 4] > 128) {
					lit++;
				}
			}
			return lit;
		};
		const near = widthAt(100);
		const far = widthAt(3000);
		// 40 world units across at one unit per pixel
		expect(near).toBeGreaterThanOrEqual(38);
		expect(near).toBeLessThanOrEqual(42);
		expect(far).toBe(near);
		// and the flag the draw raised is lowered again
		expect(renderer._orthographic3d).toBe(false);
	});
});
