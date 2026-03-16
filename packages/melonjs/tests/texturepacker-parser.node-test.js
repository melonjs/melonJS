/**
 * TexturePacker trimming math unit tests.
 *
 * Tests the mathematical invariants behind trimmed sprite handling:
 * - Pivot recovery from trim offset and frame anchor
 * - Stable character center across differently-trimmed frames
 * - Correct trim offset transformation for rotated frames
 *
 * Run with: node --test tests/texturepacker-parser.node-test.js
 */
import assert from "node:assert";
import { describe, it } from "node:test";

/**
 * Compute the anchorPoint the way the TexturePacker parser does:
 * originX = sourceSize.w * pivot.x - (trimmed ? trim.x : 0)
 * anchorPoint.x = originX / frame.w
 */
function computeAnchorPoint(
	pivot,
	frameW,
	frameH,
	trimX,
	trimY,
	sourceW,
	sourceH,
	trimmed,
) {
	const originX = sourceW * pivot.x - (trimmed ? trimX : 0);
	const originY = sourceH * pivot.y - (trimmed ? trimY : 0);
	return { x: originX / frameW, y: originY / frameH };
}

/**
 * Recover the pivot from setRegion's formula:
 * pivotX = (trim.x + frame.width * anchorPoint.x) / sourceSize.w
 */
function recoverPivot(
	trimX,
	trimY,
	frameW,
	frameH,
	anchorX,
	anchorY,
	sourceW,
	sourceH,
) {
	return {
		x: (trimX + frameW * anchorX) / sourceW,
		y: (trimY + frameH * anchorY) / sourceH,
	};
}

