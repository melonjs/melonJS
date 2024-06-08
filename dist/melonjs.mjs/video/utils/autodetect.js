/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { isWebGLSupported } from '../../system/device.js';
import WebGLRenderer from '../webgl/webgl_renderer.js';
import CanvasRenderer from '../canvas/canvas_renderer.js';

/**
 * Auto-detect the best renderer to use
 * @ignore
 */
function autoDetectRenderer(options) {
    try {
        if (isWebGLSupported(options)) {
            return new WebGLRenderer(options);
        }
    } catch (e) {
        console.log("Error creating WebGL renderer :" + e.message);
    }
    return new CanvasRenderer(options);
}

export { autoDetectRenderer };
