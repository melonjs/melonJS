import { world, viewport } from "./../game.js";
import { createCanvas, renderer } from "./../video/video.js";
import * as event from "./../system/event.js";
import {nextPowerOfTwo} from "./../math/math.js";
import pool from "./../system/pooling.js";
import Renderable from "./../renderable/renderable.js";
import ColorLayer from "./../renderable/colorlayer.js";
import Stage from "./../state/stage.js";


// a basic progress bar object
class ProgressBar extends Renderable {
    /**
     * @ignore
     */
    constructor(x, y, w, h) {

        super(x, y, w, h);

        var self = this;

        this.barHeight = h;

        this.anchorPoint.set(0, 0);

        this.loaderHdlr = event.subscribe(
            event.LOADER_PROGRESS,
            self.onProgressUpdate.bind(self)
        );

        this.resizeHdlr = event.subscribe(
            event.VIEWPORT_ONRESIZE,
            self.resize.bind(self)
        );

        this.anchorPoint.set(0, 0);

        // store current progress
        this.progress = 0;
    }

    /**
     * make sure the screen is refreshed every frame
     * @ignore
     */
    onProgressUpdate(progress) {
        this.progress = ~~(progress * this.width);
        this.isDirty = true;
    }

    /**
     * draw function
     * @ignore
     */
    draw (renderer) {
        // draw the progress bar
        renderer.setColor("black");
        renderer.fillRect(this.pos.x, viewport.centerY, renderer.getWidth(), this.barHeight / 2);

        renderer.setColor("#55aa00");
        renderer.fillRect(this.pos.x, viewport.centerY, this.progress, this.barHeight / 2);
    }

    /**
     * Called by engine before deleting the object
     * @ignore
     */
    onDestroyEvent() {
        // cancel the callback
        event.unsubscribe(this.loaderHdlr);
        event.unsubscribe(this.resizeHdlr);
        this.loaderHdlr = this.resizeHdlr = null;
    }

};

// the melonJS Logo
class IconLogo extends Renderable {
    /**
     * @ignore
     */
    constructor(x, y) {
        super(x, y, 100, 85);

        this.iconCanvas = createCanvas(
            nextPowerOfTwo(this.width),
            nextPowerOfTwo(this.height),
        false);

        var context = renderer.getContext2d(this.iconCanvas);

        context.beginPath();
        context.moveTo(0.7, 48.9);
        context.bezierCurveTo(10.8, 68.9, 38.4, 75.8, 62.2, 64.5);
        context.bezierCurveTo(86.1, 53.1, 97.2, 27.7, 87.0, 7.7);
        context.lineTo(87.0, 7.7);
        context.bezierCurveTo(89.9, 15.4, 73.9, 30.2, 50.5, 41.4);
        context.bezierCurveTo(27.1, 52.5, 5.2, 55.8, 0.7, 48.9);
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

        this.anchorPoint.set(0.5, 0.5);
    }

    /**
     * @ignore
     */
    draw(renderer) {
        renderer.drawImage(this.iconCanvas, renderer.getWidth() / 2, this.pos.y);
    }
};

// the melonJS Text Logo
class TextLogo extends Renderable {
    /**
     * @ignore
     */
    constructor(w, h) {
        super(0, 0, w, h);

        this.textWidth = 0;

        // offscreen cache canvas
        this.fontCanvas = createCanvas(256, 64, true);
        this.drawFont(renderer.getContext2d(this.fontCanvas));

        this.anchorPoint.set(0, 0.5);
    }

    drawFont(context) {
        var logo1 = pool.pull("Text", 0, 0, {
            font: "century gothic",
            size: 32,
            fillStyle: "white",
            textAlign: "middle",
            textBaseline : "top",
            text: "melon"
        });
        var logo2 = pool.pull("Text", 0, 0, {
            font: "century gothic",
            size: 32,
            fillStyle: "#55aa00",
            textAlign: "middle",
            textBaseline : "top",
            bold: true,
            text: "JS"
        });


        // compute both logo respective size
        var logo1_width = logo1.measureText(context).width;
        var logo2_width = logo2.measureText(context).width;

        this.textWidth = logo1_width + logo2_width;

        // calculate the final rendering position
        this.pos.x = Math.round(this.width - this.textWidth / 2);
        this.pos.y = Math.round(this.height + 16);

        // use the private _drawFont method to directly draw on the canvas context
        logo1._drawFont(context, ["melon"], 0, 0);
        logo2._drawFont(context, ["JS"], logo1_width, 0);

        // put them back into the object pool
        pool.push(logo1);
        pool.push(logo2);
    }

    /**
     * @ignore
     */
    draw(renderer) {
        renderer.drawImage(this.fontCanvas, Math.round((renderer.getWidth() - this.textWidth) / 2), this.pos.y);
    }

};

/**
 * a default loading screen
 * @memberOf me
 * @ignore
 * @constructor
 */
var defaultLoadingScreen = new Stage({
    /**
     * call when the loader is resetted
     * @ignore
     */
    onResetEvent : function () {
        var barHeight = 8;

        // clear the background
        world.addChild(new ColorLayer("background", "#202020"), 0);

        // progress bar
        world.addChild(new ProgressBar(
            0,
            renderer.getHeight() / 2,
            renderer.getWidth(),
            barHeight
        ), 1);

        // melonJS logo
        world.addChild(new IconLogo(
            renderer.getWidth() / 2,
            (renderer.getHeight() / 2) - (barHeight * 2) - 35

        ), 2);

        // melonJS text
        world.addChild(new TextLogo(
            renderer.getWidth(),
            renderer.getHeight()
        ), 2);
    }
});

export default defaultLoadingScreen;
