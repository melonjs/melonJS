import { expect, test } from "vitest";
import { deviation, flatten } from "./utils";
import expected from "./expected.json";
import { server } from "@vitest/browser/context";
import { earcut } from "../../src/geometries/earcut";

const { readFile } = server.commands;

test("indices-2d", () => {
	const indices = earcut([10, 0, 0, 50, 60, 60, 70, 10]);
	expect(indices).toStrictEqual([1, 0, 3, 3, 2, 1]);
});

test("indices-3d", () => {
	const indices = earcut([10, 0, 0, 0, 50, 0, 60, 60, 0, 70, 10, 0], null, 3);
	expect(indices).toStrictEqual([1, 0, 3, 3, 2, 1]);
});

test("empty", () => {
	expect(earcut([])).toStrictEqual([]);
});

const keys = Object.keys(
	expected.triangles,
) as (keyof typeof expected.triangles)[];

const isExpectedError = (
	prop: string,
): prop is keyof typeof expected.errors => {
	return prop in expected.errors;
};

for (const id of keys) {
	test(id, async () => {
		const json = await readFile(`./fixtures/${id}.json`);
		const data = flatten(JSON.parse(json) as number[][][]),
			indices = earcut(data.vertices, data.holes, data.dimensions),
			err = deviation(data.vertices, data.holes, data.dimensions, indices),
			expectedTriangles = expected.triangles[id],
			expectedDeviation = isExpectedError(id) ? expected.errors[id] : 0;

		const numTriangles = indices.length / 3;
		expect(
			numTriangles,
			`${numTriangles} triangles when expected ${expectedTriangles}`,
		).toBe(expectedTriangles);

		if (expectedTriangles > 0) {
			expect(
				err,
				`deviation ${err} <= ${expectedDeviation}`,
			).toBeLessThanOrEqual(expectedDeviation);
		}
	});
}

test("infinite-loop", () => {
	earcut([1, 2, 2, 2, 1, 2, 1, 1, 1, 2, 4, 1, 5, 1, 3, 2, 4, 2, 4, 1], [5], 2);
});
