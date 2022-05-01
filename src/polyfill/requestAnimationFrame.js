import timer from "./../system/timer.js";

var lastTime = 0;
var vendors = ["ms", "moz", "webkit", "o"];
var x;

// standardized functions
// https://developer.mozilla.org/fr/docs/Web/API/Window/requestAnimationFrame
var requestAnimationFrame = globalThis.requestAnimationFrame;
var cancelAnimationFrame = globalThis.cancelAnimationFrame;

// get prefixed rAF and cAF is standard one not supported
for (x = 0; x < vendors.length && !requestAnimationFrame; ++x) {
    requestAnimationFrame = globalThis[vendors[x] + "RequestAnimationFrame"];
}
for (x = 0; x < vendors.length && !cancelAnimationFrame; ++x) {
    cancelAnimationFrame = globalThis[vendors[x] + "CancelAnimationFrame"] ||
                           globalThis[vendors[x] + "CancelRequestAnimationFrame"];
}

if (!requestAnimationFrame || !cancelAnimationFrame) {
    requestAnimationFrame = function (callback) {
        var currTime = globalThis.performance.now();
        var timeToCall = Math.max(0, (1000 / timer.maxfps) - (currTime - lastTime));
        var id = globalThis.setTimeout(function () {
            callback(currTime + timeToCall);
        }, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
    };

    cancelAnimationFrame = function (id) {
        globalThis.clearTimeout(id);
    };

    // put back in global namespace
    globalThis.requestAnimationFrame = requestAnimationFrame;
    globalThis.cancelAnimationFrame = cancelAnimationFrame;
}
