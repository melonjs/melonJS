import {
	ClippingAttachment,
	MeshAttachment,
	RegionAttachment,
	SkeletonClipping,
} from "@esotericsoftware/spine-core";
import { Color as MColor, Math as MMath, Polygon } from "melonjs";

// World vertices are stored positions-only (stride 2). UVs come straight
// from the spine sequence (`sequence.getUVs(index)`), passed to drawMesh
// alongside the position buffer — no interleave step, no copy.
// Per-vertex color isn't needed either: canvas tinting is applied per slot
// through renderer.setTint() / setGlobalAlpha() before the mesh is drawn.

/**
 * Spine blend mode enum to melonJS blend mode string mapping
 */
const BLEND_MODES = ["normal", "additive", "multiply", "screen"];

// debug rendering colors
const DEBUG_REGION_COLOR = "green";
const DEBUG_MESH_COLOR = "yellow";
const DEBUG_CLIP_COLOR = "blue";

// shared vertex buffer (positions only, stride 2), grown as needed
let worldVertices = new Float32Array(2 * 1024);

/**
 * @classdesc
 * A Canvas-based Spine skeleton renderer that draws through melonJS's
 * canvas renderer API (drawImage, transform, setTint, setMask, etc.).
 * This provides proper integration with melonJS's canvas rendering pipeline
 * including tinting, blend modes, and clipping support.
 */
export default class SkeletonRenderer {
	/**
	 * Whether to enable triangle rendering for mesh attachments.
	 * When false, only region (image) attachments are rendered using the
	 * fast bone-transform path. Automatically enabled by Spine when the
	 * skeleton contains mesh attachments.
	 * @type {boolean}
	 * @default false
	 */
	triangleRendering = false;

	/**
	 * Whether to render debug outlines for regions, meshes, and clips
	 * @type {boolean}
	 * @default false
	 */
	debugRendering = false;

	/**
	 * Whether textures use premultiplied alpha
	 * @type {boolean}
	 * @default false
	 */
	premultipliedAlpha = false;

	// reusable color instance to avoid allocations
	tintColor = new MColor();

	// clipping state
	clipper = new SkeletonClipping();
	clippingVertices = [];
	clippingMask = new Polygon(0, 0, [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
	]);

	/**
	 * Draw the given skeleton using the melonJS canvas renderer.
	 * @param {CanvasRenderer} renderer - the melonJS canvas renderer
	 * @param {Skeleton} skeleton - the Spine skeleton to draw
	 */
	draw(renderer, skeleton) {
		const clipper = this.clipper;
		const drawOrder = skeleton.drawOrder.appliedPose;
		const skeletonColor = skeleton.color;
		const clippingMask = this.clippingMask;
		const debugRendering = this.debugRendering;

		for (let i = 0, n = drawOrder.length; i < n; i++) {
			const slot = drawOrder[i];
			const bone = slot.bone;
			let image;
			let region;
			let triangles;
			let meshUVs;

			if (!bone.active) {
				clipper.clipEnd(slot);
				renderer.clearMask();
				continue;
			}

			const slotPose = slot.appliedPose;
			const attachment = slotPose.attachment;

			if (attachment instanceof RegionAttachment) {
				const sequence = attachment.sequence;
				region = sequence.regions[sequence.resolveIndex(slotPose)];
				image = region.texture.getImage();
			} else if (
				this.triangleRendering &&
				attachment instanceof MeshAttachment
			) {
				const sequence = attachment.sequence;
				const sequenceIndex = sequence.resolveIndex(slotPose);
				if (worldVertices.length < attachment.worldVerticesLength) {
					worldVertices = new Float32Array(attachment.worldVerticesLength);
				}
				// stride 2 — positions only; UVs come from sequence.getUVs()
				attachment.computeWorldVertices(
					skeleton,
					slot,
					0,
					attachment.worldVerticesLength,
					worldVertices,
					0,
					2,
				);
				meshUVs = sequence.getUVs(sequenceIndex);
				triangles = attachment.triangles;
				region = sequence.regions[sequenceIndex];
				image = region.texture.getImage();
			} else if (attachment instanceof ClippingAttachment) {
				const vertices = this.clippingVertices;
				clipper.clipStart(skeleton, slot, attachment);
				attachment.computeWorldVertices(
					skeleton,
					slot,
					0,
					attachment.worldVerticesLength,
					vertices,
					0,
					2,
				);
				clippingMask.setVertices(vertices, attachment.worldVerticesLength);
				if (debugRendering) {
					renderer.setColor(DEBUG_CLIP_COLOR);
					renderer.stroke(clippingMask);
				}
				continue;
			} else {
				clipper.clipEnd(slot);
				renderer.clearMask();
				continue;
			}

			if (image) {
				const slotColor = slotPose.color;
				const regionColor = attachment.color;
				const color = this.tintColor;

				renderer.save();

				color.setFloat(
					skeletonColor.r * slotColor.r * regionColor.r,
					skeletonColor.g * slotColor.g * regionColor.g,
					skeletonColor.b * slotColor.b * regionColor.b,
					skeletonColor.a * slotColor.a * regionColor.a,
				);

				// melonJS Color exposes alpha as `.alpha`, NOT `.a` — reading
				// `color.a` is undefined and the canvas spec silently ignores
				// an undefined globalAlpha assignment, so slot-alpha animation
				// would never fade attachments under Canvas
				renderer.setGlobalAlpha(color.alpha);
				renderer.setTint(color);
				renderer.setBlendMode(
					BLEND_MODES[slot.data.blendMode],
					this.premultipliedAlpha,
				);

				if (triangles) {
					this.drawMesh(renderer, image, worldVertices, meshUVs, triangles);
				} else {
					this.drawRegion(
						renderer,
						image,
						bone,
						attachment,
						slotPose,
						region,
						clipper.isClipping() ? clippingMask : null,
						debugRendering,
					);
				}

				renderer.restore();
			}
			clipper.clipEnd(slot);
			renderer.clearMask();
		}
		clipper.clipEnd();
	}

