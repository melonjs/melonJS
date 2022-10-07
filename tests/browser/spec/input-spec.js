import { expect } from "expect";
import * as me from "./../public/lib/melonjs.module.js";

describe("me.input", function () {
    var renderable;
    var evenType;
    before(function () {
        renderable = new me.Renderable(0, 0, 32, 32);
        renderable.isKinematic = false;
    });

    
    describe("Pointer Event", function () {
        // skipping this one for now as it needs total rewrite to work with Puppeteer
        xit("PointerDown event triggering", function (done) {
            // Add renderable to the world
            me.game.world.addChild(renderable);

            // clear the quadtree
            me.game.world.broadphase.clear();

            // insert the world container (children) into the quadtree
            me.game.world.broadphase.insertContainer(me.game.world);

            // register on pointer down
            me.input.registerPointerEvent(
                "pointerdown",
                renderable,
                function () {
                    // Cleanup
                    me.input.releasePointerEvent("pointerdown", renderable);
                    me.game.world.removeChildNow(renderable);
                    me.game.world.broadphase.clear();

                    // Assure Jasmine that everything is alright
                    expect(true).toBe(true);
                    done();
                }
            );

            // Create the event.
            var event = new CustomEvent(evenType);

            // configure the event
            event.pointerId = 1;
            event.clientX = event.pageX = 10;
            event.clientY = event.pageY = 10;
            event.width = 1;
            event.height = 1;
            event.isPrimary = true;
            event.timeStamp = undefined;

            // dispatch the event
            me.video.renderer.getCanvas().dispatchEvent(event);
        });
    });
});
