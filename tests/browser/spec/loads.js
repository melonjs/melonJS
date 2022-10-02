import "chromedriver";
import puppeteer from "puppeteer";
import { expect } from "expect";

describe("can load the library", () => {
    it("loads", async function () {
        const page = await browser.newPage();
        await browser.newPage();
        await page.goto("http://localhost:8042/test.html");
        const melonLoaded = await page.evaluate(
            () => typeof window.me == "object" && window.me !== null
        );
        expect(melonLoaded).toBe(true);
    });
});
