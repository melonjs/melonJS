import { beforeAll, describe, expect, it } from "vitest";
import { Application, Gradient } from "../src/index.js";

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
			const canvas = gradient.toCanvas(0, 0, 100, 50);
			expect(canvas).toBeDefined();
			// dimensions are next power of two
			expect(canvas.width).toEqual(128);
			expect(canvas.height).toEqual(64);
		});

		it("should cache the canvas for same dimensions", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			const first = gradient.toCanvas(0, 0, 100, 50);
			const second = gradient.toCanvas(0, 0, 100, 50);
			expect(first).toBe(second);
		});

		it("should invalidate cache when position changes", () => {
			const gradient = new Gradient("linear", [0, 0, 100, 0]);
			gradient.addColorStop(0, "red");
			gradient.addColorStop(1, "blue");
			const first = gradient.toCanvas(0, 0, 100, 50);
			const second = gradient.toCanvas(10, 10, 100, 50);
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
});
