describe("me.Container", function () {
    var container;

    beforeEach(function () {
        container = new me.Container(0, 0, 100, 100, true);
    });

    describe("isAttachedToRoot", function () {
        it("should return true", function () {
            expect(container.isAttachedToRoot()).toEqual(true);
        });

        it("a new container should not be root", function () {
            var secondContainer = new me.Container();
            expect(secondContainer.isAttachedToRoot()).toEqual(false);
        });

        it("a new container when attached to game world should find root", function () {
            var secondContainer = new me.Container();
            container.addChild(secondContainer);
            expect(secondContainer.isAttachedToRoot()).toEqual(true);
        });
    });

    describe("object absolute position in containers", function () {

        it("should return 50,50 for renderable container", function () {
            var renderable = new me.Renderable(50, 50, 100, 100)

            expect(container.getAbsolutePosition().x).toEqual(0);
            expect(container.getAbsolutePosition().y).toEqual(0);

            container.addChild(renderable);

            expect(renderable.getAbsolutePosition().x).toEqual(50);
            expect(renderable.getAbsolutePosition().y).toEqual(50);

        });

        it("should return proper value for object in nested containers", function () {
            var secondContainer = new me.Container(10, 10, 100, 100);
            var thirdContainer = new me.Container(10, 10, 100, 100);
            var renderable = new me.Renderable(50, 50, 100, 100)

            secondContainer.addChild(thirdContainer);
            container.addChild(secondContainer);

            thirdContainer.addChild(renderable);

            var absPos = renderable.getAbsolutePosition();
            expect(absPos.x).toEqual(70);
            expect(absPos.y).toEqual(70);
        });

    });

    describe("Container bounds test", function () {
        it("me.Container bounds return default assigned size", function () {
            var bounds = container.getBounds();
            expect(bounds.x).toEqual(0);
            expect(bounds.y).toEqual(0);
            expect(bounds.width).toEqual(100);
            expect(bounds.height).toEqual(100);
        });

        it("me.Container bounds return the union of all child bounds if enabled", function () {
            container.enableChildBoundsUpdate = true;
            container.addChild(new me.Renderable(50, 50, 100, 100));
            container.addChild(new me.Renderable(100, 100, 100, 100));

            var bounds = container.getBounds();
            expect(bounds.x).toEqual(0); // because of default 0.5 anchor point
            expect(bounds.y).toEqual(0); // because of default 0.5 anchor point
            expect(bounds.width).toEqual(150);  // because of default 0.5 anchor point
            expect(bounds.height).toEqual(150);  // because of default 0.5 anchor point
        });
    });

    describe("Container utility function", function () {
        it("forEach iterate through all children", function () {
            var counter = 0;
            container.addChild(new me.Renderable(50, 50, 100, 100));
            container.addChild(new me.Renderable(100, 100, 100, 100));
            container.forEach(function(child) {
                if (child.ancestor === container) {
                    counter++;
                }
            });
            expect(counter).toEqual(2);
        });
        it("onChildChange callback", function () {
            var counter = 0;
            container.onChildChange = function (index) {
                // just count how many times this one is called
                counter ++;
            };
            container.addChild(new me.Renderable(50, 50, 100, 100));
            container.addChild(new me.Renderable(100, 100, 100, 100));
            container.removeChildNow(container.getChildAt(0));
            expect(counter).toEqual(3);
        });
    });
});
