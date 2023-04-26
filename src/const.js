/**
 * constant to select the HTML5 Canvas renderer
 * @type {number}
 * @static
 * @see Application
 */
export const CANVAS = 0;

/**
 * constant to select select the WebGL renderer
 * @type {number}
 * @static
 * @see Application
 */
export const WEBGL = 1;

/**
 * constant to auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
 * @static
 * @type {number}
 * @see Application
 */
export const AUTO = 2;
