/**
 * A PNG made from pixels, with no canvas in between.
 *
 * A 2D canvas stores its pixels multiplied by their alpha: what is drawn into
 * one with an alpha of 0 comes back black, and with a low alpha comes back
 * rounded. An image whose alpha is not coverage (a normal map carries a gloss
 * mask there) cannot be built through one. This writes the bytes of a PNG
 * file directly, as an artist's tool would, and decodes it the way the loader
 * does: into an `HTMLImageElement`.
 */

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

const crc32 = (bytes) => {
	let c = 0xffffffff;
	for (const byte of bytes) {
		c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, body) => {
	const out = new Uint8Array(12 + body.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, body.length);
	for (let i = 0; i < 4; i++) {
		out[4 + i] = type.charCodeAt(i);
	}
	out.set(body, 8);
	view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
	return out;
};

/**
 * Encode pixels as an 8-bit RGBA PNG, straight alpha, and decode it.
 * @param {ImageData} imageData - the pixels, as they are to be in the file
 * @returns {Promise<HTMLImageElement>} the decoded image
 */
export async function pngImage(imageData) {
	const { width, height, data } = imageData;
	const stride = 1 + width * 4;
	// each row: a filter byte (0, none), then its pixels
	const raw = new Uint8Array(height * stride);
	for (let y = 0; y < height; y++) {
		raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1);
	}
	const deflated = new Uint8Array(
		await new Response(
			new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),
		).arrayBuffer(),
	);
	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	// 8 bits a channel, color type 6 (RGBA), default compression and filter,
	// not interlaced
	header.set([8, 6, 0, 0, 0], 8);
	const blob = new Blob(
		[
			new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
			chunk("IHDR", header),
			chunk("IDAT", deflated),
			chunk("IEND", new Uint8Array(0)),
		],
		{ type: "image/png" },
	);
	const url = URL.createObjectURL(blob);
	const image = new Image();
	image.src = url;
	try {
		await image.decode();
	} finally {
		URL.revokeObjectURL(url);
	}
	return image;
}
