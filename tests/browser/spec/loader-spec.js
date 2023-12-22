import { expect } from "expect";

describe("me.loader", function () {
    var page;

    before(async () => {
        page = await browser.newPage();
        await page.setBypassCSP(true);
        await page.goto("http://localhost:8042/loader_test.html", {'waitUntil':'load'});
        await page.waitForNetworkIdle();
    });

    it("configure the preloader", async () => {
        expect(await page.evaluate(() => {
            loader.crossOrigin = "anonymous";
            return loader.crossOrigin === "anonymous";
        })).toEqual(true);
    });

    it("should load supported audio assets", async () => {
        expect(await page.evaluate(() => {
            return new Promise((resolve, reject) => {
                loader.load(
                    {
                        name: "silence",
                        type: "audio",
                        src: "./data/sfx/",
                    },
                    function () {
                        resolve(true);
                    },
                    function () {
                        reject(new Error("Failed to load `rect.png`"));
                    }
                );
            });
        })).toEqual(true);
    });

    it("should load base64 encoded audio assets", async () => {
        expect(await page.evaluate(() => {
            return new Promise((resolve, reject) => {
                loader.load(
                    {
                        name: "silence2",
                        type: "audio",
                        src: audioURI,
                    },
                    function () {
                        resolve(true);
                    },
                    function () {
                        reject(new Error("Failed to load `rect.png`"));
                    }
                );
            });
        })).toEqual(true);
    });

    it("should load image asset", async () => {
        expect(await page.evaluate(() => {
            return new Promise((resolve, reject) => {
                loader.load(
                    {
                        name: "testimage",
                        type: "image",
                        src: "./data/img/rect.png",
                    },
                    function () {
                        resolve(loader.getImage("testimage") !== null);
                    },
                    function () {
                        reject(new Error("Failed to load `rect.png`"));
                    }
                );
            });
        })).toEqual(true);
    });

    it("should load base64 encoded image asset", async () => {
        expect(await page.evaluate(() => {
            return new Promise((resolve, reject) => {
                loader.load(
                    {
                        name: "testimage2",
                        type: "image",
                        src: imgURI,
                    },
                    function () {
                        resolve(loader.getImage("testimage2") !== null);
                    },
                    function () {
                        reject(new Error("Failed to load `rect.png`"));
                    }
                );
            });
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
