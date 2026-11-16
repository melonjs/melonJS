/**
 * The decompression itself, fed data from another encoder (the browser's own
 * `CompressionStream`, and Tiled's zstd), then damaged every way a file can
 * be: cut short at every byte, every single bit flipped, wrong checksums and
 * lengths, odd headers, bad base64. Damaged gzip or zlib data must throw, never
 * load as other tiles.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	adler32,
	base64ToBytes,
	crc32,
	decodeBase64,
	inflate,
} from "../src/inflate.js";

// the ground layer of a map Tiled saved with zstd
const zstdMap = (await (
	await fetch(new URL("./fixtures/map-zstd.tmj", import.meta.url))
).json()) as { layers: { data: string }[] };

const H = 0x80000000;
const V = 0x40000000;
const AD = 0x20000000;

/**
 * bytes to base64, as Tiled writes them
 * @param bytes - the bytes
 * @returns base64 text
 */
const toBase64 = (bytes: Uint8Array) => {
	let text = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(text);
};

/**
 * compresses with the browser's encoder: "deflate" is zlib
 * @param bytes - the data
 * @param format - "gzip" or "deflate"
 * @returns the compressed data
 */
const compress = async (bytes: Uint8Array, format: "gzip" | "deflate") => {
	const stream = new Blob([new Uint8Array(bytes)])
		.stream()
		.pipeThrough(new CompressionStream(format));
	return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * a layer's tile ids: every tile 1 to 8, every flip, some empty cells
 * @param count - how many
 * @returns the ids
 */
const tiles = (count: number) => {
	const ids = new Uint32Array(count);
	let seed = 99;
	for (let i = 0; i < count; i++) {
		seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
		const r = seed >>> 16;
		ids[i] =
			r % 4 === 0
				? 0
				: (1 +
						(r % 8) +
						(r & 8 ? H : 0) +
						(r & 16 ? V : 0) +
						(r & 32 ? AD : 0)) >>>
					0;
	}
	return ids;
};

const bytesOf = (ids: Uint32Array) => new Uint8Array(ids.buffer.slice(0));

/**
 * where two arrays first differ, so that a failure on a big one reports
 * one index rather than a diff of every element
 * @param actual - the array produced
 * @param expected - the array wanted
 * @returns the first index where they differ, or -1 when they are equal
 */
const firstDifference = (
	actual: ArrayLike<number>,
	expected: ArrayLike<number>,
) => {
	const length = Math.min(actual.length, expected.length);
	for (let i = 0; i < length; i++) {
		if (actual[i] !== expected[i]) {
			return i;
		}
	}
	return actual.length === expected.length ? -1 : length;
};

/**
 * the outcome of inflating: the ids, or the error message
 * @param data - base64 data
 * @param format - its compression
 * @returns the result
 */
const attempt = (data: string, format: string) => {
	try {
		return { ids: inflate(data, format) };
	} catch (error) {
		return { error: error as Error };
	}
};

const PREFIX = "@melonjs/tiled-inflate-plugin: cannot read";

describe("checksums", () => {
	const text = (s: string) => new TextEncoder().encode(s);

	it("CRC-32 matches the standard check value", () => {
		expect(crc32(text("123456789"))).toBe(0xcbf43926);
		expect(crc32(new Uint8Array(0))).toBe(0);
	});

	it("CRC-32 agrees with its bitwise definition at every length", () => {
		// the definition, one bit at a time
		const reference = (data: Uint8Array) => {
			let crc = 0xffffffff;
			for (const byte of data) {
				crc ^= byte;
				for (let k = 0; k < 8; k++) {
					crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
				}
			}
			return (crc ^ 0xffffffff) >>> 0;
		};
		const data = new Uint8Array(100003).map(
			(_, i) => (i * 131 + (i >> 7)) & 0xff,
		);
		for (let length = 0; length <= 64; length++) {
			const part = data.subarray(3, 3 + length);
			expect(crc32(part), `${length} bytes`).toBe(reference(part));
		}
		expect(crc32(data)).toBe(reference(data));
	});

	it("Adler-32 matches known values", () => {
		expect(adler32(text("Wikipedia"))).toBe(0x11e60398);
		expect(adler32(new Uint8Array(0))).toBe(1);
	});

	it("Adler-32 stays exact over 100 000 bytes of 0xff", () => {
		const data = new Uint8Array(100000).fill(0xff);
		let a = 1;
		let b = 0;
		for (const byte of data) {
			a = (a + byte) % 65521;
			b = (b + a) % 65521;
		}
		expect(adler32(data)).toBe(((b << 16) | a) >>> 0);
	});
});

describe("base64", () => {
	it("skips the new lines and indentation of a .tmx, CRLF included", () => {
		const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 7]);
		const text = toBase64(bytes);
		const wrapped = `\r\n\t  ${text.slice(0, 4)}\r\n  ${text.slice(4)}\n  `;
		expect(base64ToBytes(wrapped)).toEqual(bytes);
	});

	it("accepts missing padding", () => {
		expect(base64ToBytes("AAEC")).toEqual(new Uint8Array([0, 1, 2]));
		expect(base64ToBytes("AAE")).toEqual(new Uint8Array([0, 1]));
	});

	it.each([
		["a character outside base64", "eJw!AAAA"],
		["a data URI", "data:application/octet-stream;base64,eJwDAAAAAAE="],
		["a length that cannot be base64", "eJwDA"],
	])("rejects %s", (_, text) => {
		expect(() => base64ToBytes(text)).toThrow(/not valid base64/);
		expect(() => inflate(text, "zlib")).toThrow(
			`${PREFIX} zlib compressed layer data: the layer data is not valid base64`,
		);
	});
});

