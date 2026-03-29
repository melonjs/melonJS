import {
	ClippingAttachment,
	MeshAttachment,
	RegionAttachment,
	SkeletonClipping,
} from "@esotericsoftware/spine-core";
import { Color as MColor, Math as MMath, Polygon } from "melonjs";

/**
 * Vertex size in floats: position(2) + color(4) + uv(2) = 8
 */
const VERTEX_SIZE = 8;

/**
 * Spine blend mode enum to melonJS blend mode string mapping
 */
const BLEND_MODES = ["normal", "additive", "multiply", "screen"];

// debug rendering colors
const DEBUG_REGION_COLOR = "green";
const DEBUG_MESH_COLOR = "yellow";
const DEBUG_CLIP_COLOR = "blue";

// shared vertex buffer, grown as needed
let worldVertices = new Float32Array(VERTEX_SIZE * 1024);

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

	// reusable color instances to avoid allocations
	tintColor = new MColor();
	tempColor = new MColor();

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
		const drawOrder = skeleton.drawOrder;
		const skeletonColor = skeleton.color;
		const clippingMask = this.clippingMask;
		const debugRendering = this.debugRendering;

		for (let i = 0, n = drawOrder.length; i < n; i++) {
			const clippedVertexSize = clipper.isClipping() ? 2 : VERTEX_SIZE;
			const slot = drawOrder[i];
			const bone = slot.bone;
			let image;
			let region;
			let triangles;

			if (!bone.active) {
				clipper.clipEndWithSlot(slot);
				renderer.clearMask();
				continue;
			}

			const attachment = slot.getAttachment();

			if (attachment instanceof RegionAttachment) {
				region = attachment.region;
				image = region.texture.getImage();
			} else if (
				this.triangleRendering &&
				attachment instanceof MeshAttachment
			) {
				this.computeMeshVertices(slot, attachment, clippedVertexSize);
				triangles = attachment.triangles;
				region = attachment.region;
				image = region.texture.getImage();
			} else if (attachment instanceof ClippingAttachment) {
				const vertices = this.clippingVertices;
				clipper.clipStart(slot, attachment);
				attachment.computeWorldVertices(
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
				clipper.clipEndWithSlot(slot);
				renderer.clearMask();
				continue;
			}

			if (image) {
				const slotColor = slot.color;
				const regionColor = attachment.color;
				const color = this.tintColor;

				renderer.save();

				color.setFloat(
					skeletonColor.r * slotColor.r * regionColor.r,
					skeletonColor.g * slotColor.g * regionColor.g,
					skeletonColor.b * slotColor.b * regionColor.b,
					skeletonColor.a * slotColor.a * regionColor.a,
				);

				renderer.setGlobalAlpha(color.a);
				renderer.setTint(color);
				renderer.setBlendMode(BLEND_MODES[slot.data.blendMode]);

				if (triangles) {
					this.drawMesh(renderer, image, worldVertices, triangles);
				} else {
					this.drawRegion(
						renderer,
						image,
						bone,
						attachment,
						region,
						clipper.isClipping() ? clippingMask : null,
						debugRendering,
					);
				}

				renderer.restore();
			}
			clipper.clipEndWithSlot(slot);
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
	 * @param {TextureRegion} region
	 * @param {Polygon|null} mask - clipping mask if active
	 * @param {boolean} debug - whether to draw debug outline
	 * @ignore
	 */
	drawRegion(renderer, image, bone, attachment, region, mask, debug) {
		const atlasScale = attachment.width / region.originalWidth;
		let w = region.width;
		let h = region.height;
		const hW = w / 2;
		const hH = h / 2;

		renderer.transform(
			bone.a,
			bone.c,
			bone.b,
			bone.d,
			bone.worldX,
			bone.worldY,
		);
		renderer.translate(attachment.offset[0], attachment.offset[1]);
		renderer.rotate(MMath.degToRad(attachment.rotation));
		renderer.scale(
			atlasScale * attachment.scaleX,
			atlasScale * attachment.scaleY,
		);
		renderer.translate(hW, hH);
		if (region.degrees === 90) {
			const t = w;
			w = h;
			h = t;
			renderer.rotate(-MMath.ETA);
		}
		renderer.scale(1, -1);
		renderer.translate(-hW, -hH);

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
	 * @param {Float32Array} vertices - world vertices
	 * @param {number[]} triangles - triangle indices
	 * @ignore
	 */
	drawMesh(renderer, image, vertices, triangles) {
		// subtract 1 pixel to avoid edge bleeding (matches official spine-canvas)
		const imgW = image.width - 1;
		const imgH = image.height - 1;

		for (let j = 0; j < triangles.length; j += 3) {
			const t1 = triangles[j] * VERTEX_SIZE;
			const t2 = triangles[j + 1] * VERTEX_SIZE;
			const t3 = triangles[j + 2] * VERTEX_SIZE;

			this.drawTriangle(
				renderer,
				image,
				vertices[t1],
				vertices[t1 + 1],
				vertices[t1 + 6] * imgW,
				vertices[t1 + 7] * imgH,
				vertices[t2],
				vertices[t2 + 1],
				vertices[t2 + 6] * imgW,
				vertices[t2 + 7] * imgH,
				vertices[t3],
				vertices[t3 + 1],
				vertices[t3 + 6] * imgW,
				vertices[t3 + 7] * imgH,
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
	 * Compute world vertices for a mesh attachment with color and UV data.
	 * @param {Slot} slot
	 * @param {MeshAttachment} mesh
	 * @param {number} vertexSize - floats per vertex
	 * @ignore
	 */
	computeMeshVertices(slot, mesh, vertexSize) {
		const skeletonColor = slot.bone.skeleton.color;
		const slotColor = slot.color;
		const regionColor = mesh.color;
		const alpha = skeletonColor.a * slotColor.a * regionColor.a;

		this.tempColor.setFloat(
			skeletonColor.r * slotColor.r * regionColor.r,
			skeletonColor.g * slotColor.g * regionColor.g,
			skeletonColor.b * slotColor.b * regionColor.b,
			alpha,
		);

		if (worldVertices.length < mesh.worldVerticesLength) {
			worldVertices = new Float32Array(mesh.worldVerticesLength);
		}
		mesh.computeWorldVertices(
			slot,
			0,
			mesh.worldVerticesLength,
			worldVertices,
			0,
			vertexSize,
		);

		const uvs = mesh.uvs;
		const color = this.tempColor.toArray();
		const vertexCount = mesh.worldVerticesLength / 2;
		for (let i = 0, u = 0, v = 2; i < vertexCount; i++) {
			worldVertices[v++] = color[0];
			worldVertices[v++] = color[1];
			worldVertices[v++] = color[2];
			worldVertices[v++] = color[3];
			worldVertices[v++] = uvs[u++];
			worldVertices[v++] = uvs[u++];
			v += 2;
		}
	}
}
