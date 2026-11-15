import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	Color,
	Container,
	GLTFModel,
	Light3d,
	Matrix3d,
	Mesh,
	Sprite3d,
	state,
	video,
} from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import { parseGLTF } from "../src/loader/parsers/gltf.js";
import { buildBarGLB } from "./helpers/skinned-bar.js";

/**
 * The cartoon look: `toonBands` cuts the lit shading into flat bands on both
 * GPU backends, and `outlineWidth` / `outlineColor` draw an inverted hull
 * round the silhouette. Both default off, and a mesh without them renders as
 * it always did.
 */

const SIZE = 128;

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

/** a cube of side 2h centred on its origin, one set of vertices per face */
const cubeGeometry = (h) => {
	const faces = [
		// normal, then four corners
		[0, 0, -1, [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h]],
		[0, 0, 1, [h, -h, h], [-h, -h, h], [-h, h, h], [h, h, h]],
		[-1, 0, 0, [-h, -h, h], [-h, -h, -h], [-h, h, -h], [-h, h, h]],
		[1, 0, 0, [h, -h, -h], [h, -h, h], [h, h, h], [h, h, -h]],
		[0, -1, 0, [-h, -h, h], [h, -h, h], [h, -h, -h], [-h, -h, -h]],
		[0, 1, 0, [-h, h, -h], [h, h, -h], [h, h, h], [-h, h, h]],
	];
	const vertices = [];
	const normals = [];
	const indices = [];
	faces.forEach(([nx, ny, nz, ...corners], f) => {
		for (const c of corners) {
			vertices.push(...c);
			normals.push(nx, ny, nz);
		}
		const o = f * 4;
		// counter-clockwise seen from outside, as an exported model is wound
		indices.push(o, o + 2, o + 1, o, o + 3, o + 2);
	});
	return {
		vertices: new Float32Array(vertices),
		normals: new Float32Array(normals),
		uvs: new Float32Array((vertices.length / 3) * 2),
		indices: new Uint16Array(indices),
		width: h * 2,
		height: h * 2,
		scale: 1,
		normalize: false,
		cullBackFaces: false,
		castGroundShadow: false,
	};
};

const camera = () => {
	const cam = new Camera3d(0, 0, SIZE, SIZE);
	cam.setPosition(0, 0, 0);
	cam.update(0);
	return cam;
};

/** draw `meshes` straight ahead of an unturned camera; the RGBA pixels, bottom-up */
const render = (meshes, lights = []) => {
	const renderer = app.renderer;
	const stage = state.current();
	const savedLights = stage._activeLights3d;
	stage._activeLights3d = new Set(lights);
	try {
		const world = new Container(0, 0, Infinity, Infinity);
		world.autoDepth = false;
		world.root = true;
		for (const m of meshes) {
			m.inViewport = true;
			m._useWorldSpace = true;
			world.addChild(m, m.depth);
		}
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();
		camera().draw(renderer, world);
		renderer.flush();
		const gl = renderer.gl;
		gl.finish();
		const px = new Uint8Array(SIZE * SIZE * 4);
		gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	} finally {
		stage._activeLights3d = savedLights;
	}
};
const red = (px, x, y) => {
	return px[(y * SIZE + x) * 4];
};
const green = (px, x, y) => {
	return px[(y * SIZE + x) * 4 + 1];
};

describe("settings", () => {
	it("default off, as every mesh rendered before them", () => {
		const m = new Mesh(0, 0, cubeGeometry(10));
		expect(m.toonBands).toBe(0);
		expect(m.outlineWidth).toBe(0);
		expect(m.outlineColor.toHex()).toBe("#000000");
	});

	it("take a Color, a CSS string or [r, g, b] in 0..1 for the outline", () => {
		const c = new Color(10, 20, 30);
		expect(
			new Mesh(0, 0, { ...cubeGeometry(10), outlineColor: c }).outlineColor,
		).toBe(c);
		expect(
			new Mesh(0, 0, {
				...cubeGeometry(10),
				outlineColor: "#ff8000",
			}).outlineColor.toHex(),
		).toBe("#FF8000");
		const fromArray = new Mesh(0, 0, {
			...cubeGeometry(10),
			outlineColor: [0, 1, 0],
		}).outlineColor;
		expect(fromArray.g).toBe(255);
		expect(fromArray.r).toBe(0);
	});

	it("reach every part of a GLTFModel and of a static glTF scene", async () => {
		const data = await parseGLTF(buildBarGLB());
		const model = new GLTFModel(data, {
			toonBands: 3,
			outlineWidth: 2,
			outlineColor: "#112233",
		});
		const part = model.getChildByName("bar")[0];
		expect(part.toonBands).toBe(3);
		expect(part.outlineWidth).toBe(2);
		expect(part.outlineColor.toHex()).toBe("#112233");
		expect(GLTFScene.loadOptions).toEqual(
			expect.arrayContaining(["toonBands", "outlineWidth", "outlineColor"]),
		);
	});
});

