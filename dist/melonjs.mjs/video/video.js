/*!
 * melonJS Game Engine - v14.1.3
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
import WebGLRenderer from './webgl/webgl_renderer.js';
import CanvasRenderer from './canvas/canvas_renderer.js';
import utils from '../utils/utils.js';
import { emit, WINDOW_ONRESIZE, WINDOW_ONORIENTATION_CHANGE, WINDOW_ONSCROLL, on, VIDEO_INIT } from '../system/event.js';
import { offscreenCanvas, screenOrientation, getElement, platform, enableSwipe, devicePixelRatio, getScreenOrientation, language, isWebGLSupported, hasWebAudio } from '../system/device.js';
import { initialized, version } from '../index.js';
import game from '../game.js';
import { onresize } from './utils/resize.js';

/**
 * @namespace video
 */

// default video settings
var settings = {
    parent : undefined,
    renderer : 2, // AUTO
    autoScale : false,
    scale : 1.0,
    scaleMethod : "manual",
    transparent : false,
    premultipliedAlpha: true,
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
        if (isWebGLSupported(options)) {
            return new WebGLRenderer(options);
        }
    } catch (e) {
        console.log("Error creating WebGL renderer :" + e.message);
    }
    return new CanvasRenderer(options);
}


/**
 * Select the HTML5 Canvas renderer
 * @memberof video
 * @constant
 */
const CANVAS = 0;

/**
 * Select the WebGL renderer
 * @memberof video
 * @constant
 */
const WEBGL = 1;

/**
 * Auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
 * @memberof video
 * @constant
 */
const AUTO = 2;

 /**
  * A reference to the active Canvas or WebGL active renderer renderer
  * @memberof video
  * @type {CanvasRenderer|WebGLRenderer}
  */
let renderer = null;

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
 * @memberof video
 * @param {number} width - The width of the canvas viewport
 * @param {number} height - The height of the canvas viewport
 * @param {object} [options] - The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
 * @param {string|HTMLElement} [options.parent=document.body] - the DOM parent element to hold the canvas in the HTML file
 * @param {number} [options.renderer=video.AUTO] - renderer to use (me.video.CANVAS, me.video.WEBGL, me.video.AUTO)
 * @param {number|string} [options.scale=1.0] - enable scaling of the canvas ('auto' for automatic scaling)
 * @param {string} [options.scaleMethod="fit"] - screen scaling modes ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch')
 * @param {boolean} [options.preferWebGL1=false] - if true the renderer will only use WebGL 1
 * @param {string} [options.powerPreference="default"] - a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @param {boolean} [options.transparent=false] - whether to allow transparent pixels in the front buffer (screen).
 * @param {boolean} [options.antiAlias=false] - whether to enable or not video scaling interpolation
 * @param {boolean} [options.consoleHeader=true] - whether to display melonJS version and basic device information in the console
 * @returns {boolean} false if initialization failed (canvas not supported)
 * @example
 * // init the video with a 640x480 canvas
 * me.video.init(640, 480, {
 *     parent : "screen",
 *     renderer : me.video.AUTO,
 *     scale : "auto",
 *     scaleMethod : "fit"
 * });
 */
