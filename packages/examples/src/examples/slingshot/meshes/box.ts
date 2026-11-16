/**
 * melonJS — Slingshot: a textured box mesh, the block everything is built of.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Mesh } from "melonjs";
import { GROUND_Y } from "../constants";

/**
 * A box mesh `w` × `h` × `d` pixels, centred on its position, so that a
 * `Box3d(0, 0, 0, w, h, d)` is exactly its outline. Authored Y-UP like any
 * mesh geometry; a box looks the same either way.
 * @param w - its width, along X
 * @param h - its height, along Y
 * @param d - its depth, along Z
 * @param texture - the name of a preloaded texture, repeated every 64 pixels
 * @returns the mesh, lit and casting a ground shadow
 */
export const createBox = (w: number, h: number, d: number, texture: string) => {
	const x = w / 2;
	const y = h / 2;
	const z = d / 2;
	// each face: its four corners and its normal
	const faces: [number[][], number[]][] = [
		[
			[
				[x, -y, -z],
				[x, y, -z],
				[x, y, z],
				[x, -y, z],
			],
			[1, 0, 0],
		],
		[
			[
				[-x, -y, z],
				[-x, y, z],
				[-x, y, -z],
				[-x, -y, -z],
			],
			[-1, 0, 0],
		],
		[
			[
				[-x, y, -z],
				[-x, y, z],
				[x, y, z],
				[x, y, -z],
			],
			[0, 1, 0],
		],
		[
			[
				[-x, -y, z],
				[-x, -y, -z],
				[x, -y, -z],
				[x, -y, z],
			],
			[0, -1, 0],
		],
		[
			[
				[-x, -y, z],
				[x, -y, z],
				[x, y, z],
				[-x, y, z],
			],
			[0, 0, 1],
		],
		[
			[
				[x, -y, -z],
				[-x, -y, -z],
				[-x, y, -z],
				[x, y, -z],
			],
			[0, 0, -1],
		],
	];
	const vertices: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	faces.forEach(([corners, normal], f) => {
		for (const c of corners) {
			vertices.push(...c);
			normals.push(...normal);
		}
		// one texture tile per 64 pixels, along the face's two sides
		const [a, b] = [w, h, d]
			.filter((_, i) => {
				return normal[i] === 0;
			})
			.map((size) => {
				return size / 64;
			});
		uvs.push(0, 0, a, 0, a, b, 0, b);
		const o = f * 4;
		indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
	});
	return new Mesh(0, 0, {
		vertices: new Float32Array(vertices),
		normals: new Float32Array(normals),
		uvs: new Float32Array(uvs),
		indices: new Uint16Array(indices),
		texture,
		textureRepeat: "repeat",
		normalize: false,
		scale: 1,
		width: w,
		height: h,
		cullBackFaces: false,
		lit: true,
		castGroundShadow: true,
		shadowGroundY: GROUND_Y,
	});
};