describe("toon shading (WebGL)", () => {
	/**
	 * A quad facing the camera whose normals swing from toward the light on
	 * the left to away from it on the right, so its smooth shading is a
	 * gradient across the screen.
	 */
	const gradientQuad = (toonBands) => {
		const h = 50;
		const mesh = new Mesh(0, 0, {
			vertices: new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0]),
			// left edge faces the light (-X), right edge faces away (+X); the
			// camera sees the quad face-on either way
			normals: new Float32Array([
				-1, 0, -0.2, 1, 0, -0.2, 1, 0, -0.2, -1, 0, -0.2,
			]),
			uvs: new Float32Array(8),
			indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
			width: h * 2,
			height: h * 2,
			scale: 1,
			normalize: false,
			cullBackFaces: false,
			castGroundShadow: false,
			lit: true,
			toonBands,
		});
		mesh.depth = 150;
		return mesh;
	};
	// a sun travelling toward +X: it lights the faces turned to -X
	const sun = () => {
		return new Light3d({
			type: "directional",
			direction: [1, 0, 0],
			intensity: 1,
		});
	};
	const distinctAcrossMiddleRow = (px) => {
		const seen = new Set();
		for (let x = 0; x < SIZE; x++) {
			const r = red(px, x, SIZE / 2);
			if (r > 0) {
				seen.add(r);
			}
		}
		return seen;
	};

	it("smooth shading is a gradient", () => {
		const shades = distinctAcrossMiddleRow(render([gradientQuad(0)], [sun()]));
		expect(shades.size).toBeGreaterThan(10);
	});

	it("toonBands cuts it into that many flat bands", () => {
		const shades = distinctAcrossMiddleRow(render([gradientQuad(3)], [sun()]));
		expect(shades.size).toBeGreaterThanOrEqual(2);
		expect(shades.size).toBeLessThanOrEqual(3);
	});

	it("fewer than 2 bands is smooth shading", () => {
		const shades = distinctAcrossMiddleRow(render([gradientQuad(1)], [sun()]));
		expect(shades.size).toBeGreaterThan(10);
	});
});

describe("toon shading (WebGPU, mock device)", () => {
	it("writes toonBands into the mesh block's reserved float", async () => {
		await import("./helpers/webgpu-globals.js");
		const { createMockWebGPURenderer } = await import(
			"./helpers/webgpu-mock-renderer.js"
		);
		const { default: WebGPUMeshBatcher } = await import(
			"../src/video/webgpu/batchers/mesh_batcher.js"
		);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const lastBlock = () => {
			return renderer.calls.writes
				.filter((x) => {
					return x.floats.length >= 52;
				})
				.at(-1).floats;
		};
		batcher.setPlacementUniforms(new Matrix3d(), 0xffffffff, {
			alphaCutoff: 0,
			toonBands: 4,
		});
		expect(lastBlock()[51]).toBe(4);
		batcher.setPlacementUniforms(new Matrix3d(), 0xffffffff, {
			alphaCutoff: 0,
		});
		expect(lastBlock()[51]).toBe(0);
	});
});

