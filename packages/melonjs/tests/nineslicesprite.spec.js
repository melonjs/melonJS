import { beforeAll, describe, expect, it, vi } from "vitest";
import { boot, NineSliceSprite, video } from "../src/index.js";

/**
 * NineSliceSprite — 9-slice scaling. The class had ZERO coverage, despite the
 * draw() being a non-trivial separable 3×3 grid (4 unscaled corners, 2 stretched
 * edges per axis, 1 stretched center) sourced from a frame/atlas region and
 * blitted into an arbitrary "expanded" target size.
 *
 * These specs pin down the geometry directly: a recording renderer captures every
 * drawImage(image, sx,sy,sw,sh, dx,dy,dw,dh) so we can assert the slices tile both
 * the source frame AND the destination exactly, corners stay unscaled, and — the
 * #1115 regression — that ANIMATING a NineSliceSprite does not let the per-frame
 * source size clobber the expanded (nss) target size.
 */

// a filled canvas usable as a sprite source (blank canvases upload fine too, but
// filling keeps getTexture()/getImage() happy across renderers)
const makeImage = (w, h) => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	c.getContext("2d").fillRect(0, 0, w, h);
	return c;
};

// a renderer that records the rect args of every drawImage, and counts the
// transform calls the rotated-frame branch makes. draw() touches nothing else.
const makeRecorder = () => {
	const calls = [];
	return {
		calls,
		translate: vi.fn(),
		rotate: vi.fn(),
		drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
			calls.push({ sx, sy, sw, sh, dx, dy, dw, dh });
		},
	};
};

// collapse the 9 calls onto one axis into its distinct [start → size] columns
// (top-left and bottom-left share the same dx, etc. → deduped to 3 entries)
const axis = (calls, startKey, sizeKey) => {
	const bySize = new Map();
	for (const c of calls) {
		bySize.set(c[startKey], c[sizeKey]);
	}
	const starts = [...bySize.keys()].sort((a, b) => {
		return a - b;
	});
	return {
		starts,
		sizes: starts.map((s) => {
			return bySize.get(s);
		}),
	};
};

// assert a 3-column/row axis is contiguous (no gaps, no overlap) and spans `total`
const expectTiles = (a, total) => {
	expect(a.starts.length).toBe(3);
	// each slice's end meets the next slice's start
	expect(a.starts[0] + a.sizes[0]).toBeCloseTo(a.starts[1], 6);
	expect(a.starts[1] + a.sizes[1]).toBeCloseTo(a.starts[2], 6);
	// full span = sum of the three sizes
	expect(a.sizes[0] + a.sizes[1] + a.sizes[2]).toBeCloseTo(total, 6);
};

