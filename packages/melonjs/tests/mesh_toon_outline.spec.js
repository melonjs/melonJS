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
const render = (meshes, lights = [], cam = camera()) => {
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
		cam.draw(renderer, world);
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

describe("outlineMode", () => {
	const cube = (opts = {}) => {
		const m = new Mesh(0, 0, {
			...cubeGeometry(20),
			outlineWidth: 4,
			outlineColor: "#00ff00",
			...opts,
		});
		return m;
	};
	// how many pixels of the middle row are the outline's green
	const rimPixels = (px) => {
		let n = 0;
		for (let x = 0; x < SIZE; x++) {
			if (green(px, x, SIZE / 2) > 200 && red(px, x, SIZE / 2) < 50) {
				n++;
			}
		}
		return n;
	};
	const at = (m, depth) => {
		m.depth = depth;
		return m;
	};

	it('is world units by default, and only an exact "screen" means pixels', () => {
		expect(cube().outlineMode).toBe("world");
		expect(cube({ outlineMode: "screen" }).outlineMode).toBe("screen");
		for (const other of ["Screen", "pixels", "", null, 1]) {
			expect(cube({ outlineMode: other }).outlineMode).toBe("world");
		}
	});

	it("in world units the line thins with distance, as the mesh does", () => {
		const near = rimPixels(render([at(cube({ outlineWidth: 6 }), 150)]));
		const far = rimPixels(render([at(cube({ outlineWidth: 6 }), 450)]));
		expect(near).toBeGreaterThan(far);
	});

	it("in screen pixels the line keeps its thickness however far the mesh is", () => {
		const widths = [150, 300, 450].map((d) => {
			return rimPixels(render([at(cube({ outlineMode: "screen" }), d)]));
		});
		// four pixels each side
		for (const w of widths) {
			expect(w).toBeGreaterThanOrEqual(6);
			expect(w).toBeLessThanOrEqual(10);
		}
		expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
	});

	it("in screen pixels it ignores an orthographic camera's zoom too", () => {
		const ortho = (zoom) => {
			const cam = new Camera3d(0, 0, SIZE, SIZE, {
				projection: "orthographic",
				near: 1,
				far: 5000,
			});
			cam.setPosition(0, 0, 0);
			cam.zoom = zoom;
			cam.update(0);
			return cam;
		};
		const screen = [1, 2].map((z) => {
			return rimPixels(
				render([at(cube({ outlineMode: "screen" }), 300)], [], ortho(z)),
			);
		});
		expect(Math.abs(screen[0] - screen[1])).toBeLessThanOrEqual(2);
		const world = [1, 2].map((z) => {
			return rimPixels(render([at(cube(), 300)], [], ortho(z)));
		});
		// in world units, zoomed in twice as close, the line is twice as thick
		expect(world[1]).toBeGreaterThan(world[0] * 1.6);
	});

	it("does not rebuild the hull for a change of depth no one could see", () => {
		const m = at(cube({ outlineMode: "screen" }), 300);
		render([m]);
		const offset = m._outlineOffset;
		render([at(m, 300.3)]);
		expect(m._outlineOffset).toBe(offset);
		render([at(m, 600)]);
		expect(m._outlineOffset / offset).toBeGreaterThan(1.9);
		expect(m._outlineOffset / offset).toBeLessThan(2.1);
	});

	it("keeps the width as given where a pixel has no size", () => {
		const m = cube({ outlineMode: "screen", outlineWidth: 5 });
		// no camera, a 2D camera, a camera with no size
		expect(m._outlineWorldWidth(app.renderer, undefined)).toBe(5);
		expect(m._outlineWorldWidth(app.renderer, { height: 100 })).toBe(5);
		expect(m._outlineWorldWidth(app.renderer, new Camera3d(0, 0, 0, 0))).toBe(
			5,
		);
		// a mesh at or behind the eye
		const behind = { currentTransform: new Matrix3d() };
		m.depth = -50;
		expect(m._outlineWorldWidth(behind, camera())).toBe(5);
		m.depth = 0;
		expect(m._outlineWorldWidth(behind, camera())).toBe(5);
		// and world mode never looks
		const w = cube({ outlineWidth: 5 });
		expect(w._outlineWorldWidth(behind, camera())).toBe(5);
	});

	it("reaches every part of a GLTFModel and of a scene", async () => {
		const data = await parseGLTF(buildBarGLB());
		const model = new GLTFModel(data, { outlineMode: "screen" });
		expect(model.getChildByName("bar")[0].outlineMode).toBe("screen");
		expect(GLTFScene.loadOptions).toContain("outlineMode");
	});
});

describe("rim light", () => {
	it("is off and white by default, and takes a Color, a CSS string or [r, g, b]", () => {
		const m = new Mesh(0, 0, cubeGeometry(10));
		expect(m.rimLight).toBe(0);
		expect(m.rimColor.toHex()).toBe("#FFFFFF");
		expect(
			new Mesh(0, 0, {
				...cubeGeometry(10),
				rimColor: "#ff8000",
			}).rimColor.toHex(),
		).toBe("#FF8000");
		const c = new Color(1, 2, 3);
		expect(new Mesh(0, 0, { ...cubeGeometry(10), rimColor: c }).rimColor).toBe(
			c,
		);
		expect(
			new Mesh(0, 0, { ...cubeGeometry(10), rimColor: [0, 1, 0] }).rimColor.g,
		).toBe(255);
		// a strength given as anything but a number is none
		expect(
			new Mesh(0, 0, { ...cubeGeometry(10), rimLight: "1" }).rimLight,
		).toBe(0);
	});

	it("is pushed as the colour times the strength, and as nothing when unusable", () => {
		const m = new Mesh(0, 0, {
			...cubeGeometry(10),
			rimLight: 0.5,
			rimColor: [1, 0.5, 0],
		});
		const near = (actual, expected) => {
			expected.forEach((v, i) => {
				// a Color keeps 8 bits a channel: 0.5 is 127/255
				expect(actual[i]).toBeCloseTo(v, 2);
			});
		};
		const out = [9, 9, 9];
		expect(m._rimInto(out)).toBe(out);
		near(out, [0.5, 0.25, 0]);
		// overdriven
		m.rimLight = 2;
		near(m._rimInto(out), [2, 1, 0]);
		for (const bad of [
			0,
			-1,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			"1",
			null,
		]) {
			m.rimLight = bad;
			expect(Array.from(m._rimInto([9, 9, 9]))).toEqual([0, 0, 0]);
		}
		m.rimLight = 1;
		m.rimColor = "#ffffff"; // not a Color any more: none, rather than NaN
		expect(Array.from(m._rimInto([9, 9, 9]))).toEqual([0, 0, 0]);
	});

	/**
	 * The quad of the toon tests, its normals turning from the camera at the
	 * middle to sideways at the edges, tinted black: whatever red shows is
	 * the rim alone.
	 */
	const rimQuad = (settings) => {
		const h = 50;
		const mesh = new Mesh(0, 0, {
			vertices: new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0]),
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
			rimColor: [1, 0, 0],
			...settings,
		});
		mesh.tint.setColor(0, 0, 0);
		mesh.depth = 150;
		return mesh;
	};
	const redsAcrossMiddleRow = (px) => {
		const reds = [];
		for (let x = 0; x < SIZE; x++) {
			reds.push(red(px, x, SIZE / 2));
		}
		return reds;
	};

	it("draws nothing at strength 0, as before", () => {
		const reds = redsAcrossMiddleRow(render([rimQuad({ rimLight: 0 })]));
		expect(Math.max(...reds)).toBe(0);
	});

	it("glows where the surface turns away from the camera, not where it faces it", () => {
		const reds = redsAcrossMiddleRow(render([rimQuad({ rimLight: 1 })]));
		const c = SIZE / 2;
		expect(reds[c]).toBeLessThan(8);
		// the edges of the quad, a few pixels in
		const lit = reds.filter((r) => {
			return r > 0;
		});
		expect(Math.max(...lit)).toBeGreaterThan(80);
		// a smooth falloff: many shades between the middle and the edge
		expect(new Set(lit).size).toBeGreaterThan(10);
	});

	it("is twice as bright at twice the strength", () => {
		const one = redsAcrossMiddleRow(render([rimQuad({ rimLight: 0.4 })]));
		const two = redsAcrossMiddleRow(render([rimQuad({ rimLight: 0.8 })]));
		const i = one.indexOf(Math.max(...one));
		expect(two[i] / one[i]).toBeGreaterThan(1.8);
		expect(two[i] / one[i]).toBeLessThan(2.2);
	});

	it("is a hard-edged band with toonBands", () => {
		const reds = redsAcrossMiddleRow(
			render([rimQuad({ rimLight: 1, toonBands: 3 })]),
		);
		const lit = reds.filter((r) => {
			return r > 0;
		});
		expect(lit.length).toBeGreaterThan(0);
		// all or nothing: no gradient into the band
		expect(new Set(lit).size).toBeLessThanOrEqual(2);
		expect(Math.min(...lit)).toBeGreaterThan(200);
	});

	it("is not drawn on an unlit mesh", () => {
		const reds = redsAcrossMiddleRow(
			render([rimQuad({ rimLight: 1, lit: false })]),
		);
		expect(Math.max(...reds)).toBe(0);
	});

	it("reaches every part of a GLTFModel and of a scene", async () => {
		const data = await parseGLTF(buildBarGLB());
		const model = new GLTFModel(data, { rimLight: 0.7, rimColor: "#00ff00" });
		const part = model.getChildByName("bar")[0];
		expect(part.rimLight).toBe(0.7);
		expect(part.rimColor.toHex()).toBe("#00FF00");
		expect(GLTFScene.loadOptions).toEqual(
			expect.arrayContaining(["rimLight", "rimColor"]),
		);
	});
});