describe("outlines", () => {
	const cube = (opts = {}) => {
		const m = new Mesh(0, 0, { ...cubeGeometry(20), ...opts });
		m.depth = 200;
		return m;
	};

	it("draw a rim in the outline colour round the silhouette, and nothing over the mesh", () => {
		const plain = render([cube()]);
		const outlined = render([
			cube({ outlineWidth: 4, outlineColor: "#00ff00" }),
		]);
		// the cube itself is white: the centre is unchanged
		const c = SIZE / 2;
		expect(red(outlined, c, c)).toBe(red(plain, c, c));
		expect(red(outlined, c, c)).toBeGreaterThan(200);
		// beside the silhouette: background before, green after
		let rim = 0;
		for (let x = 0; x < SIZE; x++) {
			if (
				red(plain, x, c) === 0 &&
				green(outlined, x, c) > 200 &&
				red(outlined, x, c) < 50
			) {
				rim++;
			}
		}
		expect(rim).toBeGreaterThan(0);
	});

	it("leave the renderer's tint as it was", () => {
		const renderer = app.renderer;
		renderer.currentTint.setColor(255, 255, 255, 1);
		render([cube({ outlineWidth: 4, outlineColor: "#ff0000" })]);
		expect(renderer.currentTint.toHex()).toBe("#FFFFFF");
	});

	it("push every vertex out by the width in WORLD units, whatever the mesh scale", () => {
		for (const scale of [1, 4]) {
			const m = new Mesh(0, 0, {
				...cubeGeometry(20 / scale),
				scale,
				outlineWidth: 6,
			});
			const hull = m._outlineHull();
			// the +Z face's centre-line vertex would move straight out along
			// a welded corner normal: measure the corner's displacement, in
			// world units
			const dx = hull.originalVertices[0] - m.originalVertices[0];
			const dy = hull.originalVertices[1] - m.originalVertices[1];
			const dz = hull.originalVertices[2] - m.originalVertices[2];
			expect(Math.hypot(dx, dy, dz) * scale).toBeCloseTo(6, 4);
		}
	});

	it("weld split vertices, so the hull stays closed at hard edges", () => {
		const m = cube({ outlineWidth: 5 });
		const hull = m._outlineHull();
		const v = m.originalVertices;
		const out = hull.originalVertices;
		// every pair of vertices sharing a position still shares one
		for (let i = 0; i < m.vertexCount; i++) {
			for (let j = i + 1; j < m.vertexCount; j++) {
				const same =
					v[i * 3] === v[j * 3] &&
					v[i * 3 + 1] === v[j * 3 + 1] &&
					v[i * 3 + 2] === v[j * 3 + 2];
				if (same) {
					expect(out[i * 3]).toBeCloseTo(out[j * 3], 5);
					expect(out[i * 3 + 1]).toBeCloseTo(out[j * 3 + 1], 5);
					expect(out[i * 3 + 2]).toBeCloseTo(out[j * 3 + 2], 5);
				}
			}
		}
	});

	it("turn the hull inside out", () => {
		const m = cube({ outlineWidth: 5 });
		const hull = m._outlineHull();
		const a = m._indicesOriginal;
		const b = hull._indicesOriginal;
		expect(b[0]).toBe(a[0]);
		expect(b[1]).toBe(a[2]);
		expect(b[2]).toBe(a[1]);
		// the authored cube is wound outward: its first face's normal, by the
		// right-hand rule, points out of the cube (-Z for the near face)
		const v = m.originalVertices;
		const e1 = [v[a[1] * 3] - v[a[0] * 3], v[a[1] * 3 + 1] - v[a[0] * 3 + 1]];
		const e2 = [v[a[2] * 3] - v[a[0] * 3], v[a[2] * 3 + 1] - v[a[0] * 3 + 1]];
		expect(e1[0] * e2[1] - e1[1] * e2[0]).toBeLessThan(0);
		expect(hull.cullBackFaces).toBe(true);
	});

	it("follow the geometry when it changes, and the width", () => {
		const m = cube({ outlineWidth: 5 });
		const hull = m._outlineHull();
		const before = hull.originalVertices[0];
		m.originalVertices[0] -= 10;
		m.needsUpdate = true;
		m._outlineHull();
		expect(hull.originalVertices[0]).toBeCloseTo(before - 10, 4);
		m.outlineWidth = 10;
		m._outlineHull();
		expect(hull.originalVertices[0]).toBeLessThan(before - 10);
	});

	it("follow a skinned GLTFModel part as it bends", async () => {
		const data = await parseGLTF(buildBarGLB());
		const model = new GLTFModel(data, {
			rightHanded: false,
			outlineWidth: 0.1,
		});
		const part = model.getChildByName("bar")[0];
		const hull = part._outlineHull();
		const restY = hull.originalVertices[7];
		model.setCurrentAnimation("bend", { loop: false });
		model.update(1000);
		part._outlineHull();
		// the knee-bound vertex v2 swung from y = 2 down to y = 1
		expect(hull.originalVertices[7]).toBeLessThan(restY - 0.5);
	});

	// is any batcher still holding GPU geometry for `mesh`?
	const retained = (mesh) => {
		let held = false;
		app.renderer.batchers.forEach((batcher) => {
			if (batcher.retained?.has(mesh)) {
				held = true;
			}
		});
		return held;
	};

	it("free the hull's GPU geometry with the mesh's, on destroy", () => {
		const m = cube({ outlineWidth: 4 });
		render([m]);
		const hull = m._outline;
		expect(retained(m)).toBe(true);
		expect(retained(hull)).toBe(true);
		m.destroy();
		expect(retained(m)).toBe(false);
		expect(retained(hull)).toBe(false);
	});

	it("free the hull's GPU geometry when the mesh leaves the world, and rebuild it on its next draw", () => {
		const m = cube({ outlineWidth: 4 });
		render([m]);
		const hull = m._outline;
		// what removing it with keepalive, or recycling it through the pool, does
		m.onDeactivateEvent();
		expect(retained(hull)).toBe(false);
		render([m]);
		expect(retained(m._outline)).toBe(true);
		m.destroy();
	});

	it("are not drawn for a Sprite3d", () => {
		const img = document.createElement("canvas");
		img.width = 4;
		img.height = 4;
		const sprite = new Sprite3d(0, 0, { image: img, width: 40, height: 40 });
		sprite.outlineWidth = 5;
		sprite._drawOutline(app.renderer);
		expect(sprite._outline).toBeUndefined();
	});
});