describe("base64 without atob", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/**
	 * what atob gives, or that it throws
	 * @param decode - a decoder
	 * @param text - base64 text
	 * @returns the bytes, or "throws"
	 */
	const outcome = (decode: (text: string) => Uint8Array, text: string) => {
		try {
			return Array.from(decode(text));
		} catch {
			return "throws";
		}
	};
	const native = (text: string) =>
		Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

	it("decodes every length the same as atob, padded or not, with white space anywhere", () => {
		const bytes = new Uint8Array(200).map((_, i) => (i * 151 + 7) & 0xff);
		for (let length = 0; length <= 200; length++) {
			const text = toBase64(bytes.subarray(0, length));
			const variants = [
				text,
				text.replace(/=+$/, ""),
				` \r\n\t${text.replace(/(.{7})/g, "$1\n\t ")}\f\r\n`,
			];
			for (const variant of variants) {
				expect(outcome(decodeBase64, variant), JSON.stringify(variant)).toEqual(
					Array.from(bytes.subarray(0, length)),
				);
			}
		}
	});

	it("accepts and refuses exactly what atob does", () => {
		// strings of base64 characters, padding, white space and others
		const pieces = [
			"A",
			"Q",
			"z",
			"9",
			"+",
			"/",
			"=",
			"==",
			" ",
			"\n",
			"\t",
			"\v",
			"!",
			"-",
			"_",
			"é",
			"\u0100",
			"\u0000",
		];
		let seed = 7;
		const pick = () => {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
			return pieces[(seed >>> 16) % pieces.length];
		};
		let refused = 0;
		for (let n = 0; n < 4000; n++) {
			let text = "";
			const length = n % 13;
			for (let i = 0; i < length; i++) {
				// mostly base64 characters, so that some strings are valid
				text += n % 3 === 0 ? pick() : pieces[(n * 7 + i * 3) % 6];
			}
			const expected = outcome(native, text);
			expect(outcome(decodeBase64, text), JSON.stringify(text)).toEqual(
				expected,
			);
			if (expected === "throws") {
				refused++;
			}
		}
		// both outcomes were tried, many times
		expect(refused).toBeGreaterThan(500);
		expect(refused).toBeLessThan(3500);
	});

	// every base64 character, the padding, the white space atob skips, and
	// characters it refuses: URL-safe base64, other white space, non-ASCII
	// (one character each: none of these is a surrogate pair but the last)
	const CHARS = [
		...Array.from(
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
		),
		...Array.from(" \t\n\f\r"),
		...Array.from("\v\u00a0\u2028\u0000-_.!é\u0100\uffff"),
		"\ud83d\ude00",
	];

	it("agrees with atob on every string of one or two characters", () => {
		for (const a of CHARS) {
			expect(outcome(decodeBase64, a), JSON.stringify(a)).toEqual(
				outcome(native, a),
			);
			for (const b of CHARS) {
				const text = a + b;
				expect(outcome(decodeBase64, text), JSON.stringify(text)).toEqual(
					outcome(native, text),
				);
			}
		}
	});

	it("agrees with atob on every four-character string of a smaller set", () => {
		// enough to put padding, white space and a stray character anywhere
		const small = ["A", "/", "+", "=", " ", "\n", "-", "é"];
		for (const a of small) {
			for (const b of small) {
				for (const c of small) {
					for (const d of small) {
						for (const prefix of ["", "QUJD"]) {
							const text = prefix + a + b + c + d;
							expect(outcome(decodeBase64, text), JSON.stringify(text)).toEqual(
								outcome(native, text),
							);
						}
					}
				}
			}
		}
	});

	it.each([
		["", []],
		["   \n\t", []],
		["AA==", [0]],
		["AB==", [0]],
		["AP8=", [0, 255]],
		["////", [255, 255, 255]],
		["+++/", [251, 239, 191]],
		["AB= =", [0]],
		["A B\nC\tD", [0, 16, 131]],
		["AB", [0]],
		["ABC", [0, 16]],
	])("%j decodes to %j", (text, bytes) => {
		expect(Array.from(decodeBase64(text))).toEqual(bytes);
		expect(Array.from(native(text))).toEqual(bytes);
	});

	it.each([
		"A",
		"ABCDE",
		"=",
		"==",
		"A===",
		"====",
		"AB=C",
		"AB==CD==",
		"A=BC",
		"AB==\u00a0",
		"AB\vCD",
		"AB-_",
		"ABCé",
		"AB\u0000C",
		"\ud83d\ude00AA",
		"data:application/octet-stream;base64,AAAA",
	])("%j is refused, as atob refuses it", (text) => {
		expect(() => native(text)).toThrow();
		expect(() => decodeBase64(text)).toThrow("not valid base64");
	});

	it("round-trips every byte value at every offset, and random data of every length to 3000", () => {
		const all = new Uint8Array(256 * 3).map((_, i) => i & 0xff);
		for (let offset = 0; offset < 3; offset++) {
			const part = all.subarray(offset, offset + 256);
			expect(decodeBase64(toBase64(part))).toEqual(part);
		}
		let seed = 1;
		const random = new Uint8Array(3000).map(() => {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
			return seed >>> 24;
		});
		for (let length = 0; length <= 3000; length += 1 + (length >> 6)) {
			const part = random.subarray(0, length);
			expect(decodeBase64(toBase64(part)), `${length} bytes`).toEqual(part);
		}
	});

	it("decodes 3 MB the same as atob, wrapped in lines as a .tmx is", () => {
		let seed = 3;
		const bytes = new Uint8Array(3 * 1024 * 1024).map(() => {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
			return seed >>> 24;
		});
		const text = toBase64(bytes).replace(/(.{76})/g, "$1\r\n   ");
		const decoded = decodeBase64(text);
		expect(decoded.length).toBe(bytes.length);
		expect(firstDifference(decoded, native(text))).toBe(-1);
	});

	it("agrees with atob on 20 000 random strings of up to 40 characters", () => {
		let seed = 11;
		const next = (n: number) => {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
			return (seed >>> 8) % n;
		};
		let refused = 0;
		for (let n = 0; n < 20000; n++) {
			// valid base64 of random bytes, then a few random changes
			const bytes = new Uint8Array(next(28)).map(() => next(256));
			let text = toBase64(bytes);
			for (let k = next(4); k > 0; k--) {
				const at = next(text.length + 1);
				const op = next(3);
				const char = CHARS[next(CHARS.length)];
				text =
					op === 0
						? text.slice(0, at) + char + text.slice(at)
						: op === 1
							? text.slice(0, at) + text.slice(at + 1)
							: text.slice(0, at) + char + text.slice(at + 1);
			}
			const expected = outcome(native, text);
			expect(outcome(decodeBase64, text), JSON.stringify(text)).toEqual(
				expected,
			);
			if (expected === "throws") {
				refused++;
			}
		}
		expect(refused).toBeGreaterThan(2000);
		expect(refused).toBeLessThan(18000);
	});

	it("is not used while atob exists", () => {
		const atob = vi.spyOn(globalThis, "atob");
		base64ToBytes("QUJD");
		expect(atob).toHaveBeenCalledWith("QUJD");
	});

	it("is used when the runtime has no atob, and a layer still loads", async () => {
		const ids = tiles(1000);
		const data = toBase64(await compress(bytesOf(ids), "gzip"));
		vi.stubGlobal("atob", undefined);
		expect(typeof globalThis.atob).toBe("undefined");
		expect(inflate(data, "gzip")).toEqual(ids);
		expect(inflate(`\n   ${data}\n  `, "gzip")).toEqual(ids);
		expect(() => inflate("eJw!AAAA", "zlib")).toThrow(
			`${PREFIX} zlib compressed layer data: the layer data is not valid base64`,
		);
	});
});

