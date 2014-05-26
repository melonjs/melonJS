describe("Object Properties", function () {
    describe("AnchoredRenderable", function () {
        it("throws an exception, because properties cannot be defined on the prototype", function () {
            expect(function () {
                me.Renderable.extend({
                    anchorPoint : new me.Vector2d(0.5, 1.0)
                });
            }).toThrow();
        });
    });
});