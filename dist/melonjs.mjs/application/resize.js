/*!
 * melonJS Game Engine - v15.0.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { getParentBounds, devicePixelRatio } from '../system/device.js';

/**
 * scale the "displayed" canvas by the given scalar.
 * this will modify the size of canvas element directly.
 * Only use this if you are not using the automatic scaling feature.
 * @private
 * @param {Application} game - the game application instance triggering the resize
 * @param {number} x - x scaling multiplier
 * @param {number} y - y scaling multiplier
 */
function scale(game, x, y) {
    var renderer = game.renderer;
    var canvas = renderer.getCanvas();
    var context = renderer.getContext();
    var settings = renderer.settings;
    var pixelRatio = devicePixelRatio;

    var w = settings.zoomX = canvas.width * x * pixelRatio;
    var h = settings.zoomY = canvas.height * y * pixelRatio;

    // update the global scale variable
    renderer.scaleRatio.set(x * pixelRatio, y * pixelRatio);

    // adjust CSS style based on device pixel ratio
    canvas.style.width = (w / pixelRatio) + "px";
    canvas.style.height = (h / pixelRatio) + "px";

    // if anti-alias and blend mode were resetted (e.g. Canvas mode)
    renderer.setAntiAlias(context, settings.antiAlias);
    renderer.setBlendMode(settings.blendMode, context);

    // force repaint
    game.repaint();
}

/**
 * callback for window resize event
 * @private
 * @param {Application} game - the game application instance triggering the resize
 */
function onresize(game) {
    var renderer = game.renderer;
    var settings = renderer.settings;
    var scaleX = 1, scaleY = 1;

    if (settings.autoScale) {

        // set max the canvas max size if CSS values are defined
        var canvasMaxWidth = Infinity;
        var canvasMaxHeight = Infinity;

        if (globalThis.getComputedStyle) {
            var style = globalThis.getComputedStyle(renderer.getCanvas(), null);
            canvasMaxWidth = parseInt(style.maxWidth, 10) || Infinity;
            canvasMaxHeight = parseInt(style.maxHeight, 10) || Infinity;
        }

        // get the maximum canvas size within the parent div containing the canvas container
        var nodeBounds = getParentBounds(game.getParentElement());

        var _max_width = Math.min(canvasMaxWidth, nodeBounds.width);
        var _max_height = Math.min(canvasMaxHeight, nodeBounds.height);

        // calculate final canvas width & height
        var screenRatio = _max_width / _max_height;

        if ((settings.scaleMethod === "fill-min" && screenRatio > renderer.designRatio) ||
            (settings.scaleMethod === "fill-max" && screenRatio < renderer.designRatio) ||
            (settings.scaleMethod === "flex-width")
        ) {
            // resize the display canvas to fill the parent container
            var sWidth = Math.min(canvasMaxWidth, settings.height * screenRatio);
            scaleX = scaleY = _max_width / sWidth;
            renderer.resize(Math.floor(sWidth), settings.height);
        }
        else if ((settings.scaleMethod === "fill-min" && screenRatio < renderer.designRatio) ||
                 (settings.scaleMethod === "fill-max" && screenRatio > renderer.designRatio) ||
                 (settings.scaleMethod === "flex-height")
        ) {
            // resize the display canvas to fill the parent container
            var sHeight = Math.min(canvasMaxHeight, settings.width * (_max_height / _max_width));
            scaleX = scaleY = _max_height / sHeight;
            renderer.resize(settings.width, Math.floor(sHeight));
        }
        else if (settings.scaleMethod === "flex") {
            // resize the display canvas to fill the parent container
            renderer.resize(Math.floor(_max_width), Math.floor(_max_height));
        }
        else if (settings.scaleMethod === "stretch") {
            // scale the display canvas to fit with the parent container
            scaleX = _max_width / settings.width;
            scaleY = _max_height / settings.height;
        }
        else {
            // scale the display canvas to fit the parent container
            // make sure we maintain the original aspect ratio
            if (screenRatio < renderer.designRatio) {
                scaleX = scaleY = _max_width / settings.width;
            }
            else {
                scaleX = scaleY = _max_height / settings.height;
            }
        }

        // adjust scaling ratio based on the new scaling ratio
        scale(game, scaleX, scaleY);
    } else {
        // adjust scaling ratio based on the given settings
        scale(game, settings.scale, settings.scale);
    }
}

export { onresize };
