/**
 * A mesh keeps a second copy of its indices with every triangle wound the
 * other way round: one to draw with when its winding has to be flipped, one
 * for the hull drawn as its outline. Both copies are of the same kind of
 * array as the indices they were made from, so a mesh of more than 65535
 * vertices keeps 32-bit indices, and the indices given are left as they were.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Mesh, video } from "../src/index.js";

/** two triangles sharing an edge: a quad, with the indices in a given array */
const quad = (indices) => {
	return {
		vertices: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
		uvs: new Float32Array(8),
		indices,
		width: 2,
		height: 2,
		scale: 1,
		normalize: false,
		cullBackFaces: false,
		castGroundShadow: false,
	};
};

const GIVEN = [0, 1, 2, 0, 2, 3];
const REVERSED = [0, 2, 1, 0, 3, 2];

describe("a mesh's indices, wound the other way round", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(64, 64, { parent: "screen", renderer: video.CANVAS });
		await app.init();
	});
	afterAll(() => {
		app?.destroy();
	});

	for (const [kind, IndexArray] of [
		["16-bit", Uint16Array],
		["32-bit", Uint32Array],
	]) {
		describe(`${kind} indices`, () => {
			it("the copy drawn when the winding is flipped is of the same kind", () => {
				const given = new IndexArray(GIVEN);
				const mesh = new Mesh(0, 0, quad(given));
				mesh._setupWorldSpace(true);
				expect(mesh._indicesReversed).toBeInstanceOf(IndexArray);
				expect(Array.from(mesh._indicesReversed)).toEqual(REVERSED);
				// a copy: the indices given are as they were
				expect(mesh._indicesReversed).not.toBe(given);
				expect(Array.from(given)).toEqual(GIVEN);
				expect(Array.from(mesh._indicesOriginal)).toEqual(GIVEN);
			});

			it("the outline's hull is wound the other way, in the same kind of array", () => {
				const given = new IndexArray(GIVEN);
				const mesh = new Mesh(0, 0, quad(given));
				const hull = mesh._outlineHull(0.1);
				expect(hull.indices).toBeInstanceOf(IndexArray);
				expect(Array.from(hull._indicesOriginal)).toEqual(REVERSED);
				expect(Array.from(given)).toEqual(GIVEN);
			});
		});
	}

	it("32-bit indices past 65535 are kept whole", () => {
		// what a 16-bit copy would cut short: 70000 would come back as 4464
		const count = 70001;
		const settings = quad(new Uint32Array([0, 69999, 70000]));
		settings.vertices = new Float32Array(count * 3);
		settings.normals = new Float32Array(count * 3);
		settings.uvs = new Float32Array(count * 2);
		const mesh = new Mesh(0, 0, settings);
		mesh._setupWorldSpace(true);
		expect(Array.from(mesh._indicesReversed)).toEqual([0, 70000, 69999]);
	});

	it("indices that do not end on a whole triangle: the odd ones are kept as given", () => {
		const mesh = new Mesh(0, 0, quad(new Uint16Array([0, 1, 2, 0, 2])));
		mesh._setupWorldSpace(true);
		expect(Array.from(mesh._indicesReversed)).toEqual([0, 2, 1, 0, 2]);
	});
});
