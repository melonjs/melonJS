import { describe, expect, it } from "vitest";
import { Color, Light3d, LightingEnvironment } from "../src/index.js";
import { MAX_LIGHTS } from "../src/video/webgl/lighting/constants.ts";
import litFrag from "../src/video/webgl/shaders/mesh-lit.frag";

/**
 * Unit tests for the 3D mesh lighting primitives (Light3d + LightingEnvironment).
 * Pure JS — no WebGL needed (the shader path is exercised end-to-end in the
 * gltf example / Playwright).
 */
describe("Light3d", () => {
	it("defaults: directional, white, intensity 1, +Y direction", () => {
		const l = new Light3d();
		expect(l.type).toBe("directional");
		expect(l.intensity).toBe(1);
		expect(l.color.r).toBe(255);
		expect(l.color.g).toBe(255);
		expect(l.color.b).toBe(255);
		expect([l.direction.x, l.direction.y, l.direction.z]).toEqual([0, 1, 0]);
	});

	it("normalizes the direction on construction", () => {
		const l = new Light3d({ direction: [0, 5, 0] });
		expect(l.direction.length()).toBeCloseTo(1, 5);
		expect(l.direction.y).toBeCloseTo(1, 5);
	});

	it("accepts color as a CSS string", () => {
		const l = new Light3d({ color: "#ff0000" });
		expect([l.color.r, l.color.g, l.color.b]).toEqual([255, 0, 0]);
	});

	it("accepts color as a glTF [r,g,b] array in 0..1", () => {
		const l = new Light3d({ color: [1, 0.5, 0] });
		expect(l.color.r).toBe(255);
		expect(l.color.g).toBeGreaterThan(120); // ~127
		expect(l.color.b).toBe(0);
	});

	it("accepts color as a Color instance (passthrough)", () => {
		const c = new Color(10, 20, 30, 1);
		const l = new Light3d({ color: c });
		expect(l.color).toBe(c);
	});

	it("carries type + position for a future point release", () => {
		const l = new Light3d({ type: "point", position: [1, 2, 3] });
		expect(l.type).toBe("point");
		expect([l.position.x, l.position.y, l.position.z]).toEqual([1, 2, 3]);
	});
});

describe("LightingEnvironment", () => {
	it("add / remove / clear, with no duplicate adds", () => {
		const env = new LightingEnvironment();
		const a = new Light3d();
		env.addLight(a);
		env.addLight(a); // dup ignored
		expect(env.lights.length).toBe(1);
		env.addLight(new Light3d());
		expect(env.lights.length).toBe(2);
		env.removeLight(a);
		expect(env.lights.length).toBe(1);
		env.removeLight(a); // removing absent is safe
		expect(env.lights.length).toBe(1);
		env.clear();
		expect(env.lights.length).toBe(0);
	});

	it("exposes a shared default instance", () => {
		expect(LightingEnvironment.default).toBeInstanceOf(LightingEnvironment);
	});

	it("pack(): negates + normalizes direction, premultiplies color by intensity", () => {
		const env = new LightingEnvironment();
		env.addLight(
			new Light3d({ direction: [0, 2, 0], color: [1, 0, 0], intensity: 2 }),
		);
		const p = env.pack();
		expect(p.count).toBe(1);
		// surface→light = -travel, normalized: [0, 2, 0] → travel +Y → store -Y
		expect(p.directions[0]).toBeCloseTo(0, 5);
		expect(p.directions[1]).toBeCloseTo(-1, 5);
		expect(p.directions[2]).toBeCloseTo(0, 5);
		// color (1,0,0) × intensity 2
		expect(p.colors[0]).toBeCloseTo(2, 5);
		expect(p.colors[1]).toBeCloseTo(0, 5);
		expect(p.colors[2]).toBeCloseTo(0, 5);
	});

	it("pack(): ambient is color × ambientIntensity", () => {
		const env = new LightingEnvironment();
		env.setAmbient("#808080", 0.5); // 128/255 ≈ 0.502
		const p = env.pack();
		expect(p.ambient[0]).toBeCloseTo((128 / 255) * 0.5, 2);
	});

	it("ADVERSARIAL: pack() skips non-directional lights", () => {
		const env = new LightingEnvironment();
		env.addLight(new Light3d({ type: "point" }));
		env.addLight(new Light3d({ type: "directional" }));
		expect(env.pack().count).toBe(1); // only the directional one
	});

	it("ADVERSARIAL: pack() clamps to MAX_LIGHTS", () => {
		const env = new LightingEnvironment();
		for (let i = 0; i < MAX_LIGHTS + 4; i++) {
			env.addLight(new Light3d());
		}
		expect(env.pack().count).toBe(MAX_LIGHTS);
	});

	it("ADVERSARIAL: pack() reuses its buffers (later state overwrites)", () => {
		const env = new LightingEnvironment();
		const light = new Light3d({ direction: [1, 0, 0], intensity: 1 });
		env.addLight(light);
		const p1 = env.pack();
		expect(p1.directions[0]).toBeCloseTo(-1, 5);
		// mutate the light at runtime and re-pack — same buffer, new values
		light.direction.set(0, 0, 1);
		const p2 = env.pack();
		expect(p2.directions).toBe(p1.directions); // same Float32Array
		expect(p2.directions[0]).toBeCloseTo(0, 5);
		expect(p2.directions[2]).toBeCloseTo(-1, 5); // normalized + negated
	});

	it("ADVERSARIAL: a runtime non-unit direction is normalized in pack()", () => {
		const env = new LightingEnvironment();
		const light = new Light3d();
		light.direction.set(0, 0, 9); // not unit
		env.addLight(light);
		const p = env.pack();
		const len = Math.hypot(p.directions[0], p.directions[1], p.directions[2]);
		expect(len).toBeCloseTo(1, 5);
	});
});

describe("lit mesh shader — MAX_LIGHTS drift guard", () => {
	it("C2: sources the light-array size from the constant, not a hardcoded literal", () => {
		// the shader must carry the replacement token (resolved from MAX_LIGHTS
		// by LitMeshBatcher), so the GLSL array size can't drift from the packer
		expect(litFrag).toContain("__MAX_LIGHTS__");
		// replaceAll (not replace) — the token appears at multiple use sites and
		// the preprocessor may duplicate it; every one must be resolved or the
		// shader fails to compile ('undeclared identifier').
		const resolved = litFrag.replaceAll("__MAX_LIGHTS__", String(MAX_LIGHTS));
		expect(resolved).not.toContain("__MAX_LIGHTS__");
		expect(resolved).toContain(`uLightDir[${MAX_LIGHTS}]`);
	});
});
