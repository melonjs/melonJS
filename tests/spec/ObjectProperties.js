describe("Object Properties", function () {
  
    var AnchoredRenderable = me.Renderable.extend({
        anchorPoint : new me.Vector2d(0.5, 1.0)
    });

    describe("AnchoredRenderable", function () {
        it("is anchored at 0.5,1.0", function () {
            var obj = new AnchoredRenderable(new me.Vector2d(), 20, 20);
            expect(obj.anchorPoint.x).toEqual(0.5);
            expect(obj.anchorPoint.y).toEqual(1.0);
        });
    });
});
