import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Mesh } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Mesh-texture mipmaps on the WebGL backend: `createTexture2D` has always
 * generated the chain for plain image uploads — the mesh path now samples
 * it, upgrading the texture's min filter to trilinear on first mesh use.
 * "nearest" meshes opt out (crisp pixel-art models), and the upgrade is
 * mesh-path-only: sprite-created textures keep their plain min filter.
 */
describe("WebGL mesh texture mipmaps", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeTexturedMesh = (settings = {}) => {
		const canvas = document.createElement("canvas");
		canvas.width = 32;
		canvas.height = 32;
		canvas.getContext("2d").fillRect(0, 0, 32, 32);
		return new Mesh(0, 0, {
			vertices: [-8, -8, 0, 8, -8, 0, 8, 8, 0, -8, 8, 0],
			uvs: [0, 0, 1, 0, 1, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			width: 16,
			height: 16,
			texture: canvas,
			...settings,
		});
	};

	const boundMinFilter = () => {
		const gl = renderer.gl;
		return gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER);
	};

	it("a linear-filtered mesh texture upgrades to trilinear minification (+ anisotropy)", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const mesh = makeTexturedMesh({ textureFilter: "linear" });
		try {
			renderer.drawMesh(mesh);
			// applyMeshMaterial leaves the mesh texture bound on the active
			// unit — the chain generated at upload is now actually sampled
			expect(boundMinFilter()).toBe(gl.LINEAR_MIPMAP_LINEAR);
			// and anisotropic where the driver offers it (headless software
			// rasterizers may not — the upgrade is best-effort)
			const ext = gl.getExtension("EXT_texture_filter_anisotropic");
			if (ext) {
				expect(
					gl.getTexParameter(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT),
				).toBeGreaterThan(1);
			}
		} finally {
			renderer.deleteMeshGeometry?.(mesh);
		}
	});

	it("a nearest-filtered mesh keeps hard level-0 minification (opt-out)", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const mesh = makeTexturedMesh({ textureFilter: "nearest" });
		try {
			renderer.drawMesh(mesh);
			expect(boundMinFilter()).toBe(gl.NEAREST);
		} finally {
			renderer.deleteMeshGeometry?.(mesh);
		}
	});

	it("a TextureResource-backed source keeps plain LINEAR (no generated chain to sample)", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const mesh = makeTexturedMesh({ textureFilter: "linear" });
		// a resource-owned upload: `createTexture2D` skips generateMipmap
		// for these, so a mipmap min filter would be mipmap-incomplete
		// under ES3 and sample opaque black
		mesh.texture.getTexture = () => {
			return {
				width: 32,
				height: 32,
				upload() {},
			};
		};
		try {
			renderer.drawMesh(mesh);
			expect(boundMinFilter()).toBe(gl.LINEAR);
		} finally {
			renderer.deleteMeshGeometry?.(mesh);
		}
	});

	it("a video texture re-applies the trilinear upgrade after a forced re-upload", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const mesh = makeTexturedMesh({ textureFilter: "linear" });
		// video-shaped source with no decoded frame: the frameless guard
		// allocates blank (generateMipmap still runs), and the per-frame
		// forced re-upload resets MIN_FILTER back to LINEAR each time
		mesh.texture.getTexture = () => {
			return {
				width: 0,
				height: 0,
				videoWidth: 32,
				videoHeight: 32,
				readyState: 0,
			};
		};
		try {
			renderer.drawMesh(mesh);
			expect(boundMinFilter()).toBe(gl.LINEAR_MIPMAP_LINEAR);
			// simulate the video path's per-frame forced re-upload (resets
			// the min filter), then draw the mesh again
			renderer.currentBatcher.uploadTexture(
				mesh.texture,
				undefined,
				undefined,
				true,
				true,
				mesh.textureRepeat,
			);
			expect(boundMinFilter()).toBe(gl.LINEAR);
			renderer.drawMesh(mesh);
			// videos bypass the once-per-texture cache — upgraded again
			expect(boundMinFilter()).toBe(gl.LINEAR_MIPMAP_LINEAR);
		} finally {
			renderer.deleteMeshGeometry?.(mesh);
		}
	});
});
