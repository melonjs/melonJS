import { game } from "../index.js";
import { renderer } from "./../video/video.js";
import * as event from "./../system/event.js";
import Sprite from "./../renderable/sprite.js";
import Renderable from "./../renderable/renderable.js";
import Stage from "./../state/stage.js";
import { load, unload } from "./loader.js";
import logo_url from "./melonjs_logo.png";


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
    draw(renderer, viewport) {
        // draw the progress bar
        renderer.setColor("black");
        renderer.fillRect(this.pos.x, viewport.centerY, renderer.width, this.barHeight / 2);

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
        const barHeight = 8;

        // set a background color
        game.world.backgroundColor.parseCSS("#202020");

        // progress bar
        game.world.addChild(new ProgressBar(
            0,
            renderer.height / 2,
            renderer.width,
            barHeight
        ), 1);

        // load the melonJS logo
        load({name: "melonjs_logo", type: "image", src: logo_url}, () => {
            // melonJS logo
            game.world.addChild(new Sprite(
                renderer.width / 2,
                renderer.height / 2, {
                    image : "melonjs_logo",
                    framewidth : 256,
                    frameheight : 256
                }), 2
            );
        });
    }

    /**
     * Called by engine before deleting the object
     * @ignore
     */
    onDestroyEvent() {
        // cancel the callback
        unload({name: "melonjs_logo", type:"image"});
    }
}

export default DefaultLoadingScreen;
