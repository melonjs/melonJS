import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Sprite } from "../src/index.js";
import { buildLitMultiTextureFragment } from "../src/video/webgl/shaders/multitexture-lit.js";
import litQuadVertex from "../src/video/webgl/shaders/quad-multi-lit.vert?raw";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Specular highlights on 2D sprites.
 *
 * A normal map tells the light which way each texel FACES, which gives a
 * sprite shape. Shininess decides whether it also SHINES: a highlight only
 * appears where a texel happens to reflect a light toward the screen, so it
 * slides across the surface as the light moves rather than the whole sprite
 * brightening.
 *
 * The contract is per QUAD, carried on a vertex attribute, and gated on the
 * exponent exactly as the mesh path gates on MTL `Ns` — so every sprite that
 * never opts in runs the maths it always did. That regression guard is the
 * most important thing in this file.
 */
describe("2D specular", () => {
	let renderer;

	beforeAll(async () => {
		boot();
		renderer = await getWebGLRenderer(64, 64);
	});

	afterAll(() => {
		// hand the shared context back so the next spec file does not
		// inherit our batcher selection
		releaseWebGLRenderer();
	});

	describe("the Sprite property", () => {
		/**
		 * @param {object} [extra] - settings merged over the minimum
		 * @returns {Sprite} a sprite over a tiny canvas source
		 */
		const sprite = (extra = {}) => {
			const image = document.createElement("canvas");
			image.width = image.height = 8;
			return new Sprite(0, 0, { image, ...extra });
		};

		it("defaults to 0 — matte, which is every existing sprite", () => {
			expect(sprite().shininess).toBe(0);
		});

		it("is read from settings", () => {
			expect(sprite({ shininess: 64 }).shininess).toBe(64);
		});

		it("rides the renderer's per-sprite slot, and clears with the normal map", () => {
			// it travels WITH the map because it is meaningless without one:
			// no surface directions, nothing to reflect
			// the real renderer — chasing stub methods for `super.preDraw`
			// tests the stub, not the engine
			const stub = renderer;
			stub.currentNormalMap = null;
			stub.currentShininess = 0;
			const s = sprite({ shininess: 32 });
			s._normalMap = { width: 4, height: 4 };
			s.preDraw(stub);
			expect(stub.currentShininess).toBe(32);
			expect(stub.currentNormalMap).toBe(s._normalMap);
			s.postDraw(stub);
			expect(stub.currentShininess).toBe(0);
			expect(stub.currentNormalMap).toBe(null);
		});

		it("REGRESSION: a sprite with no normal map touches neither slot", () => {
			// the pairing is what keeps an opted-out sprite off the lit path
			// the real renderer — chasing stub methods for `super.preDraw`
			// tests the stub, not the engine
			const stub = renderer;
			stub.currentNormalMap = null;
			stub.currentShininess = 0;
			const s = sprite({ shininess: 99 });
			s.preDraw(stub);
			expect(stub.currentShininess).toBe(0);
			expect(stub.currentNormalMap).toBe(null);
		});
	});

	describe("the vertex layout", () => {
		it("writes the exponent into the layout's last slot, after the frame", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.setBatcher("litQuad");
			batcher.vertexData.clear();
			const size = batcher.vertexData.vertexSize;
			// the two-float aFrame fifth, as in every sprite layout, then
			// aNormalTextureId and aShininess
			expect(size).toBe(11);

			batcher.vertexData.pushSprite(
				1,
				2,
				0,
				0,
				0,
				0xffffffff,
				0,
				0.25,
				0.5,
				3,
				48,
			);
			const f32 = batcher.vertexData.bufferF32;
			expect([f32[7], f32[8]]).toEqual([0.25, 0.5]);
			expect(f32[9]).toBe(3);
			expect(f32[10]).toBe(48);
		});

		it("REGRESSION: an unlit sprite carries -1 for its normal map and 0 for its exponent", (ctx) => {
			requireWebGL(ctx, renderer);
			// -1 is the "no normal map" sentinel the shader's unlit path keys
			// on, 0 a matte exponent; the two differ on purpose, as a
			// negative exponent reaching `pow()` would explode, and 0 for
			// the normal map would shade an unlit sprite with whatever sits
			// in slot 0
			const batcher = renderer.setBatcher("litQuad");
			batcher.vertexData.clear();
			// poison both slots: `clear()` only resets the vertex count, so
			// a build that never wrote them would still read 0 there
			batcher.vertexData.bufferF32[9] = -999;
			batcher.vertexData.bufferF32[10] = -999;
			renderer.currentShininess = undefined;
			const image = document.createElement("canvas");
			image.width = image.height = 8;
			batcher.addQuad(
				renderer.cache.get(image),
				0,
				0,
				8,
				8,
				0,
				0,
				1,
				1,
				0xffffffff,
				false,
				null,
			);
			expect(batcher.vertexData.bufferF32[9]).toBe(-1);
			expect(batcher.vertexData.bufferF32[10]).toBe(0);
			batcher.vertexData.clear();
			renderer.currentShininess = 0;
		});

		it("REGRESSION: the lit terms stay off the unlit quad layout", (ctx) => {
			requireWebGL(ctx, renderer);
			// widening the shared layout would charge every unlit sprite in
			// the engine 4 bytes a vertex for each term it never evaluates
			const quad = renderer.setBatcher("quad");
			const lit = renderer.setBatcher("litQuad");
			const names = quad.attributes.map((a) => {
				return a.name;
			});
			expect(names).not.toContain("aNormalTextureId");
			expect(names).not.toContain("aShininess");
			// the normal map slot and the exponent, and nothing else
			expect(lit.stride - quad.stride).toBe(8);
		});
	});

	describe("the shader", () => {
		const fragment = buildLitMultiTextureFragment(4);

		it("gates the term on the exponent", () => {
			// zero is matte however bright the light, so a sprite that never
			// opts in runs exactly the maths it always did
			expect(fragment).toContain("if (vShininess > 0.0)");
		});

		it("ADDS the highlight rather than multiplying it into the albedo", () => {
			// a highlight is light reflected OFF the surface, not the
			// surface's own colour lit up — which is why it blows out to
			// white on a dark sprite instead of tinting with it
			expect(fragment).toContain("color.rgb * lighting + specular");
			expect(fragment).not.toContain("color.rgb * (lighting + specular)");
			// ...but weighted by the sprite's own alpha, or a shiny sprite
			// paints an additive glow across its cut-out: the pipeline is
			// premultiplied, so `color.rgb` self-cancels where alpha is 0 and
			// an unweighted highlight would not
			expect(fragment).toContain("specular * color.a");
		});

		it("uses a CONSTANT view vector — the thing that makes 2D sound", () => {
			// a sprite lies in the screen plane and the camera looks straight
			// down -Z at it, so there is no per-fragment world position to get
			// wrong (the reason this cannot be done for a mesh under a 2D
			// camera, see #1576)
			expect(fragment).toContain("vec3(0.0, 0.0, 1.0)");
		});

		it("masks per texel from the normal map's alpha", () => {
			// free — the sample is already taken — and intact, because normal
			// maps upload with premultiplied alpha OFF
			expect(fragment).toContain("float specMask = normalSample.a;");
		});

		it("gates on the surface facing the light", () => {
			// without it a back-facing texel whose half-vector happens to line
			// up picks up a highlight from a light behind it
			expect(fragment).toContain("float facing = step(0.0001, NdotL);");
		});

		it("declares the attribute and varying end to end", () => {
			expect(litQuadVertex).toContain("in float aShininess;");
			expect(litQuadVertex).toContain("vShininess = aShininess;");
			expect(fragment).toContain("in float vShininess;");
		});
	});
});
