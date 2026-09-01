import {
	ClippingAttachment,
	RegionAttachment,
	SkeletonRendererCore,
} from "@esotericsoftware/spine-core";
import { Color as MColor, Math as MMath, Polygon } from "melonjs";

// Geometry (mesh vertices, clipping, batching) comes from spine-core's
// renderer-agnostic `SkeletonRendererCore` — the same pass spine-canvaskit
// and spine-construct3 build on. It hands back a linked list of batched
// render commands (positions, UVs, packed colors, indices, blend mode,
// texture); all this class does is replay them through melonJS's canvas
// renderer API (transform, drawImage, setTint, setGlobalAlpha, setMask).
//
// Vertices are requested positions-only (stride 2): UVs arrive in their own
// buffer, and per-vertex color is uniform across a command — the core only
// batches slots that share a color — so canvas tinting is applied once per
// command through setTint() / setGlobalAlpha() instead of per vertex.
const VERTEX_SIZE = 2;

/**
 * Spine blend mode enum to melonJS blend mode string mapping
 */
const BLEND_MODES = ["normal", "additive", "multiply", "screen"];

// debug rendering colors
const DEBUG_REGION_COLOR = "green";
const DEBUG_MESH_COLOR = "yellow";
const DEBUG_CLIP_COLOR = "blue";

/**
 * @classdesc
 * A Canvas-based Spine skeleton renderer that draws through melonJS's
 * canvas renderer API (drawImage, transform, setTint, setMask, etc.).
 * This provides proper integration with melonJS's canvas rendering pipeline
 * including tinting, blend modes, and clipping support.
 */
export default class SkeletonRenderer {
	/**
	 * Whether to render the skeleton as triangles through
	 * `SkeletonRendererCore`. Required for mesh attachments and for
	 * clipping; region-only skeletons without clipping are drawn through
	 * the faster one-drawImage-per-slot path instead. Set automatically by
	 * {@link Spine} from the skeleton content.
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

	// spine-core's renderer-agnostic geometry pass
	core = new SkeletonRendererCore();

	// scratch state for the debug clipping outlines only
	clippingVertices = [];
	clippingShape = new Polygon(0, 0, [
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
		if (this.triangleRendering) {
			this.drawTriangles(renderer, skeleton);
		} else {
			this.drawImages(renderer, skeleton);
		}
	}

	/**
	 * Fast path: one transformed `drawImage` per region attachment.
	 * Mesh attachments and clipping are not supported here — skeletons
	 * using either are rendered through {@link SkeletonRenderer#drawTriangles}.
	 * @param {CanvasRenderer} renderer - the melonJS canvas renderer
	 * @param {Skeleton} skeleton - the Spine skeleton to draw
	 * @ignore
	 */
	drawImages(renderer, skeleton) {
		const drawOrder = skeleton.drawOrder.appliedPose;
		const skeletonColor = skeleton.color;
		const color = this.tintColor;

		for (let i = 0, n = drawOrder.length; i < n; i++) {
			const slot = drawOrder[i];
			const bone = slot.bone;

			if (!bone.active) {
				continue;
			}

			const slotPose = slot.appliedPose;
			const attachment = slotPose.attachment;

			if (!(attachment instanceof RegionAttachment)) {
				continue;
			}

			const sequence = attachment.sequence;
			const region = sequence.regions[sequence.resolveIndex(slotPose)];
			const image = region?.texture.getImage();

			if (!image) {
				continue;
			}

			const slotColor = slotPose.color;
			const regionColor = attachment.color;

			color.setFloat(
				skeletonColor.r * slotColor.r * regionColor.r,
				skeletonColor.g * slotColor.g * regionColor.g,
				skeletonColor.b * slotColor.b * regionColor.b,
				skeletonColor.a * slotColor.a * regionColor.a,
			);

			renderer.save();

			// melonJS Color exposes alpha as `.alpha`, NOT `.a` — reading
			// `color.a` is undefined and the canvas spec silently ignores
			// an undefined globalAlpha assignment, so slot-alpha animation
			// would never fade attachments under Canvas
			renderer.setGlobalAlpha(color.alpha);
			renderer.setTint(color);
			renderer.setBlendMode(BLEND_MODES[slot.data.blendMode]);

			this.drawRegion(renderer, image, bone, attachment, slotPose, region);

			renderer.restore();
		}
	}

