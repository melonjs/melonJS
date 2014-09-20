/*
 * MelonJS Game Engine
 * @copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */
(function () {
    // a basic progress bar object
    var ProgressBar = me.Renderable.extend({

        init: function (v, w, h) {
            this._super(me.Renderable, "init", [v.x, v.y, w, h]);
            // flag to know if we need to refresh the display
            this.invalidate = false;

            // default progress bar height
            this.barHeight = 4;

            // current progress
            this.progress = 0;
        },

        // make sure the screen is refreshed every frame
        onProgressUpdate : function (progress) {
            this.progress = Math.floor(progress * this.width);
            this.invalidate = true;
        },

        // make sure the screen is refreshed every frame
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

         // draw function
        draw : function (renderer) {
            // draw the progress bar
            renderer.setColor("#000000");
            renderer.fillRect(0, (this.height / 2) - (this.barHeight / 2), this.width, this.barHeight);
            renderer.setColor("#55aa00");
            renderer.fillRect(2, (this.height / 2) - (this.barHeight / 2), this.progress, this.barHeight);
        }
    });

    // the melonJS Logo
    var IconLogo = me.Renderable.extend({
        init : function (iconCanvas, x, y) {
            this._super(me.Renderable, "init", [x, y, 100, 85]);

            this.iconCanvas = iconCanvas;

            var context = me.CanvasRenderer.getContext2d(this.iconCanvas);
            
            context.translate(this.pos.x, this.pos.y);
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

        draw : function (renderer) {
            renderer.drawImage(this.iconCanvas, 0, 0);
        }
    });

    // the melonJS Text Logo
    var TextLogo = me.Renderable.extend({
        // constructor
        init : function (w, h) {
            this._super(me.Renderable, "init", [0, 0, w, h]);
            this.logo1 = new me.Font("century gothic", 32, "white", "middle");
            this.logo2 = new me.Font("century gothic", 32, "#55aa00", "middle");
            this.logo2.bold();
            this.logo1.textBaseline = this.logo2.textBaseline = "alphabetic";
        },

        draw : function (renderer) {
            // measure the logo size
            var logo1_width = renderer.measureText(this.logo1, "melon").width;
            var xpos = (this.width - logo1_width - renderer.measureText(this.logo2, "JS").width) / 2;
            var ypos = (this.height / 2) + (renderer.measureText(this.logo2, "melon").height);

            // draw the melonJS string
            renderer.drawFont(this.logo1, "melon", xpos, ypos);
            renderer.drawFont(this.logo2, "JS", xpos, ypos);
        }

    });

    /**
     * a default loading screen
     * @memberOf me
     * @ignore
     * @constructor
     */
    me.DefaultLoadingScreen = me.ScreenObject.extend({
        // call when the loader is resetted
        onResetEvent : function () {
            me.game.reset();

            // background color
            me.game.world.addChild(new me.ColorLayer("background", "#202020", 0));

            // progress bar
            var progressBar = new ProgressBar(
                new me.Vector2d(),
                me.video.renderer.getWidth(),
                me.video.renderer.getHeight()
            );
            this.handle = me.event.subscribe(
                me.event.LOADER_PROGRESS,
                progressBar.onProgressUpdate.bind(progressBar)
            );
            me.game.world.addChild(progressBar, 1);
            this.iconCanvas = me.video.createCanvas(me.game.viewport.width, me.game.viewport.height, false);
            this.iconCanvas.style.display = "none";
            document.body.appendChild(this.iconCanvas);
            // melonJS text & logo
            var icon = new IconLogo(
                this.iconCanvas,
                (me.video.renderer.getWidth() - 100) / 2,
                (me.video.renderer.getHeight() / 2) - (progressBar.barHeight / 2) - 90
            );
            me.game.world.addChild(icon, 1);
            me.game.world.addChild(new TextLogo(me.video.renderer.getWidth(), me.video.renderer.getHeight()), 1);
        },

        // destroy object at end of loading
        onDestroyEvent : function () {
            // cancel the callback
            if (this.handle)  {
                me.event.unsubscribe(this.handle);
                this.handle = null;
            }

            document.body.removeChild(this.iconCanvas);
        }
    });
})();
