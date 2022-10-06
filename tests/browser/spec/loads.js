import "chromedriver";
import { expect } from "expect";
import { device } from "../public/melon/melonjs.module.js";

describe("can load the library", () => {
    it("loads", async function () {
        const page = await browser.newPage();
        await page.goto("http://localhost:8042/test.html", {'waitUntil':'load'});

        const melonLoaded = await page.evaluate(()=> {
            device.onReady(() => {
                done();
            });
        });
        expect(melonLoaded).toBe(true);
    });
});
