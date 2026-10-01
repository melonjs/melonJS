import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Matrix3d, Mesh, TextureAtlas } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * `Mesh#depthTest` — opting a mesh out of being occluded.
 *
 * Depth TEST, not depth WRITE. The transparent pass already turns writing off
 * for everything blended, so overlapping transparent draws blend instead of
 * fighting under LEQUAL; that is engine policy and not a choice. Whether
 * geometry in front of a mesh HIDES it is a different question, and an
 * authoring one.
 *
 * The case that forced it: an additive glow is a screen-space effect wearing
 * a mesh's clothes, carrying a world position only so it can sort and move
 * with the thing it belongs to. Depth tested, a flat billboard is sliced
 * along a straight line the moment any geometry is nearer at some pixel —
 * most visibly where a glowing object passes near the limb of something
 * round, where no offset escapes it because the near surface bulges further
 * than any offset you would dare apply.
 *
 * Its own spec file, with its own renderer: the toggle is real GL state, and
 * a leak would surface as unrelated depth specs failing.
 */
describe("Mesh#depthTest", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	let sharedAtlas;
	const whiteAtlas = () => {
		if (sharedAtlas === undefined) {
			const tex = document.createElement("canvas");
			tex.width = 1;
			tex.height = 1;
			const ctx = tex.getContext("2d");
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, 1, 1);
			sharedAtlas = new TextureAtlas(
				{ framewidth: 1, frameheight: 1, image: tex, name: "white_1x1" },
				tex,
				false,
			);
		}
		return sharedAtlas;
	};

	const quad = (settings) => {
		return new Mesh(0, 0, {
			vertices: new Float32Array([-8, -8, 0, 8, -8, 0, 8, 8, 0, -8, 8, 0]),
			uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
			texture: whiteAtlas(),
			width: 16,
			height: 16,
			cullBackFaces: false,
			...settings,
		});
	};

	describe("the property", () => {
		it("defaults to true, so every existing mesh is unchanged", () => {
			expect(quad().depthTest).toBe(true);
		});

		it("is settable at construction and at runtime", () => {
			expect(quad({ depthTest: false }).depthTest).toBe(false);
			const m = quad();
			m.depthTest = false;
			expect(m.depthTest).toBe(false);
		});

		it("is independent of `transparent`, which is the WRITE half", () => {
			// the two are separate axes on purpose: a mesh may be transparent
			// and still want to be occluded, which is the common case
			const m = quad({ transparent: true });
			expect(m.depthTest).toBe(true);
		});
	});

	describe("the GL state it drives", () => {
		/** count DEPTH_TEST toggles across one blended draw */
		const togglesFor = (depthTest) => {
			const gl = renderer.gl;
			const mesh = quad({
				transparent: true,
				blendMode: "additive",
				depthTest,
			});
			const calls = { off: 0, on: 0 };
			const origEnable = gl.enable.bind(gl);
			const origDisable = gl.disable.bind(gl);
			gl.enable = (cap) => {
				if (cap === gl.DEPTH_TEST) {
					calls.on++;
				}
				return origEnable(cap);
			};
			gl.disable = (cap) => {
				if (cap === gl.DEPTH_TEST) {
					calls.off++;
				}
				return origDisable(cap);
			};
			try {
				// a model matrix, because only a RETAINED draw is routed into
				// the transparent pass; the queue replays by matrix
				renderer.drawMesh(mesh, new Matrix3d());
				renderer.flushTransparentPass();
			} finally {
				gl.enable = origEnable;
				gl.disable = origDisable;
			}
			return calls;
		};

		it("leaves the test ON by default, so a blended mesh is still occluded", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(togglesFor(true).off).toBe(0);
		});

		it("switches it off for a mesh that asks, and puts it back", (ctx) => {
			requireWebGL(ctx, renderer);
			// Off once for the entry, and re-enabled before the next one.
			// Leaking it would silently un-occlude every later mesh in the
			// frame, which is the failure the begin/end pairing prevents.
			const calls = togglesFor(false);
			expect(calls.off).toBe(1);
			expect(calls.on).toBeGreaterThanOrEqual(1);
		});
	});
});
