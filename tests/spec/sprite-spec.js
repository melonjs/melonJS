describe("me.Sprite", function () {
    var container = new me.Container(50, 50, 150, 150);
    var sprite = new me.Sprite(0, 0, {
            "width" : 32,
            "height" : 32,
            "image" : me.video.createCanvas(32, 32)
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

    // TODO: add bounds testing when transformation are added

});
