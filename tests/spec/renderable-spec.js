describe("me.Renderable", function () {
    describe("bounds updates", function () {
        var renderable;
        beforeEach(function () {
            renderable = new me.Renderable(50, 50, 100, 100);
        });

        it("setting x position changes x bounds", function () {

            var xAnchor = renderable.anchorPoint.x;
            var bounds = renderable.getBounds();

            renderable.pos.x = 10;
            var expectX = renderable.pos.x - (xAnchor * bounds.width)

            expect(renderable.getBounds().pos.x).toEqual(expectX);
        });

        it("setting y position changes y bounds", function () {

            var yAnchor = renderable.anchorPoint.y;
            var bounds = renderable.getBounds();

            renderable.pos.y = 120;
            var expectY = renderable.pos.y - (yAnchor * bounds.height)

            expect(renderable.getBounds().pos.y).toEqual(expectY);
        });

        it("resizing the renderable changes its bounds width", function () {
            renderable.resize(20, 20);
            expect(renderable.getBounds().width).toEqual(20);
        });

        it("bounds should be updated when renderable is scaled", function () {
            var bounds = renderable.getBounds();
            // scale the sprite
            renderable.scale(2.0); // w & h -> 64, 64
            expect(bounds.width).toEqual(200);
            expect(bounds.height).toEqual(200);

            renderable.scale(1.0); // back to original size
            expect(bounds.width).toEqual(100);
            expect(bounds.height).toEqual(100);
        });

        it("resizing the renderable changes its bounds height", function () {
            renderable.resize(20, 30);
            expect(renderable.getBounds().height).toEqual(30);
        });

    });

    describe("getAbsoluteBounds returns the correct value", function () {

        var rootContainer;
        var childContainer;
        var renderable;
        beforeAll(function () {
            rootContainer = new me.Container(0, 0, 1000, 1000);
            childContainer = new me.Container(100, 100, 500, 500);
            renderable = new me.Renderable(50, 50, 50, 50);
        });

        it("create and add a child container to the root container", function () {
            rootContainer._root = true;
            rootContainer.addChild(childContainer);
            expect(childContainer.isAttachedToRoot()).toEqual(true);
        });

        it("renderable should have a correct absolute position once added", function () {

            childContainer.addChild(renderable);

            var bounds = renderable.getBounds();
            var xAnchor = renderable.anchorPoint.x;
            var expectX = childContainer.pos.x + (renderable.pos.x - (xAnchor * bounds.width))

            expect(renderable.getBounds().pos.x).toEqual(expectX);
        });

        it("changing the renderable position, change the absolute pos", function () {
            
            var yAnchor = renderable.anchorPoint.y;
            var xAnchor = renderable.anchorPoint.x;

            var bounds = renderable.getBounds();

            renderable.pos.set(200, 100, 0);
            var expectX = childContainer.pos.x + renderable.pos.x - (xAnchor * bounds.width)
            var expectY = childContainer.pos.y + renderable.pos.y - (yAnchor * bounds.width)

            expect(renderable.getBounds().pos.x).toEqual(expectX);
            expect(renderable.getBounds().pos.y).toEqual(expectY);
        });

        it("changing the parent container position, also change the renderable absolute pos", function () {
            childContainer.pos.set(200, 200, 0);

            var bounds = renderable.getBounds();

            var xAnchor = renderable.anchorPoint.x;
            var yAnchor = renderable.anchorPoint.y;

            var expectX = childContainer.pos.x + (renderable.pos.x - (xAnchor * bounds.width))
            var expectY = childContainer.pos.y + (renderable.pos.y - (yAnchor * bounds.width))

            expect(renderable.getBounds().pos.x).toEqual(expectX);
            expect(renderable.getBounds().pos.y).toEqual(expectY);
        });
    });
});
