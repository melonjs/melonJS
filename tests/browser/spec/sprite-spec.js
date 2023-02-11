import { expect } from "expect";

describe("me.Sprite", function () {
    var page;
    before(async () => {
        page = await browser.newPage();
        await page.goto("http://localhost:8042/sprite_test.html", {'waitUntil':'load'});
        
    });

    describe("isAttachedToRoot", function () {
        it("me.Sprite bounds return the visible part of the sprite", async () => {
            expect(await page.evaluate(() => {
                var bounds = sprite.getBounds();
                return (bounds.x === 50 && bounds.y === 50 && bounds.width === 32 && bounds.height === 32);
            })).toEqual(true);
        });

        it("me.Sprite bounds should be updated when the sprite is scaled", async () => {
            expect(await page.evaluate(() => {
                var bounds = sprite.getBounds();
                // scale up the sprite
                sprite.scale(2.0); // w & h -> [64, 64] and position unchanged because of anchor point at 0, 0
                return (bounds.x === 50 && bounds.y === 50 && bounds.width === 64 && bounds.height === 64);
            })).toEqual(true);

            expect(await page.evaluate(() => {
                var bounds = sprite.getBounds();
                // scale back to original size
                sprite.scale(0.5);
                return (bounds.x === 50 && bounds.y === 50 && bounds.width === 32 && bounds.height === 32 && bounds.width === 32 && bounds.height === 32);
            })).toEqual(true);
        });

        it("me.Sprite bounds should be updated when the anchor is changed", async () => {
            expect(await page.evaluate(() => {
                var bounds = sprite.getBounds();
                sprite.anchorPoint.set(0, 1);
                // container pos + 0, container pos - sprite size
                return (bounds.x === 50 + 0 && bounds.y === 50 - 32);
            })).toEqual(true);

            expect(await page.evaluate(() => {
                var bounds = sprite.getBounds();
                sprite.anchorPoint.set(0.5, 0.5);
                // ontainer pos - half sprite size, container pos - half sprite size
                return (bounds.x === 50 - 16 && bounds.y === 50 - 16);
            })).toEqual(true);

            expect(await page.evaluate(() => {
                var bounds = sprite.getBounds();
                sprite.anchorPoint.set(1, 0);
                // container pos - sprite size, container pos + 0
                return (bounds.x === 50 - 32 && bounds.y === 50 + 0);
            })).toEqual(true);

            expect(await page.evaluate(() => {
                var bounds = sprite.getBounds();
                sprite.anchorPoint.set(1, 1);
                // container pos - sprite size, container pos - sprite size
                return (bounds.x === 50 - 32 && bounds.y === 50 - 32);
            })).toEqual(true);
        });

        it("me.Sprite addAnimation should return the correct amount of frame", async () => {
            expect(await page.evaluate(() => sprite.addAnimation("test", [0, 1]))).toEqual(2);
            expect(await page.evaluate(() => sprite.addAnimation("test2", [0, 1, 0, 1, 0]))).toEqual(5);
        });

        it("me.Sprite reverseAnimation should return the correct amount of frame", async () => {         
            expect(await page.evaluate(() => {
                sprite.setCurrentAnimation("test");
                sprite.anchorPoint.set(1, 1);
                // container pos - sprite size, container pos - sprite size
                return sprite.anim["test"].frames[0].name === 0 && sprite.anim["test"].frames[1].name === 1;
            })).toEqual(true);

            expect(await page.evaluate(() => {
                sprite.reverseAnimation("test");
                sprite.anchorPoint.set(1, 1);
                // container pos - sprite size, container pos - sprite size
                return sprite.anim["test"].frames[0].name === 1 && sprite.anim["test"].frames[1].name === 0;
            })).toEqual(true);

            expect(await page.evaluate(() => {
                sprite.reverseAnimation();
                sprite.anchorPoint.set(1, 1);
                // container pos - sprite size, container pos - sprite size
                return sprite.anim["test"].frames[0].name === 0 && sprite.anim["test"].frames[1].name === 1;
            })).toEqual(true);
        });

        it("me.Sprite isCurrentAnimation allows to verify which animation is set", async () => {    
            expect(await page.evaluate(() => sprite.addAnimation("yoyo", [1, 0, 1, 0], 60))).toEqual(4);

            expect(await page.evaluate(() => {
                sprite.setCurrentAnimation("test");
                return sprite.isCurrentAnimation("test");
            })).toEqual(true);

            expect(await page.evaluate(() => {
                sprite.setCurrentAnimation("yoyo", "test");
                return sprite.isCurrentAnimation("test") === false && sprite.isCurrentAnimation("yoyo") === true;
            })).toEqual(true);

            expect(await page.evaluate(() => {
                for (var i = -1; i < 8; i++) {
                    sprite.update(16);
                }
                return sprite.isCurrentAnimation("yoyo")
            })).toEqual(true);

            expect(await page.evaluate(() => {
                for (var j = -1; j < 8; j++) {
                    sprite.update(16);
                }
                return sprite.isCurrentAnimation("test") === true && sprite.isCurrentAnimation("yoyo") === false;
            })).toEqual(true);
        });
    });
});
