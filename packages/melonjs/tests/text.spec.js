import { beforeAll, describe, expect, it } from "vitest";
import { boot, Text, video } from "../src/index.js";

/**
 * Text font-family handling. `setFont` wraps family names in quotes so names
 * with spaces work, but CSS *generic* families (sans-serif, monospace, …) must
 * stay unquoted — a quoted generic is treated as a (nonexistent) specific family
 * and the browser silently falls back to its default serif. These pin that down.
 */
describe("Text — font family handling", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	it("quotes a specific family name", () => {
		const t = new Text(0, 0, { font: "Arial", size: 16 });
		expect(t.font).toBe('16px "Arial"');
	});

	it("does NOT quote CSS generic families (no serif fallback)", () => {
		for (const generic of [
			"sans-serif",
			"serif",
			"monospace",
			"cursive",
			"system-ui",
		]) {
			const t = new Text(0, 0, { font: generic, size: 16 });
			expect(t.font).toBe(`16px ${generic}`);
		}
	});

	it("handles a mixed stack: quotes the specific, leaves the generic bare", () => {
		const t = new Text(0, 0, { font: "Arial, sans-serif", size: 16 });
		expect(t.font).toBe('16px "Arial",sans-serif');
	});

	it("leaves an already-quoted family untouched", () => {
		const t = new Text(0, 0, { font: '"My Font"', size: 16 });
		expect(t.font).toBe('16px "My Font"');
	});

	it("matches generic families case-insensitively", () => {
		const t = new Text(0, 0, { font: "Sans-Serif", size: 16 });
		expect(t.font).toBe("16px Sans-Serif");
	});
});
