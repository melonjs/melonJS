(function () {

    me.WebGLRenderer = (function () {
        var api = {},
        canvas = null,
        WebGLContext = null,
        gl = null,
        color = null;

        api.init = function (width, height, c) {
            canvas = c;
            WebGLContext = require("kami").WebGLContext;
            this.context = new WebGLContext(width, height, canvas);
            gl = this.context.gl;
            color = new me.Color();

            return this;
        };

        api.clearSurface = function (col) {
            if (col.match(/^\#/)) {
                color.parseHex(col);
            }
            else if (col.match(/^rgb/)) {
                color.parseRGB(col);
            }
            else {
                color.parseCSS(col);
            }

            gl.clearColor(color.r / 255.0, color.g / 255.0, color.b / 255.0, 1.0);
        };

        api.resize = function (scaleX, scaleY) {
            var gameWidthZoom = canvas.width * scaleX;
            var gameHeightZoom = canvas.height * scaleY;
            canvas.width = gameWidthZoom;
            canvas.height = gameHeightZoom;
            gl.viewport(0, 0, canvas.width, canvas.height);
            // adjust CSS style for High-DPI devices
            if (me.device.getPixelRatio() > 1) {
                canvas.style.width = (canvas.width / me.device.getPixelRatio()) + "px";
                canvas.style.height = (canvas.height / me.device.getPixelRatio()) + "px";
            }
        };

        return api;
    })();

})();