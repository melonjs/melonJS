import { expect } from "expect";
import { boot, video, Camera2d, Vector2d, Renderable } from "./../public/melon/melonjs.module.js";

describe("me.Camera2d", function () {
    var page;
    var camera;
    var result;

    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/test.html");
        
        await page.on('load', () => {
            boot();
            video.init(800, 600, {parent : "screen", scale : "auto", renderer : video.AUTO});
        });
    });


    beforeEach(function () {
        camera = new Camera2d(0, 0, 1000, 1000);
        result = new Vector2d();
    });

    it("convert between local and World coords without transforms", function () {
        // update position so that it's not just 0
        camera.move(100, 100);
        // convert to word coordinates
        camera.localToWorld(250, 150, result);
        // convert back to local coordinates
        camera.worldToLocal(result.x, result.y, result);

        expect(result.x).toBeCloseTo(250);
        expect(result.y).toBeCloseTo(150);
    });

    it("convert between local and World coords with transforms", function () {
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

        expect(result.x).toBeCloseTo(250);
        expect(result.y).toBeCloseTo(150);
    });

    it("isVisible function test", function () {
        var infiniteCamera = new Camera2d(
            -Infinity,
            -Infinity,
            Infinity,
            Infinity
        );

        // object to test for visibility
        var obj = new Renderable(0, 0, 10, 10);

        // make it easier by setting anchor point to 0, 0
        obj.anchorPoint.set(0, 0);

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

        // should always be visible if camera size is Infinite
        obj.floating = false;
        expect(infiniteCamera.isVisible(obj)).toEqual(true);
        // should always be visible if camera size is Infinite
        obj.floating = true;
        expect(infiniteCamera.isVisible(obj)).toEqual(true);
    });
});
