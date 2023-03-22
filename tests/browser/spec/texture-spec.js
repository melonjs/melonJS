import { expect } from "expect";
import * as me from "./../public/lib/melonjs.module.js";

describe("Texture", function () {
    var page;
    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/texture_test.html", {'waitUntil':'load'});
        
    });


    describe("CanvasTexture", function () {
        it("convertToBlob() should return a Blob when using a regular canvas", async () => {
            expect(await page.evaluate(() => {
                globalThis.texture_canvas.convertToBlob().then((blob) => { 
                    expect(blob).toBeInstanceOf(window.Blob);
                });
            }))
        });

        it("convertToBlob() should return a Blob when using a offscreenCanvas", async () => {
            expect(await page.evaluate(() => {
                globalThis.texture_offscreencanvas.convertToBlob().then((blob) => { 
                    expect(blob).toBeInstanceOf(window.Blob);
                });
            }))
        });
    });
});
