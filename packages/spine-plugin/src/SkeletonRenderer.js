import { Color as MColor, Math as MMath, Polygon } from "melonjs";
import { SkeletonClipping, ClippingAttachment, MeshAttachment, RegionAttachment } from "@esotericsoftware/spine-core";

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
    clippingMask = new Polygon(0, 0);

    constructor(runtime) {
        this.runtime = runtime;
        this.skeletonRenderer = new runtime.SkeletonRenderer();
    }

    draw(renderer, skeleton) {
        let clipper = this.clipper;
        let drawOrder = skeleton.drawOrder;
        let skeletonColor = skeleton.color;
        let clippingMask = this.clippingMask;
        let debugRendering = this.debugRendering;

        for (var i = 0, n = drawOrder.length; i < n; i++) {
            let clippedVertexSize = clipper.isClipping() ? 2 : vertexSize;
            let slot = drawOrder[i];
            let bone = slot.bone;
            let image;
            let region;
            let triangles;

            if (!bone.active) {
                clipper.clipEndWithSlot(slot);
                renderer.clearMask();
                continue;
            }

            let attachment = slot.getAttachment();

            if (attachment instanceof RegionAttachment) {
                attachment.computeWorldVertices(slot, worldVertices, 0, clippedVertexSize);
                region = attachment.region;
                image = region.texture.getImage();
            } else if (attachment instanceof MeshAttachment) {
                this.computeMeshVertices(slot, attachment, false, clippedVertexSize);
                triangles = attachment.triangles;
                region = attachment.region;
                image = region.texture.getImage();
            } else if (attachment instanceof ClippingAttachment) {
                let clip = attachment;
                let vertices = this.clippingVertices;
                clipper.clipStart(slot, clip);
                clip.computeWorldVertices(slot, 0, clip.worldVerticesLength, vertices, 0, 2);
                clippingMask.setVertices(vertices, clip.worldVerticesLength);
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

            if (typeof image !== "undefined") {
                let slotColor = slot.color;
                let regionColor = attachment.color;
                let blendMode = slot.data.blendMode;
                let color = this.tintColor;

                renderer.save();

                color.setFloat(skeletonColor.r * slotColor.r * regionColor.r,
                    skeletonColor.g * slotColor.g * regionColor.g,
                    skeletonColor.b * slotColor.b * regionColor.b,
                    skeletonColor.a * slotColor.a * regionColor.a);

                renderer.setGlobalAlpha(color.a);
                renderer.setTint(color);
                renderer.setBlendMode(blendModeLUT[blendMode]);

                if (typeof triangles !== "undefined") {
                    let vertices = worldVertices;
                    for (var j = 0; j < triangles.length; j += 3) {
                        let t1 = triangles[j] * 8, t2 = triangles[j + 1] * 8, t3 = triangles[j + 2] * 8;
                        let x0 = vertices[t1], y0 = vertices[t1 + 1], u0 = vertices[t1 + 6], v0 = vertices[t1 + 7];
                        let x1 = vertices[t2], y1 = vertices[t2 + 1], u1 = vertices[t2 + 6], v1 = vertices[t2 + 7];
                        let x2 = vertices[t3], y2 = vertices[t3 + 1], u2 = vertices[t3 + 6], v2 = vertices[t3 + 7];

                        this.drawTriangle(renderer, image, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2);
                    }
                } else {
                    let atlasScale = attachment.width / region.originalWidth;
                    let w = region.width, h = region.height;
                    let hW = w / 2, hH = h / 2;

                    renderer.transform(bone.a, bone.c, bone.b, bone.d, bone.worldX, bone.worldY);
                    renderer.translate(attachment.offset[0], attachment.offset[1]);
                    renderer.rotate(MMath.degToRad(attachment.rotation));
                    renderer.scale(atlasScale * attachment.scaleX, atlasScale * attachment.scaleY);
                    renderer.translate(hW, hH);
                    if (region.degrees === 90) {
                        let t = w;
                        w = h;
                        h = t;
                        renderer.rotate(-MMath.ETA);
                    }
                    renderer.scale(1, -1);
                    renderer.translate(-hW, -hH);

                    if (clipper.isClipping()) {
                        renderer.setMask(clippingMask);
                    }
                    renderer.drawImage(image, image.width * region.u, image.height * region.v, w, h, 0, 0, w, h);

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

        var det = 1 / (u1 * v2 - u2 * v1),

            // linear transformation
            a = (v2 * x1 - v1 * x2) * det,
            b = (v2 * y1 - v1 * y2) * det,
            c = (u1 * x2 - u2 * x1) * det,
            d = (u1 * y2 - u2 * y1) * det,

            // translation
            e = x0 - a * u0 - c * v0,
            f = y0 - b * u0 - d * v0;

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
        let skeletonColor = slot.bone.skeleton.color;
        let slotColor = slot.color;
        let regionColor = mesh.color;
        let alpha = skeletonColor.a * slotColor.a * regionColor.a;
        let multiplier = pma ? alpha : 1;

        this.tempColor.setFloat(skeletonColor.r * slotColor.r * regionColor.r * multiplier,
                                skeletonColor.g * slotColor.g * regionColor.g * multiplier,
                                skeletonColor.b * slotColor.b * regionColor.b * multiplier,
                                alpha);

        if (worldVertices.length < mesh.worldVerticesLength) worldVertices = new Float32Array(mesh.worldVerticesLength);
        mesh.computeWorldVertices(slot, 0, mesh.worldVerticesLength, worldVertices, 0, vertexSize);

        let uvs = mesh.uvs;
        let color = this.tempColor.toArray();
        let vertices = worldVertices;
        let vertexCount = mesh.worldVerticesLength / 2;
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
