describe("me.input", function () {
    var renderable = new me.Sprite(0, 0, {
                "framewidth" : 32,
                "frameheight" : 32,
                "image" : me.video.createCanvas(64, 64)
    });

    renderable.pointerEventHandler = function (e) {
        // add a test flag to our renderable
        this._eventTriggered = true;
    }

    me.game.world.addChild(renderable);

    describe("Pointer Event", function () {

        // reset the flag
        renderable._eventTriggered = false;

        // register on pointer down
        me.input.registerPointerEvent("pointerdown", renderable, renderable.pointerEventHandler.bind(renderable));

        it("PointerDown event triggering", function () {
            /*
            var event = new CustomEvent(
                "customevent", {
                    type : "pointerdown",
                    pointerId : 1,
                    clientX : 10,
                    clientY : 10,
                    width : 1,
                    height : 1,
                    isPrimary : true,
                    bubbles: true,
                    cancelable: true
                }
            );
            */
            // Create the event.
            var event = document.createEvent("Event");

            // Define that the event name is 'build'.
            event.initEvent("customevent", true, true);
            // configure the event
            event.type = "pointerdown";
            event.pointerId = 1;
            event.clientX = 10;
            event.clientY = 10;
            event.width = 1;
            event.height = 1;
            event.isPrimary = true;
            event.timeStamp = undefined;

            // dispatch the event
            me.video.renderer.getScreenCanvas().dispatchEvent(event);
            expect(renderable._eventTriggered).toEqual(true);
        });
    });
});
