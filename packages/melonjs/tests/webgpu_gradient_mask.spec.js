import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import { WebGPURenderer } from "../src/index.js";

/**
 * The gradientMask state machine — the GL #gradientMask parity port —
 * exercised through the real prototype over a recording stub, so the
 * phase ordering (tag/mark → test → untag → restore), the stencil
 * references, and the gradient handoff to fillRect are pinned without
 * a GPU device.
 */
function createStub({ maskLevel = 0, maskVisibleRef = 0 } = {}) {
	const log = [];
	const stub = {
		log,
		currentGradient: { id: "grad" },
		maskLevel,
		maskVisibleRef,
		stencilMode: maskLevel > 0 ? "test" : "none",
		renderPass: maskLevel > 0 ? { end() {} } : null,
		currentBatcher: {
			flush() {
				log.push("flush");
			},
		},
		beginPass(options) {
			log.push(`beginPass:${options?.stencilLoadOp ?? "load"}`);
			this.renderPass = this.passObject;
		},
		passObject: {
			setStencilReference(ref) {
				log.push(`ref:${ref}`);
			},
		},
		ensurePass() {
			log.push(`mode:${this.stencilMode}`);
			return this.passObject;
		},
		fillRect(x, y, w, h) {
			log.push(
				`fillRect:${x},${y},${w},${h}:${this.currentGradient ? "gradient" : "solid"}`,
			);
		},
	};
	// the pass "end" used when breaking for the stencil clear
	if (stub.renderPass) {
		stub.renderPass = {
			end() {
				log.push("endPass");
			},
		};
	}
	return stub;
}

const gradientMask = WebGPURenderer.prototype.gradientMask;

describe("WebGPURenderer.gradientMask (state machine)", () => {
	it("outside a mask: clears the stencil, tags with ref 1, clips the gradient, restores none", () => {
		const stub = createStub();
		const shape = () => {
			stub.log.push(
				`shape:${stub.stencilMode}:${stub.currentGradient ? "gradient" : "solid"}`,
			);
		};

		gradientMask.call(stub, shape, 5, 6, 70, 80);

		expect(stub.log).toEqual([
			"flush",
			// stencil clear = pass break
			"beginPass:clear",
			// tag phase: shape drawn solid under "tag" with ref 1
			"mode:tag",
			"ref:1",
			"shape:tag:solid",
			"flush",
			// gradient rect clipped to the tagged pixels
			"mode:test",
			"ref:1",
			"fillRect:5,6,70,80:gradient",
			"flush",
			// restore: stencil ignored again, reference back to the mask's
			"mode:none",
			"ref:0",
		]);
		expect(stub.stencilMode).toBe("none");
		expect(stub.currentGradient).toEqual({ id: "grad" });
	});

	it("inside a mask: marks visible pixels with the high bit, clips, strips the marker, re-installs the mask test", () => {
		const stub = createStub({ maskLevel: 2, maskVisibleRef: 2 });
		const shape = () => {
			stub.log.push(
				`shape:${stub.stencilMode}:${stub.currentGradient ? "gradient" : "solid"}`,
			);
		};

		gradientMask.call(stub, shape, 0, 0, 10, 10);

		const markRef = 0x80 | 2;
		expect(stub.log).toEqual([
			"flush",
			// tag only pixels visible under the active mask (no stencil
			// clear — the mask levels must survive)
			"mode:mark",
			`ref:${markRef}`,
			"shape:mark:solid",
			"flush",
			// gradient clipped to the marker
			"mode:test",
			`ref:${markRef}`,
			"fillRect:0,0,10,10:gradient",
			"flush",
			// strip the marker back to the visible value
			"mode:mark",
			"ref:2",
			"shape:mark:solid",
			"flush",
			// the exact render test setMask had established
			"mode:test",
			"ref:2",
		]);
		expect(stub.stencilMode).toBe("test");
		expect(stub.maskLevel).toBe(2);
		expect(stub.currentGradient).toEqual({ id: "grad" });
	});

	it("never breaks the pass when a mask is active (mask levels live in the stencil)", () => {
		const stub = createStub({ maskLevel: 1, maskVisibleRef: 1 });
		gradientMask.call(stub, () => {}, 0, 0, 1, 1);
		expect(stub.log).not.toContain("beginPass:clear");
		expect(stub.log).not.toContain("endPass");
	});
});
