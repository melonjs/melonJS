/**
 * set precision for the fiven shader source
 * won't do anything if the precision is already specified
 * @ignore
 */
export function setPrecision(src: any, precision: any): any;
/**
 * return the highest precision format supported by this device for GL Shaders
 * @ignore
 * @param {WebGLRenderingContext} gl - the current WebGL context
 * @returns {boolean} "lowp", "mediump", or "highp"
 */
export function getMaxShaderPrecision(gl: WebGLRenderingContext): boolean;
