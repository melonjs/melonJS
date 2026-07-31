/**
 * Backend-neutral vertex attribute formats.
 *
 * A vertex format names a component type and a component count in one token:
 * `"float32x3"` is three 32-bit floats, `"unorm8x4"` is four unsigned bytes
 * normalized to `[0, 1]`. That is everything a backend needs to interpret a
 * slice of an interleaved vertex buffer, which is why it replaces the
 * `size` + `type` + `normalized` triple the WebGL API works in.
 *
 * Naming follows the GPU vocabulary rather than the GL one, because the
 * translation only runs one way: `"unorm8x4"` gives you `4` +
 * `UNSIGNED_BYTE` + `normalized`, whereas `UNSIGNED_BYTE` alone cannot tell
 * you the component count or whether it is normalized. Declaring the format
 * also means a layout no longer needs a live rendering context to be written
 * down — the GL enums are only resolved when a backend consumes it.
 *
 * This module holds no GL references at all, so a non-WebGL backend can
 * import it without pulling in the WebGL layer.
 * @see {@link Batcher#addAttribute}
 */

/**
 * The scalar component type underlying a {@link VertexFormat}.
 * @ignore
 */
export type VertexScalar =
	| "float32"
	| "uint8"
	| "sint8"
	| "unorm8"
	| "snorm8"
	| "uint16"
	| "sint16"
	| "unorm16"
	| "snorm16"
	| "uint32"
	| "sint32";

/**
 * A vertex attribute format: component type and count.
 *
 * The set is deliberately narrower than the full GPU vocabulary — see the
 * module notes for what is excluded and why. Layouts that cannot be spelled
 * here (three-component 8- and 16-bit types, for instance) remain expressible
 * with the {@link Batcher#addAttribute} GL-enum form, which is supported
 * indefinitely.
 */
export type VertexFormat =
	// 32-bit float
	| "float32"
	| "float32x2"
	| "float32x3"
	| "float32x4"
	// 8-bit integer
	| "uint8"
	| "uint8x2"
	| "uint8x4"
	| "sint8"
	| "sint8x2"
	| "sint8x4"
	// 8-bit normalized
	| "unorm8"
	| "unorm8x2"
	| "unorm8x4"
	| "snorm8"
	| "snorm8x2"
	| "snorm8x4"
	// 16-bit integer
	| "uint16"
	| "uint16x2"
	| "uint16x4"
	| "sint16"
	| "sint16x2"
	| "sint16x4"
	// 16-bit normalized
	| "unorm16"
	| "unorm16x2"
	| "unorm16x4"
	| "snorm16"
	| "snorm16x2"
	| "snorm16x4"
	// 32-bit integer
	| "uint32"
	| "uint32x2"
	| "uint32x3"
	| "uint32x4"
	| "sint32"
	| "sint32x2"
	| "sint32x3"
	| "sint32x4";

/**
 * What a {@link VertexFormat} resolves to.
 * @ignore
 */
export interface VertexFormatInfo {
	/** number of components (1, 2, 3 or 4) */
	components: 1 | 2 | 3 | 4;
	/** total size of the attribute in bytes */
	bytes: number;
	/** whether integer values are scaled into `[0, 1]` / `[-1, 1]` when read by a shader */
	normalized: boolean;
	/** the underlying scalar type */
	scalar: VertexScalar;
}

/**
 * Bytes occupied by one component of each scalar type.
 * @ignore
 */
const SCALAR_BYTES: Record<VertexScalar, number> = {
	float32: 4,
	uint8: 1,
	sint8: 1,
	unorm8: 1,
	snorm8: 1,
	uint16: 2,
	sint16: 2,
	unorm16: 2,
	snorm16: 2,
	uint32: 4,
	sint32: 4,
};

/**
 * Whether a scalar type is read as a normalized fraction.
 * @ignore
 */
const SCALAR_NORMALIZED: Record<VertexScalar, boolean> = {
	float32: false,
	uint8: false,
	sint8: false,
	unorm8: true,
	snorm8: true,
	uint16: false,
	sint16: false,
	unorm16: true,
	snorm16: true,
	uint32: false,
	sint32: false,
};

/**
 * Build one table entry, keeping `bytes` derived rather than transcribed so a
 * typo cannot silently change a stride.
 * @param scalar - the component type
 * @param components - how many components the attribute has
 * @returns the resolved format description
 * @ignore
 */
function entry(
	scalar: VertexScalar,
	components: 1 | 2 | 3 | 4,
): VertexFormatInfo {
	return {
		components,
		bytes: components * SCALAR_BYTES[scalar],
		normalized: SCALAR_NORMALIZED[scalar],
		scalar,
	};
}

/**
 * Every supported format, resolved.
 *
 * `bytes` is computed as `components × scalar size`, which is the same
 * arithmetic the GL-enum path has always used — so a layout expressed either
 * way produces an identical stride.
 * @ignore
 */
export const VERTEX_FORMATS: Record<VertexFormat, VertexFormatInfo> = {
	float32: entry("float32", 1),
	float32x2: entry("float32", 2),
	float32x3: entry("float32", 3),
	float32x4: entry("float32", 4),

	uint8: entry("uint8", 1),
	uint8x2: entry("uint8", 2),
	uint8x4: entry("uint8", 4),
	sint8: entry("sint8", 1),
	sint8x2: entry("sint8", 2),
	sint8x4: entry("sint8", 4),

	unorm8: entry("unorm8", 1),
	unorm8x2: entry("unorm8", 2),
	unorm8x4: entry("unorm8", 4),
	snorm8: entry("snorm8", 1),
	snorm8x2: entry("snorm8", 2),
	snorm8x4: entry("snorm8", 4),

	uint16: entry("uint16", 1),
	uint16x2: entry("uint16", 2),
	uint16x4: entry("uint16", 4),
	sint16: entry("sint16", 1),
	sint16x2: entry("sint16", 2),
	sint16x4: entry("sint16", 4),

	unorm16: entry("unorm16", 1),
	unorm16x2: entry("unorm16", 2),
	unorm16x4: entry("unorm16", 4),
	snorm16: entry("snorm16", 1),
	snorm16x2: entry("snorm16", 2),
	snorm16x4: entry("snorm16", 4),

	uint32: entry("uint32", 1),
	uint32x2: entry("uint32", 2),
	uint32x3: entry("uint32", 3),
	uint32x4: entry("uint32", 4),
	sint32: entry("sint32", 1),
	sint32x2: entry("sint32", 2),
	sint32x3: entry("sint32", 3),
	sint32x4: entry("sint32", 4),
};

/**
 * Whether a value is a supported vertex format name.
 * @param value - the value to test
 * @returns `true` when `value` names a format in {@link VERTEX_FORMATS}
 */
export function isVertexFormat(value: unknown): value is VertexFormat {
	return typeof value === "string" && Object.hasOwn(VERTEX_FORMATS, value);
}

/**
 * Resolve a vertex format to its component count, size and normalization.
 * @param format - the format to resolve
 * @returns the resolved description
 * @throws {Error} when `format` is not a supported format name
 */
export function resolveVertexFormat(format: VertexFormat): VertexFormatInfo {
	if (!isVertexFormat(format)) {
		throw new Error(
			`Unknown vertex format "${String(format)}". Supported formats: ${Object.keys(
				VERTEX_FORMATS,
			).join(", ")}`,
		);
	}
	return VERTEX_FORMATS[format];
}
