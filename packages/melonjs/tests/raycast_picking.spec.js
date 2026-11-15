import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	AABB3d,
	Application,
	boot,
	Camera3d,
	Container,
	GLTFModel,
	InstancedMesh,
	input,
	Matrix3d,
	Mesh,
	Ray3d,
	Sphere,
	Sprite3d,
	Vector3d,
	video,
} from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import { gltfList } from "../src/loader/cache.js";
import { parseGLTF } from "../src/loader/parsers/gltf.js";
import { buildBarGLB } from "./helpers/skinned-bar.js";

/**
 * Picking under a perspective camera: the ray through a screen pixel
 * (`Camera3d#screenToRay`), where it meets the floor (`screenToWorld`), the
 * meshes it hits (`Mesh#intersectRay`, `Camera3d#pick`), and pointer events on
 * meshes, which under a `Camera3d` are hit-tested by that ray instead of by 2D
 * bounds that a perspective projection makes meaningless.
 *
 * Render space is Y-down and +Z goes into the screen; an unturned Camera3d at
 * the origin looks down +Z.
 */

const SIZE = 200;

// One application for the whole file: a mesh without a texture draws with the
// renderer's white pixel, so it needs a live renderer to exist at all, and the
// pointer events need its viewport.
let app;
beforeAll(async () => {
	await boot();
	app = new Application(SIZE, SIZE, {
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

/** an axis-aligned cube of side `2 × half`, centred on its origin */
const cubeGeometry = (half) => {
	const h = half;
	const vertices = new Float32Array([
		-h,
		-h,
		-h,
		h,
		-h,
		-h,
		h,
		h,
		-h,
		-h,
		h,
		-h,
		-h,
		-h,
		h,
		h,
		-h,
		h,
		h,
		h,
		h,
		-h,
		h,
		h,
	]);
	const indices = new Uint16Array([
		0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0,
		3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
	]);
	return {
		vertices,
		uvs: new Float32Array(16),
		indices,
		width: h * 2,
		height: h * 2,
		scale: 1,
		normalize: false,
		castGroundShadow: false,
	};
};

const cube = (x, y, z, half = 50) => {
	const mesh = new Mesh(x, y, cubeGeometry(half));
	mesh.depth = z;
	return mesh;
};

const camera = () => {
	const cam = new Camera3d(0, 0, SIZE, SIZE);
	cam.setPosition(0, 0, 0);
	cam.update(0);
	return cam;
};

const expectVector = (v, x, y, z, digits = 3) => {
	expect(v.x).toBeCloseTo(x, digits);
	expect(v.y).toBeCloseTo(y, digits);
	expect(v.z).toBeCloseTo(z, digits);
};

describe("Ray3d", () => {
	it("normalizes its direction", () => {
		const ray = new Ray3d(1, 2, 3, 0, 0, 10);
		expectVector(ray.origin, 1, 2, 3);
		expectVector(ray.direction, 0, 0, 1);
		ray.set(0, 0, 0, 3, 4, 0);
		expectVector(ray.direction, 0.6, 0.8, 0);
	});

	it("falls back to +Z for a zero direction", () => {
		expectVector(new Ray3d(0, 0, 0, 0, 0, 0).direction, 0, 0, 1);
	});

	it("at() walks the ray", () => {
		const ray = new Ray3d(1, 0, 0, 0, 1, 0);
		expectVector(ray.at(5), 1, 5, 0);
		const out = new Vector3d();
		expect(ray.at(2, out)).toBe(out);
	});

	it("intersectPlane: hit, parallel, behind", () => {
		const ray = new Ray3d(0, -10, 0, 0, 1, 0);
		const point = new Vector3d(0, 0, 0);
		// either side of the normal works
		expect(ray.intersectPlane(point, new Vector3d(0, -1, 0))).toBeCloseTo(10);
		expect(ray.intersectPlane(point, new Vector3d(0, 1, 0))).toBeCloseTo(10);
		const flat = new Ray3d(0, -10, 0, 1, 0, 0);
		expect(flat.intersectPlane(point, new Vector3d(0, 1, 0))).toBeNull();
		const away = new Ray3d(0, -10, 0, 0, -1, 0);
		expect(away.intersectPlane(point, new Vector3d(0, 1, 0))).toBeNull();
	});

	it("intersectSphere: entry, inside, miss, behind", () => {
		const s = new Sphere(0, 0, 100, 10);
		expect(new Ray3d(0, 0, 0, 0, 0, 1).intersectSphere(s)).toBeCloseTo(90);
		expect(new Ray3d(0, 0, 100, 1, 0, 0).intersectSphere(s)).toBe(0);
		expect(new Ray3d(20, 0, 0, 0, 0, 1).intersectSphere(s)).toBeNull();
		expect(new Ray3d(0, 0, 0, 0, 0, -1).intersectSphere(s)).toBeNull();
	});

	it("intersectAABB: entry, inside, miss, behind", () => {
		const box = new AABB3d(new Vector3d(-5, -5, 50), new Vector3d(5, 5, 60));
		expect(new Ray3d(0, 0, 0, 0, 0, 1).intersectAABB(box)).toBeCloseTo(50);
		expect(new Ray3d(0, 0, 55, 0, 1, 0).intersectAABB(box)).toBe(0);
		expect(new Ray3d(10, 0, 0, 0, 0, 1).intersectAABB(box)).toBeNull();
		expect(new Ray3d(0, 0, 0, 0, 0, -1).intersectAABB(box)).toBeNull();
	});

	it("intersectTriangle: from either side, edges and misses", () => {
		const a = new Vector3d(-1, -1, 5);
		const b = new Vector3d(1, -1, 5);
		const c = new Vector3d(0, 1, 5);
		expect(new Ray3d(0, 0, 0, 0, 0, 1).intersectTriangle(a, b, c)).toBeCloseTo(
			5,
		);
		expect(
			new Ray3d(0, 0, 10, 0, 0, -1).intersectTriangle(a, b, c),
		).toBeCloseTo(5);
		expect(new Ray3d(5, 0, 0, 0, 0, 1).intersectTriangle(a, b, c)).toBeNull();
		expect(new Ray3d(0, 0, 0, 0, 0, -1).intersectTriangle(a, b, c)).toBeNull();
		// parallel to its plane
		expect(new Ray3d(0, 0, 5, 1, 0, 0).intersectTriangle(a, b, c)).toBeNull();
	});

	it("copy() and clone() are independent", () => {
		const ray = new Ray3d(1, 2, 3, 1, 0, 0);
		const copy = ray.clone();
		copy.origin.x = 99;
		expect(ray.origin.x).toBe(1);
		const into = new Ray3d().copy(ray);
		expectVector(into.direction, 1, 0, 0);
	});
});

describe("Camera3d screen → world", () => {
	it("screenToRay through the centre starts at the eye and looks where the camera does", () => {
		const cam = camera();
		cam.setPosition(30, -40, 50);
		cam.update(0);
		const ray = cam.screenToRay(SIZE / 2, SIZE / 2);
		expectVector(ray.origin, 30, -40, 50);
		const fwd = cam.getForward(new Vector3d());
		expectVector(ray.direction, fwd.x, fwd.y, fwd.z);
	});

	it("screenToRay is the inverse of worldToScreen, however the camera is turned", () => {
		const cam = camera();
		cam.setPosition(-120, -80, 40);
		cam.lookAt(300, 50, 700);
		cam.update(0);
		for (const [x, y] of [
			[10, 10],
			[SIZE / 2, SIZE / 2],
			[180, 40],
			[30, 170],
		]) {
			const ray = cam.screenToRay(x, y);
			const screen = cam.worldToScreen(ray.at(400));
			expect(screen.x).toBeCloseTo(x, 2);
			expect(screen.y).toBeCloseTo(y, 2);
		}
	});

	it("screenToWorld finds where a pixel meets the floor", () => {
		const cam = camera();
		// above the floor (Y-down: up is a smaller y), looking down at its origin
		cam.setPosition(0, -500, -500);
		cam.lookAt(0, 0, 0);
		cam.update(0);
		const p = cam.screenToWorld(SIZE / 2, SIZE / 2, 0);
		expectVector(p, 0, 0, 0, 2);
		// and every point it returns is on the floor, under its pixel
		const q = cam.screenToWorld(40, 160, 0, new Vector3d());
		expect(q.y).toBeCloseTo(0, 6);
		// (to within the float32 precision of the camera's matrices)
		const back = cam.worldToScreen(q);
		expect(back.x).toBeCloseTo(40, 1);
		expect(back.y).toBeCloseTo(160, 1);
	});

	it("screenToWorld returns null where the pixel looks at the sky", () => {
		const cam = camera();
		// level with the horizon, 100 above the floor
		cam.setPosition(0, -100, 0);
		cam.update(0);
		// the top half of the view looks up, away from the floor
		expect(cam.screenToWorld(SIZE / 2, 10, 0)).toBeNull();
		expect(cam.screenToWorld(SIZE / 2, 190, 0)).not.toBeNull();
	});
});

describe("Mesh#intersectRay", () => {
	const forward = () => {
		return new Ray3d(0, 0, 0, 0, 0, 1);
	};

	it("hits the near face of a cube straight ahead", () => {
		const mesh = cube(0, 0, 500);
		const hit = mesh.intersectRay(forward());
		expect(hit).not.toBeNull();
		expect(hit.renderable).toBe(mesh);
		expect(hit.distance).toBeCloseTo(450);
		expectVector(hit.point, 0, 0, 450);
		expectVector(hit.normal, 0, 0, -1);
		expect(hit.instance).toBe(-1);
		expect(hit.triangle).toBeGreaterThanOrEqual(0);
		expect(hit.triangle).toBeLessThan(12);
	});

	it("misses a cube beside the ray", () => {
		expect(cube(200, 0, 500).intersectRay(forward())).toBeNull();
	});

	it("follows the mesh's position", () => {
		const mesh = cube(200, -100, 500);
		const ray = new Ray3d(0, 0, 0, 200, -100, 500);
		const hit = mesh.intersectRay(ray);
		expect(hit).not.toBeNull();
		// it enters the near face, z = 450
		expect(hit.point.z).toBeCloseTo(450);
	});

	it("follows the mesh's rotation: a cube turned 45° is hit on its edge", () => {
		const mesh = cube(0, 0, 500);
		mesh.rotate(Math.PI / 4, new Vector3d(0, 1, 0));
		const hit = mesh.intersectRay(forward());
		expect(hit.distance).toBeCloseTo(500 - 50 * Math.SQRT2, 2);
	});

	it("follows the mesh's scale", () => {
		const mesh = cube(0, 0, 500);
		mesh.scale(2, 2, 2);
		expect(mesh.intersectRay(forward()).distance).toBeCloseTo(400);
	});

	it("reports the normal facing the ray, from inside too", () => {
		const mesh = cube(0, 0, 0);
		// from the centre, out through the +X face
		const hit = mesh.intersectRay(new Ray3d(0, 0, 0, 1, 0, 0));
		expect(hit.distance).toBeCloseTo(50);
		expectVector(hit.normal, -1, 0, 0);
	});

	it("writes into the record it is given", () => {
		const mesh = cube(0, 0, 500);
		const record = {
			renderable: null,
			point: new Vector3d(),
			normal: new Vector3d(),
			distance: 0,
			triangle: -1,
			instance: -1,
		};
		expect(mesh.intersectRay(forward(), record)).toBe(record);
		expect(record.distance).toBeCloseTo(450);
	});

	it("sees geometry edited in place once needsUpdate is set", () => {
		const mesh = cube(0, 0, 500);
		expect(mesh.intersectRay(forward()).distance).toBeCloseTo(450);
		// push the whole cube 100 further away, in model space
		for (let i = 2; i < mesh.originalVertices.length; i += 3) {
			mesh.originalVertices[i] += 100;
		}
		mesh.needsUpdate = true;
		expect(mesh.intersectRay(forward()).distance).toBeCloseTo(550);
	});

	it("an InstancedMesh says which instance was hit, and only tests drawn ones", () => {
		const geometry = cubeGeometry(20);
		const set = new InstancedMesh(0, 0, { ...geometry, instanceCount: 3 });
		set.depth = 500;
		const at = new Matrix3d();
		for (let i = 0; i < 3; i++) {
			set.setInstance(i, at.identity().translate(-200 + i * 200, 0, 0));
		}
		const ray = new Ray3d(0, 0, 0, 200, 0, 500);
		const hit = set.intersectRay(ray);
		expect(hit).not.toBeNull();
		expect(hit.instance).toBe(2);
		expect(hit.renderable).toBe(set);
		// the middle one, straight ahead
		expect(set.intersectRay(forward()).instance).toBe(1);
		// drawing two of them, the third cannot be hit
		set.visibleInstanceCount = 2;
		expect(set.intersectRay(ray)).toBeNull();
	});

	it("a billboard Sprite3d is hit where it faces the camera", () => {
		const cam = camera();
		const img = document.createElement("canvas");
		img.width = 4;
		img.height = 4;
		const sprite = new Sprite3d(0, 0, {
			image: img,
			width: 100,
			height: 100,
			billboard: "spherical",
		});
		sprite.depth = 300;
		// the camera it faces is the one drawing it
		sprite._billboardCam = cam;
		const hit = sprite.intersectRay(cam.screenToRay(SIZE / 2, SIZE / 2));
		expect(hit).not.toBeNull();
		expect(hit.distance).toBeCloseTo(300);
		expect(sprite.intersectRay(cam.screenToRay(1, 1))).toBeNull();
	});
});

describe("GLTFModel#intersectRay", () => {
	let bar;
	beforeAll(async () => {
		bar = await parseGLTF(buildBarGLB());
	});

	// the bar, 100 px per unit, two units tall above its origin
	const makeBar = () => {
		const model = new GLTFModel(bar, { scale: 100, rightHanded: false });
		model.getChildByName("bar")[0].cullBackFaces = false;
		return model;
	};

	it("answers with the part that was hit", () => {
		const model = makeBar();
		// at render-space y = -150 (Y-down: 1.5 units up), x = 50, in its plane
		const hit = model.intersectRay(new Ray3d(50, -150, -100, 0, 0, 1));
		expect(hit).not.toBeNull();
		expect(hit.renderable.name).toBe("bar");
		expect(hit.distance).toBeCloseTo(100);
	});

	it("is hit where the skin was bent to, and not where it was", () => {
		const model = makeBar();
		const upper = new Ray3d(50, -150, -100, 0, 0, 1);
		// the knee turns 90°: the upper half swings over to x < 0
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		expect(model.intersectRay(upper)).toBeNull();
		const swung = new Ray3d(-50, -150, -100, 0, 0, 1);
		expect(model.intersectRay(swung)).not.toBeNull();
	});
});

describe("Camera3d#pick", () => {
	const root = () => {
		const c = new Container(0, 0, Infinity, Infinity);
		c.autoDepth = false;
		return c;
	};

	it("returns the nearest mesh under the pixel", () => {
		const cam = camera();
		const world = root();
		const far = cube(0, 0, 800);
		const near = cube(0, 0, 400);
		world.addChild(far, 800);
		world.addChild(near, 400);
		const hit = cam.pick(SIZE / 2, SIZE / 2, world);
		expect(hit.renderable).toBe(near);
		expect(hit.distance).toBeCloseTo(350);
	});

	it("returns null where nothing is under the pixel", () => {
		const cam = camera();
		const world = root();
		world.addChild(cube(0, 0, 400), 400);
		expect(cam.pick(2, 2, world)).toBeNull();
		expect(cam.pick(SIZE / 2, SIZE / 2, root())).toBeNull();
	});

	it("walks nested containers", () => {
		const cam = camera();
		const world = root();
		const group = root();
		const inner = cube(0, 0, 400);
		group.addChild(inner, 400);
		world.addChild(group, 0);
		expect(cam.pick(SIZE / 2, SIZE / 2, world).renderable).toBe(inner);
	});

	it("skips floating, hidden and fully transparent meshes", () => {
		const cam = camera();
		const world = root();
		const floating = cube(0, 0, 300);
		floating.floating = true;
		const hidden = cube(0, 0, 400);
		hidden.isRenderable = false;
		const clear = cube(0, 0, 500);
		clear.alpha = 0;
		const solid = cube(0, 0, 900);
		for (const m of [floating, hidden, clear, solid]) {
			world.addChild(m, m.depth);
		}
		expect(cam.pick(SIZE / 2, SIZE / 2, world).renderable).toBe(solid);
	});

	it("writes into the record it is given", () => {
		const cam = camera();
		const world = root();
		world.addChild(cube(0, 0, 400), 400);
		const record = cam.pick(SIZE / 2, SIZE / 2, world);
		expect(cam.pick(SIZE / 2, SIZE / 2, world, record)).toBe(record);
	});

	it("passes over a mesh that is not pickable, to the one behind it", () => {
		const cam = camera();
		const world = root();
		const front = cube(0, 0, 400);
		const back = cube(0, 0, 900);
		world.addChild(front, 400);
		world.addChild(back, 900);
		expect(front.pickable).toBe(true);
		front.pickable = false;
		expect(cam.pick(SIZE / 2, SIZE / 2, world).renderable).toBe(back);
		back.pickable = false;
		expect(cam.pick(SIZE / 2, SIZE / 2, world)).toBeNull();
		// and back again at run time
		front.pickable = true;
		expect(cam.pick(SIZE / 2, SIZE / 2, world).renderable).toBe(front);
	});

	it("takes pickable as a setting, and only an explicit false opts out", () => {
		const off = new Mesh(0, 0, { ...cubeGeometry(10), pickable: false });
		expect(off.pickable).toBe(false);
		for (const value of [undefined, null, 0, "", true]) {
			const m = new Mesh(0, 0, { ...cubeGeometry(10), pickable: value });
			expect(m.pickable).toBe(true);
		}
		const img = document.createElement("canvas");
		img.width = 4;
		img.height = 4;
		expect(
			new Sprite3d(0, 0, { image: img, width: 8, height: 8, pickable: false })
				.pickable,
		).toBe(false);
		expect(
			new InstancedMesh(0, 0, {
				...cubeGeometry(10),
				instanceCount: 1,
				pickable: false,
			}).pickable,
		).toBe(false);
	});

	it("leaves a direct intersectRay alone", () => {
		const m = cube(0, 0, 400);
		m.pickable = false;
		expect(m.intersectRay(new Ray3d(0, 0, 0, 0, 0, 1))).not.toBeNull();
	});

	it("passes over a whole model, or one part of it, that is not pickable", async () => {
		const bar = await parseGLTF(buildBarGLB());
		const cam = camera();
		const world = root();
		const model = new GLTFModel(bar, { scale: 100, rightHanded: false });
		const part = model.getChildByName("bar")[0];
		part.cullBackFaces = false;
		world.addChild(model, 300);
		model.update(0);
		const at = cam.worldToScreen(new Vector3d(50, -100, 300));
		expect(cam.pick(at.x, at.y, world).renderable).toBe(part);
		model.pickable = false;
		expect(cam.pick(at.x, at.y, world)).toBeNull();
		model.pickable = true;
		part.pickable = false;
		expect(cam.pick(at.x, at.y, world)).toBeNull();
		// the model's own intersectRay passes over the part as well
		expect(model.intersectRay(cam.screenToRay(at.x, at.y))).toBeNull();
		expect(new GLTFModel(bar, { pickable: false }).pickable).toBe(false);
	});

	it("reaches the meshes of a static scene and an animated one", async () => {
		const NAME = "__pickable_scene__";
		try {
			gltfList[NAME] = await parseGLTF(buildBarGLB());
			const animated = new Container(0, 0, 10, 10);
			new GLTFScene(NAME).addTo(animated, { pickable: false });
			expect(animated.getChildren()[0].pickable).toBe(false);
			gltfList[NAME] = await parseGLTF(buildStaticGLB());
			const flat = new Container(0, 0, 10, 10);
			new GLTFScene(NAME).addTo(flat, { pickable: false });
			const meshes = flat.getChildren().filter((c) => {
				return c instanceof Mesh;
			});
			expect(meshes.length).toBeGreaterThan(0);
			for (const m of meshes) {
				expect(m.pickable).toBe(false);
			}
			expect(GLTFScene.loadOptions).toContain("pickable");
		} finally {
			delete gltfList[NAME];
		}
	});
});

/** a one-triangle, unanimated GLB: the flat-mesh path of GLTFScene */
function buildStaticGLB() {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
	const indices = new Uint16Array([0, 1, 2, 0]);
	const bin = new Uint8Array(positions.byteLength + indices.byteLength);
	bin.set(new Uint8Array(positions.buffer), 0);
	bin.set(new Uint8Array(indices.buffer), positions.byteLength);
	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ name: "tri", mesh: 0 }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
		buffers: [{ byteLength: bin.byteLength }],
		bufferViews: [
			{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
			{
				buffer: 0,
				byteOffset: positions.byteLength,
				byteLength: indices.byteLength,
			},
		],
		accessors: [
			{
				bufferView: 0,
				componentType: 5126,
				count: 3,
				type: "VEC3",
				min: [0, 0, 0],
				max: [1, 1, 0],
			},
			{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
		],
	};
	const text = new TextEncoder().encode(JSON.stringify(json));
	const jsonLen = Math.ceil(text.length / 4) * 4;
	const binLen = Math.ceil(bin.length / 4) * 4;
	const total = 12 + 8 + jsonLen + 8 + binLen;
	const out = new Uint8Array(total);
	const dv = new DataView(out.buffer);
	dv.setUint32(0, 0x46546c67, true);
	dv.setUint32(4, 2, true);
	dv.setUint32(8, total, true);
	dv.setUint32(12, jsonLen, true);
	dv.setUint32(16, 0x4e4f534a, true);
	out.fill(0x20, 20, 20 + jsonLen);
	out.set(text, 20);
	dv.setUint32(20 + jsonLen, binLen, true);
	dv.setUint32(24 + jsonLen, 0x004e4942, true);
	out.set(bin, 28 + jsonLen);
	return out.buffer;
}

/**
 * A mesh's model matrix places it in its PARENT's space: under a Camera3d the
 * containers above it are folded into the view matrix as the tree is drawn.
 * Picking has to put them back, which it learns from the last draw.
 */
describe("picking a mesh inside a transformed container", () => {
	it("is hit where the container draws it, not at its own position", () => {
		const renderer = app.renderer;
		const cam = camera();
		const world = new Container(0, 0, Infinity, Infinity);
		world.autoDepth = false;
		world.root = true;
		const group = new Container(0, 0, Infinity, Infinity);
		group.autoDepth = false;
		// the group is 300 to the right, the mesh 300 to its left: it draws
		// straight ahead of the camera
		group.pos.x = 300;
		const mesh = cube(-300, 0, 500);
		mesh.cullBackFaces = false;
		group.addChild(mesh, 500);
		world.addChild(group, 0);
		// what the frame's culling pass would decide for a visible tree
		group.inViewport = true;
		mesh.inViewport = true;
		mesh._useWorldSpace = true;
		cam.draw(renderer, world);
		// the draw is what tells the mesh where its container put it
		expect(mesh._hasParentSpace).toBe(true);
		renderer.flush();

		const ahead = cam.pick(SIZE / 2, SIZE / 2, world);
		expect(ahead).not.toBeNull();
		expect(ahead.renderable).toBe(mesh);
		expect(ahead.point.x).toBeCloseTo(0, 1);
		// and not at x = -300, where its own position alone would put it
		const own = cam.worldToScreen(new Vector3d(-300, 0, 450));
		if (own !== null && own.x >= 0 && own.x <= SIZE) {
			expect(cam.pick(own.x, own.y, world)).toBeNull();
		}
	});
});

describe("pointer events on meshes under a Camera3d", () => {
	beforeAll(() => {
		app.viewport.setPosition(0, 0, 0);
		app.viewport.update(0);
	});

	const added = [];
	const add = (mesh) => {
		mesh.isKinematic = false;
		app.world.addChild(mesh, mesh.depth);
		added.push(mesh);
		return mesh;
	};
	const cleanup = () => {
		for (const m of added.splice(0)) {
			input.releaseAllPointerEvents(m);
			app.world.removeChildNow(m);
		}
	};

	/** send a pointer event at a CANVAS (screen) position */
	const send = (type, x, y) => {
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		canvas.dispatchEvent(
			new PointerEvent(type, {
				clientX: rect.left + (x * rect.width) / canvas.width,
				clientY: rect.top + (y * rect.height) / canvas.height,
				button: 0,
				buttons: type === "pointerup" ? 0 : 1,
				pointerId: 1,
				pointerType: "mouse",
				width: 1,
				height: 1,
				isPrimary: true,
				bubbles: true,
			}),
		);
	};

	it("a pointerdown on a mesh reaches it, with where the ray hit it", () => {
		try {
			const mesh = add(cube(0, 0, 500));
			let hit = null;
			input.registerPointerEvent("pointerdown", mesh, (pointer) => {
				hit = {
					renderable: pointer.hit3d.renderable,
					z: pointer.hit3d.point.z,
					distance: pointer.hit3d.distance,
				};
			});
			send("pointerdown", SIZE / 2, SIZE / 2);
			send("pointerup", SIZE / 2, SIZE / 2);
			expect(hit).not.toBeNull();
			expect(hit.renderable).toBe(mesh);
			expect(hit.z).toBeCloseTo(450);
			expect(hit.distance).toBeCloseTo(450);
		} finally {
			cleanup();
		}
	});

	it("a pointerdown beside the mesh does not reach it", () => {
		try {
			const mesh = add(cube(0, 0, 500));
			let calls = 0;
			input.registerPointerEvent("pointerdown", mesh, () => {
				calls++;
			});
			send("pointerdown", 5, 5);
			send("pointerup", 5, 5);
			expect(calls).toBe(0);
		} finally {
			cleanup();
		}
	});

	it("the nearer mesh is offered the event first, and can keep it", () => {
		try {
			const front = add(cube(0, 0, 400));
			const back = add(cube(0, 0, 800));
			const order = [];
			input.registerPointerEvent("pointerdown", back, () => {
				order.push("back");
			});
			input.registerPointerEvent("pointerdown", front, () => {
				order.push("front");
			});
			send("pointerdown", SIZE / 2, SIZE / 2);
			send("pointerup", SIZE / 2, SIZE / 2);
			expect(order).toEqual(["front", "back"]);

			// returning false stops it there, as in 2D
			order.length = 0;
			input.releasePointerEvent("pointerdown", front);
			input.registerPointerEvent("pointerdown", front, () => {
				order.push("front");
				return false;
			});
			send("pointerdown", SIZE / 2, SIZE / 2);
			send("pointerup", SIZE / 2, SIZE / 2);
			expect(order).toEqual(["front"]);
		} finally {
			cleanup();
		}
	});

	it("pointerenter and pointerleave follow the ray on and off the mesh", () => {
		try {
			const mesh = add(cube(0, 0, 500));
			const events = [];
			input.registerPointerEvent("pointerenter", mesh, (pointer) => {
				events.push(["enter", pointer.hit3d !== null]);
			});
			input.registerPointerEvent("pointerleave", mesh, (pointer) => {
				events.push(["leave", pointer.hit3d]);
			});
			send("pointermove", 5, 5);
			send("pointermove", SIZE / 2, SIZE / 2);
			send("pointermove", 5, 5);
			expect(events).toEqual([
				["enter", true],
				["leave", null],
			]);
		} finally {
			cleanup();
		}
	});

	it("a mesh that is not pickable still gets the events registered on it", () => {
		try {
			const mesh = add(cube(0, 0, 500));
			mesh.pickable = false;
			let pressed = 0;
			input.registerPointerEvent("pointerdown", mesh, () => {
				pressed++;
			});
			send("pointerdown", SIZE / 2, SIZE / 2);
			send("pointerup", SIZE / 2, SIZE / 2);
			expect(pressed).toBe(1);
		} finally {
			cleanup();
		}
	});

	it("a move does not ray-test a mesh that only listens for presses", () => {
		try {
			const mesh = add(cube(0, 0, 500));
			let tests = 0;
			const intersectRay = mesh.intersectRay.bind(mesh);
			mesh.intersectRay = (ray, out) => {
				tests++;
				return intersectRay(ray, out);
			};
			let pressed = 0;
			input.registerPointerEvent("pointerdown", mesh, () => {
				pressed++;
			});
			send("pointermove", 5, 5);
			send("pointermove", SIZE / 2, SIZE / 2);
			send("pointermove", SIZE / 2 + 1, SIZE / 2);
			expect(tests).toBe(0);
			send("pointerdown", SIZE / 2, SIZE / 2);
			send("pointerup", SIZE / 2, SIZE / 2);
			expect(pressed).toBe(1);
			expect(tests).toBeGreaterThan(0);
			// once it listens for moves, they test it
			tests = 0;
			let moved = 0;
			input.registerPointerEvent("pointermove", mesh, () => {
				moved++;
			});
			send("pointermove", SIZE / 2, SIZE / 2);
			expect(tests).toBe(1);
			expect(moved).toBe(1);
		} finally {
			cleanup();
		}
	});

	it("a mesh in a container taken out of the world gets no events", () => {
		const group = new Container(0, 0, Infinity, Infinity);
		const mesh = cube(0, 0, 500);
		mesh.isKinematic = false;
		group.addChild(mesh, 500);
		app.world.addChild(group);
		let calls = 0;
		input.registerPointerEvent("pointerdown", mesh, () => {
			calls++;
		});
		try {
			send("pointerdown", SIZE / 2, SIZE / 2);
			send("pointerup", SIZE / 2, SIZE / 2);
			expect(calls).toBe(1);
			// kept alive, as a scene swapped out and back in is
			app.world.removeChildNow(group, true);
			expect(mesh.ancestor).toBe(group);
			send("pointerdown", SIZE / 2, SIZE / 2);
			send("pointerup", SIZE / 2, SIZE / 2);
			expect(calls).toBe(1);
		} finally {
			input.releaseAllPointerEvents(mesh);
			if (group.ancestor !== undefined) {
				app.world.removeChildNow(group);
			}
		}
	});

	it("a leave because something nearer took the pointer has no hit3d", () => {
		try {
			const back = add(cube(0, 0, 800, 100));
			const front = add(cube(0, 0, 500));
			const left = [];
			input.registerPointerEvent("pointerenter", back, () => {});
			input.registerPointerEvent("pointerleave", back, (pointer) => {
				left.push(pointer.hit3d);
			});
			// on the back cube only, beside the front one
			const side = app.viewport.worldToScreen(new Vector3d(80, 0, 700));
			send("pointermove", side.x, side.y);
			// the front cube now covers the pointer, and keeps the move
			input.registerPointerEvent("pointermove", front, () => {
				return false;
			});
			send("pointermove", SIZE / 2, SIZE / 2);
			expect(left).toEqual([null]);
		} finally {
			cleanup();
		}
	});

	it("an InstancedMesh tells the handler which instance was pressed", () => {
		try {
			const set = new InstancedMesh(0, 0, {
				...cubeGeometry(20),
				instanceCount: 3,
			});
			set.depth = 500;
			const at = new Matrix3d();
			for (let i = 0; i < 3; i++) {
				set.setInstance(i, at.identity().translate(-150 + i * 150, 0, 0));
			}
			add(set);
			const pressed = [];
			input.registerPointerEvent("pointerdown", set, (pointer) => {
				pressed.push(pointer.hit3d.instance);
			});
			for (const x of [-150, 0, 150]) {
				const p = app.viewport.worldToScreen(new Vector3d(x, 0, 480));
				send("pointerdown", p.x, p.y);
				send("pointerup", p.x, p.y);
			}
			expect(pressed).toEqual([0, 1, 2]);
		} finally {
			cleanup();
		}
	});

	it("a pointer event on a GLTFModel is hit-tested through its parts", async () => {
		const bar = await parseGLTF(buildBarGLB());
		const model = new GLTFModel(bar, { scale: 100, rightHanded: false });
		model.getChildByName("bar")[0].cullBackFaces = false;
		model.isKinematic = false;
		app.world.addChild(model, 300);
		model.update(0);
		try {
			let part = null;
			input.registerPointerEvent("pointerdown", model, (pointer) => {
				part = pointer.hit3d.renderable;
			});
			// the bar stands up and to the right of the view's centre
			const target = app.viewport.worldToScreen(new Vector3d(50, -100, 300));
			send("pointerdown", target.x, target.y);
			send("pointerup", target.x, target.y);
			expect(part).not.toBeNull();
			expect(part.name).toBe("bar");
		} finally {
			input.releaseAllPointerEvents(model);
			app.world.removeChildNow(model);
		}
	});
});
