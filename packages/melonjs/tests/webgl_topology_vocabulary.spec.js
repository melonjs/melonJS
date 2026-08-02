import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WebGLBatcher } from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import { resolveTopology } from "../src/video/webgl/utils/topology.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Draw topology in both vocabularies (issue #1551).
 *
 * The reason this is worth testing carefully: a topology string that reaches
 * a GL draw call is coerced to `NaN` and then to `0` — and `GL_POINTS` *is*
 * `0`. So a missed translation does not throw, it silently renders the batch
 * as points. `PrimitiveBatcher`'s topology switch also falls through to
 * POINTS by default, so two independent paths agree on the same wrong answer,
 * which makes it look deliberate.
 */
describe("Batcher topology vocabulary (issue #1551)", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
		gl = renderer?.gl;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	// must declare the projection uniform: `bind()` pushes it, and GLShader
	// throws on an undeclared uniform
	const SHADER = {
		vertex:
			"attribute vec4 aVertex;\nuniform mat4 uProjectionMatrix;\nvoid main(void) { gl_Position = uProjectionMatrix * vec4(0.0, 0.0, 0.0, 1.0); }",
		fragment: "void main(void) { gl_FragColor = vec4(1.0); }",
	};

	/**
	 * A minimal batcher whose layout is irrelevant to these tests.
	 * @returns {Batcher} the batcher
	 */
	const build = () => {
		return new WebGLBatcher(renderer, {
			attributes: [{ name: "aVertex", format: "float32x3", offset: 0 }],
			shader: SHADER,
		});
	};

	describe("the mode / topology accessor pair", () => {
		it("defaults to triangles in both vocabularies", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build();
			expect(batcher.mode).toBe(gl.TRIANGLES);
			expect(batcher.topology).toBe("triangle-list");
		});

		it.for([
			["point-list", "POINTS"],
			["line-list", "LINES"],
			["line-strip", "LINE_STRIP"],
			["line-loop", "LINE_LOOP"],
			["triangle-list", "TRIANGLES"],
			["triangle-strip", "TRIANGLE_STRIP"],
			["triangle-fan", "TRIANGLE_FAN"],
		])("mode = %s reads back as gl.%s", ([topology, glName], ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build();
			batcher.mode = topology;
			expect(batcher.mode).toBe(gl[glName]);
			expect(batcher.topology).toBe(topology);
		});

		it.for([
			["POINTS", "point-list"],
			["LINES", "line-list"],
			["LINE_STRIP", "line-strip"],
			["LINE_LOOP", "line-loop"],
			["TRIANGLES", "triangle-list"],
			["TRIANGLE_STRIP", "triangle-strip"],
			["TRIANGLE_FAN", "triangle-fan"],
		])("mode = gl.%s names the topology %s", ([glName, topology], ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build();
			batcher.mode = gl[glName];
			expect(batcher.mode).toBe(gl[glName]);
			expect(batcher.topology).toBe(topology);
		});

		it("assigning through topology is equivalent to assigning mode", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build();
			batcher.topology = "line-strip";
			expect(batcher.mode).toBe(gl.LINE_STRIP);
			expect(batcher.topology).toBe("line-strip");

			batcher.topology = gl.TRIANGLE_FAN;
			expect(batcher.mode).toBe(gl.TRIANGLE_FAN);
			expect(batcher.topology).toBe("triangle-fan");
		});

		it("never silently becomes POINTS for a non-point topology", (ctx) => {
			requireWebGL(ctx, renderer);
			// the regression this whole design exists to prevent: without the
			// setter, `batcher.mode = "triangle-list"` coerces to 0 == POINTS
			// and the scene renders as points with no error anywhere
			const batcher = build();
			for (const topology of [
				"line-list",
				"line-strip",
				"line-loop",
				"triangle-list",
				"triangle-strip",
				"triangle-fan",
			]) {
				batcher.mode = topology;
				// the type check is the load-bearing one: an unnormalized
				// string is only coerced to 0 at the draw call, so comparing
				// the stored value against POINTS would pass while broken
				expect(typeof batcher.mode, topology).toBe("number");
				expect(batcher.mode, topology).not.toBe(gl.POINTS);
			}
		});

		it("keeps mode and topology in step through repeated assignment", (ctx) => {
			requireWebGL(ctx, renderer);
			// they derive from one private field, so they cannot desynchronise
			const batcher = build();
			for (const [value, expectedTopology] of [
				["line-list", "line-list"],
				[gl.TRIANGLES, "triangle-list"],
				["triangle-fan", "triangle-fan"],
				[gl.POINTS, "point-list"],
				["line-loop", "line-loop"],
			]) {
				batcher.mode = value;
				expect(batcher.topology).toBe(expectedTopology);
				// and the numeric side agrees with the name it reports
				expect(batcher.mode).toBe(resolveTopology(gl, expectedTopology));
			}
		});

		it("throws for an unrecognised topology rather than drawing points", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build();
			expect(() => {
				batcher.mode = "triangles";
			}).toThrow(/triangles/);
			expect(() => {
				batcher.topology = "nonsense";
			}).toThrow(/nonsense/);
			// and the previous value survives a rejected assignment
			expect(batcher.mode).toBe(gl.TRIANGLES);
		});
	});

	describe("flush accepts both vocabularies", () => {
		it("passes the same GL mode to drawArrays either way", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build();
			batcher.bind();
			// one vertex so the flush actually issues a draw
			const spy = vi.spyOn(gl, "drawArrays").mockImplementation(() => {});
			try {
				batcher.vertexData.push(0, 0, 0);
				batcher.flush("line-list");
				batcher.vertexData.push(0, 0, 0);
				batcher.flush(gl.LINES);
				const modes = spy.mock.calls.map((c) => {
					return c[0];
				});
				expect(modes.length).toBeGreaterThanOrEqual(2);
				expect(new Set(modes)).toEqual(new Set([gl.LINES]));
			} finally {
				spy.mockRestore();
			}
		});
	});

	describe("QuadBatcher.flush accepts both vocabularies", () => {
		// this override does not chain to super.flush and issues its own
		// drawElements, so it normalizes independently — and nothing else
		// covers it. Without this, deleting that one line leaves every sprite
		// batch drawing as points with a green suite.
		it("passes the same GL mode to drawElements either way", (ctx) => {
			requireWebGL(ctx, renderer);
			const quad = renderer.batchers.get("quad");
			renderer.setBatcher("quad");
			const seen = [];
			const orig = gl.drawElements.bind(gl);
			gl.drawElements = (mode, ...rest) => {
				seen.push(mode);
				return orig(mode, ...rest);
			};
			try {
				const tex = Renderer.createCanvas(8, 8);
				renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
				quad.flush("triangle-list");
				renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
				quad.flush(gl.TRIANGLES);
			} finally {
				gl.drawElements = orig;
			}
			expect(seen.length).toBeGreaterThanOrEqual(2);
			// every draw used TRIANGLES; an unnormalized string would be 0
			expect(new Set(seen)).toEqual(new Set([gl.TRIANGLES]));
			expect(seen).not.toContain(gl.POINTS);
		});
	});

	describe("PrimitiveBatcher.drawVertices accepts both vocabularies", () => {
		/**
		 * Draw a triangle through the primitive batcher and capture the GL
		 * primitive mode of every resulting draw call.
		 * @param {string|number} mode - the topology to draw with
		 * @param {Array<object>} [verts] - override the default vertex list
		 * @returns {Array<number>} the modes seen at the GL boundary
		 */
		const modesFor = (mode, verts = undefined) => {
			const batcher = renderer.batchers.get("primitive");
			renderer.setBatcher("primitive");
			const seen = [];
			const origArrays = gl.drawArrays.bind(gl);
			gl.drawArrays = (m, ...rest) => {
				seen.push(m);
				return origArrays(m, ...rest);
			};
			try {
				batcher.drawVertices(
					mode,
					verts ?? [
						{ x: 0, y: 0 },
						{ x: 8, y: 0 },
						{ x: 8, y: 8 },
					],
				);
				batcher.flush();
			} finally {
				gl.drawArrays = origArrays;
			}
			return seen;
		};

		it.for([
			["triangle-list", "TRIANGLES"],
			["line-list", "LINES"],
			["line-strip", "LINE_STRIP"],
			["point-list", "POINTS"],
		])(
			"drawing with %s issues the same GL mode as gl.%s",
			([topology, glName], ctx) => {
				requireWebGL(ctx, renderer);
				const viaString = modesFor(topology);
				const viaEnum = modesFor(gl[glName]);
				expect(viaString).toEqual(viaEnum);
				expect(viaString.length).toBeGreaterThan(0);
				// and it is genuinely the requested mode, not the POINTS fallback
				expect(
					viaString.every((m) => {
						return m === gl[glName];
					}),
				).toBe(true);
			},
		);

		it("routes line-loop through the closing-segment path exactly like the enum", (ctx) => {
			requireWebGL(ctx, renderer);
			// line-loop is emulated as a strip plus a closing vertex; the
			// string must take the same branch, not fall through to POINTS
			expect(modesFor("line-loop")).toEqual(modesFor(gl.LINE_LOOP));
		});

		it("still expands thick lines when given the string form", (ctx) => {
			requireWebGL(ctx, renderer);
			// the lineWidth > 1 branch tests `mode === gl.LINES`; an
			// unnormalized string would skip expansion silently
			// an even vertex count: the expansion walks the list in pairs
			const segment = [
				{ x: 0, y: 0 },
				{ x: 8, y: 0 },
				{ x: 8, y: 8 },
				{ x: 0, y: 8 },
			];
			const previous = renderer.lineWidth;
			renderer.lineWidth = 4;
			try {
				const viaString = modesFor("line-list", segment);
				const viaEnum = modesFor(gl.LINES, segment);
				expect(viaString).toEqual(viaEnum);
				// expansion turns lines into triangles; if the string form had
				// skipped that branch the modes would differ
				expect(viaString).toContain(gl.TRIANGLES);
			} finally {
				renderer.lineWidth = previous;
			}
		});
	});
});
