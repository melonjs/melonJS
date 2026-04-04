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
	});
});
