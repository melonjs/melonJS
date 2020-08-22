import timer from "./../system/timer.js";

var lastTime = 0;
var vendors = ["ms", "moz", "webkit", "o"];
var x;

// standardized functions
// https://developer.mozilla.org/fr/docs/Web/API/Window/requestAnimationFrame
var requestAnimationFrame = window.requestAnimationFrame;
var cancelAnimationFrame = window.cancelAnimationFrame;

// get prefixed rAF and cAF is standard one not supported
for (x = 0; x < vendors.length && !requestAnimationFrame; ++x) {
    requestAnimationFrame = window[vendors[x] + "RequestAnimationFrame"];
}
for (x = 0; x < vendors.length && !cancelAnimationFrame; ++x) {
    cancelAnimationFrame = window[vendors[x] + "CancelAnimationFrame"] ||
                           window[vendors[x] + "CancelRequestAnimationFrame"];
}

if (!requestAnimationFrame || !cancelAnimationFrame) {
    requestAnimationFrame = function (callback) {
        var currTime = window.performance.now();
        var timeToCall = Math.max(0, (1000 / timer.maxfps) - (currTime - lastTime));
        var id = window.setTimeout(function () {
            callback(currTime + timeToCall);
        }, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
    };

    cancelAnimationFrame = function (id) {
        window.clearTimeout(id);
    };

    // put back in global namespace
    window.requestAnimationFrame = requestAnimationFrame;
    window.cancelAnimationFrame = cancelAnimationFrame;
}