	/**
	 * Triangle path: runs spine-core's `SkeletonRendererCore` pass (mesh
	 * deformation, clipping through `SkeletonClipping`, per-slot batching)
	 * and replays the resulting commands through the melonJS canvas renderer.
	 * @param {CanvasRenderer} renderer - the melonJS canvas renderer
	 * @param {Skeleton} skeleton - the Spine skeleton to draw
	 * @ignore
	 */
	drawTriangles(renderer, skeleton) {
		const color = this.tintColor;

		// `pma` is left false on purpose: the packed colors are consumed as
		// a canvas tint plus a globalAlpha, both of which expect straight
		// (non-premultiplied) components, whatever the atlas pages store.
		let command = this.core.render(skeleton, false, undefined, VERTEX_SIZE);

		for (; command; command = command.next) {
			if (command.numVertices === 0 || command.numIndices === 0) {
				continue;
			}

			const image = command.texture?.getImage();

			if (!image) {
				continue;
			}

			// the core packs one ARGB color per vertex and only batches
			// slots that share it, so vertex 0 carries the whole command's
			// tint — canvas has no per-vertex color anyway
			const packed = command.colors[0];
			const alpha = ((packed >>> 24) & 0xff) / 255;

			color.setFloat(
				((packed >>> 16) & 0xff) / 255,
				((packed >>> 8) & 0xff) / 255,
				(packed & 0xff) / 255,
				alpha,
			);

			renderer.save();

			renderer.setGlobalAlpha(alpha);
			renderer.setTint(color);
			renderer.setBlendMode(BLEND_MODES[command.blendMode]);

			this.drawTriangleList(
				renderer,
				image,
				command.positions,
				command.uvs,
				command.indices,
			);

			renderer.restore();
		}

		if (this.debugRendering) {
			this.drawClippingDebug(renderer, skeleton);
		}
	}

	/**
	 * Draw a region attachment (single quad image).
	 * @param {CanvasRenderer} renderer
	 * @param {HTMLImageElement} image
	 * @param {Bone} bone
	 * @param {RegionAttachment} attachment
	 * @param {SlotPose} slotPose - the slot's applied pose (resolves sequence offsets)
	 * @param {TextureRegion} region
	 * @ignore
	 */
	drawRegion(renderer, image, bone, attachment, slotPose, region) {
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

		if (this.debugRendering) {
			renderer.setColor(DEBUG_REGION_COLOR);
			renderer.strokeRect(0, 0, w, h);
		}
	}

	/**
	 * Draw one render command's triangles.
	 * @param {CanvasRenderer} renderer
	 * @param {HTMLImageElement} image
	 * @param {Float32Array} vertices - world positions, stride 2 (x, y per vertex)
	 * @param {Float32Array} uvs - normalized atlas UVs, stride 2
	 * @param {Uint16Array} indices - triangle indices
	 * @ignore
	 */
	drawTriangleList(renderer, image, vertices, uvs, indices) {
		// subtract 1 pixel to avoid edge bleeding (matches official spine-canvas)
		const imgW = image.width - 1;
		const imgH = image.height - 1;

		for (let j = 0; j < indices.length; j += 3) {
			const t1 = indices[j] * VERTEX_SIZE;
			const t2 = indices[j + 1] * VERTEX_SIZE;
			const t3 = indices[j + 2] * VERTEX_SIZE;

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

	/**
	 * Stroke the outline of every active clipping attachment. The core
	 * consumes clipping attachments internally, so the outlines are
	 * recomputed here for debug rendering only.
	 * @param {CanvasRenderer} renderer
	 * @param {Skeleton} skeleton
	 * @ignore
	 */
	drawClippingDebug(renderer, skeleton) {
		const drawOrder = skeleton.drawOrder.appliedPose;
		const vertices = this.clippingVertices;
		const shape = this.clippingShape;

		for (let i = 0, n = drawOrder.length; i < n; i++) {
			const slot = drawOrder[i];

			if (!slot.bone.active) {
				continue;
			}

			const attachment = slot.appliedPose.attachment;

			if (!(attachment instanceof ClippingAttachment)) {
				continue;
			}

			attachment.computeWorldVertices(
				skeleton,
				slot,
				0,
				attachment.worldVerticesLength,
				vertices,
				0,
				2,
			);
			// `setVertices` consumes the whole array, so trim the scratch
			// buffer to this attachment's vertex count — a previous, larger
			// clipping attachment would otherwise leave stale points behind
			vertices.length = attachment.worldVerticesLength;
			shape.setVertices(vertices);
			renderer.setColor(DEBUG_CLIP_COLOR);
			renderer.stroke(shape);
		}
	}
}
