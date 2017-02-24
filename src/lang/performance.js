/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

// define window.performance if undefined
if (typeof window.performance === "undefined") {
    window.performance = {};
}

if (typeof Date.now === "undefined") {
    /**
     * provide a replacement for browser not
     * supporting Date.now (JS 1.5)
     * @ignore
     */
    Date.now = function () {
        return new Date().getTime();
    };
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
