/**
 * The Canvas renderer's mesh path, drawn and read back.
 *
 * - A mesh built from an OBJ + MTL carries its material colors as
 *   `vertexColors`, white for a material that only names a texture. The
 *   Canvas renderer took any `vertexColors` as "no texture" and filled each
 *   triangle with its color, so a textured model came out as a white
 *   silhouette. The texture is drawn, times the color, as the GPU renderers do.
 * - Canvas has no depth buffer and draws triangles back to front. The
 *   projected Z grows toward the viewer, and the sort took the largest Z as
 *   the farthest, so a mesh showed its far side through its near one.
 * - Low-poly palette models map every face onto a line (or a point) of one
 *   shared texture. Such a triangle has no UV area to map an image onto, and
 *   Canvas filled it with the one texel under its first vertex, so the model
 *   came out faceted where the GPU renderers shade along the line.
 * - Two neighbouring triangles both antialias the edge they share, which let
 *   the background show through as a faint line along it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	CanvasRenderer,
	loader,
	Mesh,
	Vector3d,
	video,
} from "../src/index.js";

const SIZE = 32;
const WHITE = 0xffffffff;
const RED = 0xffff0000;
const GREEN = 0xff00ff00;
const BLUE = 0xff0000ff;

/** a quad covering the whole target at depth `z`, as 4 vertices */
const quadVertices = (z) => {
	return [0, 0, z, SIZE, 0, z, SIZE, SIZE, z, 0, SIZE, z];
};

/**
 * A mesh of `quads` full-target quads, one depth each, drawn in that index
 * order. `vertices` is the PROJECTED buffer `drawMesh` reads, so it is set
 * directly, in pixels, with the depth of each quad.
 */
const meshOf = (depths, colors, texture) => {
	const vertices = new Float32Array(depths.flatMap(quadVertices));
	const uvs = new Float32Array(
		depths.flatMap(() => {
			return [0, 0, 1, 0, 1, 1, 0, 1];
		}),
	);
	const indices = new Uint16Array(
		depths.flatMap((_, q) => {
			const b = q * 4;
			return [b, b + 1, b + 2, b, b + 2, b + 3];
		}),
	);
	const mesh = new Mesh(0, 0, {
		vertices,
		uvs,
		indices,
		normalize: false,
		scale: 1,
		width: SIZE,
		height: SIZE,
		cullBackFaces: false,
		...(texture ? { texture } : {}),
		...(colors
			? {
					vertexColors: new Uint32Array(
						colors.flatMap((c) => {
							return [c, c, c, c];
						}),
					),
				}
			: {}),
	});
	mesh.vertices.set(mesh.originalVertices);
	return mesh;
};

/** a solid-color image bigger than 1×1, so it counts as a real texture */
const solidTexture = (css) => {
	const canvas = document.createElement("canvas");
	canvas.width = 4;
	canvas.height = 4;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = css;
	ctx.fillRect(0, 0, 4, 4);
	return canvas;
};

/**
 * draw `mesh` on a fresh Canvas renderer, return a pixel well inside one
 * triangle (the center sits on the diagonal two triangles share, where
 * their antialiased edges blend)
 */
const samplePixel = (mesh) => {
	const renderer = new CanvasRenderer({
		width: SIZE,
		height: SIZE,
		transparent: true,
	});
	renderer.drawMesh(mesh);
	const [r, g, b] = renderer
		.getContext()
		.getImageData((SIZE * 3) / 4, SIZE / 4, 1, 1).data;
	return [r, g, b];
};

describe("CanvasRenderer.drawMesh", () => {
	// a Mesh resolves its texture through the running application
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	it("draws a textured mesh's texture when it has white material colors", () => {
		const mesh = meshOf([0], [WHITE], solidTexture("#ff0000"));
		// white silhouette: [255, 255, 255]
		expect(samplePixel(mesh)).toEqual([255, 0, 0]);
	});

	it("multiplies the texture by the material color", () => {
		const mesh = meshOf([0], [GREEN], solidTexture("#ffffff"));
		expect(samplePixel(mesh)).toEqual([0, 255, 0]);
	});

	it("still fills an untextured mesh with its material colors", () => {
		const mesh = meshOf([0], [BLUE]);
		expect(samplePixel(mesh)).toEqual([0, 0, 255]);
	});

	it("draws the nearest triangles last (larger Z is nearer)", () => {
		// the near quad comes first in the index order, so drawing in index
		// order or with the old sort leaves the far one on top
		const mesh = meshOf([500, -500], [RED, BLUE]);
		expect(samplePixel(mesh)).toEqual([255, 0, 0]);
	});

	it("draws the nearest triangles last whatever their index order", () => {
		const mesh = meshOf([-500, 500], [BLUE, RED]);
		expect(samplePixel(mesh)).toEqual([255, 0, 0]);
	});

	it("fills a mesh with no texture and no material colors, opaque", () => {
		// the 1×1 white fallback texture, read once, not every frame
		const mesh = meshOf([0]);
		const renderer = new CanvasRenderer({
			width: SIZE,
			height: SIZE,
			transparent: true,
		});
		renderer.drawMesh(mesh);
		const pixel = renderer
			.getContext()
			.getImageData((SIZE * 3) / 4, SIZE / 4, 1, 1).data;
		expect(Array.from(pixel)).toEqual([255, 255, 255, 255]);
	});

	it("covers the edge two opaque triangles share", () => {
		// the center is on the quad's diagonal: with no seam cover the
		// background shows through there, at about three quarters coverage
		const mesh = meshOf([0], [RED]);
		const renderer = new CanvasRenderer({
			width: SIZE,
			height: SIZE,
			transparent: true,
		});
		renderer.drawMesh(mesh);
		const alpha = renderer.getContext().getImageData(SIZE / 2, SIZE / 2, 1, 1)
			.data[3];
		expect(alpha).toBe(255);
	});
});