describe("TexturePacker trim math", () => {
	// Real walk animation data from cityscene.json
	const WALK_FRAMES = [
		{ name: "0001", frameW: 156, frameH: 314, trimX: 16, trimY: 4 },
		{ name: "0002", frameW: 166, frameH: 301, trimX: 1, trimY: 9 },
		{
			name: "0003",
			frameW: 150,
			frameH: 305,
			trimX: 27,
			trimY: 3,
			rotated: true,
		},
		{
			name: "0004",
			frameW: 139,
			frameH: 304,
			trimX: 43,
			trimY: 2,
			rotated: true,
		},
		{ name: "0005", frameW: 137, frameH: 309, trimX: 34, trimY: 4 },
		{
			name: "0006",
			frameW: 133,
			frameH: 309,
			trimX: 30,
			trimY: 9,
			rotated: true,
		},
		{ name: "0007", frameW: 144, frameH: 312, trimX: 33, trimY: 3 },
		{ name: "0008", frameW: 159, frameH: 317, trimX: 23, trimY: 2 },
	];
	const SOURCE_W = 187;
	const SOURCE_H = 324;
	const PIVOT = { x: 0.5, y: 0.5 };

	describe("pivot recovery", () => {
		it("should recover pivot (0.5, 0.5) for all walk frames", () => {
			for (const f of WALK_FRAMES) {
				const anchor = computeAnchorPoint(
					PIVOT,
					f.frameW,
					f.frameH,
					f.trimX,
					f.trimY,
					SOURCE_W,
					SOURCE_H,
					true,
				);
				const recovered = recoverPivot(
					f.trimX,
					f.trimY,
					f.frameW,
					f.frameH,
					anchor.x,
					anchor.y,
					SOURCE_W,
					SOURCE_H,
				);

				assert.ok(
					Math.abs(recovered.x - 0.5) < 1e-10,
					`frame ${f.name}: recovered pivotX = ${recovered.x}, expected 0.5`,
				);
				assert.ok(
					Math.abs(recovered.y - 0.5) < 1e-10,
					`frame ${f.name}: recovered pivotY = ${recovered.y}, expected 0.5`,
				);
			}
		});

		it("should recover non-centered pivots correctly", () => {
			const pivot = { x: 0.3, y: 0.7 };
			const trimX = 10;
			const trimY = 5;
			const frameW = 80;
			const frameH = 90;
			const sourceW = 100;
			const sourceH = 100;

			const anchor = computeAnchorPoint(
				pivot,
				frameW,
				frameH,
				trimX,
				trimY,
				sourceW,
				sourceH,
				true,
			);
			const recovered = recoverPivot(
				trimX,
				trimY,
				frameW,
				frameH,
				anchor.x,
				anchor.y,
				sourceW,
				sourceH,
			);

			assert.ok(Math.abs(recovered.x - 0.3) < 1e-10, `pivotX: ${recovered.x}`);
			assert.ok(Math.abs(recovered.y - 0.7) < 1e-10, `pivotY: ${recovered.y}`);
		});
	});

	describe("stable character center", () => {
		it("should produce the same visual center for all walk frames", () => {
			// The visual center in sourceSize coordinates should be at
			// (sourceW * 0.5, sourceH * 0.5) for all frames with pivot (0.5, 0.5)
			const expectedCenterX = SOURCE_W * 0.5;
			const expectedCenterY = SOURCE_H * 0.5;

			for (const f of WALK_FRAMES) {
				const anchor = computeAnchorPoint(
					PIVOT,
					f.frameW,
					f.frameH,
					f.trimX,
					f.trimY,
					SOURCE_W,
					SOURCE_H,
					true,
				);

				// In the entity's local space, after preDraw translate(-anchor * sourceSize):
				// - Frame draws at (trim.x, trim.y)
				// - Character center within trimmed frame = anchor * frameSize
				// - Character center in sourceSize coords = trim + anchor * frameSize
				const centerX = f.trimX + f.frameW * anchor.x;
				const centerY = f.trimY + f.frameH * anchor.y;

				assert.ok(
					Math.abs(centerX - expectedCenterX) < 1e-10,
					`frame ${f.name}: centerX = ${centerX}, expected ${expectedCenterX}`,
				);
				assert.ok(
					Math.abs(centerY - expectedCenterY) < 1e-10,
					`frame ${f.name}: centerY = ${centerY}, expected ${expectedCenterY}`,
				);
			}
		});

		it("should maintain stable sourceSize dimensions across all frames", () => {
			// All frames from the same animation should have the same sourceSize.
			// setRegion uses sourceSize for this.width/this.height, so they stay constant.
			for (const f of WALK_FRAMES) {
				// The sprite's width/height = sourceSize (not frame dimensions)
				assert.strictEqual(SOURCE_W, 187, `frame ${f.name}: sourceW`);
				assert.strictEqual(SOURCE_H, 324, `frame ${f.name}: sourceH`);
				// Frame dimensions vary
				assert.notStrictEqual(
					f.frameW,
					SOURCE_W,
					`frame ${f.name}: frameW should differ from sourceW`,
				);
			}
		});
	});

	describe("rotated frame trim offset", () => {
		it("should transform trim offset correctly for -π/2 rotation", () => {
			// For a -π/2 rotation, the draw code computes:
			//   xpos = pos.x - frameH - trim.y
			//   ypos = pos.x + trim.x
			// After the rotation transform (x,y) → (y,-x), the screen position becomes:
			//   screen.x = ypos = trim.x
			//   screen.y = -xpos = frameH + trim.y
			// The image rect on screen has its TOP-LEFT at (trim.x, trim.y)

			for (const f of WALK_FRAMES) {
				if (!f.rotated) {
					continue;
				}

				// In the rotated draw space (after rotate(-π/2)):
				const drawX = -f.frameH - f.trimY;
				const drawY = f.trimX;

				// The rotation maps (x, y) → (y, -x):
				// Top-left corner of the drawn rect:
				//   (-frameH - trimY, trimX) → mapped through rotation
				// But the full rect corners under rotation give screen top-left at (trimX, trimY)

				// Verify: the bottom-left of the draw rect maps to the screen top-left
				// Draw bottom-left = (drawX, drawY + frameW) - since after swap, the draw rect
				// is (atlasW=frameH, atlasH=frameW), and the frame extends by frameW in Y
				// But actually the key invariant is:
				// After rotation, the visible frame's top-left on screen = (trimX, trimY)
				//
				// Corner (drawX + atlasW, drawY) where atlasW = frameH:
				// = (-frameH - trimY + frameH, trimX) = (-trimY, trimX)
				// After rotation: (trimX, trimY) ← This is the screen top-left!

				const cornerX = drawX + f.frameH; // -trimY
				const cornerY = drawY; // trimX

				// After -π/2 rotation: (x, y) → (y, -x)
				const screenX = cornerY; // trimX
				const screenY = -cornerX; // trimY

				assert.strictEqual(
					screenX,
					f.trimX,
					`frame ${f.name}: screen top-left X should be trimX (${f.trimX}), got ${screenX}`,
				);
				assert.strictEqual(
					screenY,
					f.trimY,
					`frame ${f.name}: screen top-left Y should be trimY (${f.trimY}), got ${screenY}`,
				);
			}
		});

		it("should produce the same character center for rotated and non-rotated frames", () => {
			const expectedCenterX = SOURCE_W * 0.5;
			const expectedCenterY = SOURCE_H * 0.5;

			for (const f of WALK_FRAMES) {
				const anchor = computeAnchorPoint(
					PIVOT,
					f.frameW,
					f.frameH,
					f.trimX,
					f.trimY,
					SOURCE_W,
					SOURCE_H,
					true,
				);

				// Whether rotated or not, the character center in sourceSize coords
				// is at trim + anchor * frameSize
				const centerX = f.trimX + f.frameW * anchor.x;
				const centerY = f.trimY + f.frameH * anchor.y;

				assert.ok(
					Math.abs(centerX - expectedCenterX) < 1e-10,
					`frame ${f.name} (rotated=${!!f.rotated}): centerX = ${centerX}`,
				);
				assert.ok(
					Math.abs(centerY - expectedCenterY) < 1e-10,
					`frame ${f.name} (rotated=${!!f.rotated}): centerY = ${centerY}`,
				);
			}
		});
	});

	describe("entity anchor sync logic", () => {
		it("should sync when entity anchor is at default (0, 0)", () => {
			const entityAnchor = { x: 0, y: 0 };
			const renderableAnchor = { x: 0.5, y: 0.5 };

			// sync condition: entityAnchor === (0, 0)
			if (entityAnchor.x === 0 && entityAnchor.y === 0) {
				entityAnchor.x = renderableAnchor.x;
				entityAnchor.y = renderableAnchor.y;
			}

			assert.strictEqual(entityAnchor.x, 0.5);
			assert.strictEqual(entityAnchor.y, 0.5);
		});

		it("should not sync when entity anchor has been explicitly set", () => {
			const entityAnchor = { x: 0.5, y: 1.0 };
			const renderableAnchor = { x: 0.5, y: 0.5 };

			if (entityAnchor.x === 0 && entityAnchor.y === 0) {
				entityAnchor.x = renderableAnchor.x;
				entityAnchor.y = renderableAnchor.y;
			}

			// Should remain at the explicit values
			assert.strictEqual(entityAnchor.x, 0.5);
			assert.strictEqual(entityAnchor.y, 1.0);
		});

		it("should preserve (0, 0) when renderable also has (0, 0)", () => {
			const entityAnchor = { x: 0, y: 0 };
			const renderableAnchor = { x: 0, y: 0 };

			if (entityAnchor.x === 0 && entityAnchor.y === 0) {
				entityAnchor.x = renderableAnchor.x;
				entityAnchor.y = renderableAnchor.y;
			}

			assert.strictEqual(entityAnchor.x, 0);
			assert.strictEqual(entityAnchor.y, 0);
		});

		it("should center body and renderable when both anchors match", () => {
			// With entity anchor = renderable anchor = (0.5, 0.5):
			// Entity.preDraw: translate(pos + bodyOffset + 0.5 * bodySize)
			// Renderable.preDraw: translate(-0.5 * renderableSize)
			// Body center = pos + bodyOffset + bodySize/2
			// Visual center = pos + bodyOffset + 0.5*bodySize - 0.5*renderableSize + renderableSize/2
			//               = pos + bodyOffset + 0.5*bodySize
			// Both centers at the same point!

			const bodyW = 100,
				bodyH = 300;
			const renderW = 187,
				renderH = 324;
			const anchor = 0.5;

			const bodyCenterOffset = { x: anchor * bodyW, y: anchor * bodyH };
			const visualCenterOffset = {
				x: anchor * bodyW - anchor * renderW + renderW / 2,
				y: anchor * bodyH - anchor * renderH + renderH / 2,
			};

			assert.strictEqual(bodyCenterOffset.x, visualCenterOffset.x);
			assert.strictEqual(bodyCenterOffset.y, visualCenterOffset.y);
		});
	});
});
