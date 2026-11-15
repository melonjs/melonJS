import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	Container,
	Frustum,
	Mesh,
	Renderable,
	Sprite,
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

	it("rejects them as options too, rather than falling back", () => {
		expect(() => {
			return new Camera3d(0, 0, W, H, { projection: "ortho" });
		}).toThrow(/unknown projection/);
		for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => {
				return new Camera3d(0, 0, W, H, {
					projection: "orthographic",
					orthoHeight: bad,
				});
			}).toThrow(/orthoHeight/);
		}
		// a camera with no size yet is still made, as before
		expect(() => {
			return new Camera3d(0, 0, 0, 0);
		}).not.toThrow();
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

	it("zoom divides orthoHeight: zoom 2 shows half as much world", () => {
		const cam = ortho({ orthoHeight: 100 });
		// at zoom 1, x = 100 (half the 200-wide view) is the right edge
		expect(cam.worldToScreen(new Vector3d(100, 0, 100)).x).toBeCloseTo(W, 1);
		cam.zoom = 2;
		// orthoHeight keeps what was set; the view is 50 units tall
		expect(cam.orthoHeight).toBe(100);
		expect(cam.frustum.orthoHeight).toBe(50);
		expect(cam.worldToScreen(new Vector3d(50, 0, 100)).x).toBeCloseTo(W, 1);
		// and the rays agree: the right edge looks down x = 50
		const ray = cam.screenToRay(W, H / 2);
		expect(ray.origin.x).toBeCloseTo(50, 1);
		// setting orthoHeight while zoomed keeps the zoom
		cam.orthoHeight = 400;
		expect(cam.frustum.orthoHeight).toBe(200);
		cam.zoom = 1;
		expect(cam.frustum.orthoHeight).toBe(400);
	});

	it("a perspective camera ignores zoom, as before", () => {
		const cam = new Camera3d(0, 0, W, H);
		const before = cam.projectionMatrix.clone();
		cam.zoom = 3;
		expect(Array.from(cam.projectionMatrix.val)).toEqual(
			Array.from(before.val),
		);
		// and switching to orthographic then applies it
		cam.projection = "orthographic";
		expect(cam.frustum.orthoHeight).toBeCloseTo(H / 3);
	});
});

