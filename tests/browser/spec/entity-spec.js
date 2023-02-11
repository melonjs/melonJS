import { expect } from "expect";

describe("Entity", function () {
    var page;

    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/entity_test.html", {'waitUntil':'load'});
    });

    it("has an empty set of shapes", async () => {
        expect(await page.evaluate(() => globalThis.entity.body.shapes.length)).toEqual(0);
    });

    it("has a first shape", async () => {
        await page.evaluate(() => {
            globalThis.entity.body.addShape(defaultRectShape);
        });
        expect(await page.evaluate(() => globalThis.entity.body.shapes.length)).toEqual(1);
    });

    it("has the correct body bounds: A", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.body.getBounds();
            return (bounds.x === 10 && bounds.y === 10 && bounds.width === 32 && bounds.height === 64);
        })).toEqual(true);
    });

    it("has the correct renderable bounds: A", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.renderable.getBounds();
            return (bounds.x === 0 && bounds.y === 0 && bounds.width === 32 && bounds.height === 64);
        })).toEqual(true);
    });

    it("has the correct entity bounds: A", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.getBounds();
            return (bounds.x === 0 && bounds.y === 0 && bounds.width === 42 && bounds.height === 74);
        })).toEqual(true);
    });

    it("has a second shape", async () => {
        await page.evaluate(() => {
            globalThis.entity.body.addShape(defaultRectShape.clone().setShape(-10, -10, 32, 64));
        });
        expect(await page.evaluate(() => globalThis.entity.body.shapes.length)).toEqual(2);
    });

    it("has the correct body bounds: B", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.body.getBounds();
            return (bounds.x === -10 && bounds.y === -10 && bounds.width === 42 && bounds.height === 74);
        })).toEqual(true);
    });

    it("has the correct renderable bounds: B", async () => {
        expect(await page.evaluate(() => {
            var renderable = globalThis.entity.renderable
            return (renderable.pos.x === 0 && renderable.pos.y === 0 && renderable.width === 32 && renderable.height === 64);
        })).toEqual(true);
    });


    it("has the correct entity bounds: B", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.getBounds();
            return (bounds.x === -10 && bounds.y === -10 && bounds.width === 42 && bounds.height === 74);
        })).toEqual(true);
    });

    it("removes the second shape", async () => {
        expect(await page.evaluate(() => {
            return globalThis.entity.body.removeShapeAt(1);
        })).toEqual(1);
    });

    it("has the correct body bounds: C", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.body.getBounds();
            return (bounds.x === 10 && bounds.y === 10 && bounds.width === 32 && bounds.height === 64);
        })).toEqual(true);
    });

    it("has the correct renderable bounds: C", async () => {
        expect(await page.evaluate(() => {
            var renderable = globalThis.entity.renderable
            return (renderable.pos.x === 0 && renderable.pos.y === 0 && renderable.width === 32 && renderable.height === 64);
        })).toEqual(true);
    });


    it("has the correct entity bounds: C", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.getBounds();
            return (bounds.x === 0 && bounds.y === 0 && bounds.width === 42 && bounds.height === 74);
        })).toEqual(true);
    });


    it("has the correct entity geometry: C", async () => {
        expect(await page.evaluate(() => {
            return (globalThis.entity.pos.x === 0 && globalThis.entity.pos.y === 0 && globalThis.entity.width === 32 && globalThis.entity.height === 64);
        })).toEqual(true);
    });

    it("moves properly", async () => {
        expect(await page.evaluate(() => {
            globalThis.entity.pos.set(120, 150);
            return (globalThis.entity.pos.x === 120 && globalThis.entity.pos.y === 150);
        })).toEqual(true);
    });

    it("has the correct body bounds: D", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.body.getBounds();
            return (bounds.x === 10 && bounds.y === 10 && bounds.width === 32 && bounds.height === 64);
        })).toEqual(true);
    });

    it("has the correct renderable bounds: D", async () => {
        expect(await page.evaluate(() => {
            var renderable = globalThis.entity.renderable;
            return (renderable.pos.x === 0 && renderable.pos.y === 0 && renderable.width === 32 && renderable.height === 64);
        })).toEqual(true);
    });

    it("has the correct entity bounds: D", async () => {
        expect(await page.evaluate(() => {
            var bounds = globalThis.entity.getBounds();
            return (bounds.x === 120 && bounds.y === 150 && bounds.width === 42 && bounds.height === 74);
        })).toEqual(true);
    });

});