describe("NineSliceSprite", () => {
	beforeAll(() => {
		boot();
		video.init(256, 256, { parent: "screen", renderer: video.CANVAS });
	});

	// ── construction ─────────────────────────────────────────────────────────

	it("throws when width is missing", () => {
		expect(() => {
			return new NineSliceSprite(0, 0, {
				image: makeImage(32, 32),
				height: 100,
			});
		}).toThrow();
	});

	it("throws when height is missing", () => {
		expect(() => {
			return new NineSliceSprite(0, 0, {
				image: makeImage(32, 32),
				width: 100,
			});
		}).toThrow();
	});

	it("stores the expanded size in width/height AND nss_width/nss_height", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
		});
		expect(nss.width).toBe(200);
		expect(nss.height).toBe(120);
		expect(nss.nss_width).toBe(200);
		expect(nss.nss_height).toBe(120);
	});

	it("floors fractional width/height", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200.9,
			height: 120.4,
		});
		expect(nss.width).toBe(200);
		expect(nss.height).toBe(120);
	});

	// ── static draw geometry ───────────────────────────────────────────────────

	it("issues exactly 9 drawImage calls", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
		});
		const r = makeRecorder();
		nss.draw(r);
		expect(r.calls.length).toBe(9);
	});

	it("destination slices tile the full expanded area, no gaps/overlap", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
		});
		const r = makeRecorder();
		nss.draw(r);
		expectTiles(axis(r.calls, "dx", "dw"), 200);
		expectTiles(axis(r.calls, "dy", "dh"), 120);
	});

	it("source slices tile the full frame, no gaps/overlap", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
		});
		const r = makeRecorder();
		nss.draw(r);
		expectTiles(axis(r.calls, "sx", "sw"), 64);
		expectTiles(axis(r.calls, "sy", "sh"), 64);
	});

	it("the four corners are unscaled — only the center column/row stretch", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
		});
		const r = makeRecorder();
		nss.draw(r);
		// default inset = quarter of a 64px frame → 16px corners
		const corners = r.calls.filter((c) => {
			return c.sw === 16 && c.sh === 16;
		});
		expect(corners.length).toBe(4);
		// every corner is blitted 1:1 (source size === dest size)
		for (const c of corners) {
			expect(c.dw).toBe(c.sw);
			expect(c.dh).toBe(c.sh);
		}
		// exactly one slice scales on BOTH axes (the center)
		const center = r.calls.filter((c) => {
			return c.dw !== c.sw && c.dh !== c.sh;
		});
		expect(center.length).toBe(1);
	});

	it("default inset is a quarter of the frame", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(80, 40),
			width: 300,
			height: 200,
		});
		const r = makeRecorder();
		nss.draw(r);
		// corners: 80/4 = 20 wide, 40/4 = 10 tall
		expect(axis(r.calls, "sx", "sw").sizes[0]).toBe(20);
		expect(axis(r.calls, "sy", "sh").sizes[0]).toBe(10);
	});

	it("honors custom insetx/insety", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
			insetx: 10,
			insety: 8,
		});
		const r = makeRecorder();
		nss.draw(r);
		const sxA = axis(r.calls, "sx", "sw");
		const syA = axis(r.calls, "sy", "sh");
		expect(sxA.sizes[0]).toBe(10); // left corner
		expect(sxA.sizes[2]).toBe(10); // right corner
		expect(syA.sizes[0]).toBe(8);
		expect(syA.sizes[2]).toBe(8);
		// dest corners stay at the inset size; only spans differ
		expect(axis(r.calls, "dx", "dw").sizes[0]).toBe(10);
		expect(axis(r.calls, "dy", "dh").sizes[2]).toBe(8);
	});

	it("the public width/height setter resizes the panel for the next draw", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
		});
		nss.width = 300;
		nss.height = 90;
		expect(nss.nss_width).toBe(300);
		expect(nss.nss_height).toBe(90);
		const r = makeRecorder();
		nss.draw(r);
		expectTiles(axis(r.calls, "dx", "dw"), 300);
		expectTiles(axis(r.calls, "dy", "dh"), 90);
	});

	// ── adversarial ────────────────────────────────────────────────────────────

	it("ADVERSARIAL #1115: animating must NOT clobber the expanded size", () => {
		// 128×32 sheet → four 32×32 frames; panel expanded to 200×120
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(128, 32),
			framewidth: 32,
			frameheight: 32,
			width: 200,
			height: 120,
		});
		nss.addAnimation("walk", [0, 1, 2, 3], 100);
		nss.setCurrentAnimation("walk");

		// baseline before any frame advance
		expect(nss.width).toBe(200);
		expect(nss.height).toBe(120);

		// advance a couple of frames — _applyFrame runs each time
		nss.update(100); // → frame 1
		nss.update(100); // → frame 2

		// the expanded target must survive frame application (the bug shrank it
		// to the 32px frame source size)
		expect(nss.width).toBe(200);
		expect(nss.height).toBe(120);
		expect(nss.nss_width).toBe(200);
		expect(nss.nss_height).toBe(120);

		const r = makeRecorder();
		nss.draw(r);
		// destination still spans the full expanded panel …
		expectTiles(axis(r.calls, "dx", "dw"), 200);
		expectTiles(axis(r.calls, "dy", "dh"), 120);
		// … while the SOURCE now tiles the current 32px frame (proves the frame
		// was swapped in, not the whole panel resized)
		expectTiles(axis(r.calls, "sx", "sw"), 32);
		expectTiles(axis(r.calls, "sy", "sh"), 32);
		// and the source window sits on frame 2 (offset x = 64)
		expect(
			Math.min(
				...r.calls.map((c) => {
					return c.sx;
				}),
			),
		).toBe(64);
	});

	it("ADVERSARIAL: a frame swap keeps the bounds at the expanded size", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(128, 32),
			framewidth: 32,
			frameheight: 32,
			width: 200,
			height: 120,
		});
		nss.addAnimation("walk", [0, 1, 2, 3], 100);
		nss.setCurrentAnimation("walk");
		const before = nss.getBounds().clone();
		nss.update(100);
		const after = nss.getBounds();
		expect(after.width).toBe(before.width);
		expect(after.height).toBe(before.height);
		expect(after.width).toBe(200);
		expect(after.height).toBe(120);
	});

	it("ADVERSARIAL: inset larger than half the target → negative center slice, still 9 finite calls", () => {
		// corners 16+16 = 32 > target 20 → center span goes negative; the math must
		// stay finite and the corners must still be correct (no NaN, no crash)
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 20,
			height: 20,
		});
		const r = makeRecorder();
		expect(() => {
			return nss.draw(r);
		}).not.toThrow();
		expect(r.calls.length).toBe(9);
		for (const c of r.calls) {
			for (const v of Object.values(c)) {
				expect(Number.isFinite(v)).toBe(true);
			}
		}
		// corners 16+16 = 32 > target 20 → the center column/row span goes
		// negative (documented degenerate result), 3 cells each (the center
		// column over 3 rows, the center row over 3 columns)
		const negW = r.calls.filter((c) => {
			return c.dw < 0;
		});
		const negH = r.calls.filter((c) => {
			return c.dh < 0;
		});
		expect(negW.length).toBe(3);
		expect(negH.length).toBe(3);
		expect(negW[0].dw).toBeCloseTo(-12, 6); // 20 - 2 × 16
	});

	it("ADVERSARIAL: target exactly twice the inset → zero-width center slice", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 32, // == 2 × (64/4)
			height: 32,
		});
		const r = makeRecorder();
		nss.draw(r);
		expect(r.calls.length).toBe(9);
		// center column has zero dest width (3 cells), center row zero height
		const zeroW = r.calls.filter((c) => {
			return c.dw === 0;
		});
		const zeroH = r.calls.filter((c) => {
			return c.dh === 0;
		});
		expect(zeroW.length).toBe(3);
		expect(zeroH.length).toBe(3);
	});

	it("ADVERSARIAL: a TexturePacker-rotated frame swaps source dims and still tiles", () => {
		// a 64×48 frame packed at 90° — draw() must rotate the ctx and treat the
		// frame as 48×64 for slicing, while the dest still spans the expanded panel
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 48),
			width: 200,
			height: 120,
		});
		// force the rotated-region path (normally set by the atlas loader)
		nss.current.angle = -Math.PI / 2;
		const r = makeRecorder();
		nss.draw(r);
		expect(r.translate).toHaveBeenCalledTimes(1);
		expect(r.rotate).toHaveBeenCalledTimes(1);
		expect(r.calls.length).toBe(9);
		// source dims are swapped: width sourced as the frame's 48px height
		expectTiles(axis(r.calls, "sx", "sw"), 48);
		expectTiles(axis(r.calls, "sy", "sh"), 64);
		// destination still tiles the full expanded panel
		expectTiles(axis(r.calls, "dx", "dw"), 200);
		expectTiles(axis(r.calls, "dy", "dh"), 120);
	});

	it("ADVERSARIAL: non-square frame into non-square target tiles each axis independently", () => {
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(40, 80),
			width: 333,
			height: 77,
			insetx: 7,
			insety: 13,
		});
		const r = makeRecorder();
		nss.draw(r);
		// source: 7 | 40-14=26 | 7  and  13 | 80-26=54 | 13
		expect(axis(r.calls, "sx", "sw").sizes).toEqual([7, 26, 7]);
		expect(axis(r.calls, "sy", "sh").sizes).toEqual([13, 54, 13]);
		// dest: 7 | 333-14=319 | 7  and  13 | 77-26=51 | 13
		expect(axis(r.calls, "dx", "dw").sizes).toEqual([7, 319, 7]);
		expect(axis(r.calls, "dy", "dh").sizes).toEqual([13, 51, 13]);
	});

	it("ADVERSARIAL: applying an atlas region honors its pivot anchor AND keeps the expanded size (the UI grey_panel path)", () => {
		// the UI example builds its panel from an atlas region carrying a pivot;
		// the frame application must apply that anchor (it comes ONLY from the
		// base _applyFrame) while leaving the expanded size intact. This fails if
		// the override either skips the anchor work OR lets the frame size win.
		const nss = new NineSliceSprite(0, 0, {
			image: makeImage(64, 64),
			width: 200,
			height: 120,
		});
		// mock the texture source so setRegion can resolve the sub-texture
		nss.source = {
			getTexture: () => {
				return nss.image;
			},
			getFormat: () => {
				return "Spritesheet (fixed cell size)";
			},
		};
		// an untrimmed atlas region with a non-default pivot
		nss.setRegion({
			name: "panel",
			offset: { x: 0, y: 0, setV() {} },
			width: 100,
			height: 100,
			trimmed: false,
			trim: null,
			sourceSize: null,
			angle: 0,
			anchorPoint: { x: 0.3, y: 0.7 },
		});
		// the base resolved the pivot into anchorPoint …
		expect(nss.anchorPoint.x).toBeCloseTo(0.3, 6);
		expect(nss.anchorPoint.y).toBeCloseTo(0.7, 6);
		// … while the expanded target survived the frame application
		expect(nss.width).toBe(200);
		expect(nss.height).toBe(120);
		expect(nss.nss_width).toBe(200);
		expect(nss.nss_height).toBe(120);
	});
});