describe.each([
	["gzip", "gzip"],
	["zlib", "deflate"],
] as const)("%s from another encoder", (format, browserFormat) => {
	it.each([1, 13 * 9, 4096, 300000])("%i tiles round-trip", async (count) => {
		const ids = tiles(count);
		const data = toBase64(await compress(bytesOf(ids), browserFormat));
		expect(firstDifference(inflate(data, format), ids)).toBe(-1);
	});

	it("keeps the three flip bits and the hexagonal rotation bit", async () => {
		const ids = new Uint32Array([
			(8 | H | V | AD) >>> 0,
			H >>> 0,
			0x10000001,
			0xffffffff,
			0,
		]);
		const data = toBase64(await compress(bytesOf(ids), browserFormat));
		const out = inflate(data, format);
		expect(out).toBeInstanceOf(Uint32Array);
		expect(out).toEqual(ids);
	});

	it("an empty layer is no tiles", async () => {
		const data = toBase64(await compress(new Uint8Array(0), browserFormat));
		expect(inflate(data, format)).toEqual(new Uint32Array(0));
	});

	it.each([1, 2, 3, 4097])(
		"%i bytes, not whole 32-bit ids, throws",
		async (length) => {
			const data = toBase64(
				await compress(new Uint8Array(length).fill(1), browserFormat),
			);
			expect(() => inflate(data, format)).toThrow(
				`not a whole number of 32-bit tile ids`,
			);
		},
	);

	it("data cut short at any byte throws", async () => {
		const full = await compress(bytesOf(tiles(40)), browserFormat);
		for (let length = 0; length < full.length; length++) {
			const result = attempt(toBase64(full.subarray(0, length)), format);
			expect(result.error?.message, `cut to ${length} bytes`).toMatch(
				`${PREFIX} ${format} compressed layer data`,
			);
		}
	});

	it("no single flipped bit loads as other tiles", async () => {
		const ids = tiles(40);
		const full = await compress(bytesOf(ids), browserFormat);
		let thrown = 0;
		for (let bit = 0; bit < full.length * 8; bit++) {
			const damaged = full.slice();
			damaged[bit >> 3] ^= 1 << (bit & 7);
			const result = attempt(toBase64(damaged), format);
			if (result.ids !== undefined) {
				// only a header field nothing reads (gzip's time stamp, its
				// OS byte...) may change and still give the same tiles
				expect(result.ids, `bit ${bit}`).toEqual(ids);
			} else {
				expect(result.error.message, `bit ${bit}`).toMatch(PREFIX);
				thrown++;
			}
		}
		// the deflate data and the checksums are most of the stream
		expect(thrown).toBeGreaterThan(full.length * 8 * 0.7);
	});

	it("bytes after the end throw", async () => {
		const one = await compress(bytesOf(tiles(40)), browserFormat);
		const junk = new Uint8Array(one.length + 3);
		junk.set(one);
		expect(() => inflate(toBase64(junk), format)).toThrow(PREFIX);
	});
});

