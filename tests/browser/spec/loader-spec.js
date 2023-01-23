import { expect } from "expect";

describe("me.loader", function () {
    var page;

    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/loader_test.html", {'waitUntil':'load'});
    });

    it("configure the preloader", async () => {
        expect(await page.evaluate(() => {
            loader.crossOrigin = "anonymous";
            return loader.crossOrigin === "anonymous";
        })).toEqual(true);
    });

    it("should load supported audio assets", async () => {
        expect(await page.evaluate(() => {
            loader.load({
                    name: "silence",
                    type: "audio",
                    src: "./data/sfx/",
                },
                null,
                function() {
                    throw new Error("Failed to load `silence`");
                }
            );
            return true;
        })).toEqual(true);
    });

    it("should load base64 encoded audio assets", async () => {
        expect(await page.evaluate(() => {
            loader.load(
                {
                    name: "silence",
                    type: "audio",
                    src: audioURI,
                },
                null,
                function () {
                    throw new Error("Failed to load `silence`");
                }
            );
            return true;
        })).toEqual(true);
    });

    it("should load image asset", async () => {
        expect(await page.evaluate(() => {
            loader.load(
                {
                    name: "testimage",
                    type: "image",
                    src: "./data/img/rect.png",
                },
                null,
                function () {
                    throw new Error("Failed to load `rect.png`");
                }
            );
            return loader.getImage("testimage") !== null;
        })).toEqual(true);
    });

    it("should load base64 encoded image asset", async () => {
        expect(await page.evaluate(() => {
            loader.load(
                {
                    name: "testimage2",
                    type: "image",
                    src: imgURI,
                },
                null,
                function () {
                    throw new Error("Failed to load base64 encoded png");
                }
            );
            return loader.getImage("testimage2") !== null;
        })).toEqual(true);
    });

    it("should unload image asset", async () => {
        expect(await page.evaluate(() => {
            loader.unload({ name: "testimage", type: "image" });
            loader.unload({ name: "testimage2", type: "image" });
            return loader.getImage("testimage") === null && loader.getImage("testimage2") === null;
        })).toEqual(true);
    });
});
