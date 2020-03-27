describe("me.Camera2d", function () {

    it("convert between local and World coords without transforms", function () {
        // default camera
        var camera = new me.Camera2d(0, 0, 1000, 1000);
        var result = new me.Vector2d();

        // update position so that it's not just 0
        camera.move(100, 100);
        // convert to word coordinates
        camera.localToWorld(250, 150, result);
        // convert back to local coordinates
        camera.worldToLocal(result.x, result.y, result);

        expect( result.x ).toBeCloseTo(250);
        expect( result.y ).toBeCloseTo(150);
    });

    it("convert between local and World coords with transforms", function () {
        // default camera
        var camera = new me.Camera2d(0, 0, 1000, 1000);
        var result = new me.Vector2d();

        // update position so that it's not just 0
        camera.move(100, 100);
        // rotate the viewport
        camera.currentTransform.rotate(0.5);
        // make sure the camera go through one round of update
        camera.update(0.16);
        // convert to word coordinates
        camera.localToWorld(250, 150, result);
        // convert back to local coordinates
        camera.worldToLocal(result.x, result.y, result);

        expect( result.x ).toBeCloseTo(250);
        expect( result.y ).toBeCloseTo(150);
    });

    it("isVisible function test", function () {
        // default camera
        var camera = new me.Camera2d(0, 0, 1000, 1000);
        var obj = new me.Renderable(0, 0, 10, 10);

        // check if obj is visible
        expect(camera.isVisible(obj)).toEqual(true);
        // move the object half-way over the camera origin point
        obj.pos.set(-5, -5, 0);
        // check if obj is visible
        expect(camera.isVisible(obj)).toEqual(true);
        // change camera position so that the object is not visible anymore
        camera.move(100, 100);
        // check if obj is visible
        expect(camera.isVisible(obj)).toEqual(false);
        // set as floating
        obj.floating = true;
        // should be visible again
        expect(camera.isVisible(obj)).toEqual(true);

    });
});
