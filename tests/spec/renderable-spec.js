describe("me.Renderable", function () {
    describe("bounds updates", function () {
        var renderable;
        beforeEach(function () {
            renderable = new me.Renderable(50, 50, 100, 100);
            renderable.anchorPoint.set(0, 0);
        });

        it("setting x, y position changes bounds pos", function () {
            renderable.pos.x = 10;
            expect(renderable.getBounds().x).toEqual(10);
            renderable.pos.y = 120;
            expect(renderable.getBounds().y).toEqual(120);
        });


        it("resizing the renderable changes its bounds width", function () {
            renderable.resize(20, 20);
            expect(renderable.getBounds().width).toEqual(20);
        });

        it("resizing the renderable changes its bounds height", function () {
            renderable.resize(20, 20);
            expect(renderable.getBounds().height).toEqual(20);
        });
    });

    describe("getAbsoluteBounds returns the correct value", function () {

        var rootContainer;
        var childContainer;
        var renderable;
        beforeAll(function () {
            rootContainer = new me.Container(0, 0, 1000, 1000, true);
            childContainer = new me.Container(100, 100, 500, 500);
            renderable = new me.Renderable(50, 50, 50, 50);
            renderable.anchorPoint.set(0, 0);
        });

        it("create and add a child container to the root container", function () {
            rootContainer.addChild(childContainer);
            expect(childContainer.isAttachedToRoot()).toEqual(true);
        });

        it("renderable should have a correct absolute position once added", function () {
            childContainer.addChild(renderable);
            expect(renderable.getBounds().x).toEqual(150);
            expect(renderable.getBounds().y).toEqual(150);
        });

        it("changing the renderable position, change the absolute pos", function () {
            renderable.pos.set(200, 100, 0);
            expect(renderable.getBounds().x).toEqual(300);
            expect(renderable.getBounds().y).toEqual(200);
        });

        it("changing the parent container position, also change the renderable absolute pos", function () {
            childContainer.shift(200, 300);
            expect(renderable.getBounds().x).toEqual(400); // 200 + 200
            expect(renderable.getBounds().y).toEqual(400); // 100 + 300
        });

        it("renderable in a floating container", function () {
            expect(renderable.isFloating).toEqual(false);
            childContainer.floating = true;
            expect(renderable.isFloating).toEqual(true);
        });

        it("floating renderable in a container", function () {
            childContainer.floating = false;
            renderable.floating = true;
            expect(renderable.isFloating).toEqual(true);
        });
    });
});
