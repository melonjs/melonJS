import { describe, expect, it, vi } from "vitest";
import { Container, Renderable } from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import RenderTargetPool from "../src/video/rendertarget/render_target_pool.js";

/**
 * When the warm-up runs, and for what.
 *
 * It is triggered from two places a game already goes through: attaching
 * an effect, and adding a renderable to the world. Both must stay cheap and
 * silent — a warm-up that throws or runs synchronously inside the caller's
 * code would turn a stutter fix into a new way to break a frame — and both
 * must honour the `prewarm` setting that the loading-screen warm-up does.
 */

/** a bare base renderer whose warm entry points record their calls */
function makeRenderer(prewarm = true) {
	const renderer = Object.create(Renderer.prototype);
	renderer.settings = { prewarm };
	renderer.shaderLanguage = "glsl";
	renderer.calls = { effects: [], draws: [], blends: 0 };
	renderer._warmPostEffects = (r) => {
		renderer.calls.effects.push(r);
	};
	renderer._warmDraw = (r) => {
		renderer.calls.draws.push(r);
	};
	renderer._warmAdvancedBlend = () => {
		renderer.calls.blends++;
	};
	return renderer;
}

/** let a queued microtask run */
const tick = () => {
	return Promise.resolve();
};

describe("warm-up scheduling", () => {
	it("runs after the caller's code, not inside it", async () => {
		const renderer = makeRenderer();
		const host = { postEffects: [{}], blendMode: "normal" };
		renderer._queueWarm(host);
		// the caller may still be setting the blend mode, size, parent...
		expect(renderer.calls.draws).toHaveLength(0);
		await tick();
		expect(renderer.calls.effects).toEqual([host]);
		expect(renderer.calls.draws).toEqual([host]);
	});

	it("warms a renderable once however often it was queued in one task", async () => {
		const renderer = makeRenderer();
		const host = { postEffects: [{}, {}], blendMode: "normal" };
		renderer._queueWarm(host);
		renderer._queueWarm(host);
		await tick();
		expect(renderer.calls.effects).toHaveLength(1);
	});

	it("does nothing on a backend without shaders", async () => {
		const renderer = makeRenderer();
		renderer.shaderLanguage = null;
		renderer._queueWarm({ postEffects: [{}], blendMode: "overlay" });
		await tick();
		expect(renderer.calls.draws).toHaveLength(0);
		expect(renderer.calls.blends).toBe(0);
	});

	it("does nothing with the prewarm setting off", async () => {
		const renderer = makeRenderer(false);
		renderer._queueWarm({ postEffects: [{}], blendMode: "normal" });
		await tick();
		expect(renderer.calls.effects).toHaveLength(0);
		expect(renderer.calls.draws).toHaveLength(0);
	});

	it("keeps going past a warm-up that throws, and throws nothing", async () => {
		const renderer = makeRenderer();
		const bad = { postEffects: [{}], blendMode: "normal" };
		const good = { postEffects: [{}], blendMode: "normal" };
		renderer._warmPostEffects = (r) => {
			if (r === bad) {
				throw new Error("boom");
			}
			renderer.calls.effects.push(r);
		};
		renderer._queueWarm(bad);
		renderer._queueWarm(good);
		await expect(tick()).resolves.toBeUndefined();
		expect(renderer.calls.effects).toEqual([good]);
	});

	it("skips the effect half for a renderable without effects", async () => {
		const renderer = makeRenderer();
		renderer._queueWarm({ postEffects: [], blendMode: "normal" });
		await tick();
		expect(renderer.calls.effects).toHaveLength(0);
		expect(renderer.calls.draws).toHaveLength(1);
	});

	it("warms a container's whole subtree", async () => {
		// adding a container brings its descendants in without an addChild each
		const renderer = makeRenderer();
		const leaf = { postEffects: [], blendMode: "normal" };
		const inner = { postEffects: [], blendMode: "normal", children: [leaf] };
		const outer = { postEffects: [], blendMode: "normal", children: [inner] };
		renderer._queueWarm(outer);
		await tick();
		expect(renderer.calls.draws).toEqual([outer, inner, leaf]);
	});

	it("builds the advanced blend machinery for a renderable that needs it", async () => {
		const renderer = makeRenderer();
		renderer._queueWarm({ postEffects: [], blendMode: "overlay" });
		renderer._queueWarm({ postEffects: [], blendMode: "multiply" });
		await tick();
		// `multiply` is fixed-function blend state, `overlay` is the shader
		expect(renderer.calls.blends).toBe(1);
	});
});

