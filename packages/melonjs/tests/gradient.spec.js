import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Application, Color, Gradient } from "../src/index.js";

describe("Gradient", () => {
	let app;

	beforeAll(() => {
		app = new Application(64, 64, {
			parent: "screen",
			scale: "auto",
		});
	});

	describe("createLinearGradient", () => {
		it("should return a Gradient instance", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 100, 0);
			expect(gradient).toBeInstanceOf(Gradient);
			expect(gradient.type).toEqual("linear");
		});

		it("should store gradient coordinates", () => {
			const gradient = app.renderer.createLinearGradient(10, 20, 30, 40);
			expect(gradient.coords).toEqual([10, 20, 30, 40]);
		});

		it("should support addColorStop chaining", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 100, 0);
			const result = gradient
				.addColorStop(0, "#FF0000")
				.addColorStop(1, "#0000FF");
			expect(result).toBe(gradient);
			expect(gradient.colorStops.length).toEqual(2);
		});

		it("should store color stop as string", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 100, 0);
			gradient.addColorStop(0, "#FF0000");
			expect(gradient.colorStops[0].color).toEqual("#FF0000");
		});
	});

	describe("createRadialGradient", () => {
		it("should return a Gradient instance", () => {
			const gradient = app.renderer.createRadialGradient(50, 50, 0, 50, 50, 50);
			expect(gradient).toBeInstanceOf(Gradient);
			expect(gradient.type).toEqual("radial");
		});

		it("should store gradient coordinates", () => {
			const gradient = app.renderer.createRadialGradient(10, 20, 5, 30, 40, 50);
			expect(gradient.coords).toEqual([10, 20, 5, 30, 40, 50]);
		});
	});

	describe("setColor with gradient", () => {
		it("should accept a Gradient in setColor without throwing", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			expect(() => {
				app.renderer.setColor(gradient);
			}).not.toThrow();
		});

		it("should accept a regular color after a gradient", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			app.renderer.setColor(gradient);
			expect(() => {
				app.renderer.setColor("#FF0000");
			}).not.toThrow();
		});
	});

	describe("fillRect with gradient", () => {
		it("should not throw when filling a rect with a gradient", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "#FF0000");
			gradient.addColorStop(1, "#0000FF");
			app.renderer.setColor(gradient);
			expect(() => {
				app.renderer.fillRect(0, 0, 64, 64);
			}).not.toThrow();
		});
	});

	describe("mixing colors and gradients across fill calls", () => {
		it("should fill with solid color after gradient", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			app.renderer.setColor(gradient);
			app.renderer.fillRect(0, 0, 64, 32);
			app.renderer.setColor("#00FF00");
			expect(() => {
				app.renderer.fillRect(0, 32, 64, 32);
			}).not.toThrow();
			expect(app.renderer.renderState.currentGradient).toBeNull();
		});

		it("should fill with gradient after solid color", () => {
			app.renderer.setColor("#FF0000");
			app.renderer.fillRect(0, 0, 64, 32);
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "green");
			gradient.addColorStop(1, "blue");
			app.renderer.setColor(gradient);
			expect(() => {
				app.renderer.fillRect(0, 32, 64, 32);
			}).not.toThrow();
			expect(app.renderer.renderState.currentGradient).toBe(gradient);
		});

		it("should alternate between colors and gradients", () => {
			const g1 = app.renderer.createLinearGradient(0, 0, 64, 0);
			g1.addColorStop(0, "red");
			g1.addColorStop(1, "blue");
			const g2 = app.renderer.createRadialGradient(32, 32, 0, 32, 32, 32);
			g2.addColorStop(0, "white");
			g2.addColorStop(1, "black");

			expect(() => {
				app.renderer.setColor(g1);
				app.renderer.fillRect(0, 0, 64, 16);
				app.renderer.setColor("#FF0000");
				app.renderer.fillRect(0, 16, 64, 16);
				app.renderer.setColor(g2);
				app.renderer.fillRect(0, 32, 64, 16);
				app.renderer.setColor("#0000FF");
				app.renderer.fillRect(0, 48, 64, 16);
			}).not.toThrow();
			expect(app.renderer.renderState.currentGradient).toBeNull();
		});

		it("should handle save/restore when mixing colors and gradients for rendering", () => {
			app.renderer.setColor("#FF0000");
			app.renderer.save();
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "green");
			gradient.addColorStop(1, "blue");
			app.renderer.setColor(gradient);
			app.renderer.fillRect(0, 0, 64, 32);
			app.renderer.restore();
			// after restore, should be back to solid color
			expect(app.renderer.renderState.currentGradient).toBeNull();
			expect(() => {
				app.renderer.fillRect(0, 32, 64, 32);
			}).not.toThrow();
		});
	});

	describe("multiple gradient instances sharing render target", () => {
		it("should draw different gradients in sequence without errors", () => {
			const g1 = app.renderer.createLinearGradient(0, 0, 64, 0);
			g1.addColorStop(0, "red");
			g1.addColorStop(1, "blue");
			const g2 = app.renderer.createLinearGradient(0, 0, 0, 64);
			g2.addColorStop(0, "green");
			g2.addColorStop(1, "yellow");
			const g3 = app.renderer.createRadialGradient(32, 32, 0, 32, 32, 32);
			g3.addColorStop(0, "white");
			g3.addColorStop(1, "black");

			expect(() => {
				app.renderer.setColor(g1);
				app.renderer.fillRect(0, 0, 64, 20);
				app.renderer.setColor(g2);
				app.renderer.fillRect(0, 20, 64, 20);
				app.renderer.setColor(g3);
				app.renderer.fillRect(0, 40, 64, 20);
			}).not.toThrow();
		});

		it("should handle rapid gradient creation without memory leak", () => {
			expect(() => {
				for (let i = 0; i < 100; i++) {
					const g = app.renderer.createLinearGradient(0, 0, 64, 0);
					g.addColorStop(0, "red");
					g.addColorStop(1, "blue");
					app.renderer.setColor(g);
					app.renderer.fillRect(0, 0, 64, 64);
				}
			}).not.toThrow();
			app.renderer.setColor("#000000");
		});

		it("should restore and draw a different gradient after save/restore", () => {
			const g1 = app.renderer.createLinearGradient(0, 0, 64, 0);
			g1.addColorStop(0, "red");
			g1.addColorStop(1, "blue");
			const g2 = app.renderer.createRadialGradient(32, 32, 0, 32, 32, 32);
			g2.addColorStop(0, "green");
			g2.addColorStop(1, "yellow");

			expect(() => {
				app.renderer.setColor(g1);
				app.renderer.fillRect(0, 0, 64, 32);
				app.renderer.save();
				app.renderer.setColor(g2);
				app.renderer.fillRect(0, 32, 64, 32);
				app.renderer.restore();
				// g1 should be active again and render correctly
				app.renderer.fillRect(0, 0, 64, 32);
			}).not.toThrow();
			expect(app.renderer.renderState.currentGradient).toBe(g1);
		});
	});

	describe("toCanvasGradient", () => {
		it("should produce a CanvasGradient for linear type", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			const canvasGradient = gradient.toCanvasGradient(ctx);
			expect(canvasGradient).toBeInstanceOf(CanvasGradient);
		});

		it("should produce a CanvasGradient for radial type", () => {
			const gradient = new Gradient("radial", [50, 50, 0, 50, 50, 50]);
			gradient.addColorStop(0, "white");
			gradient.addColorStop(1, "black");
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			const canvasGradient = gradient.toCanvasGradient(ctx);
			expect(canvasGradient).toBeInstanceOf(CanvasGradient);
		});

		it("should cache the CanvasGradient", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			const first = gradient.toCanvasGradient(ctx);
			const second = gradient.toCanvasGradient(ctx);
			expect(first).toBe(second);
		});

		it("should invalidate cache after addColorStop", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			const first = gradient.toCanvasGradient(ctx);
			gradient.addColorStop(1, "blue");
			const second = gradient.toCanvasGradient(ctx);
			expect(first).not.toBe(second);
		});
	});

	describe("save/restore with gradient", () => {
		it("should track gradient in renderState when set", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");

			app.renderer.setColor(gradient);
			expect(app.renderer.renderState.currentGradient).toBe(gradient);
		});

		it("should clear gradient in renderState when color is set", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");

			app.renderer.setColor(gradient);
			app.renderer.setColor("#00FF00");
			expect(app.renderer.renderState.currentGradient).toBeNull();
		});

		it("should restore gradient after save(gradient) / setColor(solid) / restore", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");

			app.renderer.setColor(gradient);
			app.renderer.save();
			app.renderer.setColor("#00FF00");
			expect(app.renderer.renderState.currentGradient).toBeNull();
			app.renderer.restore();
			expect(app.renderer.renderState.currentGradient).toBe(gradient);
		});

		it("should restore solid color after save(solid) / setColor(gradient) / restore", () => {
			app.renderer.setColor("#FF0000");
			app.renderer.save();
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "green");
			gradient.addColorStop(1, "blue");
			app.renderer.setColor(gradient);
			expect(app.renderer.renderState.currentGradient).toBe(gradient);
			app.renderer.restore();
			expect(app.renderer.renderState.currentGradient).toBeNull();
		});

		it("should handle nested save/restore with mixed colors and gradients", () => {
			const gradient1 = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient1.addColorStop(0, "red");
			gradient1.addColorStop(1, "blue");
			const gradient2 = app.renderer.createRadialGradient(
				32,
				32,
				0,
				32,
				32,
				32,
			);
			gradient2.addColorStop(0, "white");
			gradient2.addColorStop(1, "black");

			// level 0: solid color
			app.renderer.setColor("#FF0000");
			app.renderer.save();

			// level 1: gradient1
			app.renderer.setColor(gradient1);
			app.renderer.save();

			// level 2: gradient2
			app.renderer.setColor(gradient2);
			expect(app.renderer.renderState.currentGradient).toBe(gradient2);

			// restore to level 1: gradient1
			app.renderer.restore();
			expect(app.renderer.renderState.currentGradient).toBe(gradient1);

			// restore to level 0: solid color
			app.renderer.restore();
			expect(app.renderer.renderState.currentGradient).toBeNull();
		});
	});

	describe("toCanvas (texture)", () => {
		it("should produce a canvas element matching the draw rect", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			const canvas = gradient.toCanvas(app.renderer, 0, 0, 100, 50);
			expect(canvas).toBeDefined();
			// dimensions are next power of two
			expect(canvas.width).toEqual(128);
			expect(canvas.height).toEqual(64);
		});

		it("should cache the canvas for same dimensions", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			const first = gradient.toCanvas(app.renderer, 0, 0, 100, 50);
			const second = gradient.toCanvas(app.renderer, 0, 0, 100, 50);
			expect(first).toBe(second);
		});

		it("should invalidate cache when position changes", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			const first = gradient.toCanvas(app.renderer, 0, 0, 100, 50);
			const second = gradient.toCanvas(app.renderer, 10, 10, 100, 50);
			// same canvas object reused, but re-rendered
			expect(first).toBe(second);
		});
	});

	describe("addColorStop validation", () => {
		it("should throw for offset less than 0", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			expect(() => {
				gradient.addColorStop(-0.1, "red");
			}).toThrow();
		});

		it("should throw for offset greater than 1", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			expect(() => {
				gradient.addColorStop(1.1, "red");
			}).toThrow();
		});

		it("should accept offset 0 and 1", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			expect(() => {
				gradient.addColorStop(0, "red");
				gradient.addColorStop(1, "blue");
			}).not.toThrow();
		});
	});

	describe("gradient with no color stops", () => {
		it("should not throw when creating gradient with no stops", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 100, 0);
			expect(() => {
				app.renderer.setColor(gradient);
			}).not.toThrow();
		});
	});

	describe("gradient reuse across multiple setColor calls", () => {
		it("should allow the same gradient to be set multiple times", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			expect(() => {
				app.renderer.setColor(gradient);
				app.renderer.fillRect(0, 0, 32, 32);
				app.renderer.setColor("#000000");
				app.renderer.setColor(gradient);
				app.renderer.fillRect(32, 0, 32, 32);
			}).not.toThrow();
		});
	});

	describe("gradient with single color stop", () => {
		it("should not throw with a single color stop", () => {
			const gradient = app.renderer.createLinearGradient(0, 0, 64, 0);
			gradient.addColorStop(0.5, "red");
			expect(() => {
				app.renderer.setColor(gradient);
				app.renderer.fillRect(0, 0, 64, 64);
			}).not.toThrow();
		});
	});

	describe("getColorAt", () => {
		let out;

		beforeEach(() => {
			out = new Color(0, 0, 0, 1);
		});

		it("should clamp to the first stop when position <= first offset", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0.2, "#ff0000");
			g.addColorStop(0.8, "#0000ff");
			g.getColorAt(0, out);
			expect(out.r).toBe(255);
			expect(out.g).toBe(0);
			expect(out.b).toBe(0);
			expect(out.alpha).toBe(1);
			g.destroy();
		});

		it("should clamp to the last stop when position >= last offset", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0.2, "#ff0000");
			g.addColorStop(0.8, "#0000ff");
			g.getColorAt(1, out);
			expect(out.r).toBe(0);
			expect(out.g).toBe(0);
			expect(out.b).toBe(255);
			expect(out.alpha).toBe(1);
			g.destroy();
		});

		it("should interpolate between two stops at midpoint", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0, "rgba(0,0,0,1)");
			g.addColorStop(1, "rgba(200,100,50,0)");
			g.getColorAt(0.5, out);
			expect(out.r).toBe(100);
			expect(out.g).toBe(50);
			expect(out.b).toBe(25);
			expect(out.alpha).toBeCloseTo(0.5, 5);
			g.destroy();
		});

		it("should interpolate across multiple stops", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0, "#ff0000");
			g.addColorStop(0.5, "#00ff00");
			g.addColorStop(1, "#0000ff");
			g.getColorAt(0.25, out);
			expect(out.r).toBeGreaterThanOrEqual(127);
			expect(out.r).toBeLessThanOrEqual(128);
			expect(out.g).toBeGreaterThanOrEqual(127);
			expect(out.g).toBeLessThanOrEqual(128);
			expect(out.b).toBe(0);
			g.destroy();
		});

		it("should return exact color at a stop position", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0, "#ff0000");
			g.addColorStop(0.5, "#00ff00");
			g.addColorStop(1, "#0000ff");
			g.getColorAt(0.5, out);
			expect(out.r).toBe(0);
			expect(out.g).toBe(255);
			expect(out.b).toBe(0);
			g.destroy();
		});

		it("should handle a single stop", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0.5, "#ff0000");
			g.getColorAt(0, out);
			expect(out.r).toBe(255);
			g.getColorAt(1, out);
			expect(out.r).toBe(255);
			g.destroy();
		});

		it("should rebuild cache after addColorStop", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0, "#ff0000");
			g.addColorStop(1, "#ff0000");
			g.getColorAt(0.5, out);
			expect(out.r).toBe(255);
			expect(out.b).toBe(0);

			g.addColorStop(0.5, "#0000ff");
			g.getColorAt(0.5, out);
			expect(out.r).toBe(0);
			expect(out.b).toBe(255);
			g.destroy();
		});
	});

	describe("destroy", () => {
		it("should release parsed stops and allow re-creation", () => {
			const g = new Gradient("linear", [0, 0, 1, 0]);
			g.addColorStop(0, "#ff0000");
			g.addColorStop(1, "#0000ff");
			const out = new Color();
			g.getColorAt(0.5, out); // triggers cache build
			g.destroy();
			expect(g._parsedStops).toBeNull();
		});
	});
});
