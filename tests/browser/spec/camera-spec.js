import { expect } from "expect";

describe("me.Camera2d", function () {
    var page;

    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/camera_test.html", {'waitUntil':'load'});
    });

    it("convert between local and World coords without transforms", async () => {
        await page.evaluate(() => {
            // reset the camera
            camera.reset(0, 0);
            // update position so that it's not just 0
            camera.move(100, 100);
            // convert to word coordinates
            camera.localToWorld(250, 150, result);
            // convert back to local coordinates
            camera.worldToLocal(result.x, result.y, result);
        });
        expect(await page.evaluate(() => result.x)).toBeCloseTo(250);
        expect(await page.evaluate(() => result.y)).toBeCloseTo(150);
    });

    it("convert between local and World coords with transforms", async () => {
        await page.evaluate(() => {
            // reset the camera
            camera.reset(0, 0);
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
        });
        expect(await page.evaluate(() => result.x)).toBeCloseTo(250);
        expect(await page.evaluate(() => result.y)).toBeCloseTo(150);
    });

    it("isVisible function test", async () => {

        await page.evaluate(() => {
            // reset the camera
            camera.reset(0, 0);
        });

        await page.evaluate(() => {
            // make it easier by setting anchor point to 0, 0
            renderable10x10.anchorPoint.set(0, 0);
        });
        // check if obj is visible
        expect(await page.evaluate(() => camera.isVisible(renderable10x10))).toEqual(true);

        await page.evaluate(() => {
            // move the object half-way over the camera origin point
            renderable10x10.pos.set(-5, -5, 0);
        });
        // check if obj is visible
        expect(await page.evaluate(() => camera.isVisible(renderable10x10))).toEqual(true);

        await page.evaluate(() => {
            // change camera position so that the object is not visible anymore
            camera.move(100, 100);
        });
        // check if obj is visible
        expect(await page.evaluate(() => camera.isVisible(renderable10x10))).toEqual(false);

        await page.evaluate(() => {
            // set as floating
            renderable10x10.floating = true;
        });
        // should be visible again
        expect(await page.evaluate(() => camera.isVisible(renderable10x10))).toEqual(true);

        await page.evaluate(() => {
            // should always be visible if camera size is Infinite
            renderable10x10.floating = false;
        });
        expect(await page.evaluate(() => infiniteCamera.isVisible(renderable10x10))).toEqual(true);

        await page.evaluate(() => {
            // should always be visible if camera size is Infinite
            renderable10x10.floating = true;
        });
        expect(await page.evaluate(() => infiniteCamera.isVisible(renderable10x10))).toEqual(true);
    });
});