describe("gzip and zlib specifics", () => {
	it("gzip data in a map that says zlib loads, and the other way round, as with pako", async () => {
		const ids = tiles(500);
		const gzip = toBase64(await compress(bytesOf(ids), "gzip"));
		const zlib = toBase64(await compress(bytesOf(ids), "deflate"));
		expect(inflate(gzip, "zlib")).toEqual(ids);
		expect(inflate(zlib, "gzip")).toEqual(ids);
	});

	/**
	 * two streams, one after the other
	 * @param first - the first stream's tiles
	 * @param second - the second stream's tiles
	 * @param format - "gzip" or "deflate"
	 * @returns both streams
	 */
	const twoStreams = async (
		first: Uint32Array,
		second: Uint32Array,
		format: "gzip" | "deflate",
	) => {
		const one = await compress(bytesOf(first), format);
		const two = await compress(bytesOf(second), format);
		const both = new Uint8Array(one.length + two.length);
		both.set(one);
		both.set(two, one.length);
		return { one, two, both };
	};

	it("gzip members one after the other are one layer, as RFC 1952 says and pako did", async () => {
		const first = tiles(300);
		const second = tiles(77).map((id) => id ^ 1);
		const { both } = await twoStreams(first, second, "gzip");
		expect(inflate(toBase64(both), "gzip")).toEqual(
			new Uint32Array([...first, ...second]),
		);
	});

	it.each([
		["its CRC-32", (b: Uint8Array) => (b[b.length - 8] ^= 1)],
		["its length", (b: Uint8Array) => (b[b.length - 4] ^= 4)],
		["its reserved flags", (b: Uint8Array, at: number) => (b[at + 3] |= 0x40)],
	])("a second gzip member with a wrong %s throws", async (_, damage) => {
		const { one, both } = await twoStreams(tiles(300), tiles(77), "gzip");
		damage(both, one.length);
		expect(() => inflate(toBase64(both), "gzip")).toThrow(PREFIX);
	});

	it("a second gzip member cut short at any byte throws", async () => {
		const { one, both } = await twoStreams(tiles(30), tiles(20), "gzip");
		for (let length = one.length + 1; length < both.length; length++) {
			const result = attempt(toBase64(both.subarray(0, length)), "gzip");
			expect(result.error?.message, `cut to ${length} bytes`).toMatch(PREFIX);
		}
	});

	it("a second, different zlib stream after the first throws (zlib has one)", async () => {
		const { both } = await twoStreams(tiles(300), tiles(77), "deflate");
		expect(() => inflate(toBase64(both), "zlib")).toThrow(/Adler-32 mismatch/);
	});

	it("a copy of a zlib stream after it loads that stream once: its checksum is the copy's", async () => {
		const ids = tiles(300);
		const { both } = await twoStreams(ids, ids, "deflate");
		expect(inflate(toBase64(both), "zlib")).toEqual(ids);
	});

	it("a gzip header with a name, a comment, an extra field and a header CRC loads", async () => {
		const ids = tiles(100);
		const plain = await compress(bytesOf(ids), "gzip");
		const encoder = new TextEncoder();
		const extra = [4, 0, 0x41, 0x42, 2, 0]; // XLEN 4, then 4 bytes
		const name = [...encoder.encode("map.bin"), 0];
		const comment = [...encoder.encode("made by another tool"), 0];
		const headerCrc = [0x12, 0x34]; // not checked, as zlib does by default
		const header = [...plain.subarray(0, 10)];
		header[3] = 0x04 | 0x08 | 0x10 | 0x02;
		const full = new Uint8Array([
			...header,
			...extra,
			...name,
			...comment,
			...headerCrc,
			...plain.subarray(10),
		]);
		expect(inflate(toBase64(full), "gzip")).toEqual(ids);
	});

	it("a name that never ends throws", async () => {
		const plain = await compress(bytesOf(tiles(10)), "gzip");
		const header = plain.slice(0, 10);
		header[3] = 0x08;
		const full = new Uint8Array([...header, ...new Uint8Array(30).fill(0x61)]);
		expect(() => inflate(toBase64(full), "gzip")).toThrow(PREFIX);
	});

	it("an extra field longer than the data throws", async () => {
		const plain = await compress(bytesOf(tiles(10)), "gzip");
		const full = plain.slice();
		full[3] = 0x04;
		full[10] = 0xff;
		full[11] = 0xff;
		expect(() => inflate(toBase64(full), "gzip")).toThrow(PREFIX);
	});

	it.each([
		["reserved flags", (b: Uint8Array) => (b[3] |= 0x20), /reserved flags/],
		[
			"a method other than deflate",
			(b: Uint8Array) => (b[2] = 7),
			/invalid gzip data/,
		],
		[
			"a length that is not its trailer's",
			(b: Uint8Array) => (b[b.length - 4] ^= 0x04),
			/length does not match/,
		],
		[
			"a 4 GB length in its trailer",
			(b: Uint8Array) => b.fill(0xff, b.length - 4),
			/length does not match/,
		],
		[
			"a CRC-32 that is not its data's",
			(b: Uint8Array) => (b[b.length - 8] ^= 0x01),
			/CRC-32 mismatch/,
		],
	])("gzip with %s throws", async (_, damage, reason) => {
		const full = await compress(bytesOf(tiles(100)), "gzip");
		damage(full);
		expect(() => inflate(toBase64(full), "gzip")).toThrow(reason);
	});

	it.each([
		[
			"a preset dictionary",
			(b: Uint8Array) => {
				// FDICT, with the check bits made right again
				b[1] = 0x20;
				b[1] += 31 - (((b[0] << 8) | b[1]) % 31);
			},
			/preset dictionary/,
		],
		[
			"wrong header check bits",
			(b: Uint8Array) => (b[1] ^= 0x01),
			/neither zlib nor gzip/,
		],
		[
			"a method other than deflate",
			(b: Uint8Array) => (b[0] = 0x7f),
			/neither zlib nor gzip/,
		],
		[
			"an Adler-32 that is not its data's",
			(b: Uint8Array) => (b[b.length - 1] ^= 0x01),
			/Adler-32 mismatch/,
		],
	])("zlib with %s throws", async (_, damage, reason) => {
		const full = await compress(bytesOf(tiles(100)), "deflate");
		damage(full);
		expect(() => inflate(toBase64(full), "zlib")).toThrow(reason);
	});

	it.each(["", "eA==", "H4s=", "AAAA"])(
		"%j, too short to be gzip or zlib, throws",
		(text) => {
			expect(() => inflate(text, "zlib")).toThrow(PREFIX);
			expect(() => inflate(text, "gzip")).toThrow(PREFIX);
		},
	);

	it("an error keeps the library's own as its cause", async () => {
		const full = await compress(bytesOf(tiles(100)), "deflate");
		const result = attempt(toBase64(full.subarray(0, 20)), "zlib");
		expect(result.error?.cause).toBeInstanceOf(Error);
	});
});

