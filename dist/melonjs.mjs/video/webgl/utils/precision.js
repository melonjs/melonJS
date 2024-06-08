/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * set precision for the fiven shader source
 * won't do anything if the precision is already specified
 * @ignore
 */
function setPrecision(src, precision) {
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
function getMaxShaderPrecision(gl) {
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

export { getMaxShaderPrecision, setPrecision };
