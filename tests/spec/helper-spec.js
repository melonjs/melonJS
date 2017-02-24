/**
 * A collection of helper functions which can be used in your tests
 */
(function () {
    "use strict";
    beforeEach(function () {
        jasmine.addMatchers({
            toBeInstanceOf : function () {
                return {
                    compare : function(actual, expected) {
                        return {
                            pass: actual instanceof expected
                        };
                    }
                };
            }
        });
    });

    // Cross-browser helper for triggering events on elements
    /**
     * mouse event parameters:
     * type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY
     *
     * example:
     * dispatchMouseEvent(canvas, 'mousedown', true, true, win, 1, 0, 0, 100,
     *     100, null, null, null, null, 0, null);
     *
     * note:
     * to dispatch touch events you can use
     * initUIEvent('touchstart', true, true);
     * the position properties are read only so can't be set
     */
    window.dispatchMouseEvent = function(target) {
        var e = document.createEvent("MouseEvents");
        e.initMouseEvent.apply(e, Array.prototype.slice.call(arguments, 1));
        target.dispatchEvent(e);
    };
}());
