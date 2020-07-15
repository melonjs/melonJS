/* eslint-disable no-global-assign, no-native-reassign */

(function () {

    if (typeof console === "undefined") {
        /**
         * Dummy console.log to avoid crash
         * in case the browser does not support it
         * @ignore
         */
        console = {
            log : function () {},
            info : function () {},
            error : function () {
                alert(Array.prototype.slice.call(arguments).join(", "));
            }
        };
    }

    // based on the requestAnimationFrame polyfill by Erik Möller
    (function () {
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
                var timeToCall = Math.max(0, (1000 / me.timer.maxfps) - (currTime - lastTime));
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

    }());

})();
/* eslint-enable no-global-assign, no-native-reassign */
