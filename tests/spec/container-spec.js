describe("me.Container", function () {
    var container;

    describe("isAttachedToRoot", function () {
        describe("game world", function () {
            beforeEach(function () {
                container = new me.Container();
                container._root = true;
            });

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
    });
});
