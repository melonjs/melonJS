import { world, viewport } from "./../game.js";
import { renderer } from "./../video/video.js";
import * as event from "./../system/event.js";
import Renderable from "./../renderable/renderable.js";
import Sprite from "./../renderable/sprite.js";
import Stage from "./../state/stage.js";
import melonjs_logo from "./melonjs_logo.png";


// a basic progress bar object
class ProgressBar extends Renderable {
    /**
     * @ignore
     */
    constructor(x, y, w, h) {
        super(x, y, w, h);

        this.barHeight = h;
        this.anchorPoint.set(0, 0);

        event.on(event.LOADER_PROGRESS, this.onProgressUpdate, this);
        event.on(event.VIEWPORT_ONRESIZE, this.resize, this);

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
        event.off(event.LOADER_PROGRESS, this.onProgressUpdate);
        event.off(event.VIEWPORT_ONRESIZE, this.resize);
    }

};

/**
 * the melonJS Logo
 * @ignore
 */
class IconLogo extends Sprite {
    constructor(x, y) {
        // TODO: create a sprite or texture from a Base64 encoded image
        var image = new Image();
        image.src = melonjs_logo;
        super(x, y, {
            image : image,
            framewidth : 256,
            frameheight : 256
        });
    }
}

/**
 * a default loading screen
 * @ignore
 */
class DefaultLoadingScreen extends Stage {
    /**
     * call when the loader is resetted
     * @ignore
     */
    onResetEvent() {
        var barHeight = 8;

        // set a background color
        world.backgroundColor.parseCSS("#202020");

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
            (renderer.getHeight() / 2)

        ), 2);
    }
};

export default DefaultLoadingScreen;
