/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * constant to select the HTML5 Canvas renderer
 * @type {number}
 * @static
 * @see Application
 */
const CANVAS = 0;

/**
 * constant to select select the WebGL renderer
 * @type {number}
 * @static
 * @see Application
 */
const WEBGL = 1;

/**
 * constant to auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
 * @static
 * @type {number}
 * @see Application
 */
const AUTO = 2;

export { AUTO, CANVAS, WEBGL };
