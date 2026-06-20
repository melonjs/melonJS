import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Color,
	game,
	Light3d,
	Stage,
	state,
	video,
} from "../src/index.js";
import Renderable from "../src/renderable/renderable.js";
import { MAX_LIGHTS } from "../src/video/webgl/lighting/constants.ts";
import { packMeshLights } from "../src/video/webgl/lighting/pack3d.ts";
import litFrag from "../src/video/webgl/shaders/mesh-lit.frag";

/**
 * Unit tests for the 3D mesh lighting primitives. Since 19.8 a `Light3d` is a
 * world {@link Renderable} (like `Light2d`): add it to the world and the active
 * stage auto-tracks it; the lit mesh batcher packs the stage's active 3D lights
 * each frame via {@link packMeshLights}. There is no `LightingEnvironment`.
 */
describe("Light3d", () => {
	it("is a Renderable (added to the world like Light2d)", () => {
		expect(new Light3d()).toBeInstanceOf(Renderable);
	});

	it("defaults: directional, white, intensity 1, +Y direction", () => {
		const l = new Light3d();
		expect(l.type).toBe("directional");
		expect(l.intensity).toBe(1);
		expect([l.color.r, l.color.g, l.color.b]).toEqual([255, 255, 255]);
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

	it("supports an ambient type (fill light, direction ignored)", () => {
		const l = new Light3d({ type: "ambient", intensity: 0.4 });
		expect(l.type).toBe("ambient");
		expect(l.intensity).toBe(0.4);
	});

	it("carries type + position for a future point release", () => {
		const l = new Light3d({ type: "point", position: [1, 2, 3] });
		expect(l.type).toBe("point");
		expect([l.position.x, l.position.y, l.position.z]).toEqual([1, 2, 3]);
	});
});

describe("Light3d ↔ Stage registration", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		const s = new Stage();
		state.set(state.DEFAULT, s);
		state.change(state.DEFAULT, true);
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("registers with the active stage when added to the world, deregisters when removed", () => {
		const stage = state.current();
		const light = new Light3d({ direction: [0, 1, 0] });
		game.world.addChild(light);
		expect(stage._activeLights3d.has(light)).toBe(true);
		// removeChildNow (not removeChild, which defers) fires onDeactivateEvent
		// synchronously so the deregistration is observable in-test
		game.world.removeChildNow(light);
		expect(stage._activeLights3d.has(light)).toBe(false);
	});
});

describe("packMeshLights", () => {
	it("null / empty input → zero lights, zero ambient", () => {
		const p = packMeshLights(null);
		expect(p.count).toBe(0);
		expect([p.ambient[0], p.ambient[1], p.ambient[2]]).toEqual([0, 0, 0]);
		expect(packMeshLights([]).count).toBe(0);
	});

	it("negates + normalizes direction, premultiplies color by intensity", () => {
		const p = packMeshLights([
			new Light3d({ direction: [0, 2, 0], color: [1, 0, 0], intensity: 2 }),
		]);
		expect(p.count).toBe(1);
		// surface→light = -travel, normalized: travel +Y → store -Y
		expect(p.directions[0]).toBeCloseTo(0, 5);
		expect(p.directions[1]).toBeCloseTo(-1, 5);
		expect(p.directions[2]).toBeCloseTo(0, 5);
		// color (1,0,0) × intensity 2
		expect(p.colors[0]).toBeCloseTo(2, 5);
		expect(p.colors[1]).toBeCloseTo(0, 5);
	});

	it("sums ambient lights into the ambient color (color × intensity)", () => {
		const p = packMeshLights([
			new Light3d({ type: "ambient", color: "#808080", intensity: 0.5 }),
		]);
		expect(p.count).toBe(0); // ambient is not a directional light
		expect(p.ambient[0]).toBeCloseTo((128 / 255) * 0.5, 2);
	});

	it("ADVERSARIAL: multiple ambient lights accumulate", () => {
		// white × 0.1 + white × 0.2 = 0.3 (intensities avoid color int rounding)
		const p = packMeshLights([
			new Light3d({ type: "ambient", color: "#ffffff", intensity: 0.1 }),
			new Light3d({ type: "ambient", color: "#ffffff", intensity: 0.2 }),
		]);
		expect(p.ambient[0]).toBeCloseTo(0.3, 5);
	});

	it("ADVERSARIAL: skips non-directional (point) lights", () => {
		const p = packMeshLights([
			new Light3d({ type: "point" }),
			new Light3d({ type: "directional" }),
		]);
		expect(p.count).toBe(1); // only the directional one
	});

	it("ADVERSARIAL: clamps to MAX_LIGHTS", () => {
		const lights = [];
		for (let i = 0; i < MAX_LIGHTS + 4; i++) {
			lights.push(new Light3d());
		}
		expect(packMeshLights(lights).count).toBe(MAX_LIGHTS);
	});

	it("ADVERSARIAL: reuses its buffers (later state overwrites)", () => {
		const light = new Light3d({ direction: [1, 0, 0], intensity: 1 });
		const p1 = packMeshLights([light]);
		expect(p1.directions[0]).toBeCloseTo(-1, 5);
		light.direction.set(0, 0, 1);
		const p2 = packMeshLights([light]);
		expect(p2.directions).toBe(p1.directions); // same Float32Array
		expect(p2.directions[2]).toBeCloseTo(-1, 5); // normalized + negated
	});

	it("ADVERSARIAL: a runtime non-unit direction is normalized in pack", () => {
		const light = new Light3d();
		light.direction.set(0, 0, 9); // not unit
		const p = packMeshLights([light]);
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
