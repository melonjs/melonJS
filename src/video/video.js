import Vector2d from "./../math/vector2.js";
import WebGLRenderer from "./webgl/webgl_renderer.js";
import CanvasRenderer from "./canvas/canvas_renderer.js";
import utils from "./../utils/utils.js";
import * as event from "./../system/event.js";
import { repaint } from "./../game.js";
import device from "./../system/device.js";
import { initialized, version } from "./../index.js";

/**
 * video functions
 * @namespace me.video
 * @memberof me
 */

var designRatio = 1;
var designWidth = 0;
var designHeight = 0;

// default video settings
var settings = {
    parent : document.body,
    renderer : 2, // AUTO
    doubleBuffering : false,
    autoScale : false,
    scale : 1.0,
    scaleMethod : "fit",
    transparent : false,
    blendMode : "normal",
    antiAlias : false,
    failIfMajorPerformanceCaveat : true,
    subPixel : false,
    preferWebGL1 : false,
    powerPreference : "default",
    verbose : false,
    consoleHeader : true
};

/**
 * Auto-detect the best renderer to use
 * @ignore
 */
function autoDetectRenderer(options) {
    try {
        if (device.isWebGLSupported(options)) {
            return new WebGLRenderer(options);
        }
    } catch (e) {
        console.log("Error creating WebGL renderer :" + e.message);
    }
    return new CanvasRenderer(options);
};

/**
 * callback for window resize event
 * @ignore
 */
function onresize() {
    var settings = renderer.settings;
    var scaleX = 1, scaleY = 1;

    if (settings.autoScale) {

        // set max the canvas max size if CSS values are defined
        var canvasMaxWidth = Infinity;
        var canvasMaxHeight = Infinity;

        if (window.getComputedStyle) {
            var style = window.getComputedStyle(renderer.getScreenCanvas(), null);
            canvasMaxWidth = parseInt(style.maxWidth, 10) || Infinity;
            canvasMaxHeight = parseInt(style.maxHeight, 10) || Infinity;
        }

        // get the maximum canvas size within the parent div containing the canvas container
        var nodeBounds = device.getParentBounds(getParent());

        var _max_width = Math.min(canvasMaxWidth, nodeBounds.width);
        var _max_height = Math.min(canvasMaxHeight, nodeBounds.height);

        // calculate final canvas width & height
        var screenRatio = _max_width / _max_height;

        if ((settings.scaleMethod === "fill-min" && screenRatio > designRatio) ||
            (settings.scaleMethod === "fill-max" && screenRatio < designRatio) ||
            (settings.scaleMethod === "flex-width")
        ) {
            // resize the display canvas to fill the parent container
            var sWidth = Math.min(canvasMaxWidth, designHeight * screenRatio);
            scaleX = scaleY = _max_width / sWidth;
            renderer.resize(Math.floor(sWidth), designHeight);
        }
        else if ((settings.scaleMethod === "fill-min" && screenRatio < designRatio) ||
                 (settings.scaleMethod === "fill-max" && screenRatio > designRatio) ||
                 (settings.scaleMethod === "flex-height")
        ) {
            // resize the display canvas to fill the parent container
            var sHeight = Math.min(canvasMaxHeight, designWidth * (_max_height / _max_width));
            scaleX = scaleY = _max_height / sHeight;
            renderer.resize(designWidth, Math.floor(sHeight));
        }
        else if (settings.scaleMethod === "flex") {
            // resize the display canvas to fill the parent container
            renderer.resize(Math.floor(_max_width), Math.floor(_max_height));
        }
        else if (settings.scaleMethod === "stretch") {
            // scale the display canvas to fit with the parent container
            scaleX = _max_width / designWidth;
            scaleY = _max_height / designHeight;
        }
        else {
            // scale the display canvas to fit the parent container
            // make sure we maintain the original aspect ratio
            if (screenRatio < designRatio) {
                scaleX = scaleY = _max_width / designWidth;
            }
            else {
                scaleX = scaleY = _max_height / designHeight;
            }
        }

        // adjust scaling ratio based on the new scaling ratio
        scale(scaleX, scaleY);
    }
};

/**
 * Select the HTML5 Canvas renderer
 * @name CANVAS
 * @memberof me.video
 * @constant
 */
export const CANVAS = 0;

/**
 * Select the WebGL renderer
 * @name WEBGL
 * @memberof me.video
 * @constant
 */
export const WEBGL = 1;

/**
 * Auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
 * @name AUTO
 * @memberof me.video
 * @constant
 */
export const AUTO = 2;

/**
 * the parent container of the main canvas element
 * @ignore
 * @type {HTMLElement}
 * @readonly
 * @name parent
 * @memberof me.video
 */
export let parent = null;

/**
 * the scaling ratio to be applied to the display canvas
 * @name scaleRatio
 * @type {me.Vector2d}
 * @default <1,1>
 * @memberof me.video
 */
