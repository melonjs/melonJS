import { beforeAll, describe, expect, it } from "vitest";
import { Application } from "../src/index.js";

describe("LineDash", () => {
	let app;

	beforeAll(() => {
		app = new Application(64, 64, {
			parent: "screen",
			scale: "auto",
		});
	});

	describe("setLineDash / getLineDash", () => {
		it("should default to an empty array (solid line)", () => {
			expect(app.renderer.getLineDash()).toEqual([]);
		});

		it("should set and get a dash pattern", () => {
			app.renderer.setLineDash([10, 5]);
			expect(app.renderer.getLineDash()).toEqual([10, 5]);
		});

		it("should clear the dash pattern with an empty array", () => {
			app.renderer.setLineDash([10, 5]);
			app.renderer.setLineDash([]);
			expect(app.renderer.getLineDash()).toEqual([]);
		});

		it("should accept a complex dash pattern", () => {
			app.renderer.setLineDash([5, 3, 10, 3]);
			expect(app.renderer.getLineDash()).toEqual([5, 3, 10, 3]);
			app.renderer.setLineDash([]);
		});
	});

	describe("strokeLine with dash", () => {
		it("should not throw when drawing a dashed line", () => {
			app.renderer.setLineDash([10, 5]);
			expect(() => {
				app.renderer.strokeLine(0, 0, 64, 64);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});

		it("should not throw when drawing a solid line after dashed", () => {
			app.renderer.setLineDash([10, 5]);
			app.renderer.strokeLine(0, 0, 64, 0);
			app.renderer.setLineDash([]);
			expect(() => {
				app.renderer.strokeLine(0, 32, 64, 32);
			}).not.toThrow();
		});
	});

	describe("path-based stroke with dash", () => {
		it("should not throw when stroking a path with dash", () => {
			app.renderer.setLineDash([8, 4]);
			app.renderer.beginPath();
			app.renderer.moveTo(0, 0);
			app.renderer.lineTo(32, 32);
			app.renderer.lineTo(64, 0);
			expect(() => {
				app.renderer.stroke();
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});
	});

	describe("setLineDash input validation", () => {
		it("should clone the array (not store by reference)", () => {
			const pattern = [10, 5];
			app.renderer.setLineDash(pattern);
			pattern[0] = 999;
			expect(app.renderer.getLineDash()[0]).toEqual(10);
			app.renderer.setLineDash([]);
		});

		it("should filter out negative values", () => {
			app.renderer.setLineDash([10, -5, 8, -3]);
			expect(app.renderer.getLineDash()).toEqual([10, 8]);
			app.renderer.setLineDash([]);
		});

		it("should keep zero values", () => {
			app.renderer.setLineDash([10, 0, 5, 0]);
			expect(app.renderer.getLineDash()).toEqual([10, 0, 5, 0]);
			app.renderer.setLineDash([]);
		});

		it("should handle all-negative values (becomes empty = solid)", () => {
			app.renderer.setLineDash([-1, -2, -3]);
			expect(app.renderer.getLineDash()).toEqual([]);
			app.renderer.setLineDash([]);
		});

		it("should not throw with zero-length dash pattern on strokeLine", () => {
			app.renderer.setLineDash([0, 0]);
			expect(() => {
				app.renderer.strokeLine(0, 0, 64, 64);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});

		it("should not infinite loop with zero dash values on strokeLine", () => {
			app.renderer.setLineDash([0, 5, 0, 10]);
			expect(() => {
				app.renderer.strokeLine(0, 0, 64, 0);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});
	});

	describe("setLineDash edge cases", () => {
		it("should filter NaN values", () => {
			app.renderer.setLineDash([10, NaN, 5]);
			const dash = app.renderer.getLineDash();
			expect(dash).not.toContain(NaN);
			app.renderer.setLineDash([]);
		});

		it("should filter Infinity values", () => {
			app.renderer.setLineDash([10, Infinity, 5]);
			const dash = app.renderer.getLineDash();
			expect(dash).not.toContain(Infinity);
			app.renderer.setLineDash([]);
		});

		it("should handle a single-element pattern", () => {
			app.renderer.setLineDash([10]);
			expect(() => {
				app.renderer.strokeLine(0, 0, 64, 0);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});

		it("should handle fractional values", () => {
			app.renderer.setLineDash([0.5, 0.1]);
			expect(() => {
				app.renderer.strokeLine(0, 0, 64, 0);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});
	});

	describe("dash on different stroke methods", () => {
		it("should not throw with strokeRect", () => {
			app.renderer.setLineDash([8, 4]);
			expect(() => {
				app.renderer.strokeRect(0, 0, 32, 32);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});

		it("should not throw with strokeEllipse", () => {
			app.renderer.setLineDash([8, 4]);
			expect(() => {
				app.renderer.strokeEllipse(32, 32, 16, 16);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});

		it("should not throw with strokeArc", () => {
			app.renderer.setLineDash([6, 3]);
			expect(() => {
				app.renderer.strokeArc(32, 32, 16, 0, Math.PI * 2);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});

		it("should not throw on zero-length line", () => {
			app.renderer.setLineDash([10, 5]);
			expect(() => {
				app.renderer.strokeLine(32, 32, 32, 32);
			}).not.toThrow();
			app.renderer.setLineDash([]);
		});
	});

	describe("save/restore with dash", () => {
		it("should restore dash pattern after save/restore", () => {
			app.renderer.setLineDash([10, 5]);
			app.renderer.save();
			app.renderer.setLineDash([3, 3]);
			expect(app.renderer.getLineDash()).toEqual([3, 3]);
			app.renderer.restore();
			expect(app.renderer.getLineDash()).toEqual([10, 5]);
			app.renderer.setLineDash([]);
		});

		it("should restore solid line after save(solid) / setLineDash / restore", () => {
			app.renderer.setLineDash([]);
			app.renderer.save();
			app.renderer.setLineDash([10, 5]);
			app.renderer.restore();
			expect(app.renderer.getLineDash()).toEqual([]);
		});

		it("save should not be affected by subsequent setLineDash calls", () => {
			app.renderer.setLineDash([10, 5]);
			app.renderer.save();
			// setLineDash creates a new array, so saved reference stays intact
			app.renderer.setLineDash([20, 10]);
			app.renderer.save();
			app.renderer.setLineDash([1, 1]);
			// restore to [20, 10]
			app.renderer.restore();
			expect(app.renderer.getLineDash()).toEqual([20, 10]);
			// restore to [10, 5]
			app.renderer.restore();
			expect(app.renderer.getLineDash()).toEqual([10, 5]);
			app.renderer.setLineDash([]);
		});
	});
});
