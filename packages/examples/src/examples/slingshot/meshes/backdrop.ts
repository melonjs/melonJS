/**
 * melonJS — Slingshot: one wall of the painted backdrop.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Mesh } from "melonjs";

/**
 * An upright quad showing the jungle picture, repeated across it so its
 * trees stay small. Unlit, so it keeps its own colours.
 * @param w - its width
 * @param h - its height
 * @returns the mesh
 */
export const createBackdrop = (w: number, h: number) => {
	const x = w / 2;
	const y = h / 2;
	// the picture is 4:3: how many times it fits across
	const across = w / ((h * 4) / 3);
	return new Mesh(0, 0, {
		// Y-UP like any mesh geometry: the top edge takes the image's top row
		vertices: new Float32Array([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0]),
		uvs: new Float32Array([0, 1, across, 1, across, 0, 0, 0]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		texture: "backdrop",
		textureRepeat: "repeat",
		normalize: false,
		scale: 1,
		width: w,
		height: h,
		cullBackFaces: false,
		castGroundShadow: false,
	});
};
