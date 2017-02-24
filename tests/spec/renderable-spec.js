describe("me.Renderable", function () {
    describe("bounds updates", function () {
        var renderable;
        beforeEach(function () {
            renderable = new me.Renderable(50, 50, 100, 100);
        });

        it("setting x position changes x bounds", function () {
            renderable.pos.x = 10;
            expect(renderable.getBounds().pos.x).toEqual(10);
        });

        it("setting y position changes y bounds", function () {
            renderable.pos.y = 120;
            expect(renderable.getBounds().pos.y).toEqual(120);
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
        var rootContainer = new me.Container(0, 0, 1000, 1000);
        var childContainer = new me.Container(100, 100, 500, 500);
        var renderable = new me.Renderable(50, 50, 50, 50);

        it("create and add a child container to the root container", function () {
            rootContainer._root = true;
            rootContainer.addChild(childContainer);
            expect(childContainer.isAttachedToRoot()).toEqual(true);
        });

        it("renderable should have a correct absolute position once added", function () {
            childContainer.addChild(renderable);
            expect(renderable.getBounds().pos.x).toEqual(150);
            expect(renderable.getBounds().pos.y).toEqual(150);
        });

        it("changing the renderable position, change the absolute pos", function () {
            renderable.pos.set(200, 100, 0);
            expect(renderable.getBounds().pos.x).toEqual(300);
            expect(renderable.getBounds().pos.y).toEqual(200);
        });

        it("changing the parent container position, also change the renderable absolute pos", function () {
            childContainer.pos.set(200, 200, 0);
            expect(renderable.getBounds().pos.x).toEqual(400);
            expect(renderable.getBounds().pos.y).toEqual(300);
        });
    });
});
