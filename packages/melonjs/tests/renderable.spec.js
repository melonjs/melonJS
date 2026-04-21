import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, Container, Renderable, video } from "../src/index.js";

describe("Renderable", () => {
	describe("bounds updates", () => {
		let renderable;
		beforeEach(() => {
			renderable = new Renderable(50, 50, 100, 100);
			renderable.anchorPoint.set(0, 0);
		});

		it("renderable has correct bounds", () => {
			const bounds = renderable.getBounds();
			expect(bounds.x).toEqual(50);
			expect(bounds.y).toEqual(50);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
		});

		it("renderable has correct bounds when changing anchor point", () => {
			renderable.anchorPoint.set(0.5, 0.5);
			const bounds = renderable.getBounds();
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
		});

		it("setting x, y position changes bounds pos", () => {
			renderable.anchorPoint.set(0, 0);
			renderable.pos.x = 10;
			expect(renderable.getBounds().x).toEqual(10);
			renderable.pos.y = 120;
			expect(renderable.getBounds().y).toEqual(120);
		});

		it("resizing the renderable changes its bounds width", () => {
			renderable.resize(20, 20);
			expect(renderable.getBounds().width).toEqual(20);
		});

		it("resizing the renderable changes its bounds height", () => {
			renderable.resize(20, 20);
			expect(renderable.getBounds().height).toEqual(20);
		});
	});

	describe("visibleInAllCameras", () => {
		it("should default to false", () => {
			const renderable = new Renderable(0, 0, 50, 50);
			expect(renderable.visibleInAllCameras).toEqual(false);
		});

		it("should be settable to true", () => {
			const renderable = new Renderable(0, 0, 50, 50);
			renderable.visibleInAllCameras = true;
			expect(renderable.visibleInAllCameras).toEqual(true);
		});

		it("should be independent from floating", () => {
			const renderable = new Renderable(0, 0, 50, 50);
			renderable.floating = true;
			expect(renderable.visibleInAllCameras).toEqual(false);
			renderable.visibleInAllCameras = true;
			expect(renderable.floating).toEqual(true);
			expect(renderable.visibleInAllCameras).toEqual(true);
		});
	});

	describe("getAbsoluteBounds returns the correct value", () => {
		let rootContainer;
		let childContainer;
		let renderable;
		beforeAll(() => {
			rootContainer = new Container(0, 0, 1000, 1000, true);
			childContainer = new Container(100, 100, 500, 500);
			renderable = new Renderable(50, 50, 50, 50);
			childContainer.anchorPoint.set(0, 0);
			renderable.anchorPoint.set(0, 0);
			childContainer.enableChildBoundsUpdate = true;
		});

		it("create and add a child container to the root container", () => {
			rootContainer.addChild(childContainer);
			expect(childContainer.isAttachedToRoot()).toEqual(true);
		});

		it("renderable should have a correct absolute position once added", () => {
			childContainer.addChild(renderable);
			expect(renderable.getBounds().x).toEqual(150);
			expect(renderable.getBounds().y).toEqual(150);
		});

		it("changing the renderable position, change the absolute pos", () => {
			renderable.pos.set(200, 100, 0);
			expect(renderable.getBounds().x).toEqual(300);
			expect(renderable.getBounds().y).toEqual(200);
		});

		it("changing the parent container position, also change the renderable absolute pos", () => {
			childContainer.shift(200, 300);
			expect(renderable.getBounds().x).toEqual(400); // 200 + 200
			expect(renderable.getBounds().y).toEqual(400); // 100 + 300
		});

		it("renderable in a floating container", () => {
			expect(renderable.isFloating).toEqual(false);
			childContainer.floating = true;
			expect(renderable.isFloating).toEqual(true);
		});

		it("floating renderable in a container", () => {
			childContainer.floating = false;
			renderable.floating = true;
			expect(renderable.isFloating).toEqual(true);
		});
	});

	describe("postEffects", () => {
		let renderable;
		beforeEach(() => {
			renderable = new Renderable(0, 0, 100, 100);
		});

		it("should start with an empty postEffects array", () => {
			expect(renderable.postEffects).toEqual([]);
		});

		it("addPostEffect should add and return the effect", () => {
			const effect = { enabled: true };
			const result = renderable.addPostEffect(effect);
			expect(result).toBe(effect);
			expect(renderable.postEffects).toHaveLength(1);
			expect(renderable.postEffects[0]).toBe(effect);
		});

		it("addPostEffect should support multiple effects", () => {
			const a = { enabled: true };
			const b = { enabled: true };
			renderable.addPostEffect(a);
			renderable.addPostEffect(b);
			expect(renderable.postEffects).toHaveLength(2);
			expect(renderable.postEffects[0]).toBe(a);
			expect(renderable.postEffects[1]).toBe(b);
		});

		it("getPostEffect with class should find by instanceof", () => {
			class EffectA {
				constructor() {
					this.enabled = true;
				}
			}
			class EffectB {
				constructor() {
					this.enabled = true;
				}
			}
			const a = new EffectA();
			const b = new EffectB();
			renderable.addPostEffect(a);
			renderable.addPostEffect(b);
			expect(renderable.getPostEffect(EffectA)).toBe(a);
			expect(renderable.getPostEffect(EffectB)).toBe(b);
		});

		it("getPostEffect with class should return undefined if not found", () => {
			class EffectA {
				constructor() {
					this.enabled = true;
				}
			}
			expect(renderable.getPostEffect(EffectA)).toBeUndefined();
		});

		it("getPostEffect without args should return the full array", () => {
			const a = { enabled: true };
			renderable.addPostEffect(a);
			const result = renderable.getPostEffect();
			expect(result).toBe(renderable.postEffects);
			expect(result).toHaveLength(1);
		});

		it("removePostEffect should remove the effect", () => {
			const a = { enabled: true };
			const b = { enabled: true };
			renderable.addPostEffect(a);
			renderable.addPostEffect(b);
			renderable.removePostEffect(a);
			expect(renderable.postEffects).toHaveLength(1);
			expect(renderable.postEffects[0]).toBe(b);
		});

		it("removePostEffect should call destroy if available", () => {
			let destroyed = false;
			const effect = {
				enabled: true,
				destroy() {
					destroyed = true;
				},
			};
			renderable.addPostEffect(effect);
			renderable.removePostEffect(effect);
			expect(destroyed).toEqual(true);
		});

		it("removePostEffect should be a no-op for unknown effects", () => {
			const a = { enabled: true };
			const b = { enabled: true };
			renderable.addPostEffect(a);
			renderable.removePostEffect(b);
			expect(renderable.postEffects).toHaveLength(1);
		});

		it("direct array assignment should work", () => {
			const a = { enabled: true };
			const b = { enabled: true };
			renderable.postEffects = [a, b];
			expect(renderable.postEffects).toHaveLength(2);
			expect(renderable.postEffects[0]).toBe(a);
		});
	});

	describe("shader (deprecated getter/setter)", () => {
		let renderable;
		beforeEach(() => {
			renderable = new Renderable(0, 0, 100, 100);
		});

		it("shader getter should return postEffects[0]", () => {
			const effect = { enabled: true };
			renderable.postEffects = [effect];
			expect(renderable.shader).toBe(effect);
		});

		it("shader getter should return undefined when no effects", () => {
			expect(renderable.shader).toBeUndefined();
		});

		it("shader setter should set postEffects to [value]", () => {
			const effect = { enabled: true };
			renderable.shader = effect;
			expect(renderable.postEffects).toHaveLength(1);
			expect(renderable.postEffects[0]).toBe(effect);
		});

		it("shader setter with undefined should clear postEffects", () => {
			renderable.addPostEffect({ enabled: true });
			renderable.addPostEffect({ enabled: true });
			renderable.shader = undefined;
			expect(renderable.postEffects).toHaveLength(0);
		});

		it("shader setter should replace all existing effects", () => {
			renderable.addPostEffect({ enabled: true, id: 1 });
			renderable.addPostEffect({ enabled: true, id: 2 });
			const newEffect = { enabled: true, id: 3 };
			renderable.shader = newEffect;
			expect(renderable.postEffects).toHaveLength(1);
			expect(renderable.postEffects[0]).toBe(newEffect);
		});
	});

	describe("destroy cleans up postEffects", () => {
		it("should destroy all effects on renderable destroy", () => {
			const renderable = new Renderable(0, 0, 100, 100);
			let destroyCount = 0;
			renderable.addPostEffect({
				enabled: true,
				destroy() {
					destroyCount++;
				},
			});
			renderable.addPostEffect({
				enabled: true,
				destroy() {
					destroyCount++;
				},
			});
			renderable.destroy();
			expect(destroyCount).toEqual(2);
			expect(renderable.postEffects).toHaveLength(0);
		});
	});

	describe("postEffect pipeline integration", () => {
		const setup = () => {
			boot();
			video.init(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
		};

		it("preDraw with single effect should set customShader", () => {
			setup();
			const renderer = video.renderer;
			const renderable = new Renderable(0, 0, 100, 100);
			const effect = { enabled: true };
			renderable.addPostEffect(effect);

			renderable.preDraw(renderer);
			expect(renderer.customShader).toBe(effect);
			renderable.postDraw(renderer);
		});

		it("preDraw with no effects should not set customShader", () => {
			setup();
			const renderer = video.renderer;
			const renderable = new Renderable(0, 0, 100, 100);

			renderable.preDraw(renderer);
			expect(renderer.customShader).toBeUndefined();
			renderable.postDraw(renderer);
		});

		it("preDraw/postDraw should not leak customShader state", () => {
			setup();
			const renderer = video.renderer;
			const renderable = new Renderable(0, 0, 100, 100);
			const effect = { enabled: true };
			renderable.addPostEffect(effect);

			renderable.preDraw(renderer);
			// during draw, customShader should be set (single-effect fast path)
			expect(renderer.customShader).toBe(effect);
			renderable.postDraw(renderer);
			// after postDraw's restore(), customShader should be cleared
			expect(renderer.customShader).toBeUndefined();
		});

		it("disabled single effect should not be set as customShader", () => {
			setup();
			const renderer = video.renderer;
			const renderable = new Renderable(0, 0, 100, 100);
			renderable.addPostEffect({ enabled: false });

			renderable.preDraw(renderer);
			// disabled effect should not set customShader
			expect(renderer.customShader).toBeUndefined();
			renderable.postDraw(renderer);
			expect(renderer.customShader).toBeUndefined();
		});

		it("_postEffectManaged flag should prevent preDraw from calling beginPostEffect", () => {
			setup();
			const renderer = video.renderer;
			const renderable = new Renderable(0, 0, 100, 100);
			renderable.addPostEffect({ enabled: true });
			renderable.addPostEffect({ enabled: true });

			// simulate camera-managed mode
			renderable._postEffectManaged = true;
			renderable.preDraw(renderer);
			// managed mode: beginPostEffect is NOT called from preDraw,
			// so customShader should not be set
			expect(renderer.customShader).toBeUndefined();
			renderable.postDraw(renderer);
			expect(renderer.customShader).toBeUndefined();
			renderable._postEffectManaged = false;
		});

		it("multiple effects on renderable should trigger beginPostEffect", () => {
			setup();
			const renderer = video.renderer;
			const renderable = new Renderable(0, 0, 100, 100);
			renderable.addPostEffect({ enabled: true });
			renderable.addPostEffect({ enabled: true });

			// on Canvas renderer, beginPostEffect returns false (no-op)
			// but the code path should be exercised without error
			renderable.preDraw(renderer);
			renderable.postDraw(renderer);
		});

		it("clearPostEffects should remove all and destroy", () => {
			setup();
			const renderable = new Renderable(0, 0, 100, 100);
			let count = 0;
			renderable.addPostEffect({
				enabled: true,
				destroy() {
					count++;
				},
			});
			renderable.addPostEffect({
				enabled: true,
				destroy() {
					count++;
				},
			});
			renderable.clearPostEffects();
			expect(renderable.postEffects).toHaveLength(0);
			expect(count).toEqual(2);
		});
	});
});
