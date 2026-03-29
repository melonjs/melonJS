import {
	ClippingAttachment,
	MeshAttachment,
	RegionAttachment,
	SkeletonClipping,
} from "@esotericsoftware/spine-core";
import { Color as MColor, Math as MMath, Polygon } from "melonjs";

const vertexSize = 2 + 2 + 4;
const blendModeLUT = ["normal", "additive", "multiply", "screen"];
const regionDebugColor = "green";
const meshDebugColor = "yellow";
const clipDebugColor = "blue";

let worldVertices = new Float32Array(vertexSize * 1024);

export default class SkeletonRenderer {
	skeletonRenderer;
	runtime;
	tintColor = new MColor();
	tempColor = new MColor();
	debugRendering = false;
	clipper = new SkeletonClipping();
	clippingVertices = [];
	clippingMask = new Polygon(0, 0, [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
	]);

	constructor(runtime) {
		this.runtime = runtime;
		this.skeletonRenderer = new runtime.SkeletonRenderer();
	}

	draw(renderer, skeleton) {
		const clipper = this.clipper;
		const drawOrder = skeleton.drawOrder;
		const skeletonColor = skeleton.color;
		const clippingMask = this.clippingMask;
		const debugRendering = this.debugRendering;

		for (let i = 0, n = drawOrder.length; i < n; i++) {
			const clippedVertexSize = clipper.isClipping() ? 2 : vertexSize;
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
				attachment.computeWorldVertices(
					slot,
					worldVertices,
					0,
					clippedVertexSize,
				);
				region = attachment.region;
				image = region.texture.getImage();
			} else if (attachment instanceof MeshAttachment) {
				this.computeMeshVertices(slot, attachment, false, clippedVertexSize);
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
				if (debugRendering === true) {
					renderer.setColor(clipDebugColor);
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
				const blendMode = slot.data.blendMode;
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
				renderer.setBlendMode(blendModeLUT[blendMode]);

				if (typeof triangles !== "undefined") {
					const vertices = worldVertices;
					for (let j = 0; j < triangles.length; j += 3) {
						const t1 = triangles[j] * 8;
						const t2 = triangles[j + 1] * 8;
						const t3 = triangles[j + 2] * 8;

						this.drawTriangle(
							renderer,
							image,
							vertices[t1],
							vertices[t1 + 1],
							vertices[t1 + 6],
							vertices[t1 + 7],
							vertices[t2],
							vertices[t2 + 1],
							vertices[t2 + 6],
							vertices[t2 + 7],
							vertices[t3],
							vertices[t3 + 1],
							vertices[t3 + 6],
							vertices[t3 + 7],
						);
					}
				} else {
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

					if (clipper.isClipping()) {
						renderer.setMask(clippingMask);
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

					if (debugRendering === true) {
						renderer.setColor(regionDebugColor);
						renderer.strokeRect(0, 0, w, h);
					}
				}

				renderer.restore();
			}
			clipper.clipEndWithSlot(slot);
			renderer.clearMask();
		}
		clipper.clipEnd();
	}

	drawTriangle(renderer, img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
		u0 *= img.width;
		v0 *= img.height;
		u1 *= img.width;
		v1 *= img.height;
		u2 *= img.width;
		v2 *= img.height;

		renderer.save();
		renderer.beginPath();
		renderer.moveTo(x0, y0);
		renderer.lineTo(x1, y1);
		renderer.lineTo(x2, y2);
		renderer.closePath();
		renderer.setMask();

		x1 -= x0;
		y1 -= y0;
		x2 -= x0;
		y2 -= y0;

		u1 -= u0;
		v1 -= v0;
		u2 -= u0;
		v2 -= v0;

		const det = 1 / (u1 * v2 - u2 * v1);

		// linear transformation
		const a = (v2 * x1 - v1 * x2) * det;
		const b = (v2 * y1 - v1 * y2) * det;
		const c = (u1 * x2 - u2 * x1) * det;
		const d = (u1 * y2 - u2 * y1) * det;

		// translation
		const e = x0 - a * u0 - c * v0;
		const f = y0 - b * u0 - d * v0;

		renderer.transform(a, b, c, d, e, f);
		renderer.drawImage(img, 0, 0);
		renderer.clearMask();
		renderer.restore();

		if (this.debugRendering === true) {
			renderer.setColor(meshDebugColor);
			renderer.stroke();
		}
	}

	computeMeshVertices(slot, mesh, pma = false, vertexSize) {
		const skeletonColor = slot.bone.skeleton.color;
		const slotColor = slot.color;
		const regionColor = mesh.color;
		const alpha = skeletonColor.a * slotColor.a * regionColor.a;
		const multiplier = pma ? alpha : 1;

		this.tempColor.setFloat(
			skeletonColor.r * slotColor.r * regionColor.r * multiplier,
			skeletonColor.g * slotColor.g * regionColor.g * multiplier,
			skeletonColor.b * slotColor.b * regionColor.b * multiplier,
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
		const vertices = worldVertices;
		const vertexCount = mesh.worldVerticesLength / 2;
		for (let i = 0, u = 0, v = 2; i < vertexCount; i++) {
			vertices[v++] = color[0];
			vertices[v++] = color[1];
			vertices[v++] = color[2];
			vertices[v++] = color[3];
			vertices[v++] = uvs[u++];
			vertices[v++] = uvs[u++];
			v += 2;
		}
	}
}
