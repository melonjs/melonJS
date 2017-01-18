/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */
(function () {
    // a basic progress bar object
    var ProgressBar = me.Renderable.extend({
        /**
         * @ignore
         */
        init: function (v, w, h) {
            this._super(me.Renderable, "init", [v.x, v.y, w, h]);
            // flag to know if we need to refresh the display
            this.invalidate = false;

            // default progress bar height
            this.barHeight = 4;

            // current progress
            this.progress = 0;
        },

        /**
         * make sure the screen is refreshed every frame
         * @ignore
         */
        onProgressUpdate : function (progress) {
            this.progress = ~~(progress * this.width);
            this.invalidate = true;
        },

        /**
         * @ignore
         */
        update : function () {
            if (this.invalidate === true) {
                // clear the flag
                this.invalidate = false;
                // and return true
                return true;
            }
            // else return false
            return false;
        },

        /**
         * draw function
         * @ignore
         */
        draw : function (renderer) {
            // draw the progress bar
            renderer.setColor("black");
            renderer.fillRect(0, (this.height / 2) - (this.barHeight / 2), this.width, this.barHeight);

            renderer.setColor("#55aa00");
            renderer.fillRect(2, (this.height / 2) - (this.barHeight / 2), this.progress, this.barHeight);

            renderer.setColor("white");
        }
    });

    // the melonJS Logo
    var IconLogo = me.Renderable.extend({
        /**
         * @ignore
         */
        init : function (x, y) {
            this._super(me.Renderable, "init", [x, y, 100, 85]);

            this.iconCanvas = me.video.createCanvas(
                me.utils.nextPowerOfTwo(this.width),
                me.utils.nextPowerOfTwo(this.height),
            false);


            var context = me.video.renderer.getContext2d(this.iconCanvas);

            context.beginPath();
            context.moveTo(0.7, 48.9);
            context.bezierCurveTo(10.8, 68.9, 38.4, 75.8, 62.2, 64.5);
            context.bezierCurveTo(86.1, 53.1, 97.2, 27.7, 87.0, 7.7);
            context.lineTo(87.0, 7.7);
            context.bezierCurveTo(89.9, 15.4, 73.9, 30.2, 50.5, 41.4);
            context.bezierCurveTo(27.1, 52.5, 5.2, 55.8, 0.7, 48.9);
            context.lineTo(0.7, 48.9);
            context.lineTo(0.7, 48.9);
            context.closePath();
            context.fillStyle = "rgb(255, 255, 255)";
            context.fill();

            context.beginPath();
            context.moveTo(84.0, 7.0);
            context.bezierCurveTo(87.6, 14.7, 72.5, 30.2, 50.2, 41.6);
            context.bezierCurveTo(27.9, 53.0, 6.9, 55.9, 3.2, 48.2);
            context.bezierCurveTo(-0.5, 40.4, 14.6, 24.9, 36.9, 13.5);
            context.bezierCurveTo(59.2, 2.2, 80.3, -0.8, 84.0, 7.0);
            context.lineTo(84.0, 7.0);
            context.closePath();
            context.lineWidth = 5.3;
            context.strokeStyle = "rgb(255, 255, 255)";
            context.lineJoin = "miter";
            context.miterLimit = 4.0;
            context.stroke();
        },
        /**
         * @ignore
         */
        draw : function (renderer) {
            renderer.drawImage(this.iconCanvas, this.pos.x, this.pos.y);
        }
    });

    // the melonJS Text Logo
    var TextLogo = me.Renderable.extend({
        /**
         * @ignore
         */
        init : function (w, h) {
            this._super(me.Renderable, "init", [0, 0, w, h]);

            // offscreen cache canvas
            this.fontCanvas = me.video.createCanvas(128, 32);
            this.drawFont(me.video.renderer.getContext2d(this.fontCanvas));
        },

        drawFont : function (context) {
            var logo1 = new me.Font("century gothic", 32, "white", "middle");
            var logo2 = new me.Font("century gothic", 32, "#55aa00", "middle");
            var logo1_width = 0;

            // configure the font
            logo2.bold();
            logo1.textBaseline = logo2.textBaseline = "top";

            // measure the logo size (using standard 2d context)
            context.font = logo1.font;
            context.fillStyle = logo1.fillStyle.toRGBA();
            context.textAlign = logo1.textAlign;
            context.textBaseline = logo1.textBaseline;
            logo1_width = context.measureText("melon").width;

            // calculate the final rendering position
            this.pos.x = Math.round((this.width - logo1_width - context.measureText("JS").width) / 2);
            this.pos.y = this.height / 2 + 16;

            // use the private _drawFont method to directly draw on the canvas context
            logo1._drawFont(context, "melon", 0, 0);
            logo2._drawFont(context, "JS", logo1_width, 0);
        },

        /**
         * @ignore
         */
        draw : function (renderer) {
            renderer.drawImage(this.fontCanvas, this.pos.x, this.pos.y);
        }

    });

    /**
     * a default loading screen
     * @memberOf me
     * @ignore
     * @constructor
     */
    me.DefaultLoadingScreen = me.ScreenObject.extend({
        /**
         * call when the loader is resetted
         * @ignore
         */
        onResetEvent : function () {
            // background color
            me.game.world.addChild(new me.ColorLayer("background", "#202020", 0), 0);

            // progress bar
            var progressBar = new ProgressBar(
                new me.Vector2d(),
                me.video.renderer.getWidth(),
                me.video.renderer.getHeight()
            );

            this.loaderHdlr = me.event.subscribe(
                me.event.LOADER_PROGRESS,
                progressBar.onProgressUpdate.bind(progressBar)
            );

            this.resizeHdlr = me.event.subscribe(
                me.event.VIEWPORT_ONRESIZE,
                progressBar.resize.bind(progressBar)
            );

            me.game.world.addChild(progressBar, 1);
            // melonJS text & logo
            var icon = new IconLogo(
                (me.video.renderer.getWidth() - 100) / 2,
                (me.video.renderer.getHeight() / 2) - (progressBar.barHeight / 2) - 90
            );
            me.game.world.addChild(icon, 1);
            me.game.world.addChild(new TextLogo(me.video.renderer.getWidth(), me.video.renderer.getHeight()), 1);
        },

        /**
         * destroy object at end of loading
         * @ignore
         */
        onDestroyEvent : function () {
            // cancel the callback
            me.event.unsubscribe(this.loaderHdlr);
            me.event.unsubscribe(this.resizeHdlr);
            this.loaderHdlr = this.resizeHdlr = null;
        }
    });
})();
