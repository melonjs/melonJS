/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org
 */

// define window.performance if undefined
if (typeof window.performance === "undefined") {
    window.performance = {};
}

if (!window.performance.now) {
    var timeOffset = Date.now();

    if (window.performance.timing &&
        window.performance.timing.navigationStart) {
        timeOffset = window.performance.timing.navigationStart;
    }
    /**
     * provide a polyfill for window.performance now
     * to provide consistent time information across browser
     * (always return the elapsed time since the browser started)
     * @ignore
     */
    window.performance.now = function () {
        return Date.now() - timeOffset;
    };
}
