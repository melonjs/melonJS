import { describe, expect, it } from "vitest";
import { extractAttributes } from "../src/video/webgl/utils/attributes.js";
import { injectDefines, minify } from "../src/video/webgl/utils/string.js";

/**
 * Shader-source manipulation, pinned as pure functions — no GL context
 * needed, so these run everywhere and cost nothing.
 *
 * Both cases here are real bugs found while building the instanced mesh
 * shader variants (#1508), and both fail *silently* when wrong: a shader
 * that will not compile leaves the draw with no program (nothing renders,
 * no exception), and an attribute map that disagrees with the linked
 * program points vertex data at the wrong locations (garbage geometry, no
 * error).
 */
describe("injectDefines", () => {
	// what an ES 1.00 source looks like: no #version line at all
	const ES100 = "attribute vec3 aVertex;\nvoid main(void) {}\n";
	// ES 3.00 REQUIRES #version to be the very first statement
	const ES300 = "#version 300 es\nin vec3 aVertex;\nvoid main(void) {}\n";
	const DEFINES = "#define INSTANCE_COLORS\n#define INSTANCE_DATA\n";

	it("returns the source untouched when there is nothing to inject", () => {
		expect(injectDefines(ES300, "")).toBe(ES300);
		expect(injectDefines(ES100, "")).toBe(ES100);
	});

	it("puts defines at the very top of a source with no #version", () => {
		expect(injectDefines(ES100, DEFINES)).toBe(DEFINES + ES100);
	});

	it("keeps #version first and puts the defines AFTER it", () => {
		// the bug: prepending would produce `#define…` before `#version`,
		// which is a compile error on every ES 3.00 shader — and a shader
		// that fails to compile renders nothing rather than throwing
		const result = injectDefines(ES300, DEFINES);
		expect(result.startsWith("#version 300 es\n")).toBe(true);
		expect(result).toBe(
			"#version 300 es\n" + DEFINES + "in vec3 aVertex;\nvoid main(void) {}\n",
		);
		// the first non-empty line is still the version directive
		const firstLine = result
			.split("\n")
			.find((line) => {
				return line.trim() !== "";
			})
			.trim();
		expect(firstLine).toBe("#version 300 es");
	});

	it("handles a #version line with a trailing comment or padding", () => {
		const padded = "#version 300 es   // GLSL ES 3.00\nin vec3 aVertex;\n";
		const result = injectDefines(padded, DEFINES);
		expect(result.startsWith("#version 300 es   // GLSL ES 3.00\n")).toBe(true);
		expect(result.indexOf("#define")).toBeGreaterThan(
			result.indexOf("#version"),
		);
	});

	it("tolerates leading blank lines before #version", () => {
		const lead = "\n\n#version 300 es\nin vec3 aVertex;\n";
		const result = injectDefines(lead, DEFINES);
		// whatever precedes #version is preserved verbatim, and the defines
		// still land after the directive rather than before it
		expect(result.indexOf("#define")).toBeGreaterThan(
			result.indexOf("#version"),
		);
		expect(result.startsWith("\n\n#version 300 es\n")).toBe(true);
	});

	it("preserves define order", () => {
		const result = injectDefines(ES300, DEFINES);
		expect(result.indexOf("INSTANCE_COLORS")).toBeLessThan(
			result.indexOf("INSTANCE_DATA"),
		);
	});

	it("only ever treats a LEADING #version as the directive", () => {
		// `#version` mentioned in a comment further down is not a directive,
		// and must not be mistaken for the insertion point
		const source = "in vec3 aVertex;\n// mentions #version 300 es in prose\n";
		expect(injectDefines(source, DEFINES)).toBe(DEFINES + source);
	});

	it("survives minify, which the compile path applies afterwards", () => {
		// minify deliberately preserves newlines so preprocessor directives
		// stay on their own lines — if that ever changed, every #ifdef in the
		// mesh shaders would collapse onto one line and stop working
		const minified = minify(injectDefines(ES300, DEFINES));
		expect(minified).toContain("#version 300 es\n");
		expect(minified).toContain("#define INSTANCE_COLORS\n");
		expect(minified).toContain("#define INSTANCE_DATA\n");
	});

	it("keeps #ifdef blocks intact through minify", () => {
		const guarded = [
			"#version 300 es",
			"#ifdef INSTANCE_DATA",
			"in vec4 vInstanceData;",
			"#endif",
			"void main(void) {}",
		].join("\n");
		const minified = minify(guarded);
		expect(minified).toContain("#ifdef INSTANCE_DATA\n");
		expect(minified).toContain("#endif\n");
	});
});