describe("Camera3d#orthoWidth: keeping the width instead", () => {
	// W × H = 200 × 100: an aspect ratio of 2
	const rightEdge = (cam) => {
		// the world x at the right edge of the view, straight ahead
		return cam.screenToRay(cam.width, cam.height / 2).origin.x;
	};

	it("reads the width the height works out to, until it is set", () => {
		const cam = ortho({ orthoHeight: 80 });
		expect(cam.orthoWidth).toBeCloseTo(160);
		expect(cam._orthoKeep).toBe("height");
	});

	it("sets the view's width, and the height follows the aspect", () => {
		const cam = ortho();
		cam.orthoWidth = 300;
		expect(cam.orthoWidth).toBe(300);
		expect(cam.orthoHeight).toBeCloseTo(150);
		expect(rightEdge(cam)).toBeCloseTo(150, 2);
		expect(cam.worldToScreen(new Vector3d(150, 0, 100)).x).toBeCloseTo(W, 1);
	});

	it("keeps the width across a resize, then the height again once that is set", () => {
		const cam = ortho();
		cam.orthoWidth = 300;
		cam.resize(100, 100); // square now
		expect(cam.orthoWidth).toBe(300);
		expect(cam.orthoHeight).toBeCloseTo(300);
		expect(rightEdge(cam)).toBeCloseTo(150, 2);
		cam.resize(100, 400); // a phone held upright
		expect(cam.orthoWidth).toBe(300);
		expect(cam.orthoHeight).toBeCloseTo(1200);
		cam.orthoHeight = 80;
		cam.resize(400, 100);
		expect(cam.orthoHeight).toBe(80);
		expect(cam.orthoWidth).toBeCloseTo(320);
	});

	it("follows an aspect ratio set by hand", () => {
		const cam = ortho();
		cam.orthoWidth = 300;
		cam.aspect = 3;
		expect(cam.orthoHeight).toBeCloseTo(100);
		expect(cam.frustum.orthoHeight).toBeCloseTo(100);
	});

	it("is divided by the zoom, like the height", () => {
		const cam = ortho();
		cam.orthoWidth = 300;
		cam.zoom = 2;
		expect(cam.orthoWidth).toBe(300);
		expect(rightEdge(cam)).toBeCloseTo(75, 2);
		cam.resize(100, 100);
		expect(rightEdge(cam)).toBeCloseTo(75, 2);
	});

	it("re-culls with the new width at once", () => {
		const cam = ortho();
		const beside = quad(10, 140, 0, 500);
		beside.updateBounds();
		expect(cam.isVisible(beside)).toBe(false);
		cam.orthoWidth = 400;
		expect(cam.isVisible(beside)).toBe(true);
	});

	it("is a constructor option, given instead of orthoHeight", () => {
		const cam = new Camera3d(0, 0, W, H, {
			projection: "orthographic",
			orthoWidth: 400,
		});
		expect(cam.orthoWidth).toBe(400);
		expect(cam.orthoHeight).toBeCloseTo(200);
		expect(cam.frustum.orthoHeight).toBeCloseTo(200);
		expect(() => {
			return new Camera3d(0, 0, W, H, { orthoWidth: 400, orthoHeight: 100 });
		}).toThrow(/not both/);
	});

	it("refuses a width that is not a positive finite number, and keeps its own", () => {
		const cam = ortho();
		cam.orthoWidth = 300;
		for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => {
				cam.orthoWidth = bad;
			}).toThrow(/orthoWidth/);
			expect(() => {
				return new Camera3d(0, 0, W, H, { orthoWidth: bad });
			}).toThrow(/orthoWidth/);
		}
		expect(cam.orthoWidth).toBe(300);
		expect(cam._orthoKeep).toBe("width");
	});

	it("waits for a camera with no size yet, and comes out right once it has one", () => {
		// a camera with no size has no aspect ratio to work the height out from
		const cam = new Camera3d(0, 0, 0, 0, {
			projection: "orthographic",
			orthoWidth: 300,
		});
		cam.resize(W, H);
		expect(cam.orthoHeight).toBeCloseTo(150);
		expect(Array.from(cam.projectionMatrix.val).every(Number.isFinite)).toBe(
			true,
		);
	});

	it("changes nothing on a perspective camera", () => {
		const cam = new Camera3d(0, 0, W, H);
		const before = Array.from(cam.projectionMatrix.val);
		cam.orthoWidth = 999;
		expect(Array.from(cam.projectionMatrix.val)).toEqual(before);
		cam.projection = "orthographic";
		expect(cam.frustum.orthoHeight).toBeCloseTo(999 / 2);
	});
});

