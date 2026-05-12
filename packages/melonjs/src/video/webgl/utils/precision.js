/**
 * set precision for the given shader source
 * won't do anything if the precision is already specified
 * @ignore
 */
export function setPrecision(src, precision) {
	// Skip injection when the shader already declares precision near the
	// top — either at byte 0 (GLSL 1.00) or right after the `#version`
	// directive (GLSL 3.00). The substring check we used to do only caught
	// the byte-0 case, so a 3.00 shader with its own `precision highp
	// float;` after `#version` was getting a second precision line injected
	// (still legal GLSL but at best wasteful and at worst overriding user
	// intent).
	if (/^\s*(?:#version[^\n]*\n)?\s*precision\b/.test(src)) {
		return src;
	}
	// WebGL2 GLSL 3.00 requires `#version 300 es` as the very first line,
	// before any other directive. Preserve it and insert precisions after.
	// For 3.00 shaders we inject precisions for float + int so individual
	// shader files don't have to hardcode them; the engine's chosen
	// precision applies uniformly. GLSL 1.00 shaders only need a float
	// precision declaration (samplers and ints have default precisions
	// there).
	if (src.substring(0, 8) === "#version") {
		const inject =
			"\nprecision " + precision + " float;\nprecision " + precision + " int;";
		const nl = src.indexOf("\n");
		// A single-line shader (just `#version 300 es` with no trailing
		// newline) has no `\n` to anchor the insert on; append at end —
		// the `#version` directive must remain on its own first line.
		if (nl < 0) {
			return src + inject;
		}
		return src.substring(0, nl) + inject + src.substring(nl);
	}
	return "precision " + precision + " float;\n" + src;
}

/**
 * return the best shader precision for this device, up to the requested cap.
 * @ignore
 * @param {WebGLRenderingContext} gl - the current WebGL context
 * @param {boolean} [highPrecision=true] - if false, cap at "mediump" even when "highp" is available
 * @returns {string} "lowp", "mediump", or "highp"
 */
export function getMaxShaderPrecision(gl, highPrecision = true) {
	if (
		highPrecision &&
		gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT).precision >
			0 &&
		gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0
	) {
		return "highp";
	}
	if (
		gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT).precision >
			0 &&
		gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision >
			0
	) {
		return "mediump";
	}
	return "lowp";
}
