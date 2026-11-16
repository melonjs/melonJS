import { Gunzip, inflateSync } from "fflate";
import { decompress as zstdDecompress } from "fzstd";

/** @type {Int8Array | undefined} */
let base64Values;

/**
 * Decodes base64 where the runtime has no `atob`, accepting exactly what
 * `atob` accepts: ASCII white space anywhere, and no padding, or the padding
 * the length calls for.
 * @ignore
 * @param {string} text - base64 encoded data
 * @returns {Uint8Array} the decoded bytes
 */
export function decodeBase64(text) {
	if (base64Values === undefined) {
		base64Values = new Int8Array(128).fill(-1);
		const alphabet =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		for (let i = 0; i < 64; i++) {
			base64Values[alphabet.charCodeAt(i)] = i;
		}
	}
	const values = base64Values;
	const clean = text.replace(/[\t\n\f\r ]+/g, "");
	let length = clean.length;
	if (length % 4 === 0 && clean.endsWith("=")) {
		length -= clean.endsWith("==") ? 2 : 1;
	}
	if (length % 4 === 1) {
		throw new Error("not valid base64");
	}
	const bytes = new Uint8Array((length * 3) >> 2);
	let out = 0;
	let buffer = 0;
	let bits = 0;
	for (let i = 0; i < length; i++) {
		const code = clean.charCodeAt(i);
		const value = code < 128 ? values[code] : -1;
		if (value < 0) {
			throw new Error("not valid base64");
		}
		buffer = ((buffer << 6) | value) & 0xffffff;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes[out++] = buffer >> bits;
		}
	}
	return bytes;
}

/**
 * Turns the base64 text of a Tiled layer into bytes. A `.tmx` file wraps it in
 * new lines and indentation, which are skipped.
 * @ignore
 * @param {string} text - base64 encoded data
 * @returns {Uint8Array} the decoded bytes
 */
export function base64ToBytes(text) {
	try {
		if (typeof globalThis.atob !== "function") {
			return decodeBase64(text);
		}
		const binary = globalThis.atob(text);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	} catch (error) {
		throw new Error("the layer data is not valid base64", { cause: error });
	}
}

/** @type {Int32Array | undefined} */
let crcTables;

/**
 * The tables of CRC-32 "slicing by 8": table k (at k * 256) gives the CRC of
 * a byte followed by k zero bytes, so eight bytes are folded in at once.
 * @returns {Int32Array} the eight tables, one after the other
 */
function makeCrcTables() {
	const tables = new Int32Array(8 * 256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		tables[n] = c;
	}
	for (let n = 0; n < 256; n++) {
		let c = tables[n];
		for (let k = 1; k < 8; k++) {
			c = tables[c & 0xff] ^ (c >>> 8);
			tables[k * 256 + n] = c;
		}
	}
	return tables;
}

/**
 * The CRC-32 a gzip stream ends with (RFC 1952).
 * @ignore
 * @param {Uint8Array} data - the decompressed bytes
 * @returns {number} their CRC-32
 */
