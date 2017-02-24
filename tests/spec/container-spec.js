describe("me.Container", function () {
    var container;

    beforeEach(function () {
        container = new me.Container(0, 0, 100, 100);
        container._root = true;
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

    describe("Container bounds test", function () {
        it("me.Container bounds return default assigned size", function () {
            var bounds = container.getBounds();
            expect(bounds.pos.x).toEqual(0);
            expect(bounds.pos.y).toEqual(0);
            expect(bounds.width).toEqual(100);
            expect(bounds.height).toEqual(100);
        });

        it("me.Container childbounds return the union of all child bounds", function () {
            container.addChild(new me.Renderable(50, 50, 100, 100));
            container.addChild(new me.Renderable(100, 100, 100, 100));
            // update the child bounds
            container.updateChildBounds();
            var bounds = container.childBounds;
            expect(bounds.pos.x).toEqual(50);
            expect(bounds.pos.y).toEqual(50);
            expect(bounds.width).toEqual(150);
            expect(bounds.height).toEqual(150);
        });
    });

    describe("Container utility function", function () {
        var counter = 0;
        it("forEach iterate through all children", function () {
            container.addChild(new me.Renderable(50, 50, 100, 100));
            container.addChild(new me.Renderable(100, 100, 100, 100));
            container.forEach(function(child) {
                if (child.ancestor === container) {
                    counter++;
                }
            });
            expect(counter).toEqual(2);
        });
    });
});