function init(width, height, options) {

    // ensure melonjs has been properly initialized
    if (!initialized) {
        throw new Error("me.video.init() called before engine initialization.");
    }

    // revert to default options if not defined
    settings = Object.assign(settings, options || {});

    // sanitize potential given parameters
    settings.width = width;
    settings.height = height;
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

    // override renderer settings if &webgl or &canvas is defined in the URL
    var uriFragment = utils.getUriFragment();
    if (uriFragment.webgl === true || uriFragment.webgl1 === true || uriFragment.webgl2 === true) {
        settings.renderer = WEBGL;
        if (uriFragment.webgl1 === true) {
            settings.preferWebGL1 = true;
        }
    } else if (uriFragment.canvas === true) {
        settings.renderer = CANVAS;
    }

    // normalize scale
    settings.scale = (settings.autoScale) ? 1.0 : (+settings.scale || 1.0);

    // default scaled size value
    settings.zoomX = width * settings.scale;
    settings.zoomY = height * settings.scale;

    //add a channel for the onresize/onorientationchange event
    globalThis.addEventListener(
        "resize",
        utils.function.throttle(
            (e) => {
                emit(WINDOW_ONRESIZE, e);
            }, 100
        ), false
    );

    // Screen Orientation API
    globalThis.addEventListener(
        "orientationchange",
        (e) => {
            emit(WINDOW_ONORIENTATION_CHANGE, e);
        },
        false
    );
    // pre-fixed implementation on mozzila
    globalThis.addEventListener(
        "onmozorientationchange",
        (e) => {
            emit(WINDOW_ONORIENTATION_CHANGE, e);
        },
        false
    );

    if (screenOrientation === true) {
        globalThis.screen.orientation.onchange = function (e) {
            emit(WINDOW_ONORIENTATION_CHANGE, e);
        };
    }

    // Automatically update relative canvas position on scroll
    globalThis.addEventListener("scroll", utils.function.throttle((e) => {
        emit(WINDOW_ONSCROLL, e);
    }, 100), false);

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

    // register to the channel
    on(WINDOW_ONRESIZE, () => { onresize(renderer); }, this);
    on(WINDOW_ONORIENTATION_CHANGE, () => { onresize(renderer); }, this);

    // add our canvas (default to document.body if settings.parent is undefined)
    game.parentElement = getElement(typeof settings.parent !== "undefined" ? settings.parent : document.body);
    game.parentElement.appendChild(renderer.getCanvas());

    // Mobile browser hacks
    if (platform.isMobile) {
        // Prevent the webview from moving on a swipe
        enableSwipe(false);
    }

    // trigger an initial resize();
    onresize(renderer);

    // add an observer to detect when the dom tree is modified
    if ("MutationObserver" in globalThis) {
        // Create an observer instance linked to the callback function
        var observer = new MutationObserver(onresize.bind(this, renderer));

        // Start observing the target node for configured mutations
        observer.observe(game.parentElement, {
            attributes: false, childList: true, subtree: true
        });
    }

    if (settings.consoleHeader !== false) {
        var renderType = (renderer instanceof CanvasRenderer) ? "CANVAS" : "WebGL" + renderer.WebGLVersion;
        var audioType = hasWebAudio ? "Web Audio" : "HTML5 Audio";
        var gpu_renderer = (typeof renderer.GPURenderer === "string") ? " (" + renderer.GPURenderer + ")" : "";
        // output video information in the console
        console.log(
            renderType + " renderer" + gpu_renderer + " | " +
            audioType + " | " +
            "pixel ratio " + devicePixelRatio + " | " +
            (platform.nodeJS ? "node.js" : platform.isMobile ? "mobile" : "desktop") + " | " +
            getScreenOrientation() + " | " +
            language
        );
        console.log( "resolution: " + "requested " + width + "x" + height +
            ", got " + renderer.getWidth() + "x" + renderer.getHeight()
        );
    }

    // notify the video has been initialized
    emit(VIDEO_INIT);

    return true;
}

/**
 * Create and return a new Canvas element
 * @memberof video
 * @param {number} width - width
 * @param {number} height - height
 * @param {boolean} [returnOffscreenCanvas=false] - will return an OffscreenCanvas if supported
 * @returns {HTMLCanvasElement|OffscreenCanvas}
 */
function createCanvas(width, height, returnOffscreenCanvas = false) {
    var _canvas;

    if (width === 0 || height === 0) {
        throw new Error("width or height was zero, Canvas could not be initialized !");
    }

    if (offscreenCanvas === true && returnOffscreenCanvas === true) {
        _canvas = new globalThis.OffscreenCanvas(0, 0);
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
}

/**
 * return a reference to the parent DOM element holding the main canvas
 * @returns {HTMLElement}
 */
function getParent() {
    return game.getParentElement();
}

export { AUTO, CANVAS, WEBGL, createCanvas, getParent, init, renderer };
