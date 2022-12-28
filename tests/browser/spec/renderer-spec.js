import { expect } from "expect";

describe("Renderer test", function () {
    var page;

    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/renderer_test.html", {'waitUntil':'load'});
        
    });

    describe("Custom Renderer", async () => {
        it("should create a custom renderer", async () => {
            expect(await page.evaluate(() => globalThis.isCustomRenderer)).toEqual(true);
        });
    });
});
