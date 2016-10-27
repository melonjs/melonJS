describe("me.Sprite", function () {
    var container = new me.Container(50, 50, 150, 150);
    var sprite = new me.Sprite(0, 0, {
            "framewidth" : 32,
            "frameheight" : 32,
            "image" : me.video.createCanvas(64, 64)
    });

    // add to a parent container
    container.addChild(sprite);

    it("me.Sprite bounds return the visible part of the sprite", function () {
        var bounds = sprite.getBounds();
        expect(bounds.pos.x).toEqual(50);
        expect(bounds.pos.y).toEqual(50);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(32);
    });

    it("me.Sprite addAnimation should return the correct amount of frame", function () {
        expect(sprite.addAnimation("test", [ 0, 1 ])).toEqual(2);
    });

    it("me.Sprite isCurrentAnimation allows to verify which animation is set", function () {
        expect(sprite.addAnimation("reverse_test", [ 1, 0 ])).toEqual(2);
        sprite.setCurrentAnimation("reverse_test");
        expect(sprite.isCurrentAnimation("reverse_test")).toEqual(true);
        expect(sprite.isCurrentAnimation("test")).toEqual(false);
    });

    it("me.Sprite bounds should be updated when the sprite is scaled", function () {
        var bounds = sprite.getBounds();
        // scale the sprite
        sprite.scale(2.0); // w & h -> 64, 64
        expect(bounds.width).toEqual(64);
        expect(bounds.height).toEqual(64);
    });
});