export let scaleRatio = new Vector2d(1, 1);

 /**
  * A reference to the active Canvas or WebGL active renderer renderer
  * @name renderer
  * @type {me.CanvasRenderer|me.WebGLRenderer}
  * @memberof me.video
  */
export let renderer = null;

/**
 * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer). <br>
 * melonJS support various scaling mode, that can be enabled <u>once the scale option is set to <b>`auto`</b></u> : <br>
 *  - <i><b>`fit`</b></i> : Letterboxed; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fit.png"/></center><br>
 *  - <i><b>`fill-min`</b></i> : Canvas is resized to fit minimum design resolution; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fill-min.png"/></center><br>
 *  - <i><b>`fill-max`</b></i> : Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fill-max.png"/></center><br>
 *  - <i><b>`flex`</b><</i> : Canvas width & height is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex.png"/></center><br>
 *  - <i><b>`flex-width`</b></i> : Canvas width is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex-width.png"/></center><br>
 *  - <i><b>`flex-height`</b></i> : Canvas height is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex-height.png"/></center><br>
 *  - <i><b>`stretch`</b></i> : Canvas is resized to fit; content is scaled to screen aspect ratio
 * <center><img src="images/scale-stretch.png"/></center><br>
 * @function me.video.init
 * @param {number} width The width of the canvas viewport
 * @param {number} height The height of the canvas viewport
 * @param {object} [options] The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
 * @param {string|HTMLElement} [options.parent=document.body] the DOM parent element to hold the canvas in the HTML file
 * @param {number} [options.renderer=me.video.AUTO] renderer to use (me.video.CANVAS, me.video.WEBGL, me.video.AUTO)
 * @param {boolean} [options.doubleBuffering=false] enable/disable double buffering
 * @param {number|string} [options.scale=1.0] enable scaling of the canvas ('auto' for automatic scaling)
 * @param {string} [options.scaleMethod="fit"] screen scaling modes ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch')
 * @param {boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
 * @param {string} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @param {boolean} [options.transparent=false] whether to allow transparent pixels in the front buffer (screen).
 * @param {boolean} [options.antiAlias=false] whether to enable or not video scaling interpolation
 * @param {boolean} [options.consoleHeader=true] whether to display melonJS version and basic device information in the console
 * @returns {boolean} false if initialization failed (canvas not supported)
 * @example
 * // init the video with a 640x480 canvas
 * me.video.init(640, 480, {
 *     parent : "screen",
 *     renderer : me.video.AUTO,
 *     scale : "auto",
 *     scaleMethod : "fit",
 *     doubleBuffering : true
 * });
 */
