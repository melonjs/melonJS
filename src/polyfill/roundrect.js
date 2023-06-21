/*
 * based on https://www.npmjs.com/package/canvas-roundrect-polyfill
 * @version 0.0.1
 */
(() => {

    "use strict";

    /** @ignore */
    function roundRect(x, y, w, h, radii) {

        if (!([x, y, w, h].every((input) => Number.isFinite(input)))) {

            return;

        }

        radii = parseRadiiArgument(radii);

        let upperLeft, upperRight, lowerRight, lowerLeft;

        if (radii.length === 4) {

            upperLeft = toCornerPoint(radii[0]);
            upperRight = toCornerPoint(radii[1]);
            lowerRight = toCornerPoint(radii[2]);
            lowerLeft = toCornerPoint(radii[3]);

        } else if (radii.length === 3) {

            upperLeft = toCornerPoint(radii[0]);
            upperRight = toCornerPoint(radii[1]);
            lowerLeft = toCornerPoint(radii[1]);
            lowerRight = toCornerPoint(radii[2]);

        } else if (radii.length === 2) {

            upperLeft = toCornerPoint(radii[0]);
            lowerRight = toCornerPoint(radii[0]);
            upperRight = toCornerPoint(radii[1]);
            lowerLeft = toCornerPoint(radii[1]);

        } else if (radii.length === 1) {

            upperLeft = toCornerPoint(radii[0]);
            upperRight = toCornerPoint(radii[0]);
            lowerRight = toCornerPoint(radii[0]);
            lowerLeft = toCornerPoint(radii[0]);

        } else {

            throw new Error(radii.length + " is not a valid size for radii sequence.");

        }

        const corners = [upperLeft, upperRight, lowerRight, lowerLeft];
        const negativeCorner = corners.find(({x, y}) => x < 0 || y < 0);
        //const negativeValue = negativeCorner?.x < 0 ? negativeCorner.x : negativeCorner?.y

        if (corners.some(({x, y}) => !Number.isFinite(x) || !Number.isFinite(y))) {

            return;

        }

        if (negativeCorner) {

            throw new Error("Radius value " + negativeCorner + " is negative.");

        }

        fixOverlappingCorners(corners);

        if (w < 0 && h < 0) {

            this.moveTo(x - upperLeft.x, y);
            this.ellipse(x + w + upperRight.x, y - upperRight.y, upperRight.x, upperRight.y, 0, -Math.PI * 1.5, -Math.PI);
            this.ellipse(x + w + lowerRight.x, y + h + lowerRight.y, lowerRight.x, lowerRight.y, 0, -Math.PI, -Math.PI / 2);
            this.ellipse(x - lowerLeft.x, y + h + lowerLeft.y, lowerLeft.x, lowerLeft.y, 0, -Math.PI / 2, 0);
            this.ellipse(x - upperLeft.x, y - upperLeft.y, upperLeft.x, upperLeft.y, 0, 0, -Math.PI / 2);

        } else if (w < 0) {

            this.moveTo(x - upperLeft.x, y);
            this.ellipse(x + w + upperRight.x, y + upperRight.y, upperRight.x, upperRight.y, 0, -Math.PI / 2, -Math.PI, 1);
            this.ellipse(x + w + lowerRight.x, y + h - lowerRight.y, lowerRight.x, lowerRight.y, 0, -Math.PI, -Math.PI * 1.5, 1);
            this.ellipse(x - lowerLeft.x, y + h - lowerLeft.y, lowerLeft.x, lowerLeft.y, 0, Math.PI / 2, 0, 1);
            this.ellipse(x - upperLeft.x, y + upperLeft.y, upperLeft.x, upperLeft.y, 0, 0, -Math.PI / 2, 1);

        } else if (h < 0) {

            this.moveTo(x + upperLeft.x, y);
            this.ellipse(x + w - upperRight.x, y - upperRight.y, upperRight.x, upperRight.y, 0, Math.PI / 2, 0, 1);
            this.ellipse(x + w - lowerRight.x, y + h + lowerRight.y, lowerRight.x, lowerRight.y, 0, 0, -Math.PI / 2, 1);
            this.ellipse(x + lowerLeft.x, y + h + lowerLeft.y, lowerLeft.x, lowerLeft.y, 0, -Math.PI / 2, -Math.PI, 1);
            this.ellipse(x + upperLeft.x, y - upperLeft.y, upperLeft.x, upperLeft.y, 0, -Math.PI, -Math.PI * 1.5, 1);

        } else {

            this.moveTo(x + upperLeft.x, y);
            this.ellipse(x + w - upperRight.x, y + upperRight.y, upperRight.x, upperRight.y, 0, -Math.PI / 2, 0);
            this.ellipse(x + w - lowerRight.x, y + h - lowerRight.y, lowerRight.x, lowerRight.y, 0, 0, Math.PI / 2);
            this.ellipse(x + lowerLeft.x, y + h - lowerLeft.y, lowerLeft.x, lowerLeft.y, 0, Math.PI / 2, Math.PI);
            this.ellipse(x + upperLeft.x, y + upperLeft.y, upperLeft.x, upperLeft.y, 0, Math.PI, Math.PI * 1.5);

        }

        this.closePath();
        this.moveTo(x, y);

        /** @ignore */
        function toDOMPointInit(value) {

            const {x, y, z, w} = value;
            return {x, y, z, w};

        }

        /** @ignore */
        function parseRadiiArgument(value) {

            // https://webidl.spec.whatwg.org/#es-union
            // with 'optional (unrestricted double or DOMPointInit
            //   or sequence<(unrestricted double or DOMPointInit)>) radii = 0'
            const type = typeof value;

            if (type === "undefined" || value === null) {

                return [0];

            }
            if (type === "function") {

                return [NaN];

            }
            if (type === "object") {

                if (typeof value[Symbol.iterator] === "function") {

                    return [...value].map((elem) => {
                        // https://webidl.spec.whatwg.org/#es-union
                        // with '(unrestricted double or DOMPointInit)'
                        const elemType = typeof elem;
                        if (elemType === "undefined" || elem === null) {
                            return 0;
                        }
                        if (elemType === "function") {
                            return NaN;
                        }
                        if (elemType === "object") {
                            return toDOMPointInit(elem);
                        }
                        return toUnrestrictedNumber(elem);
                    });

                }

                return [toDOMPointInit(value)];

            }

            return [toUnrestrictedNumber(value)];

        }

        /** @ignore */
        function toUnrestrictedNumber(value) {

            return +value;

        }

        /** @ignore */
        function toCornerPoint(value) {

            const asNumber = toUnrestrictedNumber(value);
            if (Number.isFinite(asNumber)) {

                return {
                    x: asNumber,
                    y: asNumber
                };

            }
            if (Object(value) === value) {

                return {
                    x: toUnrestrictedNumber(value.x || 0),
                    y: toUnrestrictedNumber(value.y || 0)
                };

            }

            return {
                x: NaN,
                y: NaN
            };

        }

        /** @ignore */
        function fixOverlappingCorners(corners) {
            const [upperLeft, upperRight, lowerRight, lowerLeft] = corners;
            const factors = [
                Math.abs(w) / (upperLeft.x + upperRight.x),
                Math.abs(h) / (upperRight.y + lowerRight.y),
                Math.abs(w) / (lowerRight.x + lowerLeft.x),
                Math.abs(h) / (upperLeft.y + lowerLeft.y)
            ];
            const minFactor = Math.min(...factors);
            if (minFactor <= 1) {
                corners.forEach((radii) => {
                    radii.x *= minFactor;
                    radii.y *= minFactor;
                });
            }
        }
    }

    if (globalThis.CanvasRenderingContext2D) {
        if (typeof globalThis.Path2D.prototype.roundRect === "undefined") {
            globalThis.Path2D.prototype.roundRect = roundRect;
        }
    }
    if (globalThis.CanvasRenderingContext2D) {
        if (typeof globalThis.CanvasRenderingContext2D.prototype.roundRect === "undefined") {
            globalThis.CanvasRenderingContext2D.prototype.roundRect = roundRect;
        }
    }
    if (globalThis.OffscreenCanvasRenderingContext2D) {
        if (typeof globalThis.OffscreenCanvasRenderingContext2D.prototype.roundRect === "undefined") {
            globalThis.OffscreenCanvasRenderingContext2D.prototype.roundRect = roundRect;
        }
    }

})();
