import { describe, expect, it, vi } from "vitest";
import { ShaderEffect } from "../src/index.js";
import { buildGLSLProgram } from "../src/video/effects/glsl_realization.js";
import {
	hasSpliceMarkers,
	meshHostingBlocker,
	shiftGroup3,
	spliceEffect,
} from "../src/video/effects/mesh_splice.js";
import meshFragment from "../src/video/webgl/shaders/mesh.frag";
import litMeshFragment from "../src/video/webgl/shaders/mesh-lit.frag";
import meshWGSL from "../src/video/webgpu/shaders/mesh.wgsl";
import litMeshWGSL from "../src/video/webgpu/shaders/mesh-lit.wgsl";

/**
 * Hosting a ShaderEffect on a Mesh (#1658).
 *
 * A ShaderEffect is realized against the QUAD contract — its vertex stage
 * projects straight from `uProjectionMatrix` and declares neither
 * `uModelMatrix` nor `uViewMatrix` — so binding that program to a mesh draws
 * the geometry unplaced and without the camera. The body is therefore spliced
 * into the engine's OWN mesh shader at the identity hook those shaders carry,
 * which keeps placement, the alpha cutout, lighting and fog and makes the
 * effect a colour hook over the result.
 *
 * Device-free: the splice is pure text assembly, and that is where the
 * contract lives. The live draw paths keep their own backend-gated suites.
 */
