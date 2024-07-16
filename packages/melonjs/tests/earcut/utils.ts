// return a percentage difference between the polygon area and its triangulation area;

import { signedArea } from "../../src/geometries/earcut";

// used to verify correctness of triangulation
export function deviation(
	data: number[],
	holeIndices: number[] | null | undefined,
	dim: number,
	triangles: number[],
) {
	const hasHoles = holeIndices && holeIndices.length;
	const outerLen = hasHoles ? holeIndices[0] * dim : data.length;

	let polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
	if (hasHoles) {
		for (let i = 0, len = holeIndices.length; i < len; i++) {
			const start = holeIndices[i] * dim;
			const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
			polygonArea -= Math.abs(signedArea(data, start, end, dim));
		}
	}

	let trianglesArea = 0;
	for (let i = 0; i < triangles.length; i += 3) {
		const a = triangles[i] * dim;
		const b = triangles[i + 1] * dim;
		const c = triangles[i + 2] * dim;
		trianglesArea += Math.abs(
			(data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
				(data[a] - data[b]) * (data[c + 1] - data[a + 1]),
		);
	}

	return polygonArea === 0 && trianglesArea === 0
		? 0
		: Math.abs((trianglesArea - polygonArea) / polygonArea);
}

export function flatten(data: number[][][]) {
	const vertices = [];
	const holes = [];
	const dimensions = data[0][0].length;
	let holeIndex = 0;
	let prevLen = 0;

	for (const ring of data) {
		for (const p of ring) {
			for (let d = 0; d < dimensions; d++) vertices.push(p[d]);
		}
		if (prevLen) {
			holeIndex += prevLen;
			holes.push(holeIndex);
		}
		prevLen = ring.length;
	}
	return { vertices, holes, dimensions };
}