describe("warm-up triggers", () => {
	/** an effect carrying the renderer it was built for, as ShaderEffect does */
	const effectFor = (renderer) => {
		return { _renderer: renderer, enabled: true };
	};

	it("addPostEffect queues the renderable", () => {
		const renderer = { _queueWarm: vi.fn() };
		const renderable = new Renderable(0, 0, 10, 10);
		renderable.addPostEffect(effectFor(renderer));
		expect(renderer._queueWarm).toHaveBeenCalledWith(renderable);
	});

	it("assigning `shader` queues the renderable", () => {
		const renderer = { _queueWarm: vi.fn() };
		const renderable = new Renderable(0, 0, 10, 10);
		renderable.shader = effectFor(renderer);
		expect(renderer._queueWarm).toHaveBeenCalledWith(renderable);
	});

	it("tolerates an effect without a renderer, or one that cannot warm", () => {
		const renderable = new Renderable(0, 0, 10, 10);
		expect(() => {
			renderable.addPostEffect({ enabled: true });
			renderable.addPostEffect({ _renderer: {}, enabled: true });
			renderable.shader = null;
		}).not.toThrow();
	});

	it("adding to the world queues the child, through the app's renderer", () => {
		const renderer = { _queueWarm: vi.fn() };
		const world = new Container(0, 0, 100, 100);
		world.root = true;
		world.app = { renderer };
		const child = new Renderable(0, 0, 10, 10);
		world.addChild(child);
		expect(renderer._queueWarm).toHaveBeenCalledWith(child);
		const second = new Renderable(0, 0, 10, 10);
		world.addChildAt(second, 0);
		expect(renderer._queueWarm).toHaveBeenCalledWith(second);
	});

	it("adding to a container outside the world queues nothing", () => {
		// it is not going to be drawn; its subtree is warmed when it is added
		const renderer = { _queueWarm: vi.fn() };
		const loose = new Container(0, 0, 100, 100);
		loose.app = { renderer };
		loose.addChild(new Renderable(0, 0, 10, 10));
		expect(renderer._queueWarm).not.toHaveBeenCalled();
	});
});

describe("render targets for a chain, made ahead", () => {
	const makePool = () => {
		const made = [];
		const pool = new RenderTargetPool((w, h, isCapture, index) => {
			const target = {
				index,
				w,
				h,
				resized: 0,
				resize(width, height) {
					this.w = width;
					this.h = height;
					this.resized++;
				},
				destroy() {},
			};
			made.push(target);
			return target;
		});
		return { pool, made };
	};

	it("reserve() makes the camera pair for a two-effect chain", () => {
		const { pool, made } = makePool();
		pool.reserve(true, 2, 320, 240);
		expect(
			made.map((t) => {
				return t.index;
			}),
		).toEqual([0, 1]);
		// and touches nothing a pass relies on
		expect(pool.activeBase).toBe(-1);
	});

	it("reserve() makes only the capture target for a single effect", () => {
		const { pool, made } = makePool();
		pool.reserve(false, 1, 320, 240);
		expect(
			made.map((t) => {
				return t.index;
			}),
		).toEqual([2]);
	});

	it("reserve() leaves an existing target alone", () => {
		// the pass that uses it resizes it when it begins
		const { pool, made } = makePool();
		pool.begin(true, 2, 100, 100);
		pool.end();
		pool.reserve(true, 2, 320, 240);
		expect(made).toHaveLength(2);
		expect(made[0].resized).toBe(0);
	});

	it("a chain is provisioned for its attached effects, not just the enabled ones", () => {
		// a disabled second effect is one the game means to switch on, often
		// in the middle of play; its ping-pong target is made with the chain
		const renderer = Object.create(Renderer.prototype);
		const off = { enabled: false };
		const on = { enabled: true };
		const camera = { postEffects: [on, off], _postEffectManaged: true };
		const enabled = renderer._effectChainFor(camera);
		expect(enabled).toHaveLength(1);
		expect(renderer._postEffectCapacity(camera, enabled)).toBe(2);
		const { pool, made } = makePool();
		pool.begin(true, renderer._postEffectCapacity(camera, enabled), 320, 240);
		expect(made).toHaveLength(2);
	});
});

describe("the tone curve", () => {
	it("is warmed when it is built, and only then", () => {
		// the curve is added by the renderer, not through addPostEffect, so
		// the attach hook never sees it
		const renderer = Object.create(Renderer.prototype);
		renderer.shaderLanguage = "wgsl";
		renderer.settings = { toneMapping: "aces" };
		renderer._warmToneMap = vi.fn();
		renderer._resolveToneMapping();
		expect(renderer._warmToneMap).toHaveBeenCalledTimes(1);
		// an exposure change is a uniform write on the same curve
		renderer.settings.toneMappingExposure = 2;
		renderer._resolveToneMapping();
		expect(renderer._warmToneMap).toHaveBeenCalledTimes(1);
		// a new curve is a new shader
		renderer.settings.toneMapping = "reinhard";
		renderer._resolveToneMapping();
		expect(renderer._warmToneMap).toHaveBeenCalledTimes(2);
		renderer._toneMapEffect.destroy?.();
	});
});
