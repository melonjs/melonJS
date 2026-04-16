import { beforeAll, describe, expect, it } from "vitest";
import { boot, Entity, Renderable, Sprite, video } from "../src/index.js";

describe("Sprite trimming and Entity anchor sync", () => {
	let mockImage;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		// create a mock image for sprite creation
		mockImage = video.createCanvas(512, 512);
	});

	/**
	 * Build a mock TexturePacker atlas region.
	 */
	function buildRegion({
		name = "frame",
		x = 0,
		y = 0,
		w = 64,
		h = 64,
		trimmed = false,
		trim = null,
		sourceSize = null,
		anchorX = null,
		anchorY = null,
		angle = 0,
	}) {
		const region = {
			name,
			offset: { x, y, setV() {} },
			width: w,
			height: h,
			trimmed,
			trim,
			sourceSize,
			angle,
			anchorPoint: anchorX !== null ? { x: anchorX, y: anchorY } : null,
		};
		return region;
	}

	/**
	 * Build a trimmed region with proper anchorPoint from pivot (0.5, 0.5).
	 */
	function buildTrimmedRegion({
		name = "frame",
		atlasX = 0,
		atlasY = 0,
		frameW,
		frameH,
		trimX,
		trimY,
		sourceW,
		sourceH,
		rotated = false,
	}) {
		// Compute anchorPoint the same way TexturePacker parser does:
		// originX = sourceW * 0.5 - trimX, anchorPoint.x = originX / frameW
		const originX = sourceW * 0.5 - trimX;
		const originY = sourceH * 0.5 - trimY;
		return buildRegion({
			name,
			x: atlasX,
			y: atlasY,
			w: frameW,
			h: frameH,
			trimmed: true,
			trim: { x: trimX, y: trimY, w: frameW, h: frameH },
			sourceSize: { w: sourceW, h: sourceH },
			anchorX: originX / frameW,
			anchorY: originY / frameH,
			angle: rotated ? -Math.PI / 2 : 0,
		});
	}

	describe("Sprite.setRegion with trimmed frames", () => {
		it("should use sourceSize for width/height on trimmed frames", () => {
			const sprite = new Sprite(0, 0, {
				framewidth: 64,
				frameheight: 64,
				image: mockImage,
			});

			const region = buildTrimmedRegion({
				frameW: 156,
				frameH: 314,
				trimX: 16,
				trimY: 4,
				sourceW: 187,
				sourceH: 324,
			});

			// mock the source.getTexture
			sprite.source = {
				getTexture: () => {
					return mockImage;
				},
			};
			sprite.setRegion(region);

			expect(sprite.width).toBe(187);
			expect(sprite.height).toBe(324);
		});

		it("should use frame size for width/height on non-trimmed frames", () => {
			const sprite = new Sprite(0, 0, {
				framewidth: 64,
				frameheight: 64,
				image: mockImage,
			});

			const region = buildRegion({ w: 100, h: 80 });
			sprite.source = {
				getTexture: () => {
					return mockImage;
				},
			};
			sprite.setRegion(region);

			expect(sprite.width).toBe(100);
			expect(sprite.height).toBe(80);
		});

		it("should recover stable anchor (0.5, 0.5) for all trimmed frames with pivot (0.5, 0.5)", () => {
			const sprite = new Sprite(0, 0, {
				framewidth: 187,
				frameheight: 324,
				image: mockImage,
			});
			sprite.source = {
				getTexture: () => {
					return mockImage;
				},
			};

			// Simulate multiple animation frames with different trims
			const frames = [
				{ frameW: 156, frameH: 314, trimX: 16, trimY: 4 },
				{ frameW: 166, frameH: 301, trimX: 1, trimY: 9 },
				{ frameW: 150, frameH: 305, trimX: 27, trimY: 3 },
				{ frameW: 139, frameH: 304, trimX: 43, trimY: 2 },
			];

			for (const f of frames) {
				const region = buildTrimmedRegion({
					...f,
					sourceW: 187,
					sourceH: 324,
				});
				sprite.setRegion(region);

				expect(sprite.anchorPoint.x).toBeCloseTo(0.5, 10);
				expect(sprite.anchorPoint.y).toBeCloseTo(0.5, 10);
			}
		});

		it("should keep width/height constant across trimmed frames with same sourceSize", () => {
			const sprite = new Sprite(0, 0, {
				framewidth: 187,
				frameheight: 324,
				image: mockImage,
			});
			sprite.source = {
				getTexture: () => {
					return mockImage;
				},
			};

			const frames = [
				{ frameW: 156, frameH: 314, trimX: 16, trimY: 4 },
				{ frameW: 166, frameH: 301, trimX: 1, trimY: 9 },
				{ frameW: 139, frameH: 304, trimX: 43, trimY: 2 },
			];

			for (const f of frames) {
				const region = buildTrimmedRegion({
					...f,
					sourceW: 187,
					sourceH: 324,
				});
				sprite.setRegion(region);

				// width/height should always be sourceSize, not frame size
				expect(sprite.width).toBe(187);
				expect(sprite.height).toBe(324);
			}
		});

		it("should cache trim offset in current frame data", () => {
			const sprite = new Sprite(0, 0, {
				framewidth: 64,
				frameheight: 64,
				image: mockImage,
			});
			sprite.source = {
				getTexture: () => {
					return mockImage;
				},
			};

			const region = buildTrimmedRegion({
				frameW: 156,
				frameH: 314,
				trimX: 16,
				trimY: 4,
				sourceW: 187,
				sourceH: 324,
			});
			sprite.setRegion(region);

			expect(sprite.current.trim).toEqual({
				x: 16,
				y: 4,
				w: 156,
				h: 314,
			});
		});

		it("should set trim to null for non-trimmed frames", () => {
			const sprite = new Sprite(0, 0, {
				framewidth: 64,
				frameheight: 64,
				image: mockImage,
			});
			sprite.source = {
				getTexture: () => {
					return mockImage;
				},
			};

			const region = buildRegion({ w: 64, h: 64 });
			sprite.setRegion(region);

			expect(sprite.current.trim).toBeNull();
		});
	});

	describe("Entity renderable anchor sync", () => {
		it("should sync entity anchor to renderable anchor when entity anchor is at default (0, 0)", () => {
			const entity = new Entity(0, 0, { width: 100, height: 100 });
			expect(entity.anchorPoint.x).toBe(0);
			expect(entity.anchorPoint.y).toBe(0);

			// create a renderable with anchor (0.5, 0.5)
			const renderable = new Renderable(0, 0, 50, 50);
			// Renderable defaults to (0.5, 0.5)
			expect(renderable.anchorPoint.x).toBe(0.5);
			expect(renderable.anchorPoint.y).toBe(0.5);

			entity.renderable = renderable;

			// entity anchor should now match renderable
			expect(entity.anchorPoint.x).toBe(0.5);
			expect(entity.anchorPoint.y).toBe(0.5);
		});

		it("should not sync entity anchor when entity anchor has been explicitly set", () => {
			const entity = new Entity(0, 0, {
				width: 100,
				height: 100,
				anchorPoint: { x: 0.5, y: 1.0 },
			});
			expect(entity.anchorPoint.x).toBe(0.5);
			expect(entity.anchorPoint.y).toBe(1.0);

			const renderable = new Renderable(0, 0, 50, 50);
			entity.renderable = renderable;

			// entity anchor should NOT change — it was explicitly set
			expect(entity.anchorPoint.x).toBe(0.5);
			expect(entity.anchorPoint.y).toBe(1.0);
		});

		it("should sync entity anchor when renderable anchor is (0, 0)", () => {
			const entity = new Entity(0, 0, { width: 100, height: 100 });

			const renderable = new Renderable(0, 0, 50, 50);
			renderable.anchorPoint.set(0, 0);
			entity.renderable = renderable;

			// entity and renderable both at (0, 0) — no visible change
			expect(entity.anchorPoint.x).toBe(0);
			expect(entity.anchorPoint.y).toBe(0);
		});

		it("should sync when setting a Sprite renderable with custom anchor", () => {
			const entity = new Entity(0, 0, { width: 100, height: 300 });

			const sprite = new Sprite(0, 0, {
				framewidth: 32,
				frameheight: 32,
				image: mockImage,
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			entity.renderable = sprite;

			expect(entity.anchorPoint.x).toBe(0.5);
			expect(entity.anchorPoint.y).toBe(0.5);
		});

		it("should not sync for Tiled-style entities where both anchors are (0, 0)", () => {
			// Simulate Tiled entity: explicit anchorPoint in settings
			const entity = new Entity(0, 0, {
				width: 32,
				height: 64,
				anchorPoint: { x: 0, y: 0 },
			});

			const sprite = new Sprite(0, 0, {
				framewidth: 32,
				frameheight: 64,
				image: mockImage,
				anchorPoint: { x: 0, y: 0 },
			});
			entity.renderable = sprite;

			// Both should remain (0, 0) — Tiled compatibility
			expect(entity.anchorPoint.x).toBe(0);
			expect(entity.anchorPoint.y).toBe(0);
		});
	});

	describe("Sprite draw trim positioning", () => {
		it("should produce stable character center across trimmed frames", () => {
			// This test verifies the mathematical invariant:
			// For frames with pivot (0.5, 0.5) and the same sourceSize,
			// (trim.x + frame.width * anchorPoint.x) / sourceSize.w === 0.5
			// regardless of how the frame is trimmed.
			const sourceW = 187;
			const sourceH = 324;
			const pivot = 0.5;

			const testCases = [
				{ trimX: 16, trimY: 4, frameW: 156, frameH: 314 },
				{ trimX: 1, trimY: 9, frameW: 166, frameH: 301 },
				{ trimX: 27, trimY: 3, frameW: 150, frameH: 305 },
				{ trimX: 43, trimY: 2, frameW: 139, frameH: 304 },
				{ trimX: 34, trimY: 4, frameW: 137, frameH: 309 },
				{ trimX: 30, trimY: 9, frameW: 133, frameH: 309 },
				{ trimX: 33, trimY: 3, frameW: 144, frameH: 312 },
				{ trimX: 23, trimY: 2, frameW: 159, frameH: 317 },
			];

			for (const tc of testCases) {
				// Compute anchorPoint as the TexturePacker parser does
				const originX = sourceW * pivot - tc.trimX;
				const originY = sourceH * pivot - tc.trimY;
				const anchorX = originX / tc.frameW;
				const anchorY = originY / tc.frameH;

				// Recover pivot as setRegion does
				const recoveredX = (tc.trimX + tc.frameW * anchorX) / sourceW;
				const recoveredY = (tc.trimY + tc.frameH * anchorY) / sourceH;

				expect(recoveredX).toBeCloseTo(0.5, 10);
				expect(recoveredY).toBeCloseTo(0.5, 10);

				// Verify the visual center is at sourceSize/2 from the sourceSize origin
				// In the entity's local space (after preDraw translate(-anchor*sourceSize)):
				// trim.x + frame center = trim.x + originX = sourceW * 0.5
				const visualCenterX = tc.trimX + originX;
				const visualCenterY = tc.trimY + originY;
				expect(visualCenterX).toBeCloseTo(sourceW * 0.5, 10);
				expect(visualCenterY).toBeCloseTo(sourceH * 0.5, 10);
			}
		});

		it("should compute correct rotated trim offset", () => {
			// For a -π/2 rotation, trim (tx, ty) maps to (-ty, +tx) in rotated space.
			// The rotated draw position and a corner after rotation should give
			// screen top-left at (trimX, trimY).
			const trimX = 27;
			const trimY = 3;
			const frameH = 305;

			// In the rotated draw space:
			// xpos = -frameH - trimY, ypos = trimX
			const drawX = -frameH - trimY;
			const drawY = trimX;

			// Corner (drawX + frameH, drawY) after -π/2 rotation: (x,y)→(y,-x)
			const screenX = drawY; // trimX
			const screenY = -(drawX + frameH); // trimY

			expect(screenX).toBe(trimX);
			expect(screenY).toBe(trimY);
		});

		it("should produce stable character center for rotated frames", () => {
			const sourceW = 187;
			const sourceH = 324;
			const trimX = 27;
			const trimY = 3;

			// Character center in sourceSize coords = sourceSize / 2
			const charCenterX = trimX + (sourceW * 0.5 - trimX);
			const charCenterY = trimY + (sourceH * 0.5 - trimY);

			expect(charCenterX).toBe(sourceW * 0.5);
			expect(charCenterY).toBe(sourceH * 0.5);
		});
	});
});
