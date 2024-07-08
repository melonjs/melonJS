/**
 * constant to select the HTML5 Canvas renderer
 */
export const CANVAS = 0;

/**
 * constant to select select the WebGL renderer
 */
export const WEBGL = 1;

/**
 * constant to auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
 */
export const AUTO = 2;

export type RendererType = typeof CANVAS | typeof WEBGL | typeof AUTO;