export function crc32(data) {
	crcTables ??= makeCrcTables();
	const t = crcTables;
	const len = data.length;
	const whole = len - (len & 7);
	let crc = -1;
	let i = 0;
	for (; i < whole; i += 8) {
		const a =
			crc ^
			(data[i] |
				(data[i + 1] << 8) |
				(data[i + 2] << 16) |
				(data[i + 3] << 24));
		crc =
			t[1792 + (a & 0xff)] ^
			t[1536 + ((a >>> 8) & 0xff)] ^
			t[1280 + ((a >>> 16) & 0xff)] ^
			t[1024 + (a >>> 24)] ^
			t[768 + data[i + 4]] ^
			t[512 + data[i + 5]] ^
			t[256 + data[i + 6]] ^
			t[data[i + 7]];
	}
	for (; i < len; i++) {
		crc = t[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ -1) >>> 0;
}

/**
 * The Adler-32 checksum a zlib stream ends with (RFC 1950).
 * @ignore
 * @param {Uint8Array} data - the decompressed bytes
 * @returns {number} their Adler-32
 */
export function adler32(data) {
	let a = 1;
	let b = 0;
	const len = data.length;
	for (let i = 0; i < len; ) {
		// 5552 bytes is the most that can be summed before `b` passes 2^32
		const end = Math.min(i + 5552, len);
		for (; i < end; i++) {
			a += data[i];
			b += a;
		}
		a %= 65521;
		b %= 65521;
	}
	return ((b << 16) | a) >>> 0;
}

/**
 * Reads a little-endian 32-bit number.
 * @param {Uint8Array} bytes - the data
 * @param {number} at - where the number starts
 * @returns {number} the number
 */
const uint32LE = (bytes, at) => {
	return (
		(bytes[at] |
			(bytes[at + 1] << 8) |
			(bytes[at + 2] << 16) |
			(bytes[at + 3] << 24)) >>>
		0
	);
};

/**
 * Inflates the deflate stream inside a gzip or zlib wrapper.
 * @param {Uint8Array} stream - the raw deflate stream
 * @returns {Uint8Array} the inflated bytes
 */
function inflateStream(stream) {
	try {
		return inflateSync(stream);
	} catch (error) {
		throw new Error(
			`the compressed data is damaged or cut short (${error.message})`,
			{ cause: error },
		);
	}
}

/**
 * Decompresses gzip data (RFC 1952): one member, or several one after the
 * other, whose data follow each other. fflate checks neither a member's CRC-32
 * nor its length, so each member's are checked here.
 * @param {Uint8Array} bytes - the gzip data
 * @returns {Uint8Array} the decompressed bytes
 */
function gunzip(bytes) {
	// where each member starts in the input, and ends in the output
	const starts = [0];
	const ends = [];
	const chunks = [];
	let total = 0;
	const stream = new Gunzip((chunk) => {
		chunks.push(chunk);
		total += chunk.length;
	});
	stream.onmember = (offset) => {
		starts.push(offset);
		ends.push(total);
	};
	try {
		stream.push(bytes, true);
	} catch (error) {
		throw new Error(
			`the gzip data is damaged or cut short (${error.message})`,
			{
				cause: error,
			},
		);
	}
	ends.push(total);

	const out = chunks.length === 1 ? chunks[0] : new Uint8Array(total);
	if (chunks.length !== 1) {
		let at = 0;
		for (const chunk of chunks) {
			out.set(chunk, at);
			at += chunk.length;
		}
	}

	for (let i = 0, from = 0; i < starts.length; i++) {
		const start = starts[i];
		const end = i + 1 < starts.length ? starts[i + 1] : bytes.length;
		// a 10-byte header, at least one deflate byte, and an 8-byte trailer
		if (end - start < 19 || bytes[start + 2] !== 8) {
			throw new Error("the gzip data is cut short or not deflate");
		}
		if (bytes[start + 3] & 0xe0) {
			throw new Error("the gzip header sets reserved flags");
		}
		// the trailer: the member's CRC-32, then its length modulo 2^32
		const data = out.subarray(from, ends[i]);
		if (data.length >>> 0 !== uint32LE(bytes, end - 4)) {
			throw new Error(
				"the gzip data is damaged (its length does not match its trailer)",
			);
		}
		if (crc32(data) !== uint32LE(bytes, end - 8)) {
			throw new Error("the gzip data is damaged (CRC-32 mismatch)");
		}
		from = ends[i];
	}
	return out;
}

/**
 * Decompresses a zlib stream (RFC 1950), checking its Adler-32.
 * @param {Uint8Array} bytes - the zlib stream
 * @returns {Uint8Array} the decompressed bytes
 */
function unzlib(bytes) {
	const len = bytes.length;
	const cmf = bytes[0];
	const flg = bytes[1];
	// a 2-byte header, at least one deflate byte, and the 4-byte checksum
	if (
		len < 7 ||
		(cmf & 0x0f) !== 8 ||
		cmf >> 4 > 7 ||
		((cmf << 8) | flg) % 31 !== 0
	) {
		throw new Error("the data is neither zlib nor gzip");
	}
	if (flg & 0x20) {
		throw new Error("zlib data with a preset dictionary is not supported");
	}
	const out = inflateStream(bytes.subarray(2, len - 4));
	const expected =
		((bytes[len - 4] << 24) |
			(bytes[len - 3] << 16) |
			(bytes[len - 2] << 8) |
			bytes[len - 1]) >>>
		0;
	if (adler32(out) !== expected) {
		throw new Error("the zlib data is damaged (Adler-32 mismatch)");
	}
	return out;
}

/**
 * Decompresses a zstd frame. fzstd does not check the frame's optional
 * checksum, which Tiled does not write.
 * @param {Uint8Array} bytes - the zstd data
 * @returns {Uint8Array} the decompressed bytes
 */
function unzstd(bytes) {
	try {
		return zstdDecompress(bytes);
	} catch (error) {
		throw new Error(
			`the zstd data is damaged or cut short (${error.message})`,
			{
				cause: error,
			},
		);
	}
}

/**
 * Decompresses the base64 data of a Tiled tile layer into its tile ids.
 * gzip and zlib data are told apart by their header rather than by the map's
 * `compression`, so a map that says one and holds the other still loads, as
 * it did with pako.
 * @ignore
 * @param {string} data - base64 encoded, compressed layer data
 * @param {string} format - "gzip", "zlib" or "zstd"
 * @returns {Uint32Array} the global tile ids, flip flags included
 */
export function inflate(data, format) {
	if (format !== "gzip" && format !== "zlib" && format !== "zstd") {
		throw new Error(
			`@melonjs/tiled-inflate-plugin: Tiled layer compression "${format}" is not supported: use gzip, zlib or zstd`,
		);
	}
	let bytes;
	try {
		const compressed = base64ToBytes(data);
		if (compressed.length === 0) {
			// zstd would make no tiles of it
			throw new Error("the layer data is empty");
		}
		if (format === "zstd") {
			bytes = unzstd(compressed);
		} else if (compressed[0] === 0x1f && compressed[1] === 0x8b) {
			bytes = gunzip(compressed);
		} else {
			bytes = unzlib(compressed);
		}
		if (bytes.byteLength % 4 !== 0) {
			throw new Error(
				`${bytes.byteLength} bytes is not a whole number of 32-bit tile ids`,
			);
		}
	} catch (error) {
		throw new Error(
			`@melonjs/tiled-inflate-plugin: cannot read ${format} compressed layer data: ${error.message}`,
			{ cause: error },
		);
	}
	// a typed array view must start on a multiple of its element size
	if (bytes.byteOffset % 4 !== 0) {
		bytes = bytes.slice();
	}
	return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}