describe("a ShaderEffect hosted on a Mesh (#1658)", () => {
	const GLSL_BODY = `
uniform float uTime;
vec4 apply(vec4 color, vec2 uv) {
	return vec4(color.rgb + uTime, color.a);
}
`;

	describe("the engine's mesh shaders declare the effect hook", () => {
		// Guards the reorganisation case: the hook lives in the shader sources
		// so it travels with the code around it, and a source that loses it
		// silently stops hosting effects. A comment could not do this job —
		// the shader pipeline strips comments before they reach the splicer.
		it.each([
			["mesh.frag", meshFragment],
			["mesh-lit.frag", litMeshFragment],
			["mesh.wgsl", meshWGSL],
			["mesh-lit.wgsl", litMeshWGSL],
		])("%s", (_name, source) => {
			expect(hasSpliceMarkers(source)).toBe(true);
		});

		it("reports a source without one rather than throwing", () => {
			expect(hasSpliceMarkers("void main(void) {}")).toBe(false);
			expect(spliceEffect("void main(void) {}", "body")).toBeNull();
		});
	});

	describe("the instanced variant keeps the hook", () => {
		// `buildInstancedMeshWGSL` assembles its module as
		// `slice(0, @vertex)` + a generated vertex stage + `slice(@fragment)`,
		// so anything declared BETWEEN the two stages is dropped. The hook was
		// defined there at first: the instanced module kept the CALL and lost
		// the DEFINITION, so every frame drawing an instanced lit mesh failed
		// with "unresolved call target 'ME_effect'" and was dropped — a
		// flickering scene on WebGPU, invisible to every device-free test.
		it.each([
			["mesh.wgsl", meshWGSL],
			["mesh-lit.wgsl", litMeshWGSL],
		])("%s declares ME_effect above @vertex", (_name, source) => {
			const hookAt = source.indexOf("fn ME_effect");
			const vertexAt = source.search(/^@vertex\b/m);
			expect(hookAt).toBeGreaterThan(-1);
			expect(vertexAt).toBeGreaterThan(-1);
			expect(hookAt).toBeLessThan(vertexAt);
		});

		it.each([
			["mesh.wgsl", meshWGSL],
			["mesh-lit.wgsl", litMeshWGSL],
		])("%s survives the instanced split with both halves", (_name, source) => {
			const vertexAt = source.search(/^@vertex\b/m);
			const fragmentAt = source.search(/^@fragment\b/m);
			// exactly how buildInstancedMeshWGSL slices it
			const kept = source.slice(0, vertexAt) + source.slice(fragmentAt);
			expect(kept).toContain("fn ME_effect");
			expect(kept).toMatch(/ME_effect\((?:color|base), in\.vRegion\)/);
		});
	});

	describe("splicing", () => {
		it("pastes the body and redefines the hook to call it", () => {
			const out = spliceEffect(meshFragment, GLSL_BODY);
			expect(out).toContain("vec4 apply(vec4 color, vec2 uv)");
			// the identity hook is redefined to call the body
			expect(out).toContain("return apply(c, uv);");
			// and the shader's own call site is untouched — it already names
			// the colour variable in scope
			expect(out).toContain("color = ME_effect(color, vRegion);");
		});

		it("uses the lit shader's own variable name", () => {
			const out = spliceEffect(litMeshFragment, GLSL_BODY);
			// mesh-lit.frag calls the hook on `base`, not `color`
			expect(out).toContain("base = ME_effect(base, vRegion);");
			expect(out).not.toContain("color = ME_effect(color, vRegion);");
		});

		it("keeps the mesh placement uniforms the quad realization lacks", () => {
			const spliced = spliceEffect(meshFragment, GLSL_BODY);
			// the whole point: the effect's own program declares neither, which
			// is what drew the mesh unplaced
			const quad = buildGLSLProgram(GLSL_BODY);
			expect(quad.vertex).not.toContain("uModelMatrix");
			expect(quad.vertex).not.toContain("uViewMatrix");
			// the spliced fragment is the mesh's, so the mesh vertex stage
			// (which declares them) is the one that pairs with it
			expect(spliced).toContain("uAlphaCutoff");
		});

		it("applies the effect BEFORE fog, so crests haze with distance", () => {
			const out = spliceEffect(meshFragment, GLSL_BODY);
			// against the CALL, not the definition: `applyFog` is declared
			// earlier in the shader than it is used
			expect(out.indexOf("color = ME_effect(color, vRegion);")).toBeLessThan(
				out.indexOf("gl_FragColor"),
			);
		});
	});

	describe("WGSL group-3 renumbering", () => {
		// `uMesh` occupies @group(3) @binding(0) on a mesh, which is exactly
		// where a quad effect declares its own uniform block.
		it("shifts the effect's uniform block off uMesh's binding", () => {
			const body = "@group(3) @binding(0) var<uniform> fx : Fx;";
			expect(shiftGroup3(body, 1)).toBe(
				"@group(3) @binding(1) var<uniform> fx : Fx;",
			);
		});

		it("shifts every declared binding, not just the first", () => {
			const body = [
				"@group(3) @binding(0) var<uniform> fx : Fx;",
				"@group(3) @binding(1) var t : texture_2d<f32>;",
				"@group(3) @binding(2) var s : sampler;",
			].join("\n");
			const out = shiftGroup3(body, 1);
			expect(out).toContain("@binding(1) var<uniform> fx");
			expect(out).toContain("@binding(2) var t");
			expect(out).toContain("@binding(3) var s");
			expect(out).not.toContain("@binding(0)");
		});

		it("leaves other groups alone", () => {
			const body = "@group(1) @binding(0) var uTexture : texture_2d<f32>;";
			expect(shiftGroup3(body, 1)).toBe(body);
		});

		it("tolerates the whitespace WGSL allows", () => {
			expect(
				shiftGroup3("@group( 3 )  @binding( 4 ) var s : sampler;", 1),
			).toBe("@group(3) @binding(5) var s : sampler;");
		});
	});

	describe("what a mesh cannot host", () => {
		it("accepts a plain body", () => {
			expect(meshHostingBlocker({}, [])).toBeNull();
		});

		it.each([
			["noiseUV", "noise_uv"],
			["screenUV", "screen_uv"],
			["screenTexture", "screen_texture"],
		])("refuses %s and names it", (flag, mentioned) => {
			const reason = meshHostingBlocker({ [flag]: true }, []);
			expect(reason).toContain(mentioned);
		});

		it("refuses a body with its own samplers, on both backends alike", () => {
			const reason = meshHostingBlocker({}, ["uNoise"]);
			expect(reason).toContain("texture samplers");
		});

		it("survives a missing builtins object", () => {
			expect(meshHostingBlocker(undefined, [])).toBeNull();
		});

		// `vColor` is language-split and so cannot sit in the shared table:
		// the GLSL mesh shaders declare `varying vec4 vColor` themselves, but
		// the WGSL module has no module-scope equivalent (the quad scaffold
		// shims one in). A WGSL body reading it assembles into a module that
		// fails to compile, and the mesh path has no validity fallback.
		it("refuses a WGSL body reading vColor", () => {
			expect(meshHostingBlocker({ vColor: true }, [], "wgsl")).toContain(
				"vColor",
			);
		});

		it("allows a GLSL body reading vColor — the mesh shaders declare it", () => {
			expect(meshHostingBlocker({ vColor: true }, [], "glsl")).toBeNull();
			expect(litMeshFragment).toContain("vColor");
			expect(meshFragment).toContain("vColor");
		});
	});

	describe("backward compatibility with 2D renderables", () => {
		// The quad realization must not shift by a byte: a ShaderEffect on a
		// Sprite/Text compiles exactly the program it always did.
		it("leaves the generated quad program untouched", () => {
			const program = buildGLSLProgram(GLSL_BODY);
			// the quad fragment still wraps apply() over its own sampling
			expect(program.fragment).toContain(
				"vec4 texColor = texture2D(uSampler, vRegion) * vColor;",
			);
			expect(program.fragment).toContain(
				"gl_FragColor = apply(texColor, vRegion);",
			);
			// and carries none of the mesh scaffolding
			expect(program.fragment).not.toContain("uAlphaCutoff");
			expect(program.fragment).not.toContain("ME_effect");
		});

		it("keeps the quad module byte-identical for a WGSL body", () => {
			const body = `
struct Fx { uTime : f32 };
@group(3) @binding(0) var<uniform> fx : Fx;
fn apply(color : vec4f, uv : vec2f) -> vec4f { return color * fx.uTime; }
`;
			const effect = new ShaderEffect(
				{ shaderLanguage: "wgsl" },
				{ wgsl: body },
			);
			const quad = effect.wgslRealization.code;
			// the quad module keeps the AUTHORED binding — only the mesh
			// realization renumbers, and building one must not disturb it
			expect(quad).toContain("@group(3) @binding(0) var<uniform> fx");
			const mesh = effect.wgslRealization.meshModule(meshWGSL);
			expect(mesh).toContain("@group(3) @binding(1) var<uniform> fx");
			expect(effect.wgslRealization.code).toBe(quad);
		});

		it("caches the mesh module per host source", () => {
			const body = `
fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
`;
			const effect = new ShaderEffect(
				{ shaderLanguage: "wgsl" },
				{ wgsl: body },
			);
			const first = effect.wgslRealization.meshModule(meshWGSL);
			expect(effect.wgslRealization.meshModule(meshWGSL)).toBe(first);
			// a different host (the lit tier) is its own module
			expect(effect.wgslRealization.meshModule(litMeshWGSL)).not.toBe(first);
		});
	});

	describe("the two GLSL mesh hosts are different dialects", () => {
		// Why the splice injects `#define texture2D texture` for the lit host:
		// every documented body idiom (and every `@example` on ShaderEffect)
		// samples with `texture2D`, which ES 3.00 removed. Without the alias a
		// body that works on a sprite and on an unlit mesh fails to compile the
		// moment it lands on a lit one.
		it("the unlit host is ES 1.00 and the lit host is ES 3.00", () => {
			expect(/^\s*#version\s+300\s+es/m.test(meshFragment)).toBe(false);
			expect(/^\s*#version\s+300\s+es/m.test(litMeshFragment)).toBe(true);
		});
	});

	describe("uniform values reach a hosted splice", () => {
		it("records every setUniform for replay onto the spliced program", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const effect = new ShaderEffect({ shaderLanguage: null }, GLSL_BODY);
			warn.mockRestore();
			// a disabled effect must keep no-oping rather than throw — the
			// Canvas-stub contract
			expect(() => {
				return effect.setUniform("uTime", 1);
			}).not.toThrow();
		});

		it("keeps the recorded value for a live GLSL effect", () => {
			const effect = new ShaderEffect(
				{ shaderLanguage: "glsl", gl: undefined },
				GLSL_BODY,
			);
			effect.setUniform("uTime", 2.5);
			expect(effect._uniformValues.get("uTime")).toBe(2.5);
		});

		// `setTime` writes STRAIGHT into whichever realization it finds rather
		// than going through `setUniform`, so without an explicit record the
		// value never reached a mesh-hosted splice — a different program,
		// brought up to date from this map when it binds. The WGSL path hid it
		// (its branch writes the CPU mirror the snapshot uploads), so on WebGL
		// a mesh effect's `uTime` sat frozen at 0 while the animated texture
		// underneath made it easy to miss.
		it("records setTime for replay, not just setUniform", () => {
			const effect = new ShaderEffect(
				{ shaderLanguage: "glsl", gl: undefined },
				GLSL_BODY,
			);
			effect.setTime(3.25);
			expect(effect._uniformValues.get("uTime")).toBe(3.25);
		});

		it("keeps setTime no-oping on a disabled effect", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const effect = new ShaderEffect({ shaderLanguage: null }, GLSL_BODY);
			warn.mockRestore();
			expect(() => {
				return effect.setTime(1);
			}).not.toThrow();
		});
	});
});