	/**
	 * Draw a region attachment (single quad image).
	 * @param {CanvasRenderer} renderer
	 * @param {HTMLImageElement} image
	 * @param {Bone} bone
	 * @param {RegionAttachment} attachment
	 * @param {SlotPose} slotPose - the slot's applied pose (resolves sequence offsets)
	 * @param {TextureRegion} region
	 * @param {Polygon|null} mask - clipping mask if active
	 * @param {boolean} debug - whether to draw debug outline
	 * @ignore
	 */
	drawRegion(renderer, image, bone, attachment, slotPose, region, mask, debug) {
		const atlasScale = attachment.width / region.originalWidth;
		const bonePose = bone.appliedPose;
		const offsets = attachment.getOffsets(slotPose);
		let w = region.width;
		let h = region.height;

		renderer.transform(
			bonePose.a,
			bonePose.c,
			bonePose.b,
			bonePose.d,
			bonePose.worldX,
			bonePose.worldY,
		);
		renderer.translate(offsets[0], offsets[1]);
		renderer.rotate(MMath.degToRad(attachment.rotation));
		renderer.scale(
			atlasScale * attachment.scaleX,
			atlasScale * attachment.scaleY,
		);
		// Translate to the CENTER of the texture region (pre-rotation
		// dimensions — for a 90°-rotated atlas region, the texels in the
		// atlas are stored rotated, so the center is still at the
		// pre-rotation midpoint here).
		renderer.translate(w / 2, h / 2);
		if (region.degrees === 90) {
			// the atlas region is stored 90° rotated — un-rotate, and
			// from now on `w`/`h` reflect the upright dest-quad dimensions
			const t = w;
			w = h;
			h = t;
			renderer.rotate(-MMath.ETA);
		}
		// Y-flip to undo Spine's Y-up source orientation, then translate
		// to the TOP-LEFT of the upright dst quad — note `w`/`h` here are
		// post-swap, so for 90°-rotated atlas regions this correctly
		// uses the upright dest dimensions instead of the (incorrect)
		// pre-rotation halves. Matches the official spine-canvas
		// SkeletonRenderer.drawImages path.
		renderer.scale(1, -1);
		renderer.translate(-w / 2, -h / 2);

		if (mask) {
			renderer.setMask(mask);
		}
		renderer.drawImage(
			image,
			image.width * region.u,
			image.height * region.v,
			w,
			h,
			0,
			0,
			w,
			h,
		);

		if (debug) {
			renderer.setColor(DEBUG_REGION_COLOR);
			renderer.strokeRect(0, 0, w, h);
		}
	}

	/**
	 * Draw a mesh attachment as a series of textured triangles.
	 * @param {CanvasRenderer} renderer
	 * @param {HTMLImageElement} image
	 * @param {Float32Array} vertices - world positions, stride 2 (x, y per vertex)
	 * @param {NumberArrayLike} uvs - atlas UVs from `sequence.getUVs(index)`, stride 2
	 * @param {number[]} triangles - triangle indices
	 * @ignore
	 */
	drawMesh(renderer, image, vertices, uvs, triangles) {
		// subtract 1 pixel to avoid edge bleeding (matches official spine-canvas)
		const imgW = image.width - 1;
		const imgH = image.height - 1;

		for (let j = 0; j < triangles.length; j += 3) {
			const t1 = triangles[j] * 2;
			const t2 = triangles[j + 1] * 2;
			const t3 = triangles[j + 2] * 2;

			this.drawTriangle(
				renderer,
				image,
				vertices[t1],
				vertices[t1 + 1],
				uvs[t1] * imgW,
				uvs[t1 + 1] * imgH,
				vertices[t2],
				vertices[t2 + 1],
				uvs[t2] * imgW,
				uvs[t2 + 1] * imgH,
				vertices[t3],
				vertices[t3 + 1],
				uvs[t3] * imgW,
				uvs[t3 + 1] * imgH,
			);
		}
	}

	/**
	 * Draw a single textured triangle using affine transform.
	 * @ignore
	 */
	drawTriangle(renderer, img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
		renderer.save();
		renderer.beginPath();
		renderer.moveTo(x0, y0);
		renderer.lineTo(x1, y1);
		renderer.lineTo(x2, y2);
		renderer.closePath();
		renderer.setMask();

		// compute affine transform from UV to screen space
		const dx1 = x1 - x0;
		const dy1 = y1 - y0;
		const dx2 = x2 - x0;
		const dy2 = y2 - y0;
		const du1 = u1 - u0;
		const dv1 = v1 - v0;
		const du2 = u2 - u0;
		const dv2 = v2 - v0;

		const rawDet = du1 * dv2 - du2 * dv1;
		if (rawDet === 0) {
			// degenerate triangle — skip
			renderer.clearMask();
			renderer.restore();
			return;
		}
		const det = 1 / rawDet;
		const a = (dv2 * dx1 - dv1 * dx2) * det;
		const b = (dv2 * dy1 - dv1 * dy2) * det;
		const c = (du1 * dx2 - du2 * dx1) * det;
		const d = (du1 * dy2 - du2 * dy1) * det;
		const e = x0 - a * u0 - c * v0;
		const f = y0 - b * u0 - d * v0;

		renderer.transform(a, b, c, d, e, f);
		renderer.drawImage(img, 0, 0);
		renderer.clearMask();
		renderer.restore();

		if (this.debugRendering) {
			renderer.setColor(DEBUG_MESH_COLOR);
			renderer.stroke();
		}
	}
}
