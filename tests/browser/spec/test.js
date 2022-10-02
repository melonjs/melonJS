import "chromedriver";
import puppeteer from "puppeteer";
import { expect } from "expect";

describe("can load the library", () => {
    it("loads", async () => {
        const page = await browser.newPage();
        await browser.newPage();
        await page.goto("http://localhost:8042/test.html");
        expect(true).toBe(true);
    });
});
