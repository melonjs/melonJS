/**
 * Auto-detect the best renderer to use
 * @ignore
 */
export function autoDetectRenderer(options: any): CanvasRenderer | WebGLRenderer;
import CanvasRenderer from "../canvas/canvas_renderer";
import WebGLRenderer from "../webgl/webgl_renderer";
