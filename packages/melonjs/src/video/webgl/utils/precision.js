/**
 * set precision for the fiven shader source
 * won't do anything if the precision is already specified
 * @ignore
 */
export function setPrecision(src, precision) {
	if (src.substring(0, 9) !== "precision") {
		return "precision " + precision + " float;\n" + src;
	}
	return src;
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
