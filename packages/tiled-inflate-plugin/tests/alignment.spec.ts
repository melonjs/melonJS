/**
 * Tile ids are read from the decompressed bytes as a `Uint32Array`, which
 * must start on a multiple of 4 bytes. fzstd hands back a view into a larger
 * buffer, so its offset is its own business: here it is made odd, and the
 * ids must still come out whole.
 */
import { describe, expect, it, vi } from "vitest";

// what the stand-in fzstd returns, set by each test
let output = new Uint8Array(0);

vi.mock("fzstd", () => ({
	decompress: () => output,
}));

const { inflate } = await import("../src/inflate.js");

/**
 * a view of `bytes` that starts `offset` bytes into its buffer
 * @param bytes - the bytes
 * @param offset - where the view starts
 * @returns the view
 */
const at = (bytes: Uint8Array, offset: number) => {
	const buffer = new Uint8Array(bytes.length + offset + 3);
	buffer.set(bytes, offset);
	return buffer.subarray(offset, offset + bytes.length);
};

describe("decompressed bytes at any offset", () => {
	const ids = new Uint32Array([1, 0x80000002, 0, 0xe0000008, 5]);
	const bytes = new Uint8Array(ids.buffer);

	it.each([0, 1, 2, 3, 4, 5, 12])(
		"at an offset of %i bytes, the ids come out whole",
		(offset) => {
			output = at(bytes, offset);
			expect(output.byteOffset).toBe(offset);
			const out = inflate("KLUv/QAAAAA=", "zstd");
			expect(out).toEqual(ids);
			expect(out.byteOffset % 4).toBe(0);
		},
	);

	it("an aligned view is not copied", () => {
		output = at(bytes, 8);
		const out = inflate("KLUv/QAAAAA=", "zstd");
		expect(out.buffer).toBe(output.buffer);
	});
});