/** draw `mesh` through its own projection, on a fresh Canvas renderer */
const drawProjected = (mesh, size) => {
	const renderer = new CanvasRenderer({
		width: size,
		height: size,
		transparent: true,
	});
	mesh.preDraw(renderer);
	mesh.draw(renderer);
	mesh.postDraw(renderer);
	return renderer.getContext();
};

/** the [r, g, b] at (x, y) */
const rgbAt = (context, x, y) => {
	const [r, g, b] = context.getImageData(x, y, 1, 1).data;
	return [r, g, b];
};

describe("Mesh on the Canvas renderer, through its projection", () => {
	const VIEW = 64;
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(VIEW, VIEW, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		await loader.load({
			name: "palette_mtl",
			type: "mtl",
			src: "/data/models/palette.mtl",
		});
		await loader.load({
			name: "palette_obj",
			type: "obj",
			src: "/data/models/palette.obj",
		});
	});

	afterAll(() => {
		app?.destroy();
	});

	it("shades a palette model along its UV line, from an OBJ + MTL", () => {
		// a 4×1 swatch: red on the left half, blue on the right
		const texture = document.createElement("canvas");
		texture.width = 4;
		texture.height = 1;
		const ctx = texture.getContext("2d");
		ctx.fillStyle = "#ff0000";
		ctx.fillRect(0, 0, 2, 1);
		ctx.fillStyle = "#0000ff";
		ctx.fillRect(2, 0, 2, 1);

		const mesh = new Mesh(VIEW / 2, VIEW / 2, {
			model: "palette_obj",
			material: "palette_mtl",
			texture,
			width: VIEW,
			height: VIEW,
			cullBackFaces: false,
		});
		// what made the bug: baked (white) material colors beside a texture
		expect(mesh.vertexColors).toBeDefined();

		const context = drawProjected(mesh, VIEW);
		// the quad (about 26% to 74% of the view) runs from u = 0.125 (red)
		// to 0.875 (blue), blending between them in its middle third: a
		// white silhouette, or one texel per triangle, fails here
		expect(rgbAt(context, VIEW * 0.3, VIEW / 2)).toEqual([255, 0, 0]);
		expect(rgbAt(context, VIEW * 0.7, VIEW / 2)).toEqual([0, 0, 255]);
	});

	/**
	 * A unit cube, one color per face (four vertices each), wound
	 * counter-clockwise seen from outside.
	 */
	const cube = (colors, cullBackFaces) => {
		const faces = [
			// [normal, u, v], with u × v = normal
			[
				[0, 0, 1],
				[1, 0, 0],
				[0, 1, 0],
			],
			[
				[0, 0, -1],
				[-1, 0, 0],
				[0, 1, 0],
			],
			[
				[1, 0, 0],
				[0, 0, -1],
				[0, 1, 0],
			],
			[
				[-1, 0, 0],
				[0, 0, 1],
				[0, 1, 0],
			],
			[
				[0, 1, 0],
				[1, 0, 0],
				[0, 0, -1],
			],
			[
				[0, -1, 0],
				[1, 0, 0],
				[0, 0, 1],
			],
		];
		const vertices = [];
		const indices = [];
		const vertexColors = [];
		faces.forEach(([n, u, v], f) => {
			for (const [su, sv] of [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1],
			]) {
				for (let k = 0; k < 3; k++) {
					vertices.push(0.5 * (n[k] + su * u[k] + sv * v[k]));
				}
				vertexColors.push(colors[f]);
			}
			const b = f * 4;
			indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
		});
		return new Mesh(VIEW / 2, VIEW / 2, {
			vertices: new Float32Array(vertices),
			uvs: new Float32Array((vertices.length / 3) * 2),
			indices: new Uint16Array(indices),
			vertexColors: new Uint32Array(vertexColors),
			normalize: false,
			width: VIEW,
			height: VIEW,
			cullBackFaces,
		});
	};

	// +Z (toward the viewer) red, -Z blue, the sides green
	const FACES = [RED, BLUE, GREEN, GREEN, GREEN, GREEN];

	for (const cull of [false, true]) {
		it(`shows the face toward the viewer (cullBackFaces: ${cull})`, () => {
			const mesh = cube(FACES, cull);
			expect(rgbAt(drawProjected(mesh, VIEW), VIEW / 2, VIEW / 2)).toEqual([
				255, 0, 0,
			]);
		});

		it(`shows the other face once turned around (cullBackFaces: ${cull})`, () => {
			const mesh = cube(FACES, cull);
			mesh.rotate(Math.PI, new Vector3d(0, 1, 0));
			expect(rgbAt(drawProjected(mesh, VIEW), VIEW / 2, VIEW / 2)).toEqual([
				0, 0, 255,
			]);
		});
	}
});
