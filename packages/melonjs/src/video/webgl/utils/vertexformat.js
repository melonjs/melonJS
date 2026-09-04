import { isVertexFormat, resolveVertexFormat } from "../../gpu/vertexformat.ts";

/**
 * Translate between the backend-neutral vertex vocabulary and WebGL's
 * `size` + `type` + `normalized` triple.
 *
 * Everything here takes a live `gl` so the enum values come from the context
 * rather than from hard-coded constants — which keeps the neutral tier free
 * of GL references and matches how the rest of the WebGL layer is written.
 * @ignore
 * @internal
 */

/**
 * The scalar type of each format, as a GL enum name. Indirection through the
 * name (rather than the value) is what lets this table exist without a
 * context: the value is looked up on `gl` at call time.
 * @ignore
 * @internal
 */
const SCALAR_TO_GL_NAME = {
	float32: "FLOAT",
	uint8: "UNSIGNED_BYTE",
	sint8: "BYTE",
	unorm8: "UNSIGNED_BYTE",
	snorm8: "BYTE",
	uint16: "UNSIGNED_SHORT",
	sint16: "SHORT",
	unorm16: "UNSIGNED_SHORT",
	snorm16: "SHORT",
	uint32: "UNSIGNED_INT",
	sint32: "INT",
};

/**
 * The GL enum a vertex format's components are read as.
 * @param {WebGL2RenderingContext} gl - the rendering context
 * @param {string} format - a supported vertex format name
 * @returns {GLenum} the matching component type
 * @throws {Error} when `format` is not a supported format name
 * @ignore
 * @internal
 */
export function glTypeForFormat(gl, format) {
	const { scalar } = resolveVertexFormat(format);
	return gl[SCALAR_TO_GL_NAME[scalar]];
}

/**
 * Name a WebGL attribute description in the neutral vocabulary.
 *
 * Returns `undefined` when the combination has no name — three-component 8-
 * and 16-bit types, for instance, which the GPU vocabulary simply does not
 * define. That absence is deliberate and meaningful: a made-up name would
 * travel into a backend that cannot honour it and fail there, far from the
 * layout that produced it. An attribute with no portable format is still
 * perfectly valid on the WebGL path.
 * @param {WebGL2RenderingContext} gl - the rendering context
 * @param {number} size - component count (1-4)
 * @param {GLenum} type - component type
 * @param {boolean} normalized - whether integers are scaled into `[0, 1]` / `[-1, 1]`
 * @returns {string|undefined} the format name, or `undefined` when none exists
 * @ignore
 * @internal
 */
export function formatFromGL(gl, size, type, normalized) {
	// `FLOAT` has no normalized spelling: WebGL accepts `normalized: true`
	// alongside it and ignores the flag, so the name is keyed off the type and
	// size alone. Reporting `undefined` for that legal combination would strip
	// a portable format from every float attribute that happens to set it.
	const isFloat = type === gl.FLOAT;
	const wants = isFloat ? false : normalized === true;

	let scalar;
	switch (type) {
		case gl.FLOAT:
			scalar = "float32";
			break;
		case gl.UNSIGNED_BYTE:
			scalar = wants ? "unorm8" : "uint8";
			break;
		case gl.BYTE:
			scalar = wants ? "snorm8" : "sint8";
			break;
		case gl.UNSIGNED_SHORT:
			scalar = wants ? "unorm16" : "uint16";
			break;
		case gl.SHORT:
			scalar = wants ? "snorm16" : "sint16";
			break;
		case gl.UNSIGNED_INT:
			scalar = "uint32";
			break;
		case gl.INT:
			scalar = "sint32";
			break;
		default:
			return undefined;
	}

	const candidate = size === 1 ? scalar : `${scalar}x${size}`;
	return isVertexFormat(candidate) ? candidate : undefined;
}
