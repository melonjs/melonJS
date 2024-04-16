/**
 * set precision for the fiven shader source
 * won't do anything if the precision is already specified
 * @ignore
 */
export function setPrecision(src, precision) {
    if (src.substring(0, 9) !== "precision") {
        return "precision " + precision + " float;" + src;
    }
    return src;
}

/**
 * return the highest precision format supported by this device for GL Shaders
 * @ignore
 * @param {WebGLRenderingContext} gl - the current WebGL context
 * @returns {boolean} "lowp", "mediump", or "highp"
 */
export function getMaxShaderPrecision(gl) {
    if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT).precision > 0 &&
        gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0) {
        return "highp";
    }
    if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT).precision > 0 &&
        gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision > 0) {
        return "mediump";
    }
    return "lowp";
}
