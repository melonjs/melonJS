import { expect } from "expect";

describe("Font : me.Text", () => {
    var page;
    
    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/font_test.html", {'waitUntil':'load'});
    });

    describe("font set Size", async () => {

        it("default font size is '8'", async () => {
            expect(await page.evaluate(() => globalThis.font.height)).toEqual(8);
        });

        it("default font size is '10'", async () => {
            await page.evaluate(() => globalThis.font.setFont("Arial", "10"));
            expect(await page.evaluate(() => globalThis.font.height)).toEqual(10);
        });

        it("set font size to 12px", async () => {
            await page.evaluate(() => font.setFont("Arial", "12px"));
            expect(await page.evaluate(() => globalThis.font.height)).toEqual(12);
        });

        it("set font size to 2ex", async () => {
            await page.evaluate(() => font.setFont("Arial", "2ex"));
            expect(await page.evaluate(() => globalThis.font.height)).toEqual(2 * 12);
        });

        it("set font size to 1.5em", async () => {
            await page.evaluate(() => font.setFont("Arial", "1.5em"));
            expect(await page.evaluate(() => globalThis.font.height)).toEqual(1.5 * 24);
        });

        it("set font size to 18pt", async () => {
            await page.evaluate(() => font.setFont("Arial", "18pt"));
            expect(await page.evaluate(() => globalThis.font.height)).toEqual(18 * 0.75);
        });
    });

    describe("word wrapping", () => {
        it("word wrap a single string", async () => {
            await page.evaluate(() => {
                globalThis.font.wordWrapWidth = 150;
                globalThis.font.setText(
                    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                );
            });
            expect(
                await page.evaluate(() => globalThis.font.measureText().width)
            ).toBeLessThanOrEqual(
                await page.evaluate(() => globalThis.font.wordWrapWidth)
            );
        });
    });
});
