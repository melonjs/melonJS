describe("me.input", function () {
    var renderable;
    var evenType;
    beforeAll(function () {
        renderable = new me.Entity(0, 0, {
            "width" : 32,
            "height" : 32
        });
        if (me.device.PointerEvent) {
            evenType = "pointerdown";
        } else {
            evenType ="mousedown"
        }
    });

    describe("Pointer Event", function () {

        it("PointerDown event triggering", function (done) {

            // Add renderable to the world
            me.game.world.addChild(renderable);

            // clear the quadtree
            me.game.world.broadphase.clear();

            // insert the world container (children) into the quadtree
            me.game.world.broadphase.insertContainer(me.game.world);

            // register on pointer down
            me.input.registerPointerEvent("pointerdown", renderable, function () {
                // Cleanup
                me.input.releasePointerEvent("pointerdown", renderable);
                me.game.world.removeChildNow(renderable);
                me.game.world.broadphase.clear();

                // Assure Jasmine that everything is alright
                expect(true).toBe(true);
                done();
            });

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
            me.video.renderer.getScreenCanvas().dispatchEvent(event);
        });
    });
});
