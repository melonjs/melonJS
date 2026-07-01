import { beforeAll, describe, expect, it } from "vitest";
import { boot, Renderable, video } from "../src/index.js";

/**
 * `ShaderEffect`/`GLShader` carry a `shared` flag. When set, a renderable does
 * NOT auto-destroy the effect on cleanup (the `shader` setter, `removePostEffect`,
 * `clearPostEffects`, or `Renderable.destroy`) — so a shader reused across several
 * sprites isn't freed out from under the others when one of them goes away.
 *
 * Uses lightweight mock effects (just `{ destroy, shared }`) so the test exercises
 * the renderable's ownership logic without a WebGL context.
 */
const makeEffect = (shared = false) => {
	return {
		shared,
		destroyed: false,
		destroy() {
			this.destroyed = true;
		},
	};
};

describe("shared post-effect (shader) lifecycle", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	it("removePostEffect destroys an owned effect but keeps a shared one", () => {
		const r = new Renderable(0, 0, 10, 10);
		const owned = makeEffect(false);
		const shared = makeEffect(true);
		r.addPostEffect(owned);
		r.addPostEffect(shared);

		r.removePostEffect(owned);
		expect(owned.destroyed).toBe(true);

		r.removePostEffect(shared);
		expect(shared.destroyed).toBe(false); // shared → not destroyed
		expect(r.postEffects.includes(shared)).toBe(false); // but still detached
	});

	it("clearPostEffects skips shared effects", () => {
		const r = new Renderable(0, 0, 10, 10);
		const owned = makeEffect(false);
		const shared = makeEffect(true);
		r.addPostEffect(owned);
		r.addPostEffect(shared);

		r.clearPostEffects();
		expect(owned.destroyed).toBe(true);
		expect(shared.destroyed).toBe(false);
		expect(r.postEffects.length).toBe(0);
	});

	it("destroying one sprite doesn't free a shader shared with another", () => {
		const shared = makeEffect(true);
		const a = new Renderable(0, 0, 10, 10);
		const b = new Renderable(0, 0, 10, 10);
		a.addPostEffect(shared);
		b.addPostEffect(shared);

		a.destroy();
		expect(shared.destroyed).toBe(false); // B still uses it

		// the `shader` setter must also leave the shared effect alive
		b.shader = undefined;
		expect(shared.destroyed).toBe(false);
	});

	it("an owned effect IS still destroyed when its renderable is destroyed", () => {
		const owned = makeEffect(false);
		const r = new Renderable(0, 0, 10, 10);
		r.addPostEffect(owned);
		r.destroy();
		expect(owned.destroyed).toBe(true);
	});
});
