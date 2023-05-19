import * as device from "./../system/device";

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
    let renderer = game.renderer;
    let canvas = renderer.getCanvas();
    let context = renderer.getContext();
    let settings = renderer.settings;
    let pixelRatio = device.devicePixelRatio;

    let w = settings.zoomX = canvas.width * x * pixelRatio;
    let h = settings.zoomY = canvas.height * y * pixelRatio;

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
export function onresize(game) {
    let renderer = game.renderer;
    let settings = renderer.settings;
    let scaleX = 1, scaleY = 1;

    if (settings.autoScale) {

        // set max the canvas max size if CSS values are defined
        let canvasMaxWidth = Infinity;
        let canvasMaxHeight = Infinity;

        if (globalThis.getComputedStyle) {
            let style = globalThis.getComputedStyle(renderer.getCanvas(), null);
            canvasMaxWidth = parseInt(style.maxWidth, 10) || Infinity;
            canvasMaxHeight = parseInt(style.maxHeight, 10) || Infinity;
        }

        // get the maximum canvas size within the parent div containing the canvas container
        let nodeBounds = device.getElementBounds(game.getParentElement());

        let _max_width = Math.min(canvasMaxWidth, nodeBounds.width);
        let _max_height = Math.min(canvasMaxHeight, nodeBounds.height);

        // calculate final canvas width & height
        let screenRatio = _max_width / _max_height;

        if ((settings.scaleMethod === "fill-min" && screenRatio > renderer.designRatio) ||
            (settings.scaleMethod === "fill-max" && screenRatio < renderer.designRatio) ||
            (settings.scaleMethod === "flex-width")
        ) {
            // resize the display canvas to fill the parent container
            let sWidth = Math.min(canvasMaxWidth, settings.height * screenRatio);
            scaleX = scaleY = _max_width / sWidth;
            renderer.resize(Math.floor(sWidth), settings.height);
        }
        else if ((settings.scaleMethod === "fill-min" && screenRatio < renderer.designRatio) ||
                 (settings.scaleMethod === "fill-max" && screenRatio > renderer.designRatio) ||
                 (settings.scaleMethod === "flex-height")
        ) {
            // resize the display canvas to fill the parent container
            let sHeight = Math.min(canvasMaxHeight, settings.width * (_max_height / _max_width));
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