describe("zstd, as Tiled writes it", () => {
	const layer = zstdMap.layers[0];
	const bytes = base64ToBytes(layer.data);
	const expected = inflate(layer.data, "zstd");

	it("loads Tiled's data", () => {
		expect(expected.length).toBe(13 * 9);
		expect(expected[0]).toBe(1);
	});

	it("data cut short at any byte throws", () => {
		for (let length = 0; length < bytes.length; length++) {
			const result = attempt(toBase64(bytes.subarray(0, length)), "zstd");
			expect(result.error?.message, `cut to ${length} bytes`).toMatch(
				`${PREFIX} zstd compressed layer data`,
			);
		}
	});

	it("a flipped bit throws the plugin's error, or loads (Tiled's zstd has no checksum)", () => {
		for (let bit = 0; bit < bytes.length * 8; bit++) {
			const damaged = bytes.slice();
			damaged[bit >> 3] ^= 1 << (bit & 7);
			const result = attempt(toBase64(damaged), "zstd");
			if (result.error !== undefined) {
				expect(result.error.message, `bit ${bit}`).toMatch(PREFIX);
			} else {
				expect(result.ids, `bit ${bit}`).toBeInstanceOf(Uint32Array);
			}
		}
	});

	it("gzip or zlib data in a map that says zstd throws", async () => {
		const zlib = toBase64(await compress(bytesOf(tiles(10)), "deflate"));
		expect(() => inflate(zlib, "zstd")).toThrow(
			`${PREFIX} zstd compressed layer data: the zstd data is damaged`,
		);
	});
});

describe("compression names", () => {
	it.each(["lz4", "GZIP", "Zlib", "none", "", "deflate"])(
		"%j is not one Tiled writes, and throws naming it",
		(format) => {
			expect(() => inflate("eJwDAAAAAAE=", format)).toThrow(
				`@melonjs/tiled-inflate-plugin: Tiled layer compression "${format}" is not supported: use gzip, zlib or zstd`,
			);
		},
	);
});
