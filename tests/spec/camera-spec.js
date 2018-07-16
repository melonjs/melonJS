describe("me.Camera2d", function () {

    beforeEach(function () {
        // update position so that it's not just 0
        me.game.viewport.move(100, 100);
    });

    afterEach(function () {
        // move back to default 0,0 position
        me.game.viewport.moveTo(0, 0);
    });

    it("convert between local and World coords without transforms", function () {
        var result = new me.Vector2d();
        // convert to word coordinates
        me.game.viewport.localToWorld(250, 150, result);
        // convert back to local coordinates
        me.game.viewport.worldToLocal(result.x, result.y, result);

        expect( result.x ).toBeCloseTo(250);
        expect( result.y ).toBeCloseTo(150);
    });

    it("convert between local and World coords with transforms", function () {
        var result = new me.Vector2d();

        // rotate the viewport
        me.game.viewport.currentTransform.rotate(0.5);

        // convert to word coordinates
        me.game.viewport.localToWorld(250, 150, result);
        // convert back to local coordinates
        me.game.viewport.worldToLocal(result.x, result.y, result);

        expect( result.x ).toBeCloseTo(250);
        expect( result.y ).toBeCloseTo(150);
    });
});