describe("extractAttributes", () => {
	const shaderOf = (vertex) => {
		// extractAttributes only reads `.vertex` off the shader object
		return { vertex };
	};

	it("numbers attributes by declaration order, both GLSL dialects", () => {
		expect(
			extractAttributes(
				null,
				shaderOf("attribute vec3 aVertex;\nattribute vec2 aRegion;\n"),
			),
		).toEqual({ aVertex: 0, aRegion: 1 });
		expect(
			extractAttributes(null, shaderOf("in vec3 aVertex;\nin vec4 aColor;\n")),
		).toEqual({ aVertex: 0, aColor: 1 });
	});

	it("counts #ifdef-guarded declarations too — known, and load-bearing", () => {
		// This is a regex over the SOURCE, not a query of the linked program,
		// so a guarded-out attribute still gets a number. That is benign but
		// non-obvious, and it is why an "is this attribute present?" check must
		// ask GL (`gl.getAttribLocation(program, name)`) rather than this map:
		// `bindAttribLocation` on a name the program does not declare is
		// silently ignored, so the numbering stays self-consistent while the
		// map claims slots the program never uses.
		const attributes = extractAttributes(
			null,
			shaderOf(
				[
					"#version 300 es",
					"in vec3 aVertex;",
					"in vec4 aInstanceRow0;",
					"#ifdef INSTANCE_COLORS",
					"in vec4 aInstanceColor;",
					"#endif",
					"#ifdef INSTANCE_DATA",
					"in vec4 aInstanceData;",
					"#endif",
				].join("\n"),
			),
		);
		expect(attributes).toEqual({
			aVertex: 0,
			aInstanceRow0: 1,
			aInstanceColor: 2,
			aInstanceData: 3,
		});
	});

	it("assigns each name a DISTINCT location, guarded or not", () => {
		// two names sharing a location would fail to link — the failure mode
		// this numbering has to avoid
		const attributes = extractAttributes(
			null,
			shaderOf(
				[
					"in vec3 aVertex;",
					"in vec2 aRegion;",
					"in vec4 aColor;",
					"in vec3 aNormal;",
					"in vec4 aInstanceRow0;",
					"in vec4 aInstanceRow1;",
					"in vec4 aInstanceRow2;",
					"#ifdef INSTANCE_COLORS",
					"in vec4 aInstanceColor;",
					"#endif",
					"#ifdef INSTANCE_DATA",
					"in vec4 aInstanceData;",
					"#endif",
				].join("\n"),
			),
		);
		const locations = Object.values(attributes);
		expect(new Set(locations).size).toBe(locations.length);
		// and the highest stays inside the guaranteed minimum of 16 attribute
		// slots even with every optional slot counted — the fullest instanced
		// lit layout is 9 declarations
		expect(Math.max(...locations)).toBeLessThan(16);
	});

	it("ignores `in` inside a function parameter list", () => {
		// only a line-leading qualifier is a vertex attribute; the same word
		// appears in parameter lists, where it means something else entirely
		const attributes = extractAttributes(
			null,
			shaderOf(
				[
					"in vec3 aVertex;",
					"vec4 shade(in vec3 normal, in vec4 color) { return color; }",
				].join("\n"),
			),
		);
		expect(attributes).toEqual({ aVertex: 0 });
	});
});