describe("rim light (WebGPU, mock device)", () => {
	it("rides in the block's three free floats, leaving the rest as it was", async () => {
		await import("./helpers/webgpu-globals.js");
		const { createMockWebGPURenderer } = await import(
			"./helpers/webgpu-mock-renderer.js"
		);
		const { default: WebGPUMeshBatcher, MESH_UNIFORM_SIZE } = await import(
			"../src/video/webgpu/batchers/mesh_batcher.js"
		);
		// still one 256-byte block: growing it would double it per draw
		expect(MESH_UNIFORM_SIZE).toBe(256);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const lastBlock = () => {
			return renderer.calls.writes
				.filter((x) => {
					return x.floats.length >= 56;
				})
				.at(-1).floats;
		};
		const mesh = new Mesh(0, 0, {
			...cubeGeometry(10),
			alphaCutoff: 0.25,
			emissive: [0.1, 0.2, 0.3],
			rimLight: 0.5,
			rimColor: [1, 0.5, 0.25],
		});
		batcher.setPlacementUniforms(new Matrix3d(), 0xffffffff, mesh);
		const b = lastBlock();
		[0.5, 0.25, 0.125].forEach((v, i) => {
			expect(b[[39, 43, 55][i]]).toBeCloseTo(v, 2);
		});
		// the neighbours keep their meaning
		expect(b[36]).toBeCloseTo(0.25);
		expect(
			[b[40], b[41], b[42]].map((v) => {
				return Math.round(v * 10) / 10;
			}),
		).toEqual([0.1, 0.2, 0.3]);
		// and a mesh without one, or a plain record, writes zeros there
		mesh.rimLight = 0;
		batcher.setPlacementUniforms(new Matrix3d(), 0xffffffff, mesh);
		expect([lastBlock()[39], lastBlock()[43], lastBlock()[55]]).toEqual([
			0, 0, 0,
		]);
		batcher.setPlacementUniforms(new Matrix3d(), 0xffffffff, {
			alphaCutoff: 0,
		});
		expect([lastBlock()[39], lastBlock()[43], lastBlock()[55]]).toEqual([
			0, 0, 0,
		]);
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
