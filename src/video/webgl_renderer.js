(function () {

    me.WebGLRenderer = (function () {
        var api = {},
        canvas = null,
        WebGLContext = null,
        gl = null;

        function hexToR(h) {
            return parseInt((cutHex(h)).substring(0, 2), 16);
        }

        function hexToG(h) {
            return parseInt((cutHex(h)).substring(2, 4), 16);
        }

        function hexToB(h) {
            return parseInt((cutHex(h)).substring(4, 6), 16);
        }

        function cutHex(h) {
            return (h.charAt(0) === "#") ? h.substring(1, 7) : h;
        }

        api.init = function (width, height, c) {
            canvas = c;
            WebGLContext = require("kami").WebGLContext;
            this.context = new WebGLContext(width, height, canvas);
            gl = this.context.gl;
        };

        api.clearSurface = function (col) {
            var R = hexToR(col);
            var G = hexToG(col);
            var B = hexToB(col);

            gl.clearColor(R / 255.0, G / 255.0, B / 255.0, 1.0);
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