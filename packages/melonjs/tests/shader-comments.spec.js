/**
 * The shaders are bundled as text, which no minifier reads: their comments
 * are taken out when the engine is built (`scripts/build.ts`), by
 * `stripShaderComments`. The tests load them through the same function
 * (`vitest.config.ts`), so what is compiled here is what ships.
 */
import { describe, expect, it } from "vitest";
import { stripShaderComments } from "../scripts/strip-shader-comments.ts";
import meshLitFragment from "../src/video/webgl/shaders/mesh-lit.frag";
import quadVertex from "../src/video/webgl/shaders/quad.vert";
import tileLayerFragment from "../src/video/webgl/shaders/tmxlayer-common.frag";
import meshLitWGSL from "../src/video/webgpu/shaders/mesh-lit.wgsl";
import quadWGSL from "../src/video/webgpu/shaders/quad.wgsl";
import tileLayerWGSL from "../src/video/webgpu/shaders/tmxlayer-common.wgsl";

describe("stripShaderComments", () => {
	it("takes out a line comment, with the spaces before it", () => {
		expect(stripShaderComments("float a = 1.0; // one\nfloat b;")).toBe(
			"float a = 1.0;\nfloat b;",
		);
	});

	it("takes out a comment that is the whole line, and keeps the line", () => {
		expect(stripShaderComments("a;\n\t// note\nb;")).toBe("a;\n\nb;");
	});

	it("takes out a block comment, and keeps its line breaks", () => {
		const source = "a;\n/**\n * two\n * lines\n */\nb;";
		const stripped = stripShaderComments(source);
		expect(stripped).toBe("a;\n\n\n\n\nb;");
		// every line of the result is the same line of the source
		expect(stripped.split("\n")).toHaveLength(source.split("\n").length);
		expect(stripped.split("\n")[5]).toBe("b;");
	});

	it("does not glue the words either side of a block comment together", () => {
		expect(stripShaderComments("int/* count */n;")).toBe("int n;");
		expect(stripShaderComments("int /* count */ n;")).toBe("int  n;");
	});

	it("a `/*` inside a line comment opens nothing", () => {
		// taken as a block comment, it would run on to the next `*/` and eat
		// the code in between
		expect(stripShaderComments("a; // see x/*y\nb;\nc; /* d */\ne;")).toBe(
			"a;\nb;\nc;\ne;",
		);
	});

	it("a `//` inside a block comment ends nothing", () => {
		expect(stripShaderComments("a; /* http://x // y */ b;\nc;")).toBe(
			"a;  b;\nc;",
		);
	});

	it("keeps every preprocessor directive on its own line", () => {
		const source = [
			"#version 300 es // the version",
			"/* precision */",
			"precision highp float;",
			"#ifdef LIT // optional",
			"#define COUNT 4",
			"#endif",
		].join("\n");
		expect(stripShaderComments(source).split("\n")).toEqual([
			"#version 300 es",
			"",
			"precision highp float;",
			"#ifdef LIT",
			"#define COUNT 4",
			"#endif",
		]);
	});

	it("leaves a division, and source with no comment, as they are", () => {
		const source = "float h = a / b / 2.0;\nfloat k = a /b;\n";
		expect(stripShaderComments(source)).toBe(source);
		expect(stripShaderComments("")).toBe("");
	});

	it("an unfinished block comment is left, for the compiler to refuse", () => {
		expect(stripShaderComments("a; /* never closed\nb;")).toBe(
			"a; /* never closed\nb;",
		);
	});
});

describe("the shaders the tests compile", () => {
	const shaders = {
		"quad.vert": quadVertex,
		"mesh-lit.frag": meshLitFragment,
		"tmxlayer-common.frag": tileLayerFragment,
		"quad.wgsl": quadWGSL,
		"mesh-lit.wgsl": meshLitWGSL,
		"tmxlayer-common.wgsl": tileLayerWGSL,
	};

	for (const [name, source] of Object.entries(shaders)) {
		it(`${name} carries no comment`, () => {
			expect(typeof source).toBe("string");
			expect(source.length).toBeGreaterThan(100);
			expect(source).not.toMatch(/\/\/|\/\*|\*\//);
		});
	}

	it("mesh-lit.frag still has the token its batcher fills in", () => {
		// the comment that explains `__MAX_LIGHTS__` is gone, its uses are not
		expect(meshLitFragment.match(/__MAX_LIGHTS__/g)).toHaveLength(2);
	});
});