export function init(width, height, options) {

    // ensure melonjs has been properly initialized
    if (!initialized) {
        throw new Error("me.video.init() called before engine initialization.");
    }

    // revert to default options if not defined
    settings = Object.assign(settings, options || {});

    // sanitize potential given parameters
    settings.width = width;
    settings.height = height;
    settings.doubleBuffering = !!(settings.doubleBuffering);
    settings.transparent = !!(settings.transparent);
    settings.antiAlias = !!(settings.antiAlias);
    settings.failIfMajorPerformanceCaveat = !!(settings.failIfMajorPerformanceCaveat);
    settings.subPixel = !!(settings.subPixel);
    settings.verbose = !!(settings.verbose);
    if (settings.scaleMethod.search(/^(fill-(min|max)|fit|flex(-(width|height))?|stretch)$/) !== -1) {
        settings.autoScale = (settings.scale === "auto") || true;
    } else {
        // default scaling method
        settings.scaleMethod = "fit";
        settings.autoScale = (settings.scale === "auto") || false;
    }

    // display melonJS version
    if (settings.consoleHeader !== false) {
        // output video information in the console
        console.log("melonJS 2 (v" + version + ") | http://melonjs.org" );
    }

    // override renderer settings if &webgl is defined in the URL
    var uriFragment = utils.getUriFragment();
    if (uriFragment.webgl === true || uriFragment.webgl1 === true || uriFragment.webgl2 === true) {
        settings.renderer = WEBGL;
        if (uriFragment.webgl1 === true) {
            settings.preferWebGL1 = true;
        }
    }

    // normalize scale
    settings.scale = (settings.autoScale) ? 1.0 : (+settings.scale || 1.0);
    scaleRatio.set(settings.scale, settings.scale);

    // force double buffering if scaling is required
    if (settings.autoScale || (settings.scale !== 1.0)) {
        settings.doubleBuffering = true;
    }

    // hold the requested video size ratio
    designRatio = width / height;
    designWidth = width;
    designHeight = height;

    // default scaled size value
    settings.zoomX = width * scaleRatio.x;
    settings.zoomY = width * scaleRatio.y;

    //add a channel for the onresize/onorientationchange event
    window.addEventListener(
        "resize",
        utils.function.throttle(
            function (e) {
                event.emit(event.WINDOW_ONRESIZE, e);
            }, 100
        ), false
    );

    // Screen Orientation API
    window.addEventListener(
        "orientationchange",
        function (e) {
            event.emit(event.WINDOW_ONORIENTATION_CHANGE, e);
        },
        false
    );
    // pre-fixed implementation on mozzila
    window.addEventListener(
        "onmozorientationchange",
        function (e) {
            event.emit(event.WINDOW_ONORIENTATION_CHANGE, e);
        },
        false
    );

    if (device.ScreenOrientation === true) {
        window.screen.orientation.onchange = function (e) {
            event.emit(event.WINDOW_ONORIENTATION_CHANGE, e);
        };
    }

    // Automatically update relative canvas position on scroll
    window.addEventListener("scroll", utils.function.throttle(
        function (e) {
            event.emit(event.WINDOW_ONSCROLL, e);
        }, 100
    ), false);

    // register to the channel
    event.on(event.WINDOW_ONRESIZE, onresize, this);
    event.on(event.WINDOW_ONORIENTATION_CHANGE, onresize, this);

    try {
        switch (settings.renderer) {
            case AUTO:
            case WEBGL:
                renderer = autoDetectRenderer(settings);
                break;
            default:
                renderer = new CanvasRenderer(settings);
                break;
        }
    } catch (e) {
        console(e.message);
        // me.video.init() returns false if failing at creating/using a HTML5 canvas
        return false;
    }

    // add our canvas (default to document.body if settings.parent is undefined)
    parent = device.getElement(settings.parent);
    parent.appendChild(renderer.getScreenCanvas());

    // trigger an initial resize();
    onresize();

    // add an observer to detect when the dom tree is modified
    if ("MutationObserver" in window) {
        // Create an observer instance linked to the callback function
        var observer = new MutationObserver(onresize.bind(this));

        // Start observing the target node for configured mutations
        observer.observe(parent, {
            attributes: false, childList: true, subtree: true
        });
    }

    if (settings.consoleHeader !== false) {
        var renderType = (renderer instanceof CanvasRenderer) ? "CANVAS" : "WebGL" + renderer.WebGLVersion;
        var audioType = device.hasWebAudio ? "Web Audio" : "HTML5 Audio";
        var gpu_renderer = (typeof renderer.GPURenderer === "string") ? " (" + renderer.GPURenderer + ")" : "";
        // output video information in the console
        console.log(
            renderType + " renderer" + gpu_renderer + " | " +
            audioType + " | " +
            "pixel ratio " + device.devicePixelRatio + " | " +
            (device.isMobile ? "mobile" : "desktop") + " | " +
            device.getScreenOrientation() + " | " +
            device.language
        );
        console.log( "resolution: " + "requested " + width + "x" + height +
            ", got " + renderer.getWidth() + "x" + renderer.getHeight()
        );
    }

    // notify the video has been initialized
    event.emit(event.VIDEO_INIT);

    return true;
};

/**
 * Create and return a new Canvas element
 * @function me.video.createCanvas
 * @param {number} width width
 * @param {number} height height
 * @param {boolean} [offscreen=false] will returns an OffscreenCanvas if supported
 * @returns {HTMLCanvasElement|OffscreenCanvas}
 */
export function createCanvas(width, height, offscreen = false) {
    var _canvas;

    if (width === 0 || height === 0) {
        throw new Error("width or height was zero, Canvas could not be initialized !");
    }

    if (device.OffscreenCanvas === true && offscreen === true) {
        _canvas = new OffscreenCanvas(0, 0);
        // stubbing style for compatibility,
        // as OffscreenCanvas is detached from the DOM
        if (typeof _canvas.style === "undefined") {
            _canvas.style = {};
        }
    } else {
        // "else" create a "standard" canvas
        _canvas = document.createElement("canvas");
    }
    _canvas.width = width;
    _canvas.height = height;

    return _canvas;
};

/**
 * return a reference to the parent DOM element holding the main canvas
 * @function me.video.getParent
 * @returns {HTMLElement}
 */
export function getParent() {
    return parent;
};

/**
 * scale the "displayed" canvas by the given scalar.
 * this will modify the size of canvas element directly.
 * Only use this if you are not using the automatic scaling feature.
 * @function me.video.scale
 * @see me.video.init
 * @param {number} x x scaling multiplier
 * @param {number} y y scaling multiplier
 */
export function scale(x, y) {
    var canvas = renderer.getScreenCanvas();
    var context = renderer.getScreenContext();
    var settings = renderer.settings;
    var pixelRatio = device.devicePixelRatio;

    var w = settings.zoomX = canvas.width * x * pixelRatio;
    var h = settings.zoomY = canvas.height * y * pixelRatio;

    // update the global scale variable
    scaleRatio.set(x * pixelRatio, y * pixelRatio);

    // adjust CSS style based on device pixel ratio
    canvas.style.width = (w / pixelRatio) + "px";
    canvas.style.height = (h / pixelRatio) + "px";

    // if anti-alias and blend mode were resetted (e.g. Canvas mode)
    renderer.setAntiAlias(context, settings.antiAlias);
    renderer.setBlendMode(settings.blendMode, context);

    // force repaint
    repaint();
};