describe("a zoomed Camera3d keeps its size while it draws", () => {
	it("is still the default camera: zoom is its projection's business", () => {
		const cam = ortho();
		cam.zoom = 2;
		expect(cam.isDefault).toBe(true);
		cam.screenX = 10;
		expect(cam.isDefault).toBe(false);
		// a 2D camera is unchanged: zoomed is not default
		const flat = new Camera2d(0, 0, W, H);
		flat.zoom = 2;
		expect(flat.isDefault).toBe(false);
	});

	it("worldToScreen and screenToRay give the same answer during the draw as outside it", () => {
		const renderer = app.renderer;
		const cam = ortho();
		cam.zoom = 2;
		cam.update(0);
		const point = new Vector3d(20, 10, 300);
		const outside = cam.worldToScreen(point).clone();
		const rayOutside = cam.screenToRay(W, H).origin.clone();
		const seen = {};
		const probe = new Renderable(0, 0, 1, 1);
		probe.inViewport = true;
		probe.alwaysUpdate = true;
		probe.draw = () => {
			seen.width = cam.width;
			seen.height = cam.height;
			seen.screen = cam.worldToScreen(point).clone();
			seen.ray = cam.screenToRay(W, H).origin.clone();
		};
		const world = new Container(0, 0, Infinity, Infinity);
		world.root = true;
		world.addChild(probe, 0);
		cam.draw(renderer, world);
		renderer.flush();
		expect(seen.width).toBe(W);
		expect(seen.height).toBe(H);
		expect(seen.screen.x).toBeCloseTo(outside.x, 3);
		expect(seen.screen.y).toBeCloseTo(outside.y, 3);
		expect(seen.ray.x).toBeCloseTo(rayOutside.x, 3);
		expect(seen.ray.y).toBeCloseTo(rayOutside.y, 3);
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
		// zoomed in twice as close, the same quad draws twice as wide
		cam.zoom = 2;
		const zoomed = widthAt(100);
		cam.zoom = 1;
		expect(zoomed).toBeGreaterThanOrEqual(near * 2 - 2);
		expect(zoomed).toBeLessThanOrEqual(near * 2 + 2);
		// and the flag the draw raised is lowered again
		expect(renderer._orthographic3d).toBe(false);
	});

	it("a sprite keeps its depth: it draws where worldToScreen puts it", () => {
		const renderer = app.renderer;
		// looking down at the floor: a farther sprite sits higher on screen
		const cam = ortho({ orthoHeight: 1000 });
		cam.setPosition(0, -1000, 0);
		cam.lookAt(0, 0, 1000);
		cam.update(0);
		const canvas = document.createElement("canvas");
		canvas.width = 40;
		canvas.height = 40;
		const c2d = canvas.getContext("2d");
		c2d.fillStyle = "#ffffff";
		c2d.fillRect(0, 0, 40, 40);
		// the screen row of the lit pixels in the middle column
		const rowAt = (z) => {
			const world = new Container(0, 0, Infinity, Infinity);
			world.autoDepth = false;
			world.root = true;
			const sprite = new Sprite(0, 0, { image: canvas });
			sprite.inViewport = true;
			world.addChild(sprite, z);
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			cam.draw(renderer, world);
			renderer.flush();
			const gl = renderer.gl;
			gl.finish();
			const column = new Uint8Array(H * 4);
			gl.readPixels(W / 2, 0, 1, H, gl.RGBA, gl.UNSIGNED_BYTE, column);
			let sum = 0;
			let lit = 0;
			for (let y = 0; y < H; y++) {
				if (column[y * 4] > 128) {
					// readPixels is bottom-up
					sum += H - 1 - y;
					lit++;
				}
			}
			return lit > 0 ? sum / lit : Number.NaN;
		};
		const near = rowAt(600);
		const far = rowAt(1400);
		const expected = (z) => {
			return cam.worldToScreen(new Vector3d(0, 0, z)).y;
		};
		expect(Math.abs(near - expected(600))).toBeLessThan(3);
		expect(Math.abs(far - expected(1400))).toBeLessThan(3);
		expect(near - far).toBeGreaterThan(20);
	});

	it("setDepth keeps a depth under an orthographic Camera3d, not on screen-space draws", () => {
		const renderer = app.renderer;
		const saved = renderer.projectionMatrix.clone();
		renderer.projectionMatrix.copy(ortho().projectionMatrix);
		try {
			renderer._orthographic3d = true;
			renderer.setDepth(250);
			expect(renderer.currentDepth).toBe(250);
			renderer.beginScreenSpace();
			renderer.setDepth(250);
			expect(renderer.currentDepth).toBe(0);
			renderer.endScreenSpace();
			// a 2D camera's orthographic projection: depth is a sort key only
			renderer._orthographic3d = false;
			renderer.setDepth(250);
			expect(renderer.currentDepth).toBe(0);
		} finally {
			renderer._orthographic3d = false;
			renderer.projectionMatrix.copy(saved);
			renderer.setDepth(0);
		}
	});
});
