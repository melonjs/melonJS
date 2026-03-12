/**
 * the function used to decompress zlib/gzip data
 * @ignore
 */
let inflateFunction:
	| ((data: string, format: string) => Uint32Array)
	| undefined;

/**
 * set the function used to inflate gzip/zlib data
 * @param fn - inflate function
 */
export function setInflateFunction(
	fn: ((data: string, format: string) => Uint32Array) | undefined,
) {
	inflateFunction = fn;
}

/**
 * decompress and decode zlib/gzip data
 * @param data - Base64 encoded and compressed data
 * @param format - compressed data format ("gzip","zlib", "zstd")
 * @returns Decoded and decompressed data
 */
export function decompress(data: string, format: string): Uint32Array {
	if (typeof inflateFunction === "function") {
		return inflateFunction(data, format);
	} else {
		throw new Error(
			"No inflate function set — GZIP/ZLIB decompression not supported!",
		);
	}
}

/**
 * Decode a CSV encoded array into a binary array
 * @param input - CSV formatted data (only numbers, everything else will be converted to NaN)
 * @returns Decoded data
 */
export function decodeCSV(input: string): number[] {
	const trimmed = input.trim();

	// count commas to pre-allocate (avoids array resizing)
	let count = 1;
	for (let i = 0, len = trimmed.length; i < len; i++) {
		if (trimmed.charCodeAt(i) === 44 /* comma */) {
			count++;
		}
	}

	const result = new Array<number>(count);
	let idx = 0;
	let start = 0;

	for (let i = 0, len = trimmed.length; i <= len; i++) {
		const ch = i < len ? trimmed.charCodeAt(i) : 44; // treat end-of-string as comma
		// skip newlines (10 = \n, 13 = \r)
		if (ch === 10 || ch === 13) {
			continue;
		}
		if (ch === 44 /* comma */) {
			result[idx++] = +trimmed.slice(start, i);
			start = i + 1;
		}
	}

	// trim trailing empty entries from trailing commas
	result.length = idx;
	return result;
}

/**
 * Decode a base64 encoded string into a byte array
 * @param input - Base64 encoded data
 * @param bytes - number of bytes per array entry
 * @returns Decoded data
 */
export function decodeBase64AsArray(
	input: string,
	bytes: number = 1,
): Uint32Array {
	const dec = globalThis.atob(input.replace(/[^A-Za-z0-9+/=]/g, ""));
	const len = (dec.length / bytes) | 0;
	const ar = new Uint32Array(len);

	if (bytes === 4) {
		// fast path for the common case (tile data is always 4 bytes per entry)
		for (let i = 0; i < len; i++) {
			const base = i << 2; // i * 4
			ar[i] =
				dec.charCodeAt(base) |
				(dec.charCodeAt(base + 1) << 8) |
				(dec.charCodeAt(base + 2) << 16) |
				(dec.charCodeAt(base + 3) << 24);
		}
	} else {
		for (let i = 0; i < len; i++) {
			let val = 0;
			const base = i * bytes;
			for (let j = bytes - 1; j >= 0; --j) {
				val += dec.charCodeAt(base + j) << (j << 3);
			}
			ar[i] = val;
		}
	}
	return ar;
}

/**
 * Decode an encoded array into a binary array
 * @param data - data to be decoded
 * @param encoding - data encoding ("csv", "base64", "none")
 * @param compression - data compression ("none", "gzip", "zlib", "zstd")
 * @returns Decoded data
 */
export function decode(
	data: string | number[],
	encoding?: string,
	compression?: string,
): number[] | Uint32Array {
	const comp = compression || "none";
	const enc = encoding || "none";

	switch (enc) {
		case "csv":
			return decodeCSV(data as string);

		case "base64":
			if (comp !== "none") {
				return decompress(data as string, comp);
			} else {
				return decodeBase64AsArray(data as string, 4);
			}

		case "none":
			return data as number[];

		case "xml":
			throw new Error("XML encoding is deprecated, use base64 instead");

		default:
			throw new Error(`Unknown layer encoding: ${enc}`);
	}
}
